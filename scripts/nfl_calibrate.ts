// NFL calibration harness (read-only). Plays seeded games through the real football engine with
// the kit in src/game/football2/sim-kit.ts and writes docs/studio-overhaul/nfl-calibration/<LABEL>.json
// plus a markdown table beside it. It never reads or writes a profile, a relay or the registry.
//
//   MODE=fast|full  CASES=ai,human,stick,mis,shape,ladder,promo,wall  LABEL=<name>  npx vite-node scripts/nfl_calibrate.ts
//   MODE=pin        pins the fixture squads (card ids and a ratings snapshot) into fixtures.json
//   FIXTURES=pool   rebuilds the pinned card ids from today's card pool instead of the snapshot
//                   (the integration re-run on the merged pool)
//   GAMES=<n>       overrides the games per case
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadCards } from '../src/ut/cards';
import { rateCard } from '../src/ut/rate';
import { NFL_SLOTS } from '../src/ut/squad';
import { defenseOfSquad, offenseOfSquad, type SquadCards } from '../src/ut/teams';
import type { RatedCard } from '../src/ut/types';

const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
const MODE = env.MODE ?? 'fast';
const OUT = 'docs/studio-overhaul/nfl-calibration';
const FIXTURE_FILE = OUT + '/fixtures.json';
mkdirSync(OUT, { recursive: true });

type Tier = 'silver' | 'gold' | 'elite' | 'promo';
const HIGH = ['goat', 'spotlight', 'legend', 'promo'];
const FIXTURE_RULE =
  'Per UT slot, a unique-named card at level 1: silver and gold take the 60th-percentile card of that tier by overall, elite the 97th-percentile gold; promo takes the best GOAT, Spotlight, Legend or promo card for the slot (attributes up to 110), falling back to the elite pick where none plays it.';

/** The fixture squads by the pinned rule, from the rated card pool. */
function pickSquads(cards: RatedCard[]): Record<Tier, Record<string, string>> {
  const at = (pool: RatedCard[], pct: number, used: Set<string>, pos: string) => {
    const xs = pool.filter((c) => c.line.pos.includes(pos as never) && !used.has(c.line.name)).sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id));
    return xs.length ? xs[Math.min(xs.length - 1, Math.floor(xs.length * pct))] : undefined;
  };
  const gold = cards.filter((c) => c.tier === 'gold');
  const out = {} as Record<Tier, Record<string, string>>;
  for (const tier of ['silver', 'gold', 'elite', 'promo'] as Tier[]) {
    const used = new Set<string>();
    const ids: Record<string, string> = {};
    for (const s of NFL_SLOTS) {
      const pos = s.pos!;
      let c: RatedCard | undefined;
      if (tier === 'silver') c = at(cards.filter((x) => x.tier === 'silver'), 0.6, used, pos);
      else if (tier === 'gold') c = at(gold, 0.6, used, pos);
      else if (tier === 'elite') c = at(gold, 0.97, used, pos);
      else c = at(cards.filter((x) => HIGH.includes(x.tier)), 0.9999, used, pos) ?? at(gold, 0.97, used, pos);
      if (!c) throw Error('No fixture card for ' + tier + '/' + s.id);
      ids[s.id] = c.line.id;
      used.add(c.line.name);
    }
    out[tier] = ids;
  }
  return out;
}

async function poolTeams(ids: Record<string, string>) {
  const pool = await loadCards('nfl');
  const sq: SquadCards = {};
  for (const [slot, id] of Object.entries(ids)) {
    const line = pool.byId.get(id);
    if (!line) throw Error('Pinned fixture card ' + id + ' is not in the pool');
    sq[slot] = { line, level: 1 };
  }
  return { offense: offenseOfSquad(sq, 'fixture'), defense: defenseOfSquad(sq, 'fixture') };
}

