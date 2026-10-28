import { Rivals, RivalsTeaser } from './Rivals';
// Ultimate Team: the mode's own screen, with its own tabs (hub, squad, club, store, challenges).
// It keeps everything in the profile's `ut` (this sport's) and spends the profile's coins. The
// card pool loads when the screen opens. App.tsx only routes here (screen 'ut').
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { easternDateKey } from '../engine/season';
import { NFL, SPORT } from '../engine/sport';
import { newId, type Profile } from '../lib/profile';
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
import { Store } from './Store';
import type { OwnedCard, RatedCard } from './types';

/** An owned card with its rating and where it plays (if it's in the squad). */
export interface ClubCard {
  uid: string;
  oc: OwnedCard;
  rc: RatedCard;
  slot: string | null;
  storage?: boolean;
}

export type UtView = 'hub' | 'squad' | 'club' | 'store' | 'sbc' | 'battles' | 'rivals';

/** the view to come back to after a match (the screen unmounts while it's played) */
let lastView: UtView = 'hub';

const TABS: [UtView, string, React.ReactNode][] = [
  ['hub', 'HOME', <IconHub />],
  ['squad', 'SQUAD', <IconSquad />],
  ['club', 'CLUB', <IconClub />],
  ['store', 'STORE', <IconStore />],
  ['sbc', 'SBC', <IconSbc />],
];

