// Codex: fixed-seed diagnostics of actual NFL run plays; no profile, economy or online writes.
import { hashString, rng } from '../src/engine/rng';
import { lineUp, snap, step } from '../src/game/football2/engine';
import { newGame } from '../src/game/football2/drive';
import { decide, pilot } from '../src/game/football2/autopilot';
import { depth } from '../src/game/football2/squad';
import type { Defense, Offense, RunPlay } from '../src/game/football2/types';
import { loadCards } from '../src/ut/cards';
import { rateCard } from '../src/ut/rate';
import { NFL_SLOTS } from '../src/ut/squad';
import { offenseOfSquad, defenseOfSquad, type SquadCards } from '../src/ut/teams';
const env = (globalThis as { process?: { env?: Record<string, string> } }).process?.env ?? {};
const samples = Number(env.PS_RUN_SAMPLES ?? 80);
const cards = (await loadCards('nfl')).lines.map((c) => rateCard(c));
function squad(tier: 'silver' | 'gold'): SquadCards {
  const sq: SquadCards = {};
  const used = new Set<string>();
  for (const s of NFL_SLOTS) {
    const options = cards
      .filter((c) => c.tier === tier && c.line.pos.includes(s.pos!) && !used.has(c.line.name))
      .sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id));
    const c = options[Math.floor(options.length * 0.6)];
    if (!c) throw Error('Missing fixture ' + tier + '/' + s.id);
    sq[s.id] = { line: c.line, level: 1 };
    used.add(c.line.name);
  }
  return sq;
}
const fixtures = ['silver', 'gold'].map((t) => {
  const sq = squad(t as 'silver' | 'gold');
  return { name: 'UT ' + t, off: offenseOfSquad(sq, 'run-audit'), def: defenseOfSquad(sq, 'run-audit') };
});
const dp = (pos: string, slot: string) => depth(pos, 0.5, 'run-audit', slot);
fixtures.push({
  name: 'draft depth',
  off: {
    qb: dp('QB', 'QB'),
    rb: dp('RB', 'RB'),
    wr: [dp('WR', 'X'), dp('WR', 'Z'), dp('WR', 'SL')],
    te: dp('TE', 'TE'),
    ol: ['OT', 'OG', 'C', 'OG', 'OT'].map((pos, i) => dp(pos, 'OL' + i)) as Offense['ol'],
    k: dp('K', 'K'),
  },
  def: {
    dl: ['DE', 'DT', 'DT', 'DE'].map((pos, i) => dp(pos, 'DL' + i)) as Defense['dl'],
    lb: [0, 1, 2].map((i) => dp('LB', 'LB' + i)) as Defense['lb'],
    cb: [dp('CB', 'CB1'), dp('CB', 'CB2')],
    s: [dp('S', 'FS'), dp('S', 'SS')],
  },
});
const results = [];
for (const f of fixtures)
  for (const difficulty of [-0.5, 0, 1])
    for (const run of ['inside', 'power', 'outside'] as RunPlay[])
      for (const control of ['lane', 'straight', 'pilot']) {
        const gains: number[] = [],
          handoffs: number[] = [],
          crossings: number[] = [];
        let fum = 0,
          td = 0;
        const tacklers: Record<string, number> = {};
        for (let i = 0; i < samples; i++) {
          const seed = 'run-audit:' + i,
            p = lineUp(f.off, f.def, 'run', 'slants', run, 35, 26.67, rng(hashString(seed)), difficulty),
            g = newGame(f.off, f.def, seed, 1, difficulty),
            pl = pilot(0.65, seed);
          snap(p);
          let handed = false,
            crossed = false;
          for (let k = 0; k < 1500 && !p.end; k++) {
            const steer = control === 'pilot' ? decide(p, g, pl) : control === 'straight' ? (p.carrier?.x ?? null) : null;
            step(p, 1 / 60, steer);
            if (!handed && p.carrier === p.rb) {
              handed = true;
              handoffs.push(p.t);
            }
            if (!crossed && p.carrier === p.rb && p.rb.y >= p.los) {
              crossed = true;
              crossings.push(p.rb.x - p.bx);
            }
          }
          if (!p.end) throw Error('Unfinished run');
          gains.push(p.end.gain);
          if (p.end.kind === 'fumble') fum++;
          if (p.end.kind === 'td') td++;
          const d = p.bodies.find((b) => b.side === 'D' && b.act === 'tackle' && Math.hypot(b.x - p.rb.x, b.y - p.rb.y) < 1.7);
          if (d) tacklers[d.slot] = (tacklers[d.slot] ?? 0) + 1;
        }
        gains.sort((a, b) => a - b);
        const avg = (a: number[]) => Math.round((a.reduce((a, b) => a + b, 0) / Math.max(1, a.length)) * 100) / 100;
        results.push({
          team: f.name,
          difficulty,
          run,
          control,
          samples,
          mean: avg(gains),
          median: gains[Math.floor(samples / 2)],
          stuffRate: gains.filter((g) => g <= 0).length / samples,
          tenPlusRate: gains.filter((g) => g >= 10).length / samples,
          td,
          fum,
          handoff: avg(handoffs),
          crossedRate: crossings.length / samples,
          crossingX: avg(crossings),
          tacklers,
        });
      }
console.log(
  JSON.stringify(
    {
      implementedBy: 'Codex',
      samples,
      fixtures: fixtures.map((f) => ({
        name: f.name,
        rb: { name: f.off.rb.name, a: f.off.rb.a },
        runBlocking: f.off.ol.map((p) => p.a.RBK),
        blockShedding: f.def.dl.map((p) => p.a.BSH),
      })),
      results,
    },
    null,
    2,
  ),
);