if (MODE === 'pin') {
  const cards = (await loadCards('nfl')).lines.map((c) => rateCard(c));
  const squads = pickSquads(cards);
  const tiers: Record<string, unknown> = {};
  for (const [tier, ids] of Object.entries(squads)) tiers[tier] = { cards: ids, ...(await poolTeams(ids)) };
  writeFileSync(FIXTURE_FILE, JSON.stringify({ rule: FIXTURE_RULE, pinnedFrom: env.PIN_BASE ?? 'unknown', tiers }, null, 1) + '\n');
  console.log('pinned', Object.keys(tiers).join(', '), '->', FIXTURE_FILE);
} else {
  const kit = await import('../src/game/football2/sim-kit');
  const { HUMAN_STICK_REACTION } = await import('../src/game/football2/pacing');
  const full = MODE === 'full';
  const GAMES = Number(env.GAMES ?? (full ? 400 : 100));
  const CASES = (env.CASES ?? 'ai,human,stick,mis,shape,ladder,promo,wall').split(',');
  const LABEL = env.LABEL ?? MODE;
  const pinned = JSON.parse(readFileSync(FIXTURE_FILE, 'utf8')) as { tiers: Record<Tier, { cards: Record<string, string> }> };
  const fromPool = env.FIXTURES === 'pool';
  const teamCache = new Map<Tier, { off: unknown; def: unknown }>();
  for (const t of kit.TIERS)
    if (fromPool) {
      const p = await poolTeams(pinned.tiers[t].cards);
      teamCache.set(t, { off: p.offense, def: p.defense });
    }
  const teams = (t: Tier) => () => (fromPool ? (JSON.parse(JSON.stringify(teamCache.get(t))) as ReturnType<typeof kit.fixtureTeams>) : kit.fixtureTeams(t));
  const vs = (o: Tier, d: Tier) => () => ({ off: teams(o)().off, def: teams(d)().def });
  const human = (level: keyof typeof kit.LEVELS, extra: Partial<import('../src/game/football2/sim-kit').PilotMode> = {}) => ({ kind: 'human' as const, skill: kit.HUMAN_SKILL, defIQ: kit.LEVELS[level].defIQ, ...extra });
  const ai = (level: keyof typeof kit.LEVELS) => ({ kind: 'ai' as const, ...kit.LEVELS[level] });
  const results: unknown[] = [];
  const timing: Record<string, number> = {};
  const t0 = Date.now();
  const run = (name: string, f: () => unknown) => {
    const s = Date.now();
    const r = f();
    timing[name] = (Date.now() - s) / 1000;
    results.push(r);
    console.error(name, timing[name].toFixed(1) + 's');
  };
  if (CASES.includes('ai'))
    for (const level of ['rookie', 'pro', 'legend'] as const)
      for (const tier of ['silver', 'gold', 'elite'] as Tier[]) run('ai-' + level + '-' + tier, () => kit.runCase(teams(tier), ai(level), 'ai-' + level + '-' + tier, GAMES));
  if (CASES.includes('human'))
    for (const level of ['rookie', 'pro', 'legend'] as const) run('human-' + level + '-gold', () => kit.runCase(teams('gold'), human(level), 'human-' + level + '-gold', GAMES));
  if (CASES.includes('stick'))
    for (const [name, extra] of [
      ['held', { stickDelay: 0 }],
      ['late' + HUMAN_STICK_REACTION, { stickDelay: HUMAN_STICK_REACTION }],
      ['late0.7', { stickDelay: 0.7 }],
      ['untouched', { neverStick: true }]
    ] as const)
      run('stick-' + name, () => kit.runCase(teams('gold'), human('pro', extra), 'stick-' + name, GAMES));
  if (CASES.includes('mis')) {
    run('ai-pro-elite-v-silver', () => kit.runCase(vs('elite', 'silver'), ai('pro'), 'ai-pro-elite-v-silver', GAMES));
    run('ai-pro-silver-v-elite', () => kit.runCase(vs('silver', 'elite'), ai('pro'), 'ai-pro-silver-v-elite', GAMES));
  }
  if (CASES.includes('shape')) run('shape-11-drives', () => kit.runCase(teams('gold'), ai('pro'), 'shape-11-drives', Math.ceil(GAMES / 2), undefined, 11));
  if (CASES.includes('promo'))
    for (const level of ['pro', 'legend'] as const) run('ai-' + level + '-promo', () => kit.runCase(teams('promo'), ai(level), 'ai-' + level + '-promo', GAMES));
  if (CASES.includes('ladder'))
    for (const level of ['rookie', 'pro', 'legend'] as const) {
      run('ladder-' + level, () => kit.ladder(teams('gold')(), teams('gold')(), level, GAMES, human(level), 'ladder-' + level));
      run('ladder-' + level + '-stick', () => kit.ladder(teams('gold')(), teams('gold')(), level, GAMES, human(level, { stickDelay: HUMAN_STICK_REACTION }), 'ladder-' + level + '-stick'));
    }
  if (CASES.includes('wall')) {
    // a person's pace (2.5 s to call a play, replays on) with the stick found 0.35 s after each catch
    run('wall-human', () => kit.runCase(teams('gold'), human('pro', { stickDelay: HUMAN_STICK_REACTION }), 'wall-human', Math.min(GAMES, 30), kit.HUMAN_PACE));
    run('wall-auto', () => kit.runCase(teams('gold'), { kind: 'ai', skill: 0.75, defIQ: 0 }, 'wall-auto', Math.min(GAMES, 30), kit.AUTO_PACE));
  }
  const total = (Date.now() - t0) / 1000;
  const out = { label: LABEL, mode: MODE, games: GAMES, fixtures: fromPool ? 'pool' : 'pinned', seconds: total, timing, results };
  writeFileSync(OUT + '/' + LABEL + '.json', JSON.stringify(out, null, 1) + '\n');
  writeFileSync(OUT + '/' + LABEL + '.md', table(out));
  console.error('done in', total.toFixed(0) + 's ->', OUT + '/' + LABEL + '.{json,md}');
}

