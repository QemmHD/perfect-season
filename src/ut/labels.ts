// Claude, 2026-11-10 (studio overhaul, team ut, docs/studio-overhaul/ut.md): the one module for the
// player-facing names of Ultimate Team's modes, screens and features. The owner decided to keep
// every current name (2026-11-09), so these are today's exact words; routing them through here only
// means a later rename is one edit. Never change an id, a route or a claim id to match a label:
// labels are display text only. No imports beyond types, so any screen (and the main Home) can use
// it without pulling in card data.
import type { UtView } from './UltimateTeam';

/** Mode and feature names, in title case, exactly as players see them today. */
export const LABEL = {
  ultimateTeam: 'Ultimate Team',
  /** the short form on back buttons and tiles */
  ut: 'UT',
  // Play: solo and online modes
  play: 'Play',
  clubCups: 'Club Cups',
  clubSeason: 'Club Season',
  squadBattles: 'Squad Battles',
  championsCircuit: 'Champions Circuit',
  legendsEvents: 'Legends Events',
  moments: 'Moments',
  utDraft: 'UT Draft',
  rivals: 'Rivals',
  headToHead: 'Head to head',
  // Home
  daily: 'Daily',
  rewards: 'Rewards',
  clubRecords: 'Club Records',
  dailyDrop: 'Daily Drop',
  loginCalendar: 'Login calendar',
  // Squad and Club
  squad: 'Squad',
  club: 'Club',
  sets: 'Sets',
  evolutions: 'Evolutions',
  packTracker: 'Pack Tracker',
  collectionGallery: 'Collection Gallery',
  // Challenges
  challenges: 'Challenges',
  sbc: 'SBC',
  sbcs: 'SBCs',
  squadBuildingChallenges: 'Squad Building Challenges',
  objectives: 'Objectives',
  seasonPass: 'Season Pass',
  weeklyStandouts: 'Weekly Standouts',
  // Store
  store: 'Store',
  scoutMarket: 'Scout Market',
  swapDesk: 'Swap Desk',
  previewPack: 'Preview Pack',
  packHelper: 'Pack Helper',
} as const;

export type LabelKey = keyof typeof LABEL;

/** The UT tab bar's labels (upper case as drawn). */
export const TAB_LABEL = {
  hub: 'HOME',
  play: 'PLAY',
  squad: 'SQUAD',
  club: 'CLUB',
  sbc: 'CHALLENGES',
  store: 'STORE',
} as const;

/** The segment labels of the Club and Challenges tabs (as drawn: "SBCs" keeps its lower-case s). */
export const SEGMENT_LABEL = {
  club: 'PLAYERS',
  storage: 'STORAGE',
  gallery: 'COLLECTION',
  development: 'DEVELOPMENT',
  sbc: 'SBCs',
  objectives: 'OBJECTIVES',
  season: 'SEASON PASS',
} as const;

/** Each UT screen's one title (the top bar). Segments of one tab share the tab's title. */
export const VIEW_TITLE: Record<UtView, string> = {
  hub: LABEL.ultimateTeam,
  daily: LABEL.daily,
  inbox: LABEL.rewards,
  records: LABEL.clubRecords,
  play: LABEL.play,
  cup: LABEL.clubCups,
  league: LABEL.clubSeason,
  battles: LABEL.squadBattles,
  circuit: LABEL.championsCircuit,
  events: LABEL.legendsEvents,
  moments: LABEL.moments,
  draft: LABEL.utDraft,
  rivals: LABEL.rivals,
  squad: LABEL.squad,
  club: LABEL.club,
  storage: LABEL.club,
  gallery: LABEL.club,
  development: LABEL.club,
  sets: LABEL.sets,
  evolutions: LABEL.evolutions,
  tracker: LABEL.packTracker,
  sbc: LABEL.challenges,
  objectives: LABEL.challenges,
  season: LABEL.challenges,
  standouts: LABEL.weeklyStandouts,
  store: LABEL.store,
};

/** The Play modes' names, by view (Home's Continue card, Play rows, match screens). */
export const MODE_LABEL = {
  cup: LABEL.clubCups,
  league: LABEL.clubSeason,
  battles: LABEL.squadBattles,
  circuit: LABEL.championsCircuit,
  events: LABEL.legendsEvents,
  moments: LABEL.moments,
  draft: LABEL.utDraft,
  rivals: LABEL.rivals,
} as const;

export type ModeView = keyof typeof MODE_LABEL;

/** A mode's name for a view; a view that is not a Play mode gets its screen title. */
export function modeName(view: UtView): string {
  return (MODE_LABEL as Record<string, string>)[view] ?? VIEW_TITLE[view] ?? LABEL.ultimateTeam;
}

/** A label in capitals, the way buttons and eyebrows draw names ("SQUAD BATTLES"). */
export function upper(label: string): string {
  return label.toLocaleUpperCase('en-US');
}
