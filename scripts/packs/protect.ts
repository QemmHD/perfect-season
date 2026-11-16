// Claude (packs-2 review fix, 2026-11-16): duplicate protection vs a fresh club, paired seeds, packs 300..1,500
// (share of golds 84+ / 88+). Run: PS_SPORT=nba npx vite-node scripts/packs/protect.ts
import { getPool } from '../../src/ut/pool';
import { openPack, positionChoices } from '../../src/ut/packs';
import { fcToDisplay } from '../../src/ut/fc-scale';
const pool = await getPool();
const sport = pool.sport;
const W = '2026-W46';
const at = (x: number) => fcToDisplay(x, sport);
const kinds = ['elite', ...positionChoices(sport).map((c) => 'position:' + c.key)];
for (const kind of kinds) {
  const owned = new Set<string>();
  let n = 0, f84 = 0, p84 = 0, f88 = 0, p88 = 0;
  for (let i = 0; i < 1500; i++) {
    const a = openPack(pool, kind, 'm:' + kind + i, W).filter((c) => c.tier === 'gold');
    const b = openPack(pool, kind, 'm:' + kind + i, W, { owned });
    for (const c of b) owned.add(c.line.variantOf?.id ?? c.line.id);
    if (i < 300) continue;
    const bg = b.filter((c) => c.tier === 'gold');
    n += a.length;
    f84 += a.filter((c) => c.ovr >= at(84)).length; p84 += bg.filter((c) => c.ovr >= at(84)).length;
    f88 += a.filter((c) => c.ovr >= at(88)).length; p88 += bg.filter((c) => c.ovr >= at(88)).length;
  }
  const pc = (x: number) => ((100 * x) / n).toFixed(3) + '%';
  console.log(sport, kind.padEnd(18), '84+', pc(f84), '->', pc(p84), ' 88+', pc(f88), '->', pc(p88));
}
