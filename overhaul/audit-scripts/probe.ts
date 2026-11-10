import { getPool } from '/home/user/ps-studio/src/ut/pool';
const t0 = Date.now();
const pool = await getPool();
console.log(pool.sport, pool.lines.length, Date.now() - t0, 'ms');
for (const [t, b] of Object.entries(pool.buckets)) console.log(t, Object.values(b).flat().length);
