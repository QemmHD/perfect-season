// Claude (packs-1, 2026-11-10), ported from the packs/promos audit (C1), read-only: SBC auto-fill against
// the audit's club (an unplayed Spotlight and GOAT, twelve golds of 77 or less, twelve silvers). It lists
// every SBC whose auto-fill would trade a special or numbered card: on the audit's day, and over 28 days.
//   PACKS_OUT=<dir> PACKSIM_LABEL=before PS_SPORT=nba npx vite-node scripts/packs/autofill.ts
import { getPool } from '../../src/ut/pool';
import { autoFill, sbcsFor } from '../../src/ut/sbc';
import { quickSellValue } from '../../src/ut/packs';
import { writeOut } from './out';

const pool = await getPool();
const SPECIAL = new Set(['goat', 'spotlight', 'legend', 'landmark', 'promo', 'program', 'standout']);
const spot = Object.values(pool.buckets.spotlight).flat()[0];
const goat = Object.values(pool.buckets.goat).flat()[0];
const golds = Object.values(pool.buckets.gold).flat().filter((c) => c.ovr <= 77).slice(0, 12);
const silvers = Object.values(pool.buckets.silver).flat().slice(0, 12);
// the Spotlight and GOAT copies are registered (numbered) cards: `mint` marks them, as in the club
const club = [spot, goat, ...golds, ...silvers].filter(Boolean).map((rc, i) => ({ uid: 'u' + i, rc, slot: null, ...(rc.tier === 'spotlight' || rc.tier === 'goat' ? { mint: { serial: i + 1, totalAtPull: i + 1, requestId: 'audit', namespace: 'audit' } } : {}) }));
const takes = (day: string) => {
  const out: { sbc: string; cards: string[]; reward: unknown }[] = [];
  for (const s of sbcsFor(pool, day)) {
    const pick = autoFill(s, club);
    if (!pick) continue;
    const used = pick.map((u) => club.find((c) => c.uid === u)!).filter((c) => SPECIAL.has(c.rc.tier) || 'mint' in c);
    if (used.length) out.push({ sbc: s.title, cards: used.map((c) => c.rc.line.name + ' ' + c.rc.tier + ' ' + c.rc.ovr), reward: s.reward });
  }
  return out;
};
const day = '2026-11-09';
const first = takes(day);
let month = 0;
const uids = new Set<string>();
for (let d = 0; d < 28; d++) {
  const key = new Date(Date.UTC(2026, 10, 9 + d)).toISOString().slice(0, 10);
  for (const s of sbcsFor(pool, key)) {
    const pick = autoFill(s, club);
    const special = (pick ?? []).filter((u) => {
      const c = club.find((x) => x.uid === u)!;
      return SPECIAL.has(c.rc.tier) || 'mint' in c;
    });
    if (special.length) month++;
    special.forEach((u) => uids.add(u));
  }
}
const res = {
  sport: pool.sport,
  club: { spotlight: spot ? spot.line.name + ' ' + spot.ovr + ' qs ' + quickSellValue(spot) : null, goat: goat ? goat.line.name + ' ' + goat.ovr + ' qs ' + quickSellValue(goat) : null },
  day,
  sbcsTakingSpecialsOnDay: first.length,
  onDay: first,
  sbcsTakingSpecialsIn28Days: month,
  specialUidsIn28Days: [...uids],
};
console.log(pool.sport, res.club, 'SBCs that trade a special/numbered card on', day + ':', first.length, '| over 28 days:', month);
console.log('wrote', writeOut('autofill-' + pool.sport + '.json', res));
