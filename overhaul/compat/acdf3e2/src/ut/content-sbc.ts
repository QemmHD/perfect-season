import { pickFor } from '../engine/sport';
// Claude, 2026-11-01: the content SBCs. The weekly "Standout Squad" (standouts.ts) and Landmark
// Seasons: three landmark SBCs a week from the real-landmark catalog (the same for everyone), each
// paying that exact Landmark card. A Landmark SBC is done once forever (`sbc:<id>` in
// ut.content.claims, since the classic `sbc.done` only remembers this day and week).
import { hashString, rng, shuffle } from '../engine/rng';
import { claimed } from './content-state';
import { landmarkId } from './editions';
import { landmarkCatalog } from './landmarks';
import { type Pool, seasonText } from './pool';
import { TIER_CUTS } from './rate';
import { fcToDisplay } from './fc-scale';
import type { Sbc } from './sbc';
import { standoutSbc } from './standouts';
import type { UtState } from './state';
import type { RatedCard } from './types';

export const LANDMARKS_A_WEEK = 3;

/** The landmark cards that SBCs can pay, best first (rated). */
export function landmarkCards(pool: Pool): RatedCard[] {
  return [...landmarkCatalog(pool.lines).values()].flatMap((lm) => {
    const season = pool.byId.get(lm.seasonId);
    const rc = season ? pool.base.get(landmarkId(season)) : undefined;
    return rc ? [rc] : [];
  });
}

/** This week's Landmark SBCs: harder for the bigger cards. */
export function landmarkSbcs(pool: Pool, week: string): Sbc[] {
  const cat = [...landmarkCatalog(pool.lines).values()];
  if (!cat.length) return [];
  const rand = rng(hashString('ut-landmark:' + pool.sport + ':' + week));
  // one from the top third, two from the rest, so a week always has a headliner
  const top = cat.slice(0, Math.max(1, Math.floor(cat.length / 3)));
  const rest = cat.slice(top.length);
  const picks = [...shuffle(top, rand).slice(0, 1), ...shuffle(rest.length ? rest : top, rand).slice(0, LANDMARKS_A_WEEK - 1)];
  const size = pickFor(pool.sport, { nba: 6, nfl: 9, soccer: 8 });
  return picks.flatMap((lm) => {
    const season = pool.byId.get(lm.seasonId);
    if (!season) return [];
    const id = landmarkId(season);
    const rc = pool.base.get(id);
    if (!rc) return [];
    const gold = TIER_CUTS[pool.sport].gold;
    const team = Math.max(fcToDisplay(80, pool.sport), Math.min(fcToDisplay(86, pool.sport), rc.ovr - 6));
    return [
      {
        id: 'lm:' + id,
        kind: 'landmark' as const,
        title: season.name + ' · ' + lm.title,
        blurb: lm.text + ', ' + seasonText(season) + ' ' + season.teamName + '. Rebuild the season around him.',
        size,
        reqs: [
          { k: 'fr' as const, fr: season.fr, name: season.teamName, n: 1 },
          { k: 'tier' as const, tier: 'gold' as const, n: size - 2 },
          { k: 'teamOvr' as const, ovr: Math.max(gold - 2, team) },
        ],
        reward: { cardId: id, cardName: season.name },
      },
    ];
  });
}

/** Every content SBC on the SBC tab this week. */
export function contentSbcs(pool: Pool, week: string): Sbc[] {
  return [standoutSbc(pool, week), ...landmarkSbcs(pool, week)];
}

/** The content SBCs' done markers (merged into the classic `sbc.done` map for display). */
export function contentDone(ut: UtState, sbcs: Sbc[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sbcs) if ((s.kind === 'landmark' || s.kind === 'standout' || s.kind === 'program') && claimed(ut, 'sbc:' + s.id)) out[s.id] = 1;
  return out;
}
