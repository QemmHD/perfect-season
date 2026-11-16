/// <reference types="vite/client" />
// Claude (packs-1, 2026-11-10): the packs team's "before" snapshot. One compact record per sport of
// everything later packs work must either keep exactly or change on purpose (docs/studio-overhaul/
// packs.md): the ratings of every special edition at levels 1-5, the 60-day SBC catalogue, 20
// registered-receipt seeds, the started Live Calendar entries, the frozen numbered-card catalogs, the
// quick-sell summary per tier and a fingerprint of the rating modules other teams own.
// scripts/packs/snapshot.ts writes it to src/ut/__fixtures__/packs-before/<sport>.json; the
// packs-economy suite takes a fresh one and compares. Test and tool code only: no app module imports it.
import calendarJson from '../../data/live-calendar.json';
import editionsJson from '../../data/live-editions.json';
import numberedNba from '../../data/numbered-nba.json';
import numberedNfl from '../../data/numbered-nfl.json';
import { hashString } from '../../engine/rng';
import { manifest } from '../calendar';
import { landmarkId } from '../editions';
import { landmarkCatalog } from '../landmarks';
import { quickSellValue, registeredPack } from '../packs';
import type { Pool } from '../pool';
import { rateCard } from '../rate';
import { sbcsFor, weekOf } from '../sbc';
import { standoutProgram } from '../standouts';
import type { RatedCard, Tier, UtSport } from '../types';

/** Started content never moves: only promos starting on or after this day may change (packs plan §1). */
export const PROMO_EDIT_FROM = '2026-12-04';
/** The SBC catalogue window: 60 Eastern days from the day the snapshot was first taken. */
export const SBC_FROM = '2026-11-10';
export const SBC_DAYS = 60;
/** Weekly Standouts that have started by the cutoff (they launched in 2026-W44). */
export const STANDOUT_WEEKS = (() => {
  const out: string[] = [];
  for (let w = 44; '2026-W' + w <= weekOf(PROMO_EDIT_FROM); w++) out.push('2026-W' + w);
  return out;
})();
export const RECEIPTS = 20;

/** Rating modules other teams own (rate.ts reads them): a change there moves our fixture. */
const FOREIGN = import.meta.glob<string>(['../../game/hoops2/ratings.ts', '../../game/football2/ratings.ts', '../card-face.ts', '../calibration.ts', '../season-reference.ts'], { query: '?raw', import: 'default', eager: true });

/** The special editions a row is kept for, in a fixed order. */
export const SNAPSHOT_KINDS = ['promo', 'legend', 'spotlight', 'goat', 'landmark', 'standout', 'program'] as const;
export type SnapshotKind = (typeof SNAPSHOT_KINDS)[number];

export interface PacksSnapshot {
  v: 1;
  sport: UtSport;
  promoEditFrom: string;
  /** file → "length:hash" of its source, and the hash over all of them */
  foreign: Record<string, string>;
  foreignFingerprint: string;
  /** kind → the id prefix its rows leave out ("nba:promo:") */
  prefixes: Record<SnapshotKind, string>;
  /** kind → card id after its prefix → "<ovr L1>~<steps to L2..L5>|tier if not the kind|rawOvr|face L1|hash(attrs L1)|hash(attrs L5)" */
  ratings: Record<SnapshotKind, Record<string, string>>;
  /** tier → [min, median, max] quick-sell at level 1 over the tier's cards (the deliberate QS change shows here) */
  qs: Partial<Record<Tier, [number, number, number]>>;
  /** day → hash of the day's full SBC list (ids, titles, requirements, rewards) */
  sbcs: Record<string, string>;
  /** [seed, chase id or "", card ids] through registeredPack */
  receipts: [string, string, string][];
  /** started Live Calendar entries (start before the cutoff) → hash of the entry and its frozen selection */
  started: Record<string, string>;
  /** the frozen numbered catalogs (src/data/numbered-*.json) → hash */
  numbered: Record<string, string>;
}

const h36 = (s: string) => hashString(s).toString(36);
/** A 64-bit-ish digest: two FNV passes (forward, and over the reversed text) plus the length. */
export const digest = (s: string) => s.length.toString(36) + ':' + h36(s) + h36(s.split('').reverse().join(''));
const attrsHash = (a: Record<string, number>) => h36(Object.keys(a).sort().map((k) => k + a[k]).join(','));

