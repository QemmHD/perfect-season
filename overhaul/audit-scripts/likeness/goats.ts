import { getPool } from '/home/user/ps-studio/src/ut/pool';
const pool = await getPool();
const g = [...pool.base.values()].filter((rc) => rc.tier === 'goat').map((rc) => rc.line.name);
const l = new Set([...pool.base.values()].filter((rc) => rc.tier === 'legend').map((rc) => rc.line.name));
console.log(pool.sport, 'GOAT', g.length, g.join(', '));
console.log(pool.sport, 'legend players', l.size);
process.exit(0);
