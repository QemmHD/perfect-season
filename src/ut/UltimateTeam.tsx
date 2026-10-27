// Ultimate Team: the mode's own screen, with its own tabs (hub, squad, club, store, challenges).
// It keeps everything in the profile's `ut` (this sport's) and spends the profile's coins. The
// card pool loads when the screen opens. App.tsx only routes here (screen 'ut').
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { easternDateKey } from '../engine/season';
import { NFL, SPORT } from '../engine/sport';
import { newId, type Profile } from '../lib/profile';
import { sfx, vibrate } from '../lib/sound';
import { CoinChip } from '../ui/common';
import { Back } from '../ui/icons';
import { CardDetail } from './CardDetail';
import { Challenges } from './Challenges';
import { Club } from './Club';
import { Hub } from './Hub';
import { IconClub, IconHub, IconSbc, IconSquad, IconStore } from './icons';
import { PackOpening } from './PackOpening';
import { openPack, packDefs, packName, quickSellValue } from './packs';
import type { PlaySquad } from './play';
import { getPool, type Pool, ratedOf } from './pool';
import { rewardCard, type Sbc, sbcsFor, weekOf } from './sbc';
import { canPlay, type Lineup, rateSquad, slotsFor } from './squad';
import { SquadView } from './SquadView';
import type { UtState } from './state';
import { Store } from './Store';
import type { OwnedCard, RatedCard } from './types';

/** An owned card with its rating and where it plays (if it's in the squad). */
export interface ClubCard {
  uid: string;
  oc: OwnedCard;
  rc: RatedCard;
  slot: string | null;
}

export type UtView = 'hub' | 'squad' | 'club' | 'store' | 'sbc';

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
}

