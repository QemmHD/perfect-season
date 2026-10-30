import { Rivals, RivalsTeaser } from './Rivals';
import { recordActivity, claimObjective, claimSeason, claimReadySeason, hqOf, objectiveDeck, rewardLabel, type Prize } from './progression';
import { PlayHQ, SeasonView, ObjectivesView, CircuitView, DevelopmentView, SquadPresets, ClubRecords } from './Clubhouse';
import { Moments } from './Moments';
import { claimMoment, finishMoment } from './moments';
import { startCircuit, abandonCircuit } from './circuit';
import { savePreset, loadPreset, startDevelopment, cancelDevelopment, claimDevelopment } from './club-management';
import './clubhouse.css';
// Ultimate Team: the mode's own screen, with its own tabs (hub, squad, club, store, challenges).
// It keeps everything in the profile's `ut` (this sport's) and spends the profile's coins. The
// card pool loads when the screen opens. App.tsx only routes here (screen 'ut').
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { easternDateKey } from '../engine/season';
import { NFL, SPORT } from '../engine/sport';
import { newId, saveProfile, type Profile } from '../lib/profile';
import { reloadForMissingFiles } from '../lib/update';
import { sfx, vibrate } from '../lib/sound';
import { NET_ON } from '../net/nostr';
import { CoinChip } from '../ui/common';
import { Back } from '../ui/icons';
import { Battles } from './Battles';
import { CardDetail } from './CardDetail';
import { Challenges } from './Challenges';
import { Club } from './Club';
import { Hub } from './Hub';
import { IconClub, IconHub, IconSbc, IconSquad, IconStore } from './icons';
import { PackOpening } from './PackOpening';
import { openPack, packDefs, packName, quickSellValue } from './packs';
import type { PlaySquad } from './play';
import { getPool, type Pool, ratedOf } from './pool';
import { battlesThisWeek } from './battles';
import { checkSbc, rewardCard, type Sbc, sbcsFor, weekOf } from './sbc';
import { autoBuild, canPlay, type Lineup, rateSquad, slotsFor, startersComplete } from './squad';
import { SquadView } from './SquadView';
import type { UtState } from './state';
import { organizeStorage, removeCards, storedCards, useStoredCopy } from './storage';
import './storage.css';
import './content.css';
import { CollectionGallery } from './CollectionGallery';
import { Events } from './Events';
import { ownedCardsForPack } from './acquisition';
import { claimCollection } from './collection';
import { openRegisteredPack } from './registry';
import { registeredOpening } from './promo';
import { Store } from './Store';
import type { OwnedCard, RatedCard, CardMint } from './types';

/** An owned card with its rating and where it plays (if it's in the squad). */
export interface ClubCard {
  uid: string;
  oc: OwnedCard;
  rc: RatedCard;
  slot: string | null;
  storage?: boolean;
}

export type UtView = 'hub' | 'squad' | 'club' | 'store' | 'sbc' | 'battles' | 'rivals' | 'gallery' | 'events' | 'play' | 'season' | 'objectives' | 'circuit' | 'moments' | 'development' | 'records';

/** the view to come back to after a match (the screen unmounts while it's played) */
let lastView: UtView = 'hub';

const TABS: [UtView, string, React.ReactNode][] = [
  ['hub', 'HOME', <IconHub />],
  ['squad', 'SQUAD', <IconSquad />],
  ['club', 'CLUB', <IconClub />],
  ['store', 'STORE', <IconStore />],
  ['sbc', 'SBC', <IconSbc />]
];

export interface Opening {
  id: string;
  title: string;
  kind: string;
  cards: { uid: string; rc: RatedCard; mint?: CardMint }[];
  stored?: number;
  mint?: { serial: number; total: number };
}

