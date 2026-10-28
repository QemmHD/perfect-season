import { SPORT } from '../engine/sport';
import type { Profile } from '../lib/profile';
import {
  KIND_APP,
  NET_ON,
  NS_SUFFIX,
  query,
  sign,
  pool,
  tagValue,
} from '../net/nostr';
import { displayName } from '../lib/names';
import { rivalsOf } from './rivals';
const tag = (week: string) =>
  'perfect-season/rivals/v1/' + SPORT + '/' + week + NS_SUFFIX;
export interface RivalsEntry {
  key: string;
  name: string;
  points: number;
  w: number;
  l: number;
}
/** Separate additive board tags; existing queues and leaderboard payloads are unchanged. */
export async function publishRivals(
  p: Profile,
  week: string
): Promise<boolean> {
  const r = rivalsOf(p.ut.rivals, week);
  if (!NET_ON || !p.name || r.w + r.l === 0) return true;
  try {
    return (
      (await pool.publish(
        sign(
          KIND_APP,
          [
            ['d', tag(week)],
            ['t', tag(week)],
          ],
          JSON.stringify({
            v: 1,
            name: p.name,
            points: r.points,
            best: r.best,
            w: r.w,
            l: r.l,
          })
        )
      )) > 0
    );
  } catch {
    return false;
  }
}
export async function fetchRivals(week: string): Promise<RivalsEntry[]> {
  if (!NET_ON) return [];
  const events = await query([
    { kinds: [KIND_APP], '#t': [tag(week)], limit: 500 },
  ]);
  const latest = new Map<string, { at: number; e: RivalsEntry }>();
  for (const e of events) {
    try {
      if (tagValue(e, 'd') !== tag(week)) continue;
      const c = JSON.parse(e.content);
      if (
        c.v !== 1 ||
        typeof c.name !== 'string' ||
        ![c.points, c.w, c.l].every(
          (n) => Number.isInteger(n) && n >= 0 && n <= 100000
        ) ||
        c.points > c.w * 30
      )
        continue;
      const was = latest.get(e.pubkey);
      if (!was || was.at < e.created_at)
        latest.set(e.pubkey, {
          at: e.created_at,
          e: {
            key: e.pubkey,
            name: displayName(c.name),
            points: c.points,
            w: c.w,
            l: c.l,
          },
        });
    } catch {}
  }
  return [...latest.values()]
    .map((x) => x.e)
    .sort(
      (a, b) => b.points - a.points || b.w - a.w || a.key.localeCompare(b.key)
    );
}