export function foreignPrint(): { files: Record<string, string>; print: string } {
  const files: Record<string, string> = {};
  for (const k of Object.keys(FOREIGN).sort()) files[k.replace(/^(\.\.\/)+/, '')] = digest(String(FOREIGN[k]));
  return { files, print: digest(JSON.stringify(files)) };
}

/** Every special edition of the snapshot, by kind (de-duplicated, sorted by id). */
export function snapshotEditions(pool: Pool): Record<SnapshotKind, RatedCard[]> {
  const sport = pool.sport;
  const out = Object.fromEntries(SNAPSHOT_KINDS.map((k) => [k, new Map<string, RatedCard>()])) as Record<SnapshotKind, Map<string, RatedCard>>;
  const put = (k: SnapshotKind, rc: RatedCard | undefined) => rc && out[k].set(rc.line.id, rc);
  for (const t of ['promo', 'legend', 'spotlight', 'goat'] as const) for (const rc of Object.values(pool.buckets[t]).flat()) put(t, rc);
  for (const sid of landmarkCatalog(pool.lines).keys()) {
    const season = pool.byId.get(sid);
    if (season) put('landmark', pool.base.get(landmarkId(season)));
  }
  for (const w of STANDOUT_WEEKS) for (const rc of standoutProgram(pool, w).cards) put('standout', rc);
  for (const sel of Object.values(manifest())) for (const [id] of sel[sport] ?? []) put('program', pool.base.get(id));
  return Object.fromEntries(SNAPSHOT_KINDS.map((k) => [k, [...out[k].values()].sort((a, b) => (a.line.id < b.line.id ? -1 : 1))])) as Record<SnapshotKind, RatedCard[]>;
}

/** One edition at levels 1-5 (levels never lower an overall, and a level adds at most a point or two). */
export function ratingRow(pool: Pool, rc: RatedCard, kind: string): string {
  const line = pool.byId.get(rc.line.id) ?? rc.line;
  const levels = [rc, ...[2, 3, 4, 5].map((l) => rateCard(line, l))];
  const steps = levels.slice(1).map((r, i) => r.ovr - levels[i].ovr);
  if (steps.some((d) => d < 0 || d > 9)) throw new Error('Unexpected level step for ' + rc.line.id + ': ' + steps.join(','));
  const face = (rc.face ?? rc.key).map((x) => x[2]).join('.');
  return [rc.ovr + '~' + steps.join(''), rc.tier === kind ? '' : rc.tier, rc.rawOvr ?? '', face, attrsHash(rc.attrs), attrsHash(levels[4].attrs)].join('|');
}

/** A row read back: OVR at levels 1-5, the tier, the raw overall and the face. */
export function parseRow(row: string, kind: string): { ovr: number[]; tier: string; raw: string; face: string } {
  const [o, tier, raw, face] = row.split('|');
  const [l1, steps] = o.split('~');
  const ovr = [Number(l1)];
  for (const d of steps) ovr.push(ovr[ovr.length - 1] + Number(d));
  return { ovr, tier: tier || kind, raw, face };
}

/** The rows of a kind by full card id. */
export function rowsOf(s: PacksSnapshot, kind: SnapshotKind): Map<string, string> {
  return new Map(Object.entries(s.ratings[kind]).map(([id, r]) => [s.prefixes[kind] + id, r]));
}

/** The longest shared prefix of the ids, cut after its last ':'. */
function prefixOf(ids: string[]): string {
  if (!ids.length) return '';
  let p = ids[0];
  for (const id of ids) while (!id.startsWith(p)) p = p.slice(0, -1);
  return p.slice(0, p.lastIndexOf(':') + 1);
}

const median3 = (xs: number[]): [number, number, number] => {
  const s = xs.slice().sort((a, b) => a - b);
  return [s[0], s[Math.floor(s.length / 2)], s[s.length - 1]];
};

export function sbcDays(): string[] {
  const t0 = Date.UTC(+SBC_FROM.slice(0, 4), +SBC_FROM.slice(5, 7) - 1, +SBC_FROM.slice(8, 10));
  return Array.from({ length: SBC_DAYS }, (_, i) => new Date(t0 + i * 86400000).toISOString().slice(0, 10));
}

