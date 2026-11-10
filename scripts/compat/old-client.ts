// Claude, 2026-11-10 (studio overhaul, team ut): the mixed-client round trip. A player can have this
// build on one phone and the live build (acdf3e2) on another, or open a home-screen app before it
// updates; cloud saves carry whole profiles between them. So a save must survive
//   new client loads and saves it  ->  old client loads and saves it  ->  new client loads it
// with no receipt, coin, card, level, XP, squad or season lost (a lost receipt is a reward that can
// be claimed twice). The old client is the real acdf3e2 code (scripts/compat/acdf3e2.ts), not a copy.
//
//   bash O/heavy.sh npx vite-node scripts/compat/old-client.ts                 today's fixtures, 3 sports
//   PS_SPORT=nfl PS_COMPAT_ONE=1 npx vite-node scripts/compat/old-client.ts    one sport (its fixture)
//   PS_COMPAT_SAVES=a.json,b.json  saves to test instead: a fixture ({ storage }) or a raw dump of
//                                  localStorage's profile keys, for the sport in PS_SPORT
// It prints what the old client drops (new additive fields: each must be a cache or have its
// receipt mirrored in a kept list, docs/studio-overhaul/ut-plan.md §2) and fails on any loss.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { changedFamilies, lostAtoms, PROFILE_FAMILIES, UT_FAMILIES, type SaveLike } from '../../src/ut/compat/expect-preserved';
import { MemoryStorage, oldSrc, REPO, useStorage } from './acdf3e2';

const SPORTS = ['nba', 'nfl', 'soccer'];

if (!process.env.PS_COMPAT_ONE) {
  let failed = 0;
  for (const sport of SPORTS)
    try {
      execFileSync('npx', ['vite-node', 'scripts/compat/old-client.ts'], { cwd: REPO, stdio: 'inherit', env: { ...process.env, PS_SPORT: sport, PS_COMPAT_ONE: '1' } });
    } catch {
      failed++;
    }
  console.log(failed ? 'old-client: FAILED in ' + failed + ' sport(s)' : 'old-client: all 3 sports lose nothing');
  process.exit(failed ? 1 : 0);
}

type Mod = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
const S = oldSrc();
// one at a time: parallel imports of module graphs with cycles can stall vite-node silently
const { SPORT } = (await import(join(REPO, 'src/engine/sport.ts'))) as Mod;
const cur = (await import(join(REPO, 'src/lib/profile.ts'))) as Mod;
const old = (await import(join(S, 'lib/profile.ts'))) as Mod;
if (cur.loadProfile === old.loadProfile) throw Error('the old tree resolved to the current code');

const inputs = (process.env.PS_COMPAT_SAVES ? process.env.PS_COMPAT_SAVES.split(',') : [join(REPO, 'src/ut/compat/acdf3e2-' + SPORT + '.json')]).map((f) => resolve(f));

/** Paths (to depth 3) that `a` has and `b` lacks: what a whitelisting normalizer dropped. */
function dropped(a: unknown, b: unknown, path = '', depth = 0): string[] {
  if (!a || typeof a !== 'object' || Array.isArray(a) || depth > 2) return [];
  return Object.entries(a as Record<string, unknown>).flatMap(([k, v]) => {
    if (v === undefined) return [];
    const p = path ? path + '.' + k : k;
    const other = b && typeof b === 'object' ? (b as Record<string, unknown>)[k] : undefined;
    return other === undefined ? [p] : dropped(v, other, p, depth + 1);
  });
}

let failed = false;
for (const file of inputs) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const storage: Record<string, unknown> = raw.storage ?? raw;
  // 1. this build loads the save and writes it back (a new-shape save)
  useStorage(new MemoryStorage(storage));
  const fresh = cur.loadProfile() as SaveLike;
  cur.saveProfile(fresh);
  const newSave = (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.dump();
  // 2. the live build opens that save and writes it back (a second phone, or a cloud restore)
  useStorage(new MemoryStorage(newSave));
  const oldView = old.loadProfile() as SaveLike;
  old.saveProfile(oldView);
  const oldSave = (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.dump();
  // 3. this build loads what the old one wrote
  useStorage(new MemoryStorage(oldSave));
  const back = cur.loadProfile() as SaveLike;

  const lost = lostAtoms(fresh, back);
  const report = {
    sport: SPORT,
    save: file.replace(REPO + '/', ''),
    oldClientDrops: dropped(fresh, oldView),
    changedProfileFamilies: changedFamilies(fresh, back, PROFILE_FAMILIES),
    changedUtFamilies: changedFamilies(fresh.ut, back.ut, UT_FAMILIES),
    lost,
  };
  console.log(JSON.stringify(report, null, 1));
  if (lost.length) {
    failed = true;
    console.error('LOST in the ' + SPORT + ' round trip (' + lost.length + '): ' + lost.slice(0, 20).join(' | '));
  } else console.log(SPORT + ': round trip new -> old (acdf3e2) -> new loses nothing (' + file.replace(REPO + '/', '') + ')');
}
process.exit(failed ? 1 : 0);