export default function UltimateTeam(props: {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  onExit: () => void;
  onToast: (t: string) => void;
  /** play the squad: a Squad Battles rung, or online head to head (App.tsx opens Match.tsx) */
  onPlaySquad?: PlaySquad;
}) {
  const { profile, update, onToast } = props;
  const ut = profile.ut;
  const [pool, setPool] = useState<Pool | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setViewNow] = useState<UtView>(() => lastView);
  const setView = (v: UtView) => {
    lastView = v;
    setViewNow(v);
  };
  const [opening, setOpening] = useState<Opening | null>(null);
  const [showStorage, setShowStorage] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const busy = useRef(false);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoRetry, setPromoRetry] = useState(0);
  const latest = useRef(profile);
  latest.current = profile;
  const [day, setDay] = useState(() => easternDateKey());
  useEffect(() => {
    const refresh = () => setDay(easternDateKey());
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const tries = useRef(0);
  const load = () => {
    setFailed(false);
    // a second miss: this build's card files are likely gone (a newer build is live), so reload
    if (tries.current++ >= 1 && reloadForMissingFiles()) return;
    getPool()
      .then(setPool)
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  const slotOf = useMemo(() => new Map(Object.entries(ut.squad).map(([s, u]) => [u, s])), [ut.squad]);
  const club: ClubCard[] = useMemo(() => {
    if (!pool) return [];
    const out: ClubCard[] = [];
    const stored = new Set(ut.duplicateStorage ?? []);
    for (const oc of ut.owned) {
      if (stored.has(oc.uid)) continue;
      const rc = ratedOf(pool, oc);
      if (rc) out.push({ uid: oc.uid, oc, rc, slot: slotOf.get(oc.uid) ?? null });
    }
    return out;
  }, [pool, ut.owned, ut.duplicateStorage, slotOf]);
  const stored: ClubCard[] = useMemo(() => {
    if (!pool) return [];
    return storedCards(ut).flatMap((oc) => {
      const rc = ratedOf(pool, oc);
      return rc ? [{ uid: oc.uid, oc, rc, slot: null, storage: true }] : [];
    });
  }, [pool, ut.owned, ut.duplicateStorage]);
  const inventory = useMemo(() => [...club, ...stored], [club, stored]);
  const byUid = useMemo(() => new Map(inventory.map((c) => [c.uid, c])), [inventory]);
  const lineup: Lineup = useMemo(() => Object.fromEntries(Object.entries(ut.squad).map(([s, u]) => [s, byUid.get(u)?.rc ?? null])), [ut.squad, byUid]);
  const rating = useMemo(() => rateSquad(SPORT, lineup), [lineup]);
  const sbcs = useMemo(() => (pool ? sbcsFor(pool, day, ut.sbc.done) : []), [pool, day, ut.sbc.done]);
  const ready = useMemo(() => startersComplete(SPORT, lineup), [lineup]);

  const setUt = (fn: (u: UtState) => UtState) => update((p) => ({ ...p, ut: organizeStorage(fn(p.ut)) }));

  const go = (v: UtView) => {
    if (v === view) return;
    sfx.click();
    setView(v);
  };

  // A pending request is persisted before contact. Retries recover the same server receipt.
  const startPromo = (kind: string, price: number, packId?: string) => {
    if (busy.current || promoBusy || ut.pendingPromo) {
      onToast('Finish your reserved pack in the Store first.');
      return;
    }
    if (profile.coins < price) {
      onToast('Not enough coins for this pack.');
      return;
    }
    busy.current = true;
    const pending = { id: newId(), kind, price, at: Date.now(), ...(packId ? { packId } : {}) };
    const next = { ...profile, ut: { ...ut, pendingPromo: pending } };
    if (!saveProfile(next)) {
      busy.current = false;
      onToast('Your phone could not save the pack request. Back up your progress and retry.');
      return;
    }
    setPromoError('');
    update((p) => ({ ...p, ut: { ...p.ut, pendingPromo: pending } }));
  };
  useEffect(() => {
    const pending = ut.pendingPromo;
    if (!pool || !pending) return;
    let live = true;
    setPromoBusy(true);
    setPromoError('');
    void openRegisteredPack(SPORT, pending.id, pending.kind)
      .then((receipt) => {
        if (!live) return;
        const preview = registeredOpening(pool, latest.current, receipt);
        update((p) => registeredOpening(pool, p, receipt).profile);
        if (preview.opening) setOpening(preview.opening);
        busy.current = false;
        setPromoBusy(false);
      })
      .catch((e) => {
        if (live) {
          busy.current = false;
          setPromoBusy(false);
          setPromoError(e instanceof Error ? e.message : 'Retry to recover your reserved pack.');
        }
      });
    return () => {
      live = false;
    };
  }, [pool, ut.pendingPromo?.id, promoRetry]);

  const claimPrize = (get: (u: UtState) => Prize) => {
    const shown = get(latest.current.ut);
    if (shown.ut === latest.current.ut) return;
    update((p) => {
      const r = get(p.ut);
      return { ...p, coins: p.coins + r.coins, ut: r.ut };
    });
    sfx.coin();
    onToast(
      'Reward claimed. ' +
        [rewardLabel({ coins: shown.coins, pack: shown.pack ?? undefined, sp: shown.sp }), shown.packCount ? shown.packCount + ' packs added to your Store' : ''].filter(Boolean).join(' · ')
    );
  };

  // ---------- packs ----------

  /** Open a pack now: its cards go into the club at once (closing the app mid-reveal keeps them).
   * `fill`: an empty squad is built from the club, these cards included (the starter pack). */
  const openNow = (kind: string, seed: string, title: string, also?: (p: Profile) => Profile, fill = false) => {
    if (!pool || busy.current || promoBusy || ut.pendingPromo) {
      if (ut.pendingPromo) onToast('Finish your reserved pack in the Store first.');
      return;
    }
    busy.current = true;
    window.setTimeout(() => (busy.current = false), 600);
    // truly random cards (`seed` only names the pack and its cards' ids)
    const cards = openPack(pool, kind);
    const at = Date.now();
    const owned = ownedCardsForPack(cards, seed, at);
    update((p) => {
      const deposited = organizeStorage(recordActivity(p.ut, 'pack:' + seed, easternDateKey(), { packs: 1 }), owned);
      const empty = fill && !Object.keys(deposited.squad).length;
      const squad = empty
        ? autoBuild(
            SPORT,
            deposited.owned
              .filter((oc) => !deposited.duplicateStorage?.includes(oc.uid))
              .flatMap((oc) => {
                const rc = ratedOf(pool, oc);
                return rc ? [{ uid: oc.uid, rc }] : [];
              })
          )
        : deposited.squad;
      const q = { ...p, ut: { ...deposited, squad, packsOpened: p.ut.packsOpened + 1 } };
      return also ? also(q) : q;
    });
    const stored = new Set(organizeStorage(ut, owned).duplicateStorage);
    setOpening({ id: seed, title, kind, stored: owned.filter((c) => stored.has(c.uid)).length, cards: cards.map((rc, i) => ({ uid: owned[i].uid, rc })) });
  };

  const buy = (kind: string, price: number) => {
    if (kind === 'spotlight') return startPromo(kind, packDefs(SPORT).spotlight.price);
    if (profile.coins < price) {
      sfx.nope();
      onToast('Not enough coins yet: ' + (price - profile.coins).toLocaleString('en-US') + ' more. Games, missions and challenges all pay.');
      return;
    }
    sfx.coin();
    openNow(kind, newId(), packName(SPORT, kind), (p) => ({ ...p, coins: p.coins - price }));
  };

  const claimStarter = () => {
    if (ut.starterClaimed) return;
    sfx.click();
    // a card for every spot: they go straight into the squad (if it's still empty)
    openNow('starter', newId(), 'Starter Pack', (p) => ({ ...p, ut: { ...p.ut, starterClaimed: true } }), true);
  };

  const openPending = (id: string) => {
    const pp = ut.packs.find((x) => x.id === id);
    if (!pp) return;
    if (pp.kind.startsWith('event-spotlight:') || pp.kind === 'spotlight') return startPromo(pp.kind, 0, pp.id);
    sfx.click();
    openNow(pp.kind, pp.id, packName(SPORT, pp.kind), (p) => ({ ...p, ut: { ...p.ut, packs: p.ut.packs.filter((x) => x.id !== id) } }));
  };

  // ---------- the club ----------

  const quickSell = (uids: string[]) => {
    const cards = [...new Set(uids)].map((u) => byUid.get(u)).filter((c): c is ClubCard => !!c);
    if (!cards.length) return;
    const coins = cards.reduce((a, c) => a + quickSellValue(c.rc), 0);
    const gone = new Set(cards.map((c) => c.uid));
    update((p) => {
      const current = new Set(p.ut.owned.map((c) => c.uid));
      const sold = cards.filter((c) => current.has(c.uid));
      if (!sold.length) return p;
      const proceeds = sold.reduce((sum, c) => sum + quickSellValue(c.rc), 0);
      return {
        ...p,
        coins: p.coins + proceeds,
        ut: {
          ...removeCards(p.ut, gone, 'sold'),
          sold: { cards: p.ut.sold.cards + sold.length, coins: p.ut.sold.coins + proceeds }
        }
      };
    });
    sfx.coin();
    onToast('Sold ' + (cards.length === 1 ? cards[0].rc.line.name : cards.length + ' cards') + ' for ' + coins.toLocaleString('en-US') + ' coins.');
  };

  // ---------- the squad ----------

  /** Put a card in a slot (or empty it). A card already elsewhere in the squad swaps places. */
  const setSlot = (slot: string, uid: string | null) => {
    const slots = slotsFor(SPORT);
    setUt((u) => {
      const sq = { ...u.squad };
      const cur = sq[slot];
      const from = uid ? Object.keys(sq).find((k) => sq[k] === uid) : undefined;
      if (uid) sq[slot] = uid;
      else delete sq[slot];
      if (from && from !== slot) {
        const back = cur ? byUid.get(cur) : undefined;
        const fromDef = slots.find((s) => s.id === from);
        if (back && fromDef && canPlay(fromDef, back.rc)) sq[from] = cur!;
        else delete sq[from];
      }
      return { ...u, squad: sq };
    });
  };

  const setSquad = (squad: Record<string, string>) => setUt((u) => ({ ...u, squad }));

  // ---------- challenges ----------

  const submitSbc = (s: Sbc, uids: string[]) => {
    if (!pool || ut.sbc.done[s.id]) return;
    const selected = uids.map((uid) => byUid.get(uid));
    if (
      new Set(uids).size !== uids.length ||
      selected.some((c) => !c) ||
      !checkSbc(
        s,
        selected.map((c) => c!.rc)
      ).ok
    )
      return;
    const gone = new Set(uids);
    const week = weekOf(day);
    const rc = s.reward.card ? rewardCard(pool, s.reward.card) : null;
    const prize: OwnedCard | null = rc ? { uid: 'sbc' + newId().replace(/-/g, '').slice(0, 8), cardId: rc.line.id, level: 1, xp: 0, at: Date.now() } : null;
    const pack = s.reward.pack ? { id: newId(), kind: s.reward.pack, at: Date.now() } : null;
    update((p) => {
      const current = new Set(p.ut.owned.map((c) => c.uid));
      if (p.ut.sbc.done[s.id] || uids.some((uid) => !current.has(uid))) return p;
      // only this day's and week's challenges need remembering
      const done = Object.fromEntries(Object.entries(p.ut.sbc.done).filter(([k]) => k.includes(day) || k.includes(week)));
      done[s.id] = Date.now();
      return {
        ...p,
        coins: p.coins + (s.reward.coins ?? 0),
        ut: {
          ...organizeStorage(removeCards(recordActivity(p.ut, 'sbc:' + s.id, easternDateKey(), { sbcs: 1 }, 50), gone, 'sbc'), prize ? [prize] : []),
          sbc: { done },
          packs: pack ? [...p.ut.packs, pack] : p.ut.packs
        }
      };
    });
    sfx.levelUp();
    vibrate([20, 40, 20]);
    if (rc && prize) setOpening({ id: 'sbc:' + s.id, title: s.title, kind: 'reward', cards: [{ uid: prize.uid, rc }] });
    else onToast(s.title + ' done!' + (pack ? ' Your ' + packName(SPORT, pack.kind) + ' is waiting in the Store.' : '') + (s.reward.coins ? ' +' + s.reward.coins + ' coins.' : ''));
  };

  const detailCard = detail ? (byUid.get(detail) ?? null) : null;
  // (the upgrades and repeatables are always there: they don't count toward what's left to do)
  const todo = sbcs.filter((s) => s.kind !== 'upgrade' && !ut.sbc.done[s.id]).length;

  let body: React.ReactNode;
  if (failed)
    body = (
      <div className="ut-loading">
        <p>The cards didn’t load.</p>
        <button className="btn primary" onClick={load}>
          TRY AGAIN
        </button>
      </div>
    );
  else if (!pool)
    body = (
      <div className="ut-loading" role="status">
        <span className="ut-spinner" aria-hidden="true" />
        <p>Loading {NFL ? 'football' : 'basketball'} cards…</p>
      </div>
    );
  else if (view === 'squad')
    body = (
      <SquadView
        pool={pool}
        club={club}
        lineup={lineup}
        squad={ut.squad}
        rating={rating}
        onSlot={setSlot}
        onSquad={setSquad}
        onInspect={setDetail}
        onToast={onToast}
        management={
          <SquadPresets
            ut={ut}
            pool={pool}
            onSave={(id, name) => {
              setUt((u) => savePreset(u, id, name, Date.now()));
              onToast('Current squad saved. Every card stays in your club.');
            }}
            onLoad={(id) => {
              setUt((u) => loadPreset(u, pool, id));
              onToast('Saved lineup loaded using your owned copies.');
            }}
          />
        }
      />
    );
  else if (view === 'play')
    body = (
      <PlayHQ
        onGo={go}
        onOnline={() => {
          if (!ready) {
            onToast('Fill your starting squad first.');
            go('squad');
            return;
          }
          props.onPlaySquad?.({ id: Date.now(), mode: 'online' });
        }}
      />
    );
  else if (view === 'season')
    body = (
      <SeasonView
        ut={ut}
        day={day}
        sport={SPORT}
        onStore={() => go('store')}
        onClaim={(period, tier) => {
          const at = Date.now();
          claimPrize((u) => claimSeason(u, period, tier, at));
        }}
        onClaimReady={(period) => {
          const at = Date.now();
          claimPrize((u) => claimReadySeason(u, period, at));
        }}
      />
    );
  else if (view === 'objectives')
    body = (
      <ObjectivesView
        ut={ut}
        day={day}
        onClaim={(id) => {
          const at = Date.now();
          claimPrize((u) => claimObjective(u, id, day, at));
        }}
        onClaimAll={() => {
          const at = Date.now();
          claimPrize((u) => {
            let next = u,
              coins = 0,
              sp = 0;
            for (const o of objectiveDeck(u, day))
              if (!o.claimed && o.progress >= o.target) {
                const r = claimObjective(next, o.id, day, at);
                next = r.ut;
                coins += r.coins;
                sp += r.sp;
              }
            return { ut: next, coins, sp, pack: null, packCount: next.packs.length - u.packs.length };
          });
        }}
      />
    );
  else if (view === 'circuit')
    body = (
      <CircuitView
        ut={ut}
        week={weekOf(day)}
        ready={ready}
        onSquad={() => go('squad')}
        onStart={() => {
          const id = newId(),
            at = Date.now();
          setUt((u) => startCircuit(u, weekOf(day), id, at));
        }}
        onPlay={(runId, round) => props.onPlaySquad?.({ id: Date.now(), mode: 'ai', circuit: { runId, round } })}
        onEnd={() => setUt(abandonCircuit)}
      />
    );
  else if (view === 'moments')
    body = (
      <Moments
        pool={pool}
        ut={ut}
        ready={ready}
        onSquad={() => go('squad')}
        onFinish={(m, attempts) => {
          const at = Date.now();
          setUt((u) => finishMoment(u, m, attempts, at));
        }}
        onClaim={(id) => {
          const at = Date.now();
          claimPrize((u) => claimMoment(u, SPORT, id, day, at));
        }}
      />
    );
  else if (view === 'development')
    body = (
      <DevelopmentView
        ut={ut}
        club={inventory}
        onUseCopy={(uid) => {
          setUt((u) => useStoredCopy(u, uid));
          onToast('Your development copy is back in the club. Its XP and serial are kept.');
        }}
        onSquad={() => go('squad')}
        onStart={(uid, path) => {
          const at = Date.now();
          setUt((u) => startDevelopment(u, uid, path, at));
        }}
        onCancel={() => setUt(cancelDevelopment)}
        onClaim={() => {
          const at = Date.now();
          const shown = claimDevelopment(latest.current.ut, day, at);
          if (!shown.xp) return;
          setUt((u) => claimDevelopment(u, day, at).ut);
          sfx.levelUp();
          onToast('Program complete. +' + shown.xp + ' card XP and +' + shown.sp + ' Season Points.');
        }}
      />
    );
  else if (view === 'records') body = <ClubRecords ut={ut} />;
  else if (view === 'club')
    body = (
      <div className="ut-collection-shell">
        <div className="ut-storage-tabs" role="group" aria-label="Card location">
          <button aria-pressed={!showStorage} onClick={() => setShowStorage(false)}>
            CLUB <b className="num">{club.length}</b>
          </button>
          <button aria-pressed={showStorage} onClick={() => setShowStorage(true)}>
            DUPLICATE STORAGE <b className="num">{stored.length}</b>
          </button>
        </div>
        <Club key={showStorage ? 'storage' : 'club'} club={showStorage ? stored : club} storage={showStorage} onInspect={setDetail} onSell={quickSell} />
      </div>
    );
  else if (view === 'gallery')
    body = (
      <CollectionGallery
        pool={pool}
        ut={ut}
        onClaim={(id) => {
          update((p) => {
            const result = claimCollection(pool, p.ut, id, Date.now());
            return { ...p, coins: p.coins + result.coins, ut: result.ut };
          });
        }}
      />
    );
  else if (view === 'events')
    body = <Events pool={pool} ut={ut} ready={ready} onSquad={() => go('squad')} onPlay={(id, node) => props.onPlaySquad?.({ id: Date.now(), mode: 'ai', event: { id, node } })} />;
  else if (view === 'store')
    body = (
      <>
        <div className="ut-registry-status" aria-live="polite">
          {ut.pendingPromo && (
            <>
              <b>{promoBusy ? 'Registering your pack…' : 'Your pack is reserved.'}</b>
              <p>{promoError || 'Your pull is being checked and saved. Coins are charged once when the cards arrive.'}</p>
              {!promoBusy && (
                <button className="btn primary" onClick={() => setPromoRetry((n) => n + 1)}>
                  RETRY SAME PACK
                </button>
              )}
            </>
          )}
        </div>
        <Store sport={SPORT} coins={profile.coins} starter={!ut.starterClaimed} pending={ut.packs} defs={packDefs(SPORT)} onBuy={buy} onStarter={claimStarter} onPending={openPending} />
      </>
    );
  else if (view === 'battles')
    body = (
      <Battles
        pool={pool}
        sport={SPORT}
        week={weekOf(day)}
        battles={ut.battles}
        rating={rating}
        ready={ready}
        onSquad={() => go('squad')}
        onToast={onToast}
        onLevel={(level) => setUt((u) => ({ ...u, battles: { ...battlesThisWeek(u.battles, weekOf(day)), level, cleared: 0 } }))}
        onPlay={(rung) => {
          const play = props.onPlaySquad;
          if (!play) return onToast('Squad Battles aren’t available here.');
          play({ id: Date.now(), mode: 'ai', rung });
        }}
      />
    );
  else if (view === 'rivals')
    body = (
      <Rivals
        profile={profile}
        update={update}
        onToast={onToast}
        onPlay={() => {
          if (!ready) {
            onToast('Fill your starting squad first.');
            go('squad');
            return;
          }
          props.onPlaySquad?.({ id: Date.now(), mode: 'online' });
        }}
      />
    );
  else if (view === 'sbc') body = <Challenges pool={pool} sbcs={sbcs} done={ut.sbc.done} club={inventory} day={day} onSubmit={submitSbc} onToast={onToast} />;
  else
    body = (
      <Hub
        rivals={<RivalsTeaser profile={profile} onOpen={() => go('rivals')} />}
        sport={SPORT}
        day={day}
        club={club}
        lineup={lineup}
        rating={rating}
        ut={ut}
        sbcTodo={todo}
        sbcs={sbcs}
        onInspect={setDetail}
        onGo={go}
        onStarter={claimStarter}
        onPlay={(mode) => {
          if (mode === 'ai') return go('battles');
          const play = props.onPlaySquad;
          if (!play || !NET_ON) {
            sfx.nope();
            onToast('Head to head needs a connection.');
            return;
          }
          if (!ready) {
            sfx.nope();
            onToast('Fill every starting spot in your squad first.');
            return go('squad');
          }
          sfx.click();
          play({ id: Date.now(), mode: 'online' });
        }}
      />
    );

  return (
    <div className={'screen ut ut-v-' + view}>
      <div className="topbar ut-top" {...(opening ? { inert: '' } : {})}>
        <button
          className="icon-btn pill-btn"
          onClick={() => (view === 'hub' ? (sfx.click(), (lastView = 'hub'), props.onExit()) : go('hub'))}
          aria-label={view === 'hub' ? 'Leave Ultimate Team' : 'Back to the Ultimate Team home'}
        >
          <Back size={16} /> {view === 'hub' ? 'HOME' : 'UT'}
        </button>
        <span className="ut-title disp">
          {view === 'hub'
            ? 'Ultimate Team'
            : ((
                {
                  battles: 'Squad Battles',
                  rivals: 'Rivals',
                  gallery: 'Collection',
                  events: 'Spotlight Events',
                  play: 'Play HQ',
                  season: 'Season Rewards',
                  objectives: 'Objectives',
                  circuit: 'Champions Circuit',
                  moments: 'Moments',
                  development: 'Development',
                  records: 'Club Records'
                } as Partial<Record<UtView, string>>
              )[view] ??
              TABS.find((t) => t[0] === view)?.[1] ??
              'Ultimate Team')}
        </span>
        <CoinChip coins={profile.coins} />
      </div>
      <div className="ut-body" {...(opening ? { inert: '' } : {})}>{body}</div>
      <nav className="ut-tabs" aria-label="Ultimate Team" {...(opening ? { inert: '' } : {})}>
        {TABS.map(([k, label, icon]) => (
          <button key={k} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}>
            {icon}
            <span>{label}</span>
            {k === 'sbc' && pool && todo > 0 && <i className="ut-dot num">{todo}</i>}
            {k === 'store' && (ut.packs.length > 0 || !ut.starterClaimed) && <i className="ut-dot num">{ut.packs.length + (ut.starterClaimed ? 0 : 1)}</i>}
          </button>
        ))}
      </nav>
      {detailCard && (
        <CardDetail
          cc={detailCard}
          clubRecord={hqOf(ut).cardStats[detailCard.uid]}
          developed={!!hqOf(ut).development.completed[detailCard.uid]}
          sport={SPORT}
          onUse={
            detailCard.storage
              ? () => {
                  setUt((u) => useStoredCopy(u, detailCard.uid));
                  setDetail(null);
                  onToast('Copy moved to your club. Your other copy is safe in Duplicate Storage.');
                }
              : undefined
          }
          onSell={() => quickSell([detailCard.uid])}
          onClose={() => setDetail(null)}
        />
      )}
      {opening && (
        <PackOpening
          key={opening.id}
          opening={{ ...opening, cards: opening.cards.map((c) => ({ ...c, mint: byUid.get(c.uid)?.oc.mint ?? c.mint })) }}
          onDone={(to) => {
            setOpening(null);
            if (to) setView(to);
          }}
        />
      )}
    </div>
  );
}
