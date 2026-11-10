import { getPool } from '/home/user/ps-studio/src/ut/pool';
import { sbcsFor, reqText } from '/home/user/ps-studio/src/ut/sbc';
const pool = await getPool();
for (const day of ['2026-11-09','2026-11-10','2026-11-11','2026-11-12']) {
  const bad = sbcsFor(pool, day).filter((s) => s.reqs.some((r) => r.k === 'positions' && r.pos.some((p) => !['GK','CB','FB','DM','CM','AM','W','ST'].includes(p))));
  console.log(day, bad.map((s) => s.title + ' [' + s.reqs.map(reqText).join('; ') + '] -> ' + JSON.stringify(s.reward)));
}
