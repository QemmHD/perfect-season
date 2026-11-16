// Claude (nfl-2): the human proxy (Pro, gold v gold) with and without the pocket thumb: sacks,
// throwaways, interceptions and the drive result, each with a 95% interval.
//   GAMES=400 npx vite-node scripts/nfl_pocket_proxy.ts
import * as kit from '../src/game/football2/sim-kit';

const GAMES = Number(process.env.GAMES ?? 400);
const out: Record<string, unknown> = {};
for (const pocket of [false, true]) {
  const label = pocket ? 'pocket-on' : 'pocket-off';
  const t0 = Date.now();
  const acc = kit.newAcc();
  for (let i = 0; i < GAMES; i++) kit.playGame(kit.fixtureTeams('gold'), { kind: 'human', skill: kit.HUMAN_SKILL, defIQ: kit.LEVELS.pro.defIQ, pocket }, 'human-pro-gold:' + i, acc);
  const s = kit.summarize(acc);
  const n = (k: string) => acc.c[k] ?? 0;
  out[label] = {
    dropbacks: n('dropbacks'),
    sack: s.sackRate,
    throwaway: kit.wilson(n('throwaway'), n('dropbacks')),
    int: s.intRate,
    cmp: s.completion,
    ptsPerDrive: s.ptsPerDrive,
    secs: (Date.now() - t0) / 1000
  };
  console.error(label, JSON.stringify(out[label]));
}
console.log(JSON.stringify(out, null, 1));
