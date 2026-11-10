// Claude, 2026-11-10 (studio overhaul, team ut): labels.ts keeps today's exact wording (the owner
// kept every mode name, 2026-11-09), the screens read their names from it, and no research
// shorthand for another publisher's programs reaches a player-facing string in a ut-owned file.
import { describe, expect, it } from 'vitest';
import { LABEL, MODE_LABEL, modeName, SEGMENT_LABEL, TAB_LABEL, upper, VIEW_TITLE } from './labels';
import { SEGMENTS, UT_TABS, viewInfo } from './nav';
import { MODE_NAME } from './play-status';
import type { UtView } from './UltimateTeam';

/** The few node:fs calls this test needs (the project has no Node typings). CSS goes through fs, since
 * Vitest hands `.css?raw` imports back empty. */
interface Fs {
  readFileSync(p: URL, enc: 'utf8'): string;
  readdirSync(p: URL, o: { recursive: true }): string[];
}
const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as Fs;
const SRC = new URL('../', import.meta.url);
/** ut-owned files outside src/ut (OWNERSHIP.md), including the shared screens ut has hunks in. */
const OUTSIDE = ['ui/Welcome.tsx', 'ui/Results.tsx', 'ui/Gauntlet.tsx', 'ui/Rewards.tsx', 'ui/Pages.tsx', 'engine/missions.ts', 'App.tsx'];
/** Every source under src/ut (no tests) plus OUTSIDE, keyed by path under src ("ut/nav.ts"). */
const FILES = [
  ...fs
    .readdirSync(new URL('ut/', SRC), { recursive: true })
    .filter((f) => /\.(ts|tsx|css)$/.test(f) && !/\.test(-util)?\.tsx?$/.test(f))
    .map((f) => 'ut/' + f.split('\\').join('/')),
  ...OUTSIDE,
];
const read = (rel: string) => fs.readFileSync(new URL(rel, SRC), 'utf8');

describe('wording snapshot: unchanged from acdf3e2', () => {
  it('mode and feature names', () =>
    expect(LABEL).toEqual({
      ultimateTeam: 'Ultimate Team',
      ut: 'UT',
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
      daily: 'Daily',
      rewards: 'Rewards',
      clubRecords: 'Club Records',
      dailyDrop: 'Daily Drop',
      loginCalendar: 'Login calendar',
      squad: 'Squad',
      club: 'Club',
      sets: 'Sets',
      evolutions: 'Evolutions',
      packTracker: 'Pack Tracker',
      collectionGallery: 'Collection Gallery',
      challenges: 'Challenges',
      sbc: 'SBC',
      sbcs: 'SBCs',
      squadBuildingChallenges: 'Squad Building Challenges',
      objectives: 'Objectives',
      seasonPass: 'Season Pass',
      weeklyStandouts: 'Weekly Standouts',
      store: 'Store',
      scoutMarket: 'Scout Market',
      swapDesk: 'Swap Desk',
      previewPack: 'Preview Pack',
      packHelper: 'Pack Helper',
    }));
  it('tabs and segments', () => {
    expect(Object.values(TAB_LABEL)).toEqual(['HOME', 'PLAY', 'SQUAD', 'CLUB', 'CHALLENGES', 'STORE']);
    expect(Object.values(SEGMENT_LABEL)).toEqual(['PLAYERS', 'STORAGE', 'COLLECTION', 'DEVELOPMENT', 'SBCs', 'OBJECTIVES', 'SEASON PASS']);
  });
  it('every screen title, as nav.ts had them', () =>
    expect(VIEW_TITLE).toEqual({
      hub: 'Ultimate Team',
      daily: 'Daily',
      inbox: 'Rewards',
      records: 'Club Records',
      play: 'Play',
      cup: 'Club Cups',
      league: 'Club Season',
      battles: 'Squad Battles',
      circuit: 'Champions Circuit',
      events: 'Legends Events',
      moments: 'Moments',
      draft: 'UT Draft',
      rivals: 'Rivals',
      squad: 'Squad',
      club: 'Club',
      storage: 'Club',
      gallery: 'Club',
      development: 'Club',
      sets: 'Sets',
      evolutions: 'Evolutions',
      tracker: 'Pack Tracker',
      sbc: 'Challenges',
      objectives: 'Challenges',
      season: 'Challenges',
      standouts: 'Weekly Standouts',
      store: 'Store',
    }));
  it('play-status MODE_NAME, as it was', () =>
    expect(MODE_NAME).toEqual({
      cup: 'Club Cups',
      league: 'Club Season',
      battles: 'Squad Battles',
      circuit: 'Champions Circuit',
      events: 'Legends Events',
      moments: 'Moments',
      draft: 'UT Draft',
      rivals: 'Rivals',
    }));
  it('helpers', () => {
    expect(modeName('battles')).toBe('Squad Battles');
    expect(modeName('tracker')).toBe('Pack Tracker');
    expect(upper(LABEL.squadBattles)).toBe('SQUAD BATTLES');
  });
});