// ---------- the markdown table ----------

interface B {
  v: number;
  n: number;
  lo?: number;
  hi?: number;
}
function cell(b: B | undefined, pct = false): string {
  if (!b || !Number.isFinite(b.v)) return '–';
  const f = (x: number) => (pct ? (x * 100).toFixed(1) : x.toFixed(2));
  return b.lo === undefined ? f(b.v) : f(b.v) + ' [' + f(b.lo) + '–' + f(b.hi!) + ']';
}
function table(out: { label: string; mode: string; games: number; seconds: number; results: unknown[] }): string {
  const rows: string[] = [];
  rows.push('# NFL calibration: ' + out.label, '', `Mode ${out.mode}, ${out.games} games per case, ${out.seconds.toFixed(0)} s. Each cell is the value and its 95% interval; n is in the JSON beside this file.`, '');
  const cols: [string, (r: Record<string, any>) => string][] = [
    ['pts/drive', (r) => cell(r.ptsPerDrive)],
    ['TD % dr', (r) => cell(r.driveEnds?.TD, true)],
    ['TO % dr', (r) => cell(r.turnoverDrives, true)],
    ['DOWNS % dr', (r) => cell(r.driveEnds?.DOWNS, true)],
    ['cmp %', (r) => cell(r.completion, true)],
    ['INT %', (r) => cell(r.intRate, true)],
    ['sack %', (r) => cell(r.sackRate, true)],
    ['TTT s', (r) => cell(r.timeToThrow)],
    ['YAC', (r) => cell(r.yac)],
    ['20+ % att', (r) => cell(r.gain20PerAttempt, true)],
    ['YPC', (r) => cell(r.runs?.ypc)],
    ['run ≤0 %', (r) => cell(r.runs?.stuffed, true)],
    ['run 10+ %', (r) => cell(r.runs?.['10+'], true)],
    ['3rd %', (r) => cell(r.third?.all, true)],
    ['tie odds %', (r) => cell(r.scores?.tie, true)],
    ['plays', (r) => String(r.plays ?? '')]
  ];
  const cases = out.results.filter((r) => (r as { ptsPerDrive?: unknown }).ptsPerDrive) as Record<string, any>[];
  rows.push('| case | ' + cols.map((c) => c[0]).join(' | ') + ' |', '|' + '---|'.repeat(cols.length + 1));
  for (const r of cases) rows.push('| ' + r.label + ' | ' + cols.map((c) => c[1](r)).join(' | ') + ' |');
  const ladders = out.results.filter((r) => (r as { win?: unknown }).win) as Record<string, any>[];
  if (ladders.length) {
    rows.push('', '| ladder (human proxy vs AI, gold v gold) | win % | tie % | loss % |', '|---|---|---|---|');
    for (const l of ladders) rows.push('| ' + l.label + ' | ' + cell(l.win, true) + ' | ' + cell(l.tie, true) + ' | ' + cell(l.loss, true) + ' |');
  }
  const walls = cases.filter((r) => r.wall);
  if (walls.length) {
    rows.push('', '| wall clock | mean drive s | median drive s | P90 drive s | game s |', '|---|---|---|---|---|');
    for (const r of walls) rows.push('| ' + r.label + ' | ' + cell(r.wall.perDrive) + ' | ' + cell(r.wall.medianDrive) + ' | ' + cell(r.wall.p90Drive) + ' | ' + cell(r.wall.perGame) + ' |');
  }
  return rows.join('\n') + '\n';
}
