// Claude, 2026-11-01: the Pack Tracker (Club → Pack Tracker, and PULL HISTORY in the Store), see
// docs/PULL-TRACKER.md. Three sections: BY PACK (what each pack type has returned against what its
// published odds expect), RECENT (the latest packs and their cards) and ALL CARDS (every copy the
// save knows, cards from before the tracker marked as such). Read-only: it never changes the club.
import React, { useMemo, useState } from 'react';
import { UtCard } from './CardArt';
import { PackArt } from './PackArt';
import { IconChart } from './icons';
import { ratedOf, type Pool } from './pool';
import {
  allPulled,
  defFor,
  expectedFor,
  isPickGroup,
  isSpecial,
  ovrEdges,
  OVR_LABELS,
  packGroup,
  pullsOf,
  SOURCE_LABEL,
  uidOf,
  untrackedPacks,
  type PullAgg,
  type PullEntry,
  type PulledItem,
} from './pull-log';
import { PULL_LOG_CARDS, PULL_LOG_PACKS } from './pull-log-state';
import { TIER_NAMES } from './rate';
import type { UtState } from './state';
import type { RatedCard, Tier, UtSport } from './types';
import type { ClubCard } from './UltimateTeam';
import { EmptyState, Lede, Segmented } from './ui';
import './pull-tracker.css';

type Section = 'packs' | 'recent' | 'all';
type TierF = 'any' | 'bronze' | 'silver' | 'gold' | 'gold+' | '86' | 'special';
type OvrF = 0 | 75 | 80 | 83 | 86 | 90;

/** The section and filters stay as they were for the rest of the visit. */
let saved: { section: Section; group: string; tier: TierF; ovr: OvrF; allTier: TierF } = { section: 'packs', group: 'all', tier: 'any', ovr: 0, allTier: 'any' };

const n0 = (x: number) => Math.round(x).toLocaleString('en-US');
const pct = (x: number) => (x >= 0.995 ? '100%' : x > 0 && x < 0.01 ? '<1%' : Math.round(x * 100) + '%');
const day = (at: number) => new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const when = (at: number) => {
  const d = new Date(at);
  const today = new Date();
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return d.toDateString() === today.toDateString() ? 'Today ' + time : day(at) + ' · ' + time;
};

/** The pack art's wrapper for a pack type. */
function artOf(group: string): [string, string] {
  if (group === 'preview') return ['premium', 'PREVIEW'];
  if (group === 'event-spotlight') return ['spotlight', 'REWARD'];
  if (isPickGroup(group)) return ['scout', 'PICK'];
  if (group.startsWith('live-plus')) return ['live-plus', 'GUARANTEE'];
  if (group.startsWith('live')) return ['live', 'PROGRAM'];
  const short: Record<string, string> = { premium: 'PREMIUM', position: 'POSITION', starter: 'STARTER', jumbo: 'JUMBO', elite: 'ELITE', standout: 'STANDOUT', lightning: 'LIGHTNING' };
  return [group, short[group] ?? group.toUpperCase().slice(0, 9)];
}

function tierOk(f: TierF, tier: string, ovr: number, e86: number): boolean {
  if (f === 'any') return true;
  if (f === 'special') return isSpecial(tier);
  if (f === 'gold+') return tier !== 'bronze' && tier !== 'silver';
  if (f === '86') return ovr >= e86;
  return tier === f;
}

