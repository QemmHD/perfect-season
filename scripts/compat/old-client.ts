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
// Claude, 2026-11-16 (ut-2): also
//   - a save without the new fields is written byte for byte as the old client writes it;
//   - each save again with a MINUTES ledger (profile.playtime) and the two healthy-play settings in
//     the shared (basketball) key: they must come back byte-equal from the old client, in the profile
//     keys and through the encrypted cloud snapshot (new capture -> old apply/capture -> new apply).
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
const curCloud = (await import(join(REPO, 'src/lib/cloud-data.ts'))) as Mod;
const oldCloud = (await import(join(S, 'lib/cloud-data.ts'))) as Mod;
const SHARED_KEY = 'perfect-season:profile:v1';
/** A MINUTES ledger as this build writes it (V2 E.3), with claims, owed receipts and league state. */
const LEDGER = {
  v: 1, life: 40000, rawLife: 52000, day: '2026-11-16', daySec: 1620, dayMenuSec: 240, rawDaySec: 2400, week: '2026-W47',
  weekDays: [1620, 0, 0, 0, 0, 0, 0], bySport: { nba: 30000, nfl: 6000, soccer: 4000 }, acts: 110, weekActs: [5, 0, 0, 0, 0, 0, 0],
  claimed: { day: [0, 1], week: [], life: [0, 1, 2], dayKey: '2026-11-16', weekKey: '2026-W47' },
  league: { tier: 2, season: 'S1', best: 2, lastWeek: { week: '2026-W46', rank: 3, am: 310, moved: 1 } },
  restedDay: '2026-11-16', owed: ['stamp:day:2026-11-15:30:0'], hook: { drops: 2, road: ['l5'] },
};
const NEW_SETTINGS = { hideBoards: true, breakReminder: false };

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
const fail = (why: string) => {
  failed = true;
  console.error(SPORT + ': ' + why);
};
const dumpAfter = (storage: Record<string, unknown>, mod: Mod) => {
  useStorage(new MemoryStorage(structuredClone(storage)));
  mod.saveProfile(mod.loadProfile());
  return (globalThis as unknown as { localStorage: MemoryStorage }).localStorage.dump();
};
const cases: { file: string; storage: Record<string, unknown>; minutes: boolean }[] = [];
for (const file of inputs) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  const storage: Record<string, unknown> = raw.storage ?? raw;
  cases.push({ file, storage, minutes: false });
  const shared = storage[SHARED_KEY] as Record<string, unknown> | undefined;
  if (shared && !shared.playtime)
    cases.push({ file: file + ' +MINUTES', storage: { ...storage, [SHARED_KEY]: { ...shared, playtime: LEDGER, settings: { ...(shared.settings as object), ...NEW_SETTINGS } } }, minutes: true });
}
for (const { file, storage, minutes } of cases) {
  // 0. a save without the new fields: this build writes exactly what the live build writes
  if (!minutes) {
    const a = dumpAfter(storage, cur),
      b = dumpAfter(storage, old);
    if (JSON.stringify(a) !== JSON.stringify(b)) fail('this build writes an old save differently from the live build');
    else console.log(SPORT + ': an old save is written byte for byte as the live build writes it (' + file.replace(REPO + '/', '') + ')');
  }
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
  if (minutes) {
    const want = JSON.stringify(LEDGER),
      sharedOld = JSON.parse(JSON.stringify(oldSave[SHARED_KEY] ?? null));
    if (JSON.stringify(back.playtime) !== want) fail('the ledger changed in the round trip');
    if (JSON.stringify(sharedOld?.playtime) !== want) fail('the live build dropped the ledger from the shared key');
    for (const k of Object.keys(NEW_SETTINGS) as (keyof typeof NEW_SETTINGS)[])
      if ((back.settings as Record<string, unknown>)[k] !== NEW_SETTINGS[k]) fail('the setting ' + k + ' was lost in the round trip');
    // the cloud snapshot: this build captures, the live build restores and captures, this build restores
    useStorage(new MemoryStorage(newSave));
    const snap = curCloud.captureProgress(globalThis.localStorage);
    useStorage(new MemoryStorage({}));
    oldCloud.applyProgress(globalThis.localStorage, snap);
    const oldSnap = oldCloud.captureProgress(globalThis.localStorage);
    useStorage(new MemoryStorage({}));
    curCloud.applyProgress(globalThis.localStorage, oldSnap);
    const cloudBack = cur.loadProfile() as SaveLike;
    if (JSON.stringify(cloudBack.playtime) !== want) fail('the ledger changed through the cloud snapshot');
    if (Object.entries(NEW_SETTINGS).some(([k, v]) => (cloudBack.settings as Record<string, unknown>)[k] !== v)) fail('a setting was lost through the cloud snapshot');
    if (lostAtoms(fresh, cloudBack).length) fail('the cloud snapshot lost ' + lostAtoms(fresh, cloudBack).length + ' atoms');
    else console.log(SPORT + ': the ledger and settings survive the old client, in the profile keys and through the cloud snapshot');
  }
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
