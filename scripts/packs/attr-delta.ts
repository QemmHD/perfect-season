// Claude (packs-5, 2026-11-16): the per-position played-attribute change of the re-rated editions, for the
// sport teams' Squad Battles balance (plan packs-5 item 10; docs/studio-overhaul/packs.md).
//   PACKS_OUT=<dir> PACKSIM_LABEL=before-packs-5 PS_SPORT=nba npx vite-node scripts/packs/attr-delta.ts -- --dump
//   PACKS_OUT=<dir> PACKSIM_LABEL=after-packs-5 PACKS_BEFORE=<dir>/before-packs-5 PS_SPORT=nba npx vite-node scripts/packs/attr-delta.ts
// --dump writes every Hot Season, Legend, Spotlight and GOAT edition's played attributes at level 1
// (attrs-<sport>.json). Without it the script compares this tree with such a dump and writes
// attr-delta-<sport>.md: per kind and position, the cards, the mean change over every played attribute
// and over the position's face skills, the largest single change, and the mean displayed-overall change.
// Self-contained (pool and rate exports that predate packs-5), so the same file dumps an older tree.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faceOf } from '../../src/ut/card-face';
import { groupOf } from '../../src/game/football2/ratings';
import { getPool } from '../../src/ut/pool';
import type { RatedCard } from '../../src/ut/types';
import { writeOut } from './out';

const KINDS = ['promo', 'legend', 'spotlight', 'goat'] as const;
const NAME: Record<string, string> = { promo: 'Hot Season', legend: 'Legend', spotlight: 'Spotlight', goat: 'GOAT' };
interface Dumped { kind: string; pos: string; ovr: number; attrs: Record<string, number>; face: string[] }

const pool = await getPool();
const sport = pool.sport;
const posOf = (rc: RatedCard) => (sport === 'nfl' ? groupOf(rc.pos) : rc.line.pos[0]);
const facePos = (rc: RatedCard) => (sport === 'nba' ? (['PG', 'SG', 'SF', 'PF', 'C'].includes(rc.line.pos[0]) ? rc.line.pos[0] : 'SF') : rc.pos);
/** the attributes behind the face: basketball's categories' parts, football's face keys */
const faceCodes = (rc: RatedCard) => (sport === 'nfl' ? faceOf(sport, facePos(rc), rc.attrs).map(([c]) => c) : Object.keys(rc.attrs).filter((c) => !['STA'].includes(c)));
const now: Record<string, Dumped> = {};
for (const kind of KINDS)
  for (const rc of Object.values(pool.buckets[kind]).flat()) now[rc.line.id] = { kind, pos: posOf(rc), ovr: rc.ovr, attrs: rc.attrs, face: faceCodes(rc) };

if (process.argv.includes('--dump')) {
  console.log(sport, Object.keys(now).length, 'editions →', writeOut('attrs-' + sport + '.json', now));
} else {
  const dir = process.env.PACKS_BEFORE;
  if (!dir) throw new Error('Set PACKS_BEFORE to the folder of a --dump run');
  const before = JSON.parse(readFileSync(join(dir, 'attrs-' + sport + '.json'), 'utf8')) as Record<string, Dumped>;
  type Acc = { n: number; all: number; allN: number; face: number; faceN: number; max: number; maxAt: string; ovr: number };
  const acc = new Map<string, Acc>();
  for (const [id, b] of Object.entries(now)) {
    const a = before[id];
    if (!a) continue;
    const key = b.kind + '|' + b.pos;
    const s = acc.get(key) ?? { n: 0, all: 0, allN: 0, face: 0, faceN: 0, max: 0, maxAt: '', ovr: 0 };
    s.n++;
    s.ovr += b.ovr - a.ovr;
    for (const [c, v] of Object.entries(b.attrs)) {
      if (typeof a.attrs[c] !== 'number') continue;
      const d = v - a.attrs[c];
      s.all += d;
      s.allN++;
      if (b.face.includes(c)) {
        s.face += d;
        s.faceN++;
      }
      if (Math.abs(d) > Math.abs(s.max)) [s.max, s.maxAt] = [d, c];
    }
    acc.set(key, s);
  }
  const f = (x: number) => (x > 0 ? '+' : '') + x.toFixed(1);
  const rows = [...acc.entries()].sort(([x], [y]) => KINDS.indexOf(x.split('|')[0] as (typeof KINDS)[number]) - KINDS.indexOf(y.split('|')[0] as (typeof KINDS)[number]) || (x < y ? -1 : 1));
  const md = [
    '| ' + sport.toUpperCase() + ' | Pos | Cards | Mean Δ, every attribute | Mean Δ, face skills | Largest Δ (attribute) | Mean Δ displayed OVR |',
    '|---|---|---|---|---|---|---|',
    ...rows.map(([k, s]) => {
      const [kind, pos] = k.split('|');
      return '| ' + NAME[kind] + ' | ' + pos + ' | ' + s.n + ' | ' + f(s.all / Math.max(1, s.allN)) + ' | ' + f(s.face / Math.max(1, s.faceN)) + ' | ' + f(s.max) + ' (' + s.maxAt + ') | ' + f(s.ovr / s.n) + ' |';
    }),
    '',
  ].join('\n');
  console.log(md);
  console.log('wrote', writeOut('attr-delta-' + sport + '.md', md));
}
