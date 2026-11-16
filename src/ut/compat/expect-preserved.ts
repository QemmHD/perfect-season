// Claude, 2026-11-10 (studio overhaul, team ut): what an old save must keep, as data, so a test and
// the mixed-client script (scripts/compat/old-client.ts) can name exactly what was lost. Two views:
//   - families: every field family an acdf3e2 save carries, compared whole (JSON-equal = kept);
//   - atoms: every receipt, coin, owned copy (with level, XP and mint), squad slot and season claim
//     as one string each, so a set difference lists precisely what disappeared.
// No imports beyond types: it runs in Vitest, in vite-node and against the old tree's output alike.
import type { UtState } from '../state';

/** Every field family of an acdf3e2 `ut` save, by path. */
export const UT_FAMILIES = [
  'owned',
  'duplicateStorage',
  'squad',
  'formation',
  'packsOpened',
  'starterClaimed',
  'sbc',
  'packs',
  'sold',
  'battles',
  'record',
  'paid',
  'hq.totals',
  'hq.days',
  'hq.weeks',
  'hq.seasons',
  'hq.claims',
  'hq.journal',
  'hq.history',
  'hq.cardStats',
  'hq.presets',
  'hq.development',
  'hq.moments',
  'hq.circuit',
  'hq.circuitHistory',
  'content.daily',
  'content.buys',
  'content.picks',
  'content.claims',
  'content.market',
  'content.soWins',
  'content.draft',
  'content.era',
  'content.locked',
  'content.evo',
  'content.evoSeen',
  'content.streams',
  'content.calendar',
  'content.preview',
  'content.pulls',
  'league',
  'cup',
  'rivals',
  'settled',
  'collected',
  'collectionClaims',
  'registeredOpenings',
  'events',
  'pendingPromo',
  'retirements',
] as const;

/** Every field family of the profile around it (the shared wallet and this sport's own records). */
export const PROFILE_FAMILIES = [
  'coins',
  'xp',
  'inventory',
  'settings',
  'name',
  'streak',
  'rewardDay',
  'gifts',
  'firstRun',
  'mode',
  'botLevel',
  'history',
  'daily',
  'stats',
  'lb',
  'collection',
  'gauntlet',
  'h2h',
  'missions',
  'activeMatch',
  'vs',
] as const;

export interface SaveLike {
  coins?: number;
  xp?: number;
  ut: UtState;
  [k: string]: unknown;
}

const at = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((v, k) => (v && typeof v === 'object' ? (v as Record<string, unknown>)[k] : undefined), o);

