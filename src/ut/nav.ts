// Claude, 2026-11-01 (UI reorganisation, docs/UI-NAVIGATION.md): one map for every Ultimate Team
// screen. A view belongs to exactly one tab (which the tab bar highlights), has one name (its title)
// and one parent (where its back button goes, labelled with that parent's tab). Root views are the
// tabs themselves and their segments (Club: Players / Storage / Collection / Development;
// Challenges: SBCs / Objectives / Season Pass); they show no back button, except Home's EXIT.
import type { UtView } from './UltimateTeam';
// Claude 2026-11-10 (studio overhaul): every name below comes from labels.ts, unchanged.
import { SEGMENT_LABEL, TAB_LABEL, VIEW_TITLE as T } from './labels';

export type UtTab = 'hub' | 'play' | 'squad' | 'club' | 'sbc' | 'store';

/** The tab bar, in order, with each tab's label. */
export const UT_TABS: [UtTab, string][] = [
  ['hub', TAB_LABEL.hub],
  ['play', TAB_LABEL.play],
  ['squad', TAB_LABEL.squad],
  ['club', TAB_LABEL.club],
  ['sbc', TAB_LABEL.sbc],
  ['store', TAB_LABEL.store],
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
  hub: { title: T.hub, tab: 'hub' },
  daily: { title: T.daily, tab: 'hub', parent: 'hub' },
  inbox: { title: T.inbox, tab: 'hub', parent: 'hub' },
  records: { title: T.records, tab: 'hub', parent: 'hub' },

  play: { title: T.play, tab: 'play' },
  cup: { title: T.cup, tab: 'play', parent: 'play' },
  league: { title: T.league, tab: 'play', parent: 'play' },
  battles: { title: T.battles, tab: 'play', parent: 'play' },
  circuit: { title: T.circuit, tab: 'play', parent: 'play' },
  events: { title: T.events, tab: 'play', parent: 'play' },
  moments: { title: T.moments, tab: 'play', parent: 'play' },
  draft: { title: T.draft, tab: 'play', parent: 'play' },
  rivals: { title: T.rivals, tab: 'play', parent: 'play' },

  squad: { title: T.squad, tab: 'squad' },

  club: { title: T.club, tab: 'club' },
  storage: { title: T.storage, tab: 'club' },
  gallery: { title: T.gallery, tab: 'club' },
  development: { title: T.development, tab: 'club' },
  sets: { title: T.sets, tab: 'club', parent: 'gallery' },
  evolutions: { title: T.evolutions, tab: 'club', parent: 'development' },
  // Claude: the Pack Tracker (docs/PULL-TRACKER.md), also linked from the Store
  tracker: { title: T.tracker, tab: 'club', parent: 'club' },

  sbc: { title: T.sbc, tab: 'sbc' },
  objectives: { title: T.objectives, tab: 'sbc' },
  season: { title: T.season, tab: 'sbc' },
  standouts: { title: T.standouts, tab: 'sbc', parent: 'sbc' },

  store: { title: T.store, tab: 'store' },
};

export const viewInfo = (v: UtView): ViewInfo => V[v] ?? V.hub;
export const tabOf = (v: UtView): UtTab => viewInfo(v).tab;
export const tabLabel = (t: UtTab) => UT_TABS.find(([k]) => k === t)![1];

/** The segments of a tab with more than one root screen. */
export const SEGMENTS: Partial<Record<UtTab, [UtView, string][]>> = {
  club: [
    ['club', SEGMENT_LABEL.club],
    ['storage', SEGMENT_LABEL.storage],
    ['gallery', SEGMENT_LABEL.gallery],
    ['development', SEGMENT_LABEL.development],
  ],
  sbc: [
    ['sbc', SEGMENT_LABEL.sbc],
    ['objectives', SEGMENT_LABEL.objectives],
    ['season', SEGMENT_LABEL.season],
  ],
};

/** The segment a tab opens on when you tap it again from elsewhere: the one you last used. */
const lastSegment: Partial<Record<UtTab, UtView>> = {};
export function rememberSegment(v: UtView) {
  const t = tabOf(v);
  if (SEGMENTS[t]?.some(([k]) => k === v)) lastSegment[t] = v;
}
export const tabTarget = (t: UtTab): UtView => lastSegment[t] ?? t;