describe('the screens read their names from labels.ts', () => {
  it('nav.ts titles, tabs and segments equal the constants', () => {
    for (const v of Object.keys(VIEW_TITLE) as UtView[]) expect(viewInfo(v).title, v).toBe(VIEW_TITLE[v]);
    expect(Object.fromEntries(UT_TABS)).toEqual(TAB_LABEL);
    expect(Object.fromEntries([...SEGMENTS.club!, ...SEGMENTS.sbc!])).toEqual(SEGMENT_LABEL);
  });
  it('no mode name is typed out again in nav.ts or in the Match title and eyebrow strings', () => {
    const nav = read('ut/nav.ts');
    for (const t of new Set(Object.values(VIEW_TITLE))) expect(nav, t).not.toContain("'" + t + "'");
    const match = read('ut/Match.tsx');
    for (const t of Object.values(MODE_LABEL)) expect(match, t).not.toMatch(new RegExp("'(Solo )?" + t + '( ·[^\']*)?\''));
    expect(match).not.toContain("'Head to head'");
    expect(match).not.toContain("'Head to head · online'");
  });
});

// ---------- research shorthand must not reach players ----------

/** Other publishers' program names and research shorthand (never player-facing here). */
const BANNED = /\b(TOTW|TOTS|TOTY|FUT|MUT|MyTEAM|Campaign Hub|Lightning Rounds?|Icon cards?|Hero cards?)\b/;

/** Files OWNERSHIP.md gives to other teams inside src/ut (packs, players): not ut's to police. */
const OTHER_TEAMS =
  /^ut\/(packs|market|preview-pack|live-packs|live-cards|promo|calendar|calendar-rules|calendar-sbc|specials|standouts|content-packs|content-sbc|content-progress|content-state|sbc|pack-sequence|pack-helper|walkout|rare|editions|variants|new-era|acquisition|pull-log[\w-]*|circulation|numbered-sync|registry|pool|card-stats|rate|rating-quality|card-face|PackOpening|PackArt|PackAtmosphere|PreviewPack|PullTracker|PickSheet|Store|StandoutsView|Challenges|CardArt|CardDetail|CardSerial|pack-cinema|pack-reveal|pack-art|pull-tracker|content|card-editions)\.(ts|tsx|css)$/;
/** Hits that predate this test, by file: report them, fail on any new one. (None today.) */
const ALLOWED: Record<string, number> = {};

/** ut-owned files: FILES except what OWNERSHIP.md gives packs and players. */
const utOwned = () => FILES.filter((f) => !OTHER_TEAMS.test(f)).sort();

/**
 * The source with comments blanked out (strings, template text and JSX text stay): what a player
 * can see. A small lexer, so `//` inside a string or a regular expression is not a comment.
 */
function withoutComments(src: string, css = false): string {
  let out = '';
  let i = 0;
  /** the last significant character, and the identifier it ends (a regex can follow `return`) */
  let last = '';
  let word = '';
  const n = src.length;
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '*') {
      const end = src.indexOf('*/', i + 2);
      i = end < 0 ? n : end + 2;
      out += ' ';
      continue;
    }
    if (!css && c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') i++;
      continue;
    }
    if (c === '"' || c === "'" || (!css && c === '`')) {
      let j = i + 1;
      // a quote in JSX text ("You're") is not a string: '…' and "…" never run past the line
      while (j < n && src[j] !== c && (c === '`' || src[j] !== '\n')) j += src[j] === '\\' ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      last = c;
      word = '';
      continue;
    }
    if (!css && c === '/' && (last === '' || /[(,=:[!&|?{};+\-*%~^]/.test(last) || word === 'return')) {
      let j = i + 1;
      let cls = false;
      while (j < n && src[j] !== '\n' && (src[j] !== '/' || cls)) {
        if (src[j] === '\\') j++;
        else if (src[j] === '[') cls = true;
        else if (src[j] === ']') cls = false;
        j++;
      }
      out += src.slice(i, j + 1);
      i = j + 1;
      last = '/';
      word = '';
      continue;
    }
    out += c;
    if (!/\s/.test(c)) {
      word = /\w/.test(c) ? (/\w/.test(last) ? word + c : c) : '';
      last = c;
    }
    i++;
  }
  return out;
}

describe('banned research shorthand', () => {
  it('the comment stripper keeps strings and drops comments', () => {
    const code = `const a = 'http://x'; // TOTW here\nconst b = /\\/\\//; /* MUT */ const c = "FUT";`;
    const kept = withoutComments(code);
    expect(kept).toContain("'http://x'");
    expect(kept).toContain('"FUT"');
    expect(kept).not.toContain('TOTW');
    expect(kept).not.toContain('MUT');
  });
  it('0 new banned terms in player-facing strings of ut-owned files', () => {
    const files = utOwned();
    expect(files.length).toBeGreaterThan(60);
    expect(files).toContain('ut/labels.ts');
    expect(files).toContain('ut/kit.tsx');
    expect(files).not.toContain('ut/Store.tsx');
    const hits: Record<string, string[]> = {};
    for (const f of files) {
      const text = withoutComments(read(f), f.endsWith('.css'));
      const found = text.split('\n').filter((l) => BANNED.test(l));
      if (found.length) hits[f] = found.map((l) => l.trim().slice(0, 120));
    }
    const fresh = Object.entries(hits).filter(([f, l]) => l.length > (ALLOWED[f] ?? 0));
    if (Object.keys(hits).length) console.info('banned-term hits (allowlisted: ' + JSON.stringify(ALLOWED) + '):', hits);
    expect(fresh).toEqual([]);
  });
});
