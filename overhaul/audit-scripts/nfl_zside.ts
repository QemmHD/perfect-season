// AUDIT ONLY: is the Z receiver's low target share geometric (TE/strong side)? Compare normal vs flipped formation.
import { snap, step, flipPlay } from '/home/user/ps-studio/src/game/football2/engine';
import { newGame, startPlay } from '/home/user/ps-studio/src/game/football2/drive';
import { decide, pilot } from '/home/user/ps-studio/src/game/football2/autopilot';
import { loadCards } from '/home/user/ps-studio/src/ut/cards';
import { rateCard } from '/home/user/ps-studio/src/ut/rate';
import { NFL_SLOTS } from '/home/user/ps-studio/src/ut/squad';
import { offenseOfSquad, defenseOfSquad, type SquadCards } from '/home/user/ps-studio/src/ut/teams';
const cards = (await loadCards('nfl')).lines.map((c) => rateCard(c));
const sq: SquadCards = {}; const used = new Set<string>();
for (const s of NFL_SLOTS) { const o = cards.filter((c) => c.tier === 'gold' && c.line.pos.includes(s.pos!) && !used.has(c.line.name)).sort((a, b) => a.ovr - b.ovr || a.line.id.localeCompare(b.line.id)); const c = o[Math.floor(o.length * 0.6)]; sq[s.id] = { line: c.line, level: 1 }; used.add(c.line.name); }
const off0 = offenseOfSquad(sq, 'audit'), def0 = defenseOfSquad(sq, 'audit');
const def = (globalThis as any).process.env.CBSWAP === '1' ? { ...def0, cb: [def0.cb[1], def0.cb[0]] as any } : (globalThis as any).process.env.CBSAME === '1' ? { ...def0, cb: [def0.cb[0], def0.cb[0]] as any } : def0;
const pr = (x: any) => x.name + ' ovr' + x.ovr + ' SPD' + x.a.SPD + ' RTE' + x.a.RTE + ' CTH' + x.a.CTH + ' REL' + x.a.REL + ' MCV' + x.a.MCV + ' ZCV' + x.a.ZCV + ' PRS' + x.a.PRS;
console.log('X', pr(off0.wr[0]), '| Z', pr(off0.wr[1]), '| SL', pr(off0.wr[2]));
console.log('CB1', pr(def.cb[0]), '| CB2', pr(def.cb[1]));
const SWAP = (globalThis as any).process.env.SWAP === '1';
const off = SWAP ? { ...off0, wr: [off0.wr[1], off0.wr[0], off0.wr[2]] as any } : off0;
console.log('SWAP', SWAP);
for (const flip of [false]) {
  const tg: Record<string, number> = {}; const cmp: Record<string, number> = {}; const per: Record<string, Record<string, number>> = {};
  for (let i = 0; i < 1500; i++) {
    const g = newGame(off, def, 'z' + i, 4, 0);
    const p = startPlay(g, 'pass'); if (flip) flipPlay(p);
    const pl = pilot(0.68, 'zp' + i); snap(p);
    let t: any = null;
    for (let k = 0; k < 1500 && !p.end; k++) { step(p, 1 / 60, decide(p, g, pl)); if (!t) t = p.bodies.find((b) => b.job === 'track') ?? null; p.events.length = 0; }
    if (t) { tg[t.slot] = (tg[t.slot] ?? 0) + 1; per[p.concept] ??= {}; per[p.concept][t.slot] = (per[p.concept][t.slot] ?? 0) + 1; if (p.end!.caught) cmp[t.slot] = (cmp[t.slot] ?? 0) + 1; }
  }
  console.log(flip ? 'FLIPPED' : 'NORMAL', 'targets', JSON.stringify(tg), 'catches', JSON.stringify(cmp));
  console.log('  by concept', JSON.stringify(per));
}