export default function UltimateTeam(props: {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  onExit: () => void;
  onToast: (t: string) => void;
  /** the played matches (the next step): absent until then */
  onPlaySquad?: PlaySquad;
}) {
  const { profile, update, onToast } = props;
  const ut = profile.ut;
  const [pool, setPool] = useState<Pool | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState<UtView>('hub');
  const [opening, setOpening] = useState<Opening | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const busy = useRef(false);
  const [day] = useState(() => easternDateKey());

  const load = () => {
    setFailed(false);
    getPool()
      .then(setPool)
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  const slotOf = useMemo(() => new Map(Object.entries(ut.squad).map(([s, u]) => [u, s])), [ut.squad]);
  const club: ClubCard[] = useMemo(() => {
    if (!pool) return [];
    const out: ClubCard[] = [];
    for (const oc of ut.owned) {
      const rc = ratedOf(pool, oc);
      if (rc) out.push({ uid: oc.uid, oc, rc, slot: slotOf.get(oc.uid) ?? null });
    }
    return out;
  }, [pool, ut.owned, slotOf]);
  const byUid = useMemo(() => new Map(club.map((c) => [c.uid, c])), [club]);
  const lineup: Lineup = useMemo(() => Object.fromEntries(Object.entries(ut.squad).map(([s, u]) => [s, byUid.get(u)?.rc ?? null])), [ut.squad, byUid]);
  const rating = useMemo(() => rateSquad(SPORT, lineup), [lineup]);
  const sbcs = useMemo(() => (pool ? sbcsFor(pool, day) : []), [pool, day]);

  const setUt = (fn: (u: UtState) => UtState) => update((p) => ({ ...p, ut: fn(p.ut) }));

  const go = (v: UtView) => {
    if (v === view) return;
    sfx.click();
    setView(v);
  };

  // ---------- packs ----------

  /** Open a pack now: its cards go into the club at once (closing the app mid-reveal keeps them). */
  const openNow = (kind: string, seed: string, title: string, also?: (p: Profile) => Profile) => {
    if (!pool || busy.current) return;
    busy.current = true;
    window.setTimeout(() => (busy.current = false), 600);
    const cards = openPack(pool, kind, seed);
    const at = Date.now();
    const tag = seed.replace(/[^a-z0-9]/gi, '').slice(0, 10);
    const owned: OwnedCard[] = cards.map((rc, i) => ({ uid: tag + '-' + i, cardId: rc.line.id, level: 1, xp: 0, at: at + i }));
    update((p) => {
      const q = { ...p, ut: { ...p.ut, owned: [...p.ut.owned, ...owned], packsOpened: p.ut.packsOpened + 1 } };
      return also ? also(q) : q;
    });
    setOpening({ id: seed, title, kind, cards: cards.map((rc, i) => ({ uid: owned[i].uid, rc })) });
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
    openNow('starter', newId(), 'Starter Pack', (p) => ({ ...p, ut: { ...p.ut, starterClaimed: true } }));
  };

  const openPending = (id: string) => {
    const pp = ut.packs.find((x) => x.id === id);
    if (!pp) return;
    sfx.click();
    openNow(pp.kind, pp.id, packName(SPORT, pp.kind), (p) => ({ ...p, ut: { ...p.ut, packs: p.ut.packs.filter((x) => x.id !== id) } }));
  };

  // ---------- the club ----------

  const quickSell = (uids: string[]) => {
    const cards = uids.map((u) => byUid.get(u)).filter((c): c is ClubCard => !!c);
    if (!cards.length) return;
    const coins = cards.reduce((a, c) => a + quickSellValue(c.rc), 0);
    const gone = new Set(cards.map((c) => c.uid));
    update((p) => ({
      ...p,
      coins: p.coins + coins,
      ut: {
        ...p.ut,
        owned: p.ut.owned.filter((o) => !gone.has(o.uid)),
        squad: Object.fromEntries(Object.entries(p.ut.squad).filter(([, u]) => !gone.has(u))),
        sold: { cards: p.ut.sold.cards + cards.length, coins: p.ut.sold.coins + coins },
      },
    }));
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
    const gone = new Set(uids);
    const week = weekOf(day);
    const rc = s.reward.card ? rewardCard(pool, s.reward.card, s.id) : null;
    const prize: OwnedCard | null = rc ? { uid: 'sbc' + newId().replace(/-/g, '').slice(0, 8), cardId: rc.line.id, level: 1, xp: 0, at: Date.now() } : null;
    const pack = s.reward.pack ? { id: newId(), kind: s.reward.pack, at: Date.now() } : null;
    update((p) => {
      // only this day's and week's challenges need remembering
      const done = Object.fromEntries(Object.entries(p.ut.sbc.done).filter(([k]) => k.includes(day) || k.includes(week)));
      done[s.id] = Date.now();
      return {
        ...p,
        coins: p.coins + (s.reward.coins ?? 0),
        ut: {
          ...p.ut,
          owned: [...p.ut.owned.filter((o) => !gone.has(o.uid)), ...(prize ? [prize] : [])],
          squad: Object.fromEntries(Object.entries(p.ut.squad).filter(([, u]) => !gone.has(u))),
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
  const todo = sbcs.filter((s) => !ut.sbc.done[s.id]).length;

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
  else if (view === 'club') body = <Club club={club} onInspect={setDetail} onSell={quickSell} />;
  else if (view === 'store')
    body = <Store sport={SPORT} coins={profile.coins} starter={!ut.starterClaimed} pending={ut.packs} defs={packDefs(SPORT)} onBuy={buy} onStarter={claimStarter} onPending={openPending} />;
  else if (view === 'sbc') body = <Challenges pool={pool} sbcs={sbcs} done={ut.sbc.done} club={club} day={day} onSubmit={submitSbc} onToast={onToast} />;
  else
    body = (
      <Hub
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
          const play = props.onPlaySquad;
          if (!play) {
            sfx.nope();
            onToast((mode === 'ai' ? 'Squad battles vs the AI' : 'Online head to head') + ' arrive in the next update. Build your squad meanwhile!');
            return;
          }
          // TODO(match step): credit the result (coins, awardXp) in `done`
          const cards = Object.fromEntries(Object.entries(lineup).filter(([, rc]) => !!rc)) as Record<string, RatedCard>;
          play({ sport: SPORT, mode, cards, uids: ut.squad, rating, done: () => {} });
        }}
      />
    );

  return (
    <div className={'screen ut ut-v-' + view}>
      <div className="topbar ut-top">
        <button className="icon-btn pill-btn" onClick={() => (view === 'hub' ? (sfx.click(), props.onExit()) : go('hub'))} aria-label={view === 'hub' ? 'Leave Ultimate Team' : 'Back to the Ultimate Team home'}>
          <Back size={16} /> {view === 'hub' ? 'HOME' : 'UT'}
        </button>
        <span className="ut-title disp">{view === 'hub' ? 'Ultimate Team' : TABS.find((t) => t[0] === view)![1]}</span>
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
      {detailCard && <CardDetail cc={detailCard} sport={SPORT} onSell={() => quickSell([detailCard.uid])} onClose={() => setDetail(null)} />}
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