export interface Opening {
  id: string;
  title: string;
  kind: string;
  cards: { uid: string; rc: RatedCard }[];
  stored?: number;
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
  const [day] = useState(() => easternDateKey());

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
    return storedCards(ut).flatMap(oc => {
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

  // ---------- packs ----------

  /** Open a pack now: its cards go into the club at once (closing the app mid-reveal keeps them).
   * `fill`: an empty squad is built from the club, these cards included (the starter pack). */
  const openNow = (kind: string, seed: string, title: string, also?: (p: Profile) => Profile, fill = false) => {
    if (!pool || busy.current) return;
    busy.current = true;
    window.setTimeout(() => (busy.current = false), 600);
    // truly random cards (`seed` only names the pack and its cards' ids)
    const cards = openPack(pool, kind);
    const at = Date.now();
    const tag = seed.replace(/[^a-z0-9]/gi, '').slice(0, 10);
    const owned: OwnedCard[] = cards.map((rc, i) => ({ uid: tag + '-' + i, cardId: rc.line.id, level: 1, xp: 0, at: at + i }));
    update((p) => {
      const deposited = organizeStorage(p.ut, owned);
      const empty = fill && !Object.keys(deposited.squad).length;
      const squad = empty ? autoBuild(SPORT, deposited.owned.filter(oc => !deposited.duplicateStorage?.includes(oc.uid)).flatMap(oc => {
        const rc = ratedOf(pool, oc);
        return rc ? [{ uid: oc.uid, rc }] : [];
      })) : deposited.squad;
      const q = { ...p, ut: { ...deposited, squad, packsOpened: p.ut.packsOpened + 1 } };
      return also ? also(q) : q;
    });
    const stored = new Set(organizeStorage(ut, owned).duplicateStorage);
    setOpening({ id: seed, title, kind, stored: owned.filter(c => stored.has(c.uid)).length, cards: cards.map((rc, i) => ({ uid: owned[i].uid, rc })) });
  };

  const buy = (kind: string, price: number) => {
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
      const current = new Set(p.ut.owned.map(c => c.uid));
      const sold = cards.filter(c => current.has(c.uid));
      if (!sold.length) return p;
      const proceeds = sold.reduce((sum, c) => sum + quickSellValue(c.rc), 0);
      return {
        ...p,
        coins: p.coins + proceeds,
        ut: {
          ...removeCards(p.ut, gone),
          sold: { cards: p.ut.sold.cards + sold.length, coins: p.ut.sold.coins + proceeds },
        },
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
    const selected = uids.map(uid => byUid.get(uid));
    if (new Set(uids).size !== uids.length || selected.some(c => !c) || !checkSbc(s, selected.map(c => c!.rc)).ok) return;
    const gone = new Set(uids);
    const week = weekOf(day);
    const rc = s.reward.card ? rewardCard(pool, s.reward.card) : null;
    const prize: OwnedCard | null = rc ? { uid: 'sbc' + newId().replace(/-/g, '').slice(0, 8), cardId: rc.line.id, level: 1, xp: 0, at: Date.now() } : null;
    const pack = s.reward.pack ? { id: newId(), kind: s.reward.pack, at: Date.now() } : null;
    update((p) => {
      const current = new Set(p.ut.owned.map(c => c.uid));
      if (p.ut.sbc.done[s.id] || uids.some(uid => !current.has(uid))) return p;
      // only this day's and week's challenges need remembering
      const done = Object.fromEntries(Object.entries(p.ut.sbc.done).filter(([k]) => k.includes(day) || k.includes(week)));
      done[s.id] = Date.now();
      return {
        ...p,
        coins: p.coins + (s.reward.coins ?? 0),
        ut: {
          ...organizeStorage(removeCards(p.ut, gone), prize ? [prize] : []),
          sbc: { done },
          packs: pack ? [...p.ut.packs, pack] : p.ut.packs,
        },
      };
    });
    sfx.levelUp();
    vibrate([20, 40, 20]);
    if (rc && prize) setOpening({ id: 'sbc:' + s.id, title: s.title, kind: 'reward', cards: [{ uid: prize.uid, rc }] });
    else onToast(s.title + ' done!' + (pack ? ' Your ' + packName(SPORT, pack.kind) + ' is waiting in the Store.' : '') + (s.reward.coins ? ' +' + s.reward.coins + ' coins.' : ''));
  };

  const detailCard = detail ? byUid.get(detail) ?? null : null;
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
  else if (view === 'squad') body = <SquadView pool={pool} club={club} lineup={lineup} squad={ut.squad} rating={rating} onSlot={setSlot} onSquad={setSquad} onInspect={setDetail} onToast={onToast} />;
  else if (view === 'club') body = <div className="ut-collection-shell">
    <div className="ut-storage-tabs" role="group" aria-label="Card location">
      <button aria-pressed={!showStorage} onClick={() => setShowStorage(false)}>CLUB <b className="num">{club.length}</b></button>
      <button aria-pressed={showStorage} onClick={() => setShowStorage(true)}>DUPLICATE STORAGE <b className="num">{stored.length}</b></button>
    </div>
    <Club key={showStorage ? 'storage' : 'club'} club={showStorage ? stored : club} storage={showStorage} onInspect={setDetail} onSell={quickSell} />
  </div>;
  else if (view === 'store')
    body = <Store sport={SPORT} coins={profile.coins} starter={!ut.starterClaimed} pending={ut.packs} defs={packDefs(SPORT)} onBuy={buy} onStarter={claimStarter} onPending={openPending} />;
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
  else if (view === 'rivals') body = <Rivals profile={profile} update={update} onToast={onToast} onPlay={() => { if (!ready) { onToast('Fill your starting squad first.'); go('squad'); return; } props.onPlaySquad?.({id:Date.now(),mode:'online'}); }} />;
  else if (view === 'sbc') body = <Challenges pool={pool} sbcs={sbcs} done={ut.sbc.done} club={inventory} day={day} onSubmit={submitSbc} onToast={onToast} />;
  else
    body = (
      <Hub
        rivals={<RivalsTeaser profile={profile} onOpen={()=>go('rivals')}/>}
        sport={SPORT}
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
      <div className="topbar ut-top">
        <button className="icon-btn pill-btn" onClick={() => (view === 'hub' ? (sfx.click(), (lastView = 'hub'), props.onExit()) : go('hub'))} aria-label={view === 'hub' ? 'Leave Ultimate Team' : 'Back to the Ultimate Team home'}>
          <Back size={16} /> {view === 'hub' ? 'HOME' : 'UT'}
        </button>
        <span className="ut-title disp">{view === 'hub' ? 'Ultimate Team' : view === 'battles' ? 'Squad Battles' : view === 'rivals' ? 'Rivals' : TABS.find((t) => t[0] === view)![1]}</span>
        <CoinChip coins={profile.coins} />
      </div>
      <div className="ut-body">{body}</div>
      <nav className="ut-tabs" aria-label="Ultimate Team">
        {TABS.map(([k, label, icon]) => (
          <button key={k} aria-current={view === k ? 'page' : undefined} onClick={() => go(k)}>
            {icon}
            <span>{label}</span>
            {k === 'sbc' && pool && todo > 0 && <i className="ut-dot num">{todo}</i>}
            {k === 'store' && (ut.packs.length > 0 || !ut.starterClaimed) && <i className="ut-dot num">{ut.packs.length + (ut.starterClaimed ? 0 : 1)}</i>}
          </button>
        ))}
      </nav>
      {detailCard && <CardDetail cc={detailCard} sport={SPORT} onUse={detailCard.storage ? () => {
        setUt(u => useStoredCopy(u, detailCard.uid));
        setDetail(null);
        onToast('Copy moved to your club. Your other copy is safe in Duplicate Storage.');
      } : undefined} onSell={() => quickSell([detailCard.uid])} onClose={() => setDetail(null)} />}
      {opening && (
        <PackOpening
          key={opening.id}
          opening={opening}
          onDone={(to) => {
            setOpening(null);
            if (to) setView(to);
          }}
        />
      )}
    </div>
  );
}
