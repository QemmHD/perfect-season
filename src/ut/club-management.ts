// Codex: saved squads and development use existing copy UIDs, positions and XP rules.
import { awardXp, type UtState } from './state';
import { hqOf, recordActivity } from './progression';
import { canPlay, slotsFor } from './squad';
import { ratedOf, type Pool } from './pool';
import { organizeStorage } from './storage';
export const DEVELOPMENT_PATHS = [
  {
    id: 'breakout' as const,
    title: 'Breakout',
    text: 'Make an emerging card a regular.',
    games: 3,
    wins: 1,
    xp: 200,
    sp: 150
  },
  {
    id: 'captain' as const,
    title: 'Captain',
    text: 'Lead your squad to three wins.',
    games: 5,
    wins: 3,
    xp: 350,
    sp: 250
  },
  {
    id: 'ironman' as const,
    title: 'Ironman',
    text: 'Stay ready. Build your match experience.',
    games: 6,
    wins: 0,
    xp: 300,
    sp: 200
  }
];
export function savePreset(
  ut: UtState,
  id: number,
  name: string,
  at: number
): UtState {
  if (!Number.isInteger(id) || id < 0 || id > 2) return ut;
  const h = hqOf(ut),
    preset = {
      id,
      name: name.trim().slice(0, 22) || 'Squad ' + (id + 1),
      squad: { ...ut.squad },
      at
    };
  return {
    ...ut,
    hq: {
      ...h,
      presets: [...h.presets.filter((p) => p.id !== id), preset].sort(
        (a, b) => a.id - b.id
      )
    }
  };
}
export function loadPreset(ut: UtState, pool: Pool, id: number): UtState {
  const h = hqOf(ut),
    p = h.presets.find((p) => p.id === id);
  if (!p) return ut;
  const squad: Record<string, string> = {},
    used = new Set<string>(),
    owned = new Map(ut.owned.map((c) => [c.uid, c]));
  for (const s of slotsFor(pool.sport)) {
    const uid = p.squad[s.id],
      oc = owned.get(uid),
      rc = oc && ratedOf(pool, oc);
    if (rc && canPlay(s, rc) && !used.has(uid)) {
      squad[s.id] = uid;
      used.add(uid);
    }
  }
  return organizeStorage({ ...ut, squad });
}
export function startDevelopment(
  ut: UtState,
  uid: string,
  path: string,
  at: number
): UtState {
  const h = hqOf(ut),
    card = ut.owned.find((c) => c.uid === uid),
    p = DEVELOPMENT_PATHS.find((p) => p.id === path);
  if (
    !card ||
    card.level >= 5 ||
    !p ||
    h.development.active ||
    h.development.completed[uid]
  )
    return ut;
  return {
    ...ut,
    hq: {
      ...h,
      development: {
        ...h.development,
        active: { uid, path: p.id, games: 0, wins: 0, points: 0, at }
      }
    }
  };
}
export function cancelDevelopment(ut: UtState): UtState {
  const h = hqOf(ut);
  return {
    ...ut,
    hq: { ...h, development: { ...h.development, active: undefined } }
  };
}
export function developmentReady(ut: UtState): boolean {
  const a = hqOf(ut).development.active,
    p = DEVELOPMENT_PATHS.find((p) => p.id === a?.path);
  return (
    !!a &&
    !!p &&
    ut.owned.some((c) => c.uid === a.uid) &&
    a.games >= p.games &&
    a.wins >= p.wins
  );
}
export function claimDevelopment(
  ut: UtState,
  day: string,
  at: number
): { ut: UtState; xp: number; sp: number } {
  if (!developmentReady(ut)) return { ut, xp: 0, sp: 0 };
  const h = hqOf(ut),
    a = h.development.active!,
    p = DEVELOPMENT_PATHS.find((p) => p.id === a.path)!;
  const next = awardXp(
    {
      ...ut,
      hq: {
        ...h,
        development: {
          active: undefined,
          completed: {
            ...h.development.completed,
            [a.uid]: { path: a.path, at }
          }
        }
      }
    },
    [a.uid],
    p.xp
  ).ut;
  return {
    ut: recordActivity(
      next,
      'development:' + a.uid,
      day,
      { development: 1 },
      p.sp
    ),
    xp: p.xp,
    sp: p.sp
  };
}
