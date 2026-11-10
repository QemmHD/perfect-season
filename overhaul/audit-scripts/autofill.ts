import { getPool } from '/home/user/ps-studio/src/ut/pool';
import { sbcsFor, autoFill } from '/home/user/ps-studio/src/ut/sbc';
import { quickSellValue } from '/home/user/ps-studio/src/ut/packs';
const pool = await getPool();
const spot = Object.values(pool.buckets.spotlight).flat()[0];
const goat = Object.values(pool.buckets.goat).flat()[0];
const golds = Object.values(pool.buckets.gold).flat().filter((c) => c.ovr <= 77).slice(0, 12);
const silvers = Object.values(pool.buckets.silver).flat().slice(0, 12);
const club = [spot, goat, ...golds, ...silvers].map((rc, i) => ({ uid: 'u' + i, rc, slot: null }));
console.log('spotlight', spot.line.name, spot.ovr, 'qs', quickSellValue(spot), '| goat', goat.line.name, goat.ovr, 'qs', quickSellValue(goat));
for (const s of sbcsFor(pool, '2026-11-09')) {
  const pick = autoFill(s, club);
  if (!pick) continue;
  const used = pick.map((u) => club.find((c) => c.uid === u)!.rc).filter((rc) => rc.tier === 'spotlight' || rc.tier === 'goat');
  if (used.length) console.log('SBC', s.title, '-> auto-fill submits', used.map((r) => r.line.name + ' ' + r.tier + ' ' + r.ovr).join(', '), 'reward', JSON.stringify(s.reward));
}
