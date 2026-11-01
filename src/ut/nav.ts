// Claude, 2026-11-01 (UI reorganisation, docs/UI-NAVIGATION.md): one map for every Ultimate Team
// screen. A view belongs to exactly one tab (which the tab bar highlights), has one name (its title)
// and one parent (where its back button goes, labelled with that parent's tab). Root views are the
// tabs themselves and their segments (Club: Players / Storage / Collection / Development;
// Challenges: SBCs / Objectives / Season Pass); they show no back button, except Home's EXIT.
import type { UtView } from './UltimateTeam';

export type UtTab = 'hub' | 'play' | 'squad' | 'club' | 'sbc' | 'store';

/** The tab bar, in order, with each tab's label. */
export const UT_TABS: [UtTab, string][] = [
  ['hub', 'HOME'],
  ['play', 'PLAY'],
  ['squad', 'SQUAD'],
  ['club', 'CLUB'],
  ['sbc', 'CHALLENGES'],
  ['store', 'STORE'],
];

interface ViewInfo {
  /** the screen's one name, shown in the top bar */
  title: string;
  /** the tab it lives under */
  tab: UtTab;
  /** where back goes (a root view has none) */
  parent?: UtView;
}

const V: Record<UtView, ViewInfo> = {
  hub: { title: 'Ultimate Team', tab: 'hub' },
  daily: { title: 'Daily', tab: 'hub', parent: 'hub' },
  inbox: { title: 'Rewards', tab: 'hub', parent: 'hub' },
  records: { title: 'Club Records', tab: 'hub', parent: 'hub' },

  play: { title: 'Play', tab: 'play' },
  league: { title: 'Club Season', tab: 'play', parent: 'play' },
  battles: { title: 'Squad Battles', tab: 'play', parent: 'play' },
  circuit: { title: 'Champions Circuit', tab: 'play', parent: 'play' },
  events: { title: 'Legends Events', tab: 'play', parent: 'play' },
  moments: { title: 'Moments', tab: 'play', parent: 'play' },
  draft: { title: 'UT Draft', tab: 'play', parent: 'play' },
  rivals: { title: 'Rivals', tab: 'play', parent: 'play' },

  squad: { title: 'Squad', tab: 'squad' },

  club: { title: 'Club', tab: 'club' },
  storage: { title: 'Club', tab: 'club' },
  gallery: { title: 'Club', tab: 'club' },
  development: { title: 'Club', tab: 'club' },
  sets: { title: 'Sets', tab: 'club', parent: 'gallery' },
  evolutions: { title: 'Evolutions', tab: 'club', parent: 'development' },

  sbc: { title: 'Challenges', tab: 'sbc' },
  objectives: { title: 'Challenges', tab: 'sbc' },
  season: { title: 'Challenges', tab: 'sbc' },
  standouts: { title: 'Weekly Standouts', tab: 'sbc', parent: 'sbc' },

  store: { title: 'Store', tab: 'store' },
};

export const viewInfo = (v: UtView): ViewInfo => V[v] ?? V.hub;
export const tabOf = (v: UtView): UtTab => viewInfo(v).tab;
export const tabLabel = (t: UtTab) => UT_TABS.find(([k]) => k === t)![1];

/** The segments of a tab with more than one root screen. */
export const SEGMENTS: Partial<Record<UtTab, [UtView, string][]>> = {
  club: [
    ['club', 'PLAYERS'],
    ['storage', 'STORAGE'],
    ['gallery', 'COLLECTION'],
    ['development', 'DEVELOPMENT'],
  ],
  sbc: [
    ['sbc', 'SBCs'],
    ['objectives', 'OBJECTIVES'],
    ['season', 'SEASON PASS'],
  ],
};

/** The segment a tab opens on when you tap it again from elsewhere: the one you last used. */
const lastSegment: Partial<Record<UtTab, UtView>> = {};
export function rememberSegment(v: UtView) {
  const t = tabOf(v);
  if (SEGMENTS[t]?.some(([k]) => k === v)) lastSegment[t] = v;
}
export const tabTarget = (t: UtTab): UtView => lastSegment[t] ?? t;