/** The started (pre-cutoff) Live Calendar entries: promos with their frozen selection, SBCs, packs. */
export function startedEntries(): Record<string, string> {
  const cal = calendarJson as unknown as { seasons: { promos: { id: string; start: string }[]; sbcs: { id: string; start: string }[]; packs: { id: string; start: string }[] }[] };
  const frozen = editionsJson as unknown as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const se of cal.seasons) {
    for (const p of se.promos) if (p.start < PROMO_EDIT_FROM) out['promo:' + p.id] = digest(JSON.stringify(p) + '|' + JSON.stringify(frozen[p.id] ?? null));
    for (const b of se.sbcs) if (b.start < PROMO_EDIT_FROM) out['sbc:' + b.id] = digest(JSON.stringify(b));
    for (const k of se.packs) if (k.start < PROMO_EDIT_FROM) out['pack:' + k.id] = digest(JSON.stringify(k));
  }
  return out;
}

/** The committed numbered catalogs, hashed the way scripts/build_numbered_catalog.ts --check hashes them. */
export function numberedPrint(): Record<string, string> {
  return { nba: digest(JSON.stringify(numberedNba)), nfl: digest(JSON.stringify(numberedNfl)) };
}

/** The receipts a registered Spotlight pack rebuilds from: seed → chase id → the cards. */
export function receiptRows(pool: Pool): [string, string, string][] {
  const chase = Object.values(pool.buckets.spotlight)
    .flat()
    .map((rc) => rc.line.id)
    .sort();
  return Array.from({ length: RECEIPTS }, (_, i) => {
    const seed = 'packs-before:receipt:' + pool.sport + ':' + i;
    const id = i % 2 && chase.length ? chase[(i * 7) % chase.length] : '';
    return [seed, id, registeredPack(pool, 'spotlight', seed, id || null).map((rc) => rc.line.id).join(',')];
  });
}

export function takeSnapshot(pool: Pool): PacksSnapshot {
  const eds = snapshotEditions(pool);
  const prefixes = Object.fromEntries(SNAPSHOT_KINDS.map((k) => [k, prefixOf(eds[k].map((rc) => rc.line.id))])) as PacksSnapshot['prefixes'];
  const ratings = Object.fromEntries(SNAPSHOT_KINDS.map((k) => [k, Object.fromEntries(eds[k].map((rc) => [rc.line.id.slice(prefixes[k].length), ratingRow(pool, rc, k)]))])) as PacksSnapshot['ratings'];
  const byTier: Partial<Record<Tier, number[]>> = {};
  for (const t of ['bronze', 'silver', 'gold'] as const) byTier[t] = Object.values(pool.buckets[t]).flat().map(quickSellValue);
  for (const k of SNAPSHOT_KINDS) for (const rc of eds[k]) (byTier[rc.tier] ??= []).push(quickSellValue(rc));
  const qs: PacksSnapshot['qs'] = {};
  for (const [t, v] of Object.entries(byTier)) if (v.length) qs[t as Tier] = median3(v);
  const sbcs: PacksSnapshot['sbcs'] = {};
  for (const day of sbcDays()) sbcs[day] = digest(JSON.stringify(sbcsFor(pool, day)));
  const f = foreignPrint();
  return { v: 1, sport: pool.sport, promoEditFrom: PROMO_EDIT_FROM, foreign: f.files, foreignFingerprint: f.print, prefixes, ratings, qs, sbcs, receipts: receiptRows(pool), started: startedEntries(), numbered: numberedPrint() };
}

/** The top-level sections where two snapshots differ, with up to `max` example paths each. */
export function diffSnapshot(a: PacksSnapshot, b: PacksSnapshot, max = 5): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const note = (sec: string, path: string) => {
    const l = (out[sec] ??= []);
    if (l.length < max) l.push(path);
  };
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof PacksSnapshot>;
  for (const k of keys) {
    const x = a[k] as unknown;
    const y = b[k] as unknown;
    if (JSON.stringify(x) === JSON.stringify(y)) continue;
    if (x && y && typeof x === 'object' && typeof y === 'object' && !Array.isArray(x)) {
      const sub = new Set([...Object.keys(x), ...Object.keys(y as object)]);
      for (const s of sub) {
        const xs = (x as Record<string, unknown>)[s];
        const ys = (y as Record<string, unknown>)[s];
        if (JSON.stringify(xs) === JSON.stringify(ys)) continue;
        if (xs && ys && typeof xs === 'object' && !Array.isArray(xs)) {
          for (const id of new Set([...Object.keys(xs), ...Object.keys(ys as object)]))
            if (JSON.stringify((xs as Record<string, unknown>)[id]) !== JSON.stringify((ys as Record<string, unknown>)[id])) note(k, s + '.' + id);
        } else note(k, s);
      }
    } else note(k, String(k));
  }
  return out;
}