/** Key-order-independent JSON, so two equal values always compare equal. */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object')
    return (
      '{' +
      Object.keys(v as object)
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stable((v as Record<string, unknown>)[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(v ?? null);
}

/** The families (of `families`) present in `before` whose value differs in `after`. */
export function changedFamilies(before: unknown, after: unknown, families: readonly string[]): string[] {
  return families.filter((f) => at(before, f) !== undefined && stable(at(before, f)) !== stable(at(after, f)));
}

/** The families a save actually holds (to prove a fixture covers them all). */
export function presentFamilies(save: unknown, families: readonly string[]): string[] {
  return families.filter((f) => at(save, f) !== undefined);
}

/**
 * Everything that must survive any load, save or mixed-client round trip, one string per atom.
 * Caches and UI memory are deliberately absent: only progress, receipts and property.
 */
export function atoms(p: SaveLike): string[] {
  const out: string[] = [];
  const add = (k: string, v: unknown) => out.push(k + ':' + (typeof v === 'string' ? v : stable(v)));
  add('coins', p.coins ?? 0);
  add('xp', p.xp ?? 0);
  for (const k of ['inventory', 'streak', 'gifts', 'h2h', 'gauntlet', 'stats'] as const) if (p[k] !== undefined) add(k, p[k]);
  const ut = p.ut;
  for (const c of ut.owned) add('owned', c);
  for (const uid of ut.duplicateStorage ?? []) add('storage', uid);
  for (const [slot, uid] of Object.entries(ut.squad)) add('squad', slot + '=' + uid);
  if (ut.formation) add('formation', ut.formation);
  add('packsOpened', ut.packsOpened);
  add('starterClaimed', ut.starterClaimed);
  for (const [id, t] of Object.entries(ut.sbc.done)) add('sbc', id + '@' + t);
  for (const pk of ut.packs) add('pack', pk);
  add('sold', ut.sold);
  add('battles', ut.battles);
  add('record', ut.record);
  add('paid', ut.paid);
  const h = ut.hq;
  if (h) {
    add('totals', h.totals);
    for (const [k, v] of Object.entries(h.days)) add('day', k + '=' + stable(v));
    for (const [k, v] of Object.entries(h.weeks)) add('week', k + '=' + stable(v));
    for (const [k, s] of Object.entries(h.seasons)) {
      add('season.xp', k + '=' + s.xp);
      for (const t of s.claimed) add('season.claimed', k + '#' + t);
    }
    for (const x of h.claims) add('hq.claim', x);
    for (const x of h.journal) add('hq.journal', x);
    for (const m of h.history) add('hq.history', m);
    for (const [uid, v] of Object.entries(h.cardStats)) add('cardStats', uid + '=' + stable(v));
    for (const pr of h.presets) for (const [slot, uid] of Object.entries(pr.squad)) add('preset', pr.id + ':' + slot + '=' + uid);
    if (h.development.active) add('dev.active', h.development.active);
    for (const [uid, d] of Object.entries(h.development.completed)) add('dev.done', uid + '=' + stable(d));
    for (const [id, m] of Object.entries(h.moments)) add('moment', id + '=' + stable(m));
    add('circuit', h.circuit);
    for (const [w, c] of Object.entries(h.circuitHistory ?? {})) add('circuitHistory', w + '=' + stable(c));
  }
  const c = ut.content;
  if (c) {
    for (const x of c.claims ?? []) add('content.claim', x);
    for (const x of c.picks ?? []) add('pick', x);
    for (const x of c.locked ?? []) add('locked', x);
    for (const [uid, e] of Object.entries(c.evo ?? {})) add('evo', uid + '=' + stable(e));
    for (const k of ['daily', 'buys', 'market', 'soWins', 'draft', 'era', 'streams', 'calendar', 'preview'] as const) if (c[k] !== undefined) add('content.' + k, c[k]);
    if (c.pulls) {
      add('pulls.since', c.pulls.since);
      for (const [k, a] of Object.entries(c.pulls.a)) add('pulls.total', k + '=' + stable(a));
      for (const e of c.pulls.r) add('pulls.recent', e.id);
    }
  }
  if (ut.league) add('league', ut.league);
  if (ut.cup) {
    for (const x of ut.cup.claims) add('cup.claim', x);
    add('cup.trophies', ut.cup.trophies);
    for (const x of ut.cup.history) add('cup.history', x);
    if (ut.cup.active) add('cup.active', ut.cup.active);
  }
  if (ut.rivals) {
    for (const x of ut.rivals.claimed) add('rivals.claimed', x);
    for (const x of ut.rivals.rewards) add('rivals.reward', x.id);
    add('rivals.standing', { week: ut.rivals.week, points: ut.rivals.points, best: ut.rivals.best, peak: ut.rivals.peak, w: ut.rivals.w, l: ut.rivals.l });
  }
  for (const x of ut.settled ?? []) add('settled', x);
  for (const x of ut.collected ?? []) add('collected', x);
  for (const x of ut.collectionClaims ?? []) add('collectionClaim', x);
  for (const x of ut.registeredOpenings ?? []) add('registeredOpening', x);
  for (const [id, n] of Object.entries(ut.events ?? {})) add('event', id + '=' + n);
  if (ut.pendingPromo) add('pendingPromo', ut.pendingPromo);
  for (const x of ut.retirements ?? []) add('retirement', x);
  return out;
}

/** The atoms of `before` that `after` no longer has: an empty list means nothing was lost. */
export function lostAtoms(before: SaveLike, after: SaveLike): string[] {
  const kept = new Set(atoms(after));
  return atoms(before).filter((a) => !kept.has(a));
}