function Chips<T extends string | number>(props: { label: string; items: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="ut-chips ut-trk-chips" role="group" aria-label={props.label}>
      {props.items.map(([k, l]) => (
        <button key={String(k)} className={'chip' + (props.value === k ? ' on' : '')} aria-pressed={props.value === k} onClick={() => props.onChange(k)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function PullTracker(props: { pool: Pool; ut: UtState; sport: UtSport; day: string; week: string; byUid: Map<string, ClubCard>; onInspect: (uid: string) => void; onStore: () => void }) {
  const { pool, ut, sport } = props;
  const [f, setF] = useState(saved);
  const set = (k: Partial<typeof f>) => {
    const next = { ...f, ...k };
    saved = next;
    setF(next);
  };
  const log = pullsOf(ut);
  const groups = useMemo(() => Object.entries(log?.a ?? {}).sort((a, b) => b[1].l - a[1].l), [log?.a]);
  const totals = useMemo(() => {
    const t = { n: 0, c: 0, k: 0, qp: 0 };
    for (const [, a] of groups) {
      t.n += a.n;
      t.c += a.c;
      t.k += a.k;
      t.qp += a.qp;
    }
    return t;
  }, [groups]);
  const before = untrackedPacks(ut);
  const tracked = !!log && groups.length > 0;

  return (
    <div className="page ut-tracker">
      {tracked ? (
        <>
          <div className="ut-trk-hero">
            <span>
              <b className="num">{n0(totals.n)}</b>
              <small>PACKS</small>
            </span>
            <span>
              <b className="num">{n0(totals.k)}</b>
              <small>CARDS</small>
            </span>
            <span>
              <b className="num">{totals.c >= 100000 ? Math.round(totals.c / 1000) + 'K' : n0(totals.c)}</b>
              <small>COINS SPENT</small>
            </span>
            <span className={totals.c ? '' : 'dim'}>
              <b className="num">{totals.c ? pct(totals.qp / totals.c) : '—'}</b>
              <small>RETURNED</small>
            </span>
          </div>
          <p className="ut-trk-since">
            Tracking since {day(log!.since)}.{' '}
            {before > 0 ? before + (before === 1 ? ' earlier pack was' : ' earlier packs were') + ' opened before the tracker, so their pack type is unknown.' : 'Every pack you’ve opened is here.'}
          </p>
        </>
      ) : (
        <Lede>Every pack you open is logged here: what it cost, what came out, and how it compares with the published odds.</Lede>
      )}
      <Segmented
        label="Pack Tracker sections"
        className="ut-trk-seg"
        items={[
          ['packs', 'BY PACK'],
          ['recent', 'RECENT'],
          ['all', 'ALL CARDS'],
        ]}
        value={f.section}
        onChange={(v) => set({ section: v })}
      />
      {f.section !== 'all' && !tracked ? (
        <div className="ut-trk-empty">
          <EmptyState icon={<IconChart size={24} />} title="Your next pack starts the log">
            Open any pack — a Store pack, your Daily Drop or a reward — and it shows up here with its price, its cards and your hit rate against the odds.
            {before > 0 ? ' Packs opened before this update (' + before + ') can’t be matched to a pack type; their cards are under All cards.' : ''}
          </EmptyState>
          <button className="btn primary" onClick={props.onStore}>
            GO TO THE STORE
          </button>
        </div>
      ) : f.section === 'packs' ? (
        <div className="ut-trk-list">
          {groups.map(([g, a]) => (
            <PackSummary key={g} group={g} a={a} pool={pool} sport={sport} day={props.day} week={props.week} />
          ))}
          <p className="note">
            Return is the quick-sell value of what paid packs gave you, against the coins they cost. Expected rates come from each pack’s published slot odds, drawn through the same code as a real
            pack. Small samples swing a lot.
          </p>
        </div>
      ) : f.section === 'recent' ? (
        <Recent log={log!.r} names={log!.a} f={f} set={set} pool={pool} sport={sport} byUid={props.byUid} onInspect={props.onInspect} />
      ) : (
        <AllCards ut={ut} f={f} set={set} pool={pool} sport={sport} byUid={props.byUid} onInspect={props.onInspect} />
      )}
    </div>
  );
}

function PackSummary({ group, a, pool, sport, day, week }: { group: string; a: PullAgg; pool: Pool; sport: UtSport; day: string; week: string }) {
  const pick = isPickGroup(group);
  const exp = useMemo(() => expectedFor(pool, group, day, week), [pool, group, week]);
  const def = defFor(sport, group, day);
  const [kind, label] = artOf(group);
  const best = a.b ? pool.base.get(a.b[0]) : null;
  const you = (x: number) => (a.n ? x / a.n : 0);
  const free = !a.pd;
  // paid packs: quick-sell returned against the coins; free ones: what a pack is worth sold
  const rows: [string, string, string][] = [
    free ? ['Value per pack', n0(a.q / Math.max(1, a.n)) + ' c', exp ? n0(exp.qs) + ' c' : '—'] : ['Return', pct(a.qp / a.c), exp && def && def.price > 0 ? pct(exp.qs / def.price) : '—'],
    ['86+ in a pack', pct(you(a.h86)), exp ? pct(exp.r86) : '—'],
    ['90+ in a pack', pct(you(a.h90)), exp ? pct(exp.r90) : '—'],
    ['Special edition', pct(you(a.hs)), exp ? pct(exp.special) : '—'],
  ];
  return (
    <article className="ut-trk-pack" aria-label={a.nm + ' summary'}>
      <div className="ut-trk-head">
        <PackArt kind={kind} label={label} sport={sport} small />
        <span className="ut-trk-name">
          <b>{a.nm}</b>
          <small>
            {a.n} {pick ? (a.n === 1 ? 'pick' : 'picks') : a.n === 1 ? 'pack' : 'packs'} · {a.k} {a.k === 1 ? 'card' : 'cards'}
          </small>
          <small>{a.c ? n0(a.c) + ' coins spent' + (a.pd < a.n ? ' · ' + (a.n - a.pd) + ' free' : '') : 'Free or earned'}</small>
        </span>
        {best && (
          <span className="ut-trk-best" title="Best pull">
            <UtCard rc={best} w={44} />
            <i>BEST</i>
          </span>
        )}
      </div>
      <div className={'ut-trk-table' + (pick ? ' solo' : '')} role="table" aria-label={a.nm + (pick ? ': your picks' : ': you against the odds')}>
        <div role="row" className="ut-trk-th">
          <span role="columnheader" />
          <span role="columnheader">YOU</span>
          {!pick && <span role="columnheader">EXPECTED</span>}
        </div>
        {rows.map(([k, y, e]) => (
          <div role="row" key={k}>
            <span role="rowheader">{k}</span>
            <b role="cell" className="num">
              {y}
            </b>
            {!pick && (
              <span role="cell" className="num">
                {e}
              </span>
            )}
          </div>
        ))}
      </div>
      {pick && <p className="ut-trk-foot">You keep one of the options you see, so a pick has no pack odds to compare.</p>}
      <div className="ut-trk-ovr" aria-label="Cards by overall">
        {OVR_LABELS.map((l, i) => (
          <span key={l} className={'b' + i + (a.o[i] ? '' : ' zero')}>
            <b className="num">{a.o[i]}</b>
            <small>{l}</small>
          </span>
        ))}
      </div>
      <p className="ut-trk-foot">
        {a.w} {a.w === 1 ? 'walkout' : 'walkouts'} · {a.sp} special · {a.lg} {a.lg === 1 ? 'legend' : 'legends'} · {n0(a.q)} coins quick-sell
        {a.n < 10 && !pick ? ' · small sample' : ''}
      </p>
    </article>
  );
}

const PAGE_PACKS = 20;
const PAGE_CARDS = 48;
const MINIS = 5;

function MiniCard({ uid, cardId, pool, byUid, onInspect, w }: { uid: string; cardId: string; pool: Pool; byUid: Map<string, ClubCard>; onInspect: (uid: string) => void; w: number }) {
  const cc = byUid.get(uid);
  const rc: RatedCard | null = cc?.rc ?? ratedOf(pool, { cardId, level: 1 });
  if (!rc) return <span className="ut-trk-missing" style={{ width: w, height: w * 1.4 }} aria-label="Card not in this build" />;
  return cc ? (
    <button className="ut-trk-mini" onClick={() => onInspect(uid)} aria-label={rc.line.name + ', ' + rc.ovr}>
      <UtCard rc={rc} w={w} level={cc.oc.level} />
    </button>
  ) : (
    <span className="ut-trk-mini gone" title="No longer in your club">
      <UtCard rc={rc} w={w} />
    </span>
  );
}

function Recent(props: { log: PullEntry[]; names: Record<string, PullAgg>; f: typeof saved; set: (k: Partial<typeof saved>) => void; pool: Pool; sport: UtSport; byUid: Map<string, ClubCard>; onInspect: (uid: string) => void }) {
  const { f, set, sport } = props;
  const [shown, setShown] = useState(PAGE_PACKS);
  const e86 = ovrEdges(sport)[3];
  const groups = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of props.log.slice().reverse()) if (!m.has(packGroup(e.k, e.s))) m.set(packGroup(e.k, e.s), props.names[packGroup(e.k, e.s)]?.nm ?? e.n);
    return [...m.entries()];
  }, [props.log, props.names]);
  // a saved filter for a pack type no longer in the recent list falls back to all packs
  const group = groups.some(([g]) => g === f.group) ? f.group : 'all';
  const list = useMemo(
    () =>
      props.log
        .slice()
        .reverse()
        .filter((e) => group === 'all' || packGroup(e.k, e.s) === group)
        .map((e) => ({ e, idx: e.cs.map((_, i) => i).filter((i) => tierOk(f.tier, e.cs[i][2], e.cs[i][1], e86)) }))
        .filter((x) => x.idx.length),
    [props.log, group, f.tier, e86]
  );
  const groupItems: [string, string][] = [['all', 'ALL PACKS'], ...groups.map(([g, n]) => [g, shortName(g, n)] as [string, string])];
  return (
    <>
      <Chips label="Pack type" items={groupItems} value={group} onChange={(v) => (set({ group: v }), setShown(PAGE_PACKS))} />
      <Chips
        label="Cards"
        items={[
          ['any', 'ANY CARD'],
          ['gold+', 'GOLD+'],
          ['86', e86 + '+'],
          ['special', 'SPECIAL'],
        ]}
        value={(['any', 'gold+', '86', 'special'] as TierF[]).includes(f.tier) ? f.tier : 'any'}
        onChange={(v) => (set({ tier: v }), setShown(PAGE_PACKS))}
      />
      {list.length ? (
        <div className="ut-trk-feed">
          {list.slice(0, shown).map(({ e, idx }) => {
            const order = idx.slice().sort((a, b) => cmp(e.cs[b], e.cs[a]));
            const more = order.length - MINIS;
            return (
              <article key={e.id} className="ut-trk-pull">
                <div className="ut-trk-pull-head">
                  <b>{e.n}</b>
                  <i className={'ut-trk-src s-' + e.s}>{SOURCE_LABEL[e.s] ?? 'Reward'}</i>
                  <span className="num">{e.c ? n0(e.c) : 'FREE'}</span>
                </div>
                <small className="ut-trk-when">
                  {when(e.at)} · {e.cs.length} {e.cs.length === 1 ? 'card' : 'cards'}
                  {f.tier !== 'any' ? ' · ' + idx.length + ' shown' : ''}
                </small>
                <div className="ut-trk-cards">
                  {order.slice(0, MINIS).map((i) => (
                    <MiniCard key={i} uid={uidOf(e, i)} cardId={e.cs[i][0]} pool={props.pool} byUid={props.byUid} onInspect={props.onInspect} w={52} />
                  ))}
                  {more > 0 && <span className="ut-trk-more num">+{more}</span>}
                </div>
              </article>
            );
          })}
          {shown < list.length && (
            <button className="btn ut-trk-show" onClick={() => setShown((n) => n + PAGE_PACKS)}>
              SHOW {Math.min(PAGE_PACKS, list.length - shown)} MORE
            </button>
          )}
        </div>
      ) : (
        <EmptyState icon={<IconChart size={24} />} title="No packs match">
          Try another pack type or card filter.
        </EmptyState>
      )}
      <p className="note">
        Your newest {PULL_LOG_PACKS} packs (up to {PULL_LOG_CARDS.toLocaleString('en-US')} cards) are kept here in full; the totals under By pack count every pack you’ve opened since the tracker began.
      </p>
    </>
  );
}

const TIER_RANKS: Record<string, number> = { bronze: 0, silver: 1, gold: 2, standout: 2.5, program: 3, promo: 3, landmark: 3.5, legend: 4, spotlight: 5, goat: 6 };
const cmp = (a: [string, number, string], b: [string, number, string]) => (TIER_RANKS[a[2]] ?? 0) - (TIER_RANKS[b[2]] ?? 0) || a[1] - b[1];

function shortName(group: string, name: string): string {
  return name.replace(/ Pack$/, '').replace(/'/g, '’').toUpperCase() || group.toUpperCase();
}

const STATUS: Record<PulledItem['status'], string> = { club: '', storage: 'STORAGE', sold: 'SOLD', sbc: 'SBC', gone: 'GONE' };

function AllCards(props: { ut: UtState; f: typeof saved; set: (k: Partial<typeof saved>) => void; pool: Pool; sport: UtSport; byUid: Map<string, ClubCard>; onInspect: (uid: string) => void }) {
  const { f, set, pool, sport } = props;
  const [shown, setShown] = useState(PAGE_CARDS);
  const e = ovrEdges(sport);
  const items = useMemo(() => {
    return allPulled(props.ut).flatMap((it) => {
      const rc = props.byUid.get(it.uid)?.rc ?? ratedOf(pool, { cardId: it.cardId, level: it.level });
      const ovr = rc?.ovr ?? it.logged?.[1] ?? 0;
      const tier = (rc?.tier ?? it.logged?.[2] ?? 'bronze') as Tier;
      return [{ it, rc, ovr, tier }];
    });
  }, [props.ut.owned, props.ut.duplicateStorage, props.ut.retirements, props.ut.content?.pulls, props.byUid, pool]);
  const ovrMin = f.ovr ? (e[OVR_STEPS.indexOf(f.ovr) - 1] ?? f.ovr) : 0;
  const list = items.filter((x) => x.ovr >= ovrMin && tierOk(f.allTier, x.tier, x.ovr, e[3]));
  const pre = items.filter((x) => x.it.origin === 'pre').length;
  const label = (it: PulledItem) =>
    it.entry
      ? it.entry.n
      : { pre: 'Before tracker', old: 'Earlier pack', sbc: 'SBC reward', market: 'Scout Market', pick: 'Pick', other: 'Other', pack: 'Pack' }[it.origin];
  return (
    <>
      <Chips
        label="Overall"
        items={[[0, 'ANY OVR'], ...OVR_STEPS.slice(1).map((x, i) => [x, e[i] + '+'] as [OvrF, string])]}
        value={f.ovr}
        onChange={(v) => (set({ ovr: v }), setShown(PAGE_CARDS))}
      />
      <Chips
        label="Tier"
        items={[
          ['any', 'ANY TIER'],
          ['bronze', 'BRONZE'],
          ['silver', 'SILVER'],
          ['gold', 'GOLD'],
          ['special', 'SPECIAL'],
        ]}
        value={(['any', 'bronze', 'silver', 'gold', 'special'] as TierF[]).includes(f.allTier) ? f.allTier : 'any'}
        onChange={(v) => (set({ allTier: v }), setShown(PAGE_CARDS))}
      />
      <p className="ut-trk-count">
        <b className="num">{list.length.toLocaleString('en-US')}</b> {list.length === 1 ? 'card' : 'cards'}
        {list.length !== items.length ? ' of ' + items.length.toLocaleString('en-US') : ''} · newest first
        {pre > 0 && <> · {pre.toLocaleString('en-US')} from before the tracker</>}
      </p>
      {list.length ? (
        <div className="ut-trk-grid">
          {list.slice(0, shown).map(({ it, rc }) => (
            <div key={it.uid} className={'ut-trk-item' + (it.origin === 'pre' ? ' pre' : '') + (it.status === 'club' || it.status === 'storage' ? '' : ' gone')}>
              {rc ? (
                it.status === 'club' || it.status === 'storage' ? (
                  <button className="ut-trk-mini" onClick={() => props.onInspect(it.uid)} aria-label={rc.line.name + ', ' + rc.ovr + ', ' + TIER_NAMES[rc.tier] + ', ' + label(it)}>
                    <UtCard rc={rc} w={70} level={it.level} />
                  </button>
                ) : (
                  <UtCard rc={rc} w={70} />
                )
              ) : (
                <span className="ut-trk-missing" style={{ width: 70, height: 98 }} />
              )}
              {STATUS[it.status] && <i className={'ut-trk-status st-' + it.status}>{STATUS[it.status]}</i>}
              <small className="ut-trk-from">{label(it)}</small>
              <small className="ut-trk-date">{it.at ? day(it.at) : '—'}</small>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState icon={<IconChart size={24} />} title={items.length ? 'No cards match' : 'No cards yet'}>
          {items.length ? 'Try a lower overall or another tier.' : 'Open your starter pack in the Store.'}
        </EmptyState>
      )}
      {shown < list.length && (
        <button className="btn ut-trk-show" onClick={() => setShown((n) => n + PAGE_CARDS)}>
          SHOW {Math.min(PAGE_CARDS, list.length - shown)} MORE
        </button>
      )}
      <p className="note">Cards packed before the tracker show “Before tracker”: their pack type was never saved. Sold and SBC cards appear while the save still remembers them.</p>
    </>
  );
}

const OVR_STEPS: OvrF[] = [0, 75, 80, 83, 86, 90];
