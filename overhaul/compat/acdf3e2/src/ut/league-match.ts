// Codex: season-only copies of AI runtime players. Online/draft and owned cards keep their ratings.
import type { Teams } from './teams';
import type { Pool } from './pool';
import { rateCard, toHooper } from './rate';
import { withLeagueForm } from './league-form';
import type { FbPlayer } from '../game/football2/types';
export function applyLeagueTeams(
  teams: Teams,
  pool: Pool,
  form: Record<string, number>
): Teams {
  const fb = (p: FbPlayer): FbPlayer => {
    const line = pool.byId.get(p.id);
    if (!line) return p;
    const rc = withLeagueForm(rateCard(line, 1, p.pos), form[p.id] ?? 0);
    return { ...p, ovr: rc.ovr, a: { ...rc.attrs } };
  };
  if (pool.sport === 'nba')
    return {
      ...teams,
      rivalFive: teams.rivalFive?.map((p) =>
        toHooper(
          withLeagueForm(
            rateCard(pool.byId.get(p.id)!, 1, p.pos),
            form[p.id] ?? 0
          )
        )
      ),
      rivalBench: teams.rivalBench?.map((p) =>
        toHooper(
          withLeagueForm(
            rateCard(pool.byId.get(p.id)!, 1, p.pos),
            form[p.id] ?? 0
          )
        )
      )
    };
  const o = teams.rivalOffense!,
    d = teams.rivalDefense!;
  return {
    ...teams,
    rivalOffense: {
      ...o,
      qb: fb(o.qb),
      rb: fb(o.rb),
      wr: o.wr.map(fb) as typeof o.wr,
      te: fb(o.te),
      ol: o.ol.map(fb) as typeof o.ol,
      k: fb(o.k)
    },
    rivalDefense: {
      ...d,
      dl: d.dl.map(fb) as typeof d.dl,
      lb: d.lb.map(fb) as typeof d.lb,
      cb: d.cb.map(fb) as typeof d.cb,
      s: d.s.map(fb) as typeof d.s
    }
  };
}
