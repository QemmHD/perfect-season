// Claude, 2026-11-16 (studio overhaul, team ut, ut-3; V2 E.9, D.11): MINUTES on screen. The chip's
// words in every state (0, 27, 58, 60 ready, 89, 90 done, rested, frozen), the Home chip and UT Home
// line, the Minutes screen's hero and rails, claims that pay once, the Profile panel (counted and
// raw), reduced motion, and the guilt-copy red line over every ut-owned string.
/// <reference types="vite/client" />
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/sound', () => ({ sfx: { coin: vi.fn(), click: vi.fn() }, vibrate: vi.fn(), tapHaptic: vi.fn() }));
vi.mock('../lib/haptics', () => ({ haptic: vi.fn() }));
vi.mock('../net/nostr', () => ({ NET_ON: true }));

import { credit, etDay, freshPlaytime, isoWeek, playtimeLine, playtimeView, type Playtime } from '../lib/playtime';
import type { Profile } from '../lib/profile';
import { claimMinutes, lifeBadge, minutesChip, shortReward, LADDERS } from '../ut/minutes';
import { MINUTES_DONE_LINE, nextUp } from '../ut/next-action';
import MinutesView from './MinutesView';
import { compactCount, HomeMinutesChip, minText, PlaytimePanel } from './playtime-ui';

const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as { readFileSync(p: URL | string, enc: 'utf8'): string; readdirSync(p: URL): string[] };

const NOW = Date.parse('2026-11-16T17:00:00Z'); // Monday, noon ET
const DAY = etDay(NOW);

/** A ledger on today with `min` counted minutes, its claimed rungs, and lifetime minutes. */
function ledger(o: { min: number; day?: number[]; week?: number[]; life?: number[]; lifeMin?: number; rawMin?: number; extra?: Partial<Playtime> }): Playtime {
  const p = freshPlaytime(DAY);
  const sec = o.min * 60,
    lifeSec = (o.lifeMin ?? o.min) * 60;
  return {
    ...p,
    life: lifeSec,
    rawLife: Math.max(lifeSec, (o.rawMin ?? o.min) * 60),
    daySec: sec,
    rawDaySec: (o.rawMin ?? o.min) * 60,
    weekDays: [sec, 0, 0, 0, 0, 0, 0],
    bySport: { nba: lifeSec, nfl: 0, soccer: 0 },
    claimed: { day: o.day ?? [], week: o.week ?? [], life: o.life ?? [], dayKey: DAY, weekKey: isoWeek(DAY) },
    ...o.extra,
  };
}
function profile(pt?: Playtime, extra: Partial<Profile> = {}): Profile {
  return {
    coins: 1000,
    xp: 0,
    stats: { games: 4 },
    history: [],
    settings: { sound: true, haptics: true, hints: true },
    ut: { packs: [], record: { w: 2, l: 1, h2hW: 0, h2hL: 0 } },
    ...(pt ? { playtime: pt } : {}),
    ...extra,
  } as unknown as Profile;
}
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('the Minutes chip in every state (V2 E.9.1)', () => {
  const cases: [string, Playtime | undefined, Partial<ReturnType<typeof minutesChip>>][] = [
    ['0 min', ledger({ min: 0, lifeMin: 360, life: [0, 1] }), { state: 'next', minutes: 0, target: 5, reward: '25 coins next' }],
    ['27 min', ledger({ min: 27, day: [0, 1], lifeMin: 360, life: [0, 1] }), { state: 'next', minutes: 27, target: 30, reward: '75 coins + stamp next' }],
    ['58 min', ledger({ min: 58, day: [0, 1, 2], lifeMin: 360, life: [0, 1] }), { state: 'next', minutes: 58, target: 60, reward: 'Silver Pack next' }],
    ['60 min, ready', ledger({ min: 60, day: [0, 1, 2], week: [0], lifeMin: 360, life: [0, 1] }), { state: 'ready', minutes: 60, target: 90, reward: 'Silver Pack ready', ready: 1 }],
    // review fix: today's real minutes toward the next unreached rung, never clamped to the first ready one
    ['75 min, the 30 and 60 waiting', ledger({ min: 75, day: [0, 1], week: [0], lifeMin: 360, life: [0, 1] }), { state: 'ready', minutes: 75, target: 90, reward: '2 rewards ready', ready: 2 }],
    ['89 min', ledger({ min: 89, day: [0, 1, 2, 3], week: [0], lifeMin: 360, life: [0, 1] }), { state: 'next', minutes: 89, target: 90, reward: '50 coins next' }],
    ['90 min, all claimed', ledger({ min: 90, day: [0, 1, 2, 3, 4], week: [0], lifeMin: 360, life: [0, 1] }), { state: 'done', minutes: 90, target: 90, reward: 'Great session.' }],
    ['90 min, the 90 rung waiting', ledger({ min: 90, day: [0, 1, 2, 3], week: [0], lifeMin: 360, life: [0, 1] }), { state: 'ready', target: 90, reward: '50 coins ready' }],
    ['rested', ledger({ min: 0, week: [0], lifeMin: 360, life: [0, 1], extra: { restedDay: DAY } }), { state: 'next', target: 5, reward: 'Rested ×2: 50 coins next', rested: true }],
    ['frozen', ledger({ min: 12, lifeMin: 360, life: [0, 1], extra: { day: etDay(NOW + 86400_000) } }), { state: 'next', minutes: 0, reward: 'Paused today: the date changed', frozen: true }],
    ['a week rung while today counts', ledger({ min: 40, day: [0, 1, 2], extra: { weekDays: [2400, 0, 0, 0, 0, 0, 0], week: isoWeek(DAY) }, lifeMin: 360, life: [0, 1] }), { state: 'next', target: 60 }],
  ];
  for (const [name, pt, want] of cases)
    it(name, () => {
      expect(minutesChip(pt, NOW)).toMatchObject(want);
    });
  it('a new player (no ledger, no games) starts 3 minutes in', () => {
    expect(minutesChip(undefined, NOW, true)).toMatchObject({ state: 'next', minutes: 3, target: 5 });
    expect(minutesChip(undefined, NOW, false)).toMatchObject({ state: 'next', minutes: 0, target: 5 });
  });
  it('several rewards waiting say how many', () => {
    expect(minutesChip(ledger({ min: 31 }), NOW)).toMatchObject({ state: 'ready', ready: 3, minutes: 31, target: 60, reward: '3 rewards ready' });
  });
  it('the short reward text names a pack, coins and the stamp', () => {
    expect(LADDERS.daily.map((r) => shortReward(r.reward))).toEqual(['25 coins', '50 coins', '75 coins + stamp', 'Silver Pack', '50 coins']);
  });
});

describe('the Home chip and UT Home ring', () => {
  it('27/30 with the full line as its label', () => {
    const h = html(<HomeMinutesChip profile={profile(ledger({ min: 27, day: [0, 1], lifeMin: 360, life: [0, 1] }))} onOpen={() => {}} now={NOW} />);
    expect(h).toContain('>27/30<');
    expect(h).toContain('aria-label="Minutes: 27 of 30 minutes today. 75 coins + stamp next. Open Minutes"');
    expect(h).toContain('data-state="next"');
    expect(h).not.toContain('mins-dot');
  });
  it('READY with a gold dot; DONE with a check at 90', () => {
    const ready = html(<HomeMinutesChip profile={profile(ledger({ min: 60, day: [0, 1, 2], week: [0], lifeMin: 360, life: [0, 1] }))} onOpen={() => {}} now={NOW} />);
    expect(ready).toContain('>READY<');
    expect(ready).toContain('mins-dot');
    const done = html(<HomeMinutesChip profile={profile(ledger({ min: 90, day: [0, 1, 2, 3, 4], week: [0], lifeMin: 360, life: [0, 1] }))} onOpen={() => {}} now={NOW} />);
    expect(done).toContain('>DONE<');
    expect(done).toContain('done for today. Great session');
  });
});

describe('the Minutes screen', () => {
  const view = (pt?: Playtime, extra: Partial<Profile> = {}) => html(<MinutesView profile={profile(pt, extra)} update={() => {}} now={NOW} />);
  it('27 min: three minutes to the next reward, the rails, the league tile and the explainer button', () => {
    const t = text(view(ledger({ min: 27, day: [0, 1], lifeMin: 360, life: [0, 1] })));
    expect(t).toContain('3 minutes to your next reward');
    expect(t).toContain('75 coins + a Scout Stamp. An hour today earns a Silver Pack.');
    expect(t).toContain('TODAY · 27 min');
    expect(t).toContain('DONE AT 90');
    expect(t).toContain('THIS WEEK · 27 min');
    expect(t).toContain('SILVER PACK AT 150');
    expect(t).toContain('CAREER · 6 H');
    expect(t).toContain('Leagues are coming');
    expect(t).not.toMatch(/next week/i);
    expect(t).toContain('Active play only · up to 90 a day · resets midnight ET');
    expect(view(ledger({ min: 27, day: [0, 1] }))).toContain('aria-label="How Minutes work"');
  });
  it('the next rung is drawn larger; reached and claimed rungs open; no CLAIM without a ready rung', () => {
    const h = view(ledger({ min: 27, day: [0, 1], lifeMin: 360, life: [0, 1] }));
    expect(h.match(/data-state="next"/g)?.length).toBeGreaterThanOrEqual(1);
    expect(h).toMatch(/data-state="next"[^]*?width="40"/);
    expect(h).not.toContain('ut-k-claim');
  });
  it('the 90-minute "done" chest is a plain locked chest until it is reached (review fix)', () => {
    const CHECK = 'M15 27.5l3.4 3.4 6.4-6.6';
    const node90 = (h: string) => h.match(/<li[^>]*aria-label="90: [^"]*"[^]*?<\/li>/)?.[0] ?? '';
    for (const min of [27, 60]) {
      const n = node90(view(ledger({ min, day: [0, 1, 2], week: [0], lifeMin: 360, life: [0, 1] })));
      expect(n).toMatch(/data-state="(locked|next)"/);
      expect(n).not.toContain(CHECK);
      expect(text(n)).toContain('FINISH');
      expect(text(n)).not.toContain('DONE');
    }
    const ready = node90(view(ledger({ min: 90, day: [0, 1, 2, 3], week: [0], lifeMin: 360, life: [0, 1] })));
    expect(ready).toContain('data-state="ready"');
    expect(ready).toContain(CHECK);
    const claimed = node90(view(ledger({ min: 90, day: [0, 1, 2, 3, 4], week: [0], lifeMin: 360, life: [0, 1] })));
    expect(claimed).toContain('data-state="claimed"');
    expect(text(claimed)).toContain('DONE');
  });
  it('60 ready: CLAIM, and the hero names the reward', () => {
    const h = view(ledger({ min: 60, day: [0, 1, 2], week: [0], lifeMin: 360, life: [0, 1] }));
    expect(text(h)).toContain('Your 60-minute reward is ready');
    expect(text(h)).toContain('Silver Pack + 50 coins.');
    expect(h).toContain('ut-k-claim');
    expect(h).toContain('>READY<');
  });
  it('90: the calm Done for today state, with the line about matches', () => {
    const t = text(view(ledger({ min: 90, day: [0, 1, 2, 3, 4], week: [0], lifeMin: 360, life: [0, 1] })));
    expect(t).toContain('Done for today. Great session.');
    expect(t).toContain(MINUTES_DONE_LINE);
  });
  it('rested and frozen days say so', () => {
    // (the rested week credit of 60 minutes has paid the first weekly rung, claimed here)
    expect(text(view(ledger({ min: 0, week: [0], lifeMin: 360, life: [0, 1], extra: { restedDay: DAY } })))).toContain('Welcome back: today’s first three rewards are doubled.');
    expect(text(view(ledger({ min: 12, lifeMin: 360, life: [0, 1], extra: { day: etDay(NOW + 86400_000) } })))).toContain('Minutes are paused today');
  });
  it('hidden from boards: the tile says so', () => {
    expect(text(view(ledger({ min: 5 }), { settings: { sound: true, haptics: true, hints: true, hideBoards: true } } as Partial<Profile>))).toContain('hidden from public boards');
  });
});

describe('claims pay once (fixtures at 30, 60 and 300 weekly)', () => {
  const fixtures: [string, Playtime, number, number][] = [
    // name, ledger, coins it pays, packs it grants
    ['30 today', ledger({ min: 30, day: [0, 1], lifeMin: 360, life: [0, 1] }), 75, 0],
    ['60 today', ledger({ min: 60, day: [0, 1, 2], week: [0], lifeMin: 360, life: [0, 1] }), 50, 1],
  ];
  // Thursday: 90 + 90 + 90 + 30 minutes this week, the 60 and 150 rungs already claimed
  const THU = NOW + 3 * 86400_000,
    thu = etDay(THU);
  const week300: Playtime = { ...ledger({ min: 30, lifeMin: 360, life: [0, 1] }), day: thu, weekDays: [5400, 5400, 5400, 1800, 0, 0, 0], claimed: { day: [0, 1, 2], week: [0, 1], life: [0, 1], dayKey: thu, weekKey: isoWeek(thu) } };
  const cases: [string, Playtime, number, number, number][] = [...fixtures.map(([n, pt, c, k]) => [n, pt, c, k, NOW] as [string, Playtime, number, number, number]), ['300 this week', week300, 0, 1, THU]];
  for (const [name, pt, coins, packs, at] of cases)
    it(name, () => {
      const p = profile(pt);
      const once = claimMinutes(p, at, 'nba');
      expect(once.profile.coins - p.coins).toBe(coins);
      expect(once.profile.ut.packs.length).toBe(packs);
      // a second tap: nothing more, the same object back
      const twice = claimMinutes(once.profile, at + 1000, 'nba');
      expect(twice.granted).toEqual([]);
      expect(twice.profile).toBe(once.profile);
      // and the chip has nothing waiting
      expect(minutesChip(once.profile.playtime, at + 1000).ready).toBe(0);
    });
});

describe('Done for today in nextUp', () => {
  it('the calm line is the Minutes one when the 90 are in', () => {
    const base = {
      sport: 'nba',
      claim: { count: 0, lines: [] },
      minutes: null,
      elsewhere: [],
      starter: false,
      runs: [],
      streak: null,
      ending: [],
      milestones: [],
      dailyPlay: null,
      dailyLast: null,
      pass: null,
      wave: null,
      packs: 0,
      picks: 0,
      recent: { line: 'Squad Battles', setup: { mode: 'battles' } },
      battles: {},
      today: { dailiesDone: false, paidLeft: 3, minutesCapped: true },
    };
    const a = nextUp(base as unknown as Parameters<typeof nextUp>[0]);
    expect(a.done).toBe(true);
    expect(a.line).toBe('Done for today · ' + MINUTES_DONE_LINE);
  });
});

describe('the Profile panel (V2 E.9.5)', () => {
  it('today and this week, counted and raw; lifetime by sport; the badge', () => {
    const pt = credit(ledger({ min: 27, rawMin: 72, lifeMin: 372, life: [0, 1] }), { sec: 0, menu: 0, raw: 600, sport: 'nba', act: 0 }, NOW);
    const t = text(html(<PlaytimePanel profile={profile(pt)} onOpen={() => {}} now={NOW} />));
    expect(t).toContain('Today 27 min');
    expect(t).toContain('This week 27 min active · open 1 h 22 min');
    expect(t).toContain('You’ve had the app open 1 h 22 min today.');
    expect(t).toContain('Lifetime 6.2 h');
    expect(t).toContain('STARTER');
    expect(t).toContain('3.8 h to Pro');
    expect(t).toContain('NBA 6.2 h');
    expect(t).toContain('MINUTES: rewards and leagues');
  });
  it('an old save without a ledger reads zeros and no badge', () => {
    const t = text(html(<PlaytimePanel profile={profile()} now={NOW} />));
    expect(t).toContain('Today 0 min');
    expect(t).toContain('NO BADGE YET');
    expect(t).toContain('1 h to Rookie');
  });
  it('raw week is kept per weekday and is never below the counted week', () => {
    const pt = ledger({ min: 50, rawMin: 10 });
    expect(playtimeView({ playtime: pt }, NOW).week).toMatchObject({ min: 50, rawMin: 50 });
    const more = credit(pt, { sec: 0, menu: 0, raw: 7200, sport: 'nba', act: 0 }, NOW);
    expect(more.rawWeek).toEqual([7200, 0, 0, 0, 0, 0, 0]);
    // the weekday holds 7,200 raw seconds; today's own raw count (600 + 7,200) is the larger
    expect(playtimeView({ playtime: more }, NOW).week.rawMin).toBe(130);
    expect(minText(0)).toBe('0 min');
    expect(minText(72)).toBe('1 h 12 min');
    expect(minText(180)).toBe('3 h');
  });
  it('the lifetime badge ladder', () => {
    expect(lifeBadge(undefined)).toEqual({ badge: null, next: 'Rookie', hoursToNext: 1 });
    expect(lifeBadge(ledger({ min: 0, lifeMin: 60 }))).toMatchObject({ badge: 'Rookie', next: 'Starter' });
    expect(lifeBadge(ledger({ min: 0, lifeMin: 60000 }))).toEqual({ badge: 'GOAT', next: null, hoursToNext: 0 });
  });
});

describe('compactCount for the online chip (review fix: the strip stays in the gutters)', () => {
  it('3 digits as they are, then k and m, rounded down', () => {
    expect([0, 7, 99, 999].map(compactCount)).toEqual(['0', '7', '99', '999']);
    expect([1000, 1234, 1999, 9999, 12345, 999999].map(compactCount)).toEqual(['1k', '1.2k', '1.9k', '9.9k', '12k', '999k']);
    expect([1_000_000, 1_250_000, 12_500_000].map(compactCount)).toEqual(['1m', '1.2m', '12m']);
    for (const n of [0, 5, 999, 1234, 54321, 999999, 3_000_001]) expect(compactCount(n).length).toBeLessThanOrEqual(4);
  });
});

describe('playtimeLine for the sports’ pause sheets', () => {
  it('adds the seconds of the match in progress', () => {
    const p = { playtime: ledger({ min: 27 }) };
    expect(playtimeLine(p, NOW, 0)).toBe('Today 27 min · next reward at 30');
    expect(playtimeLine(p, NOW, 4 * 60)).toBe('Today 31 min · next reward at 60');
    expect(playtimeLine({ playtime: ledger({ min: 88 }) }, NOW, 600)).toBe('Today 90 min · done for today');
  });
  it('applies the week cap to the match in progress (review fix: never above what it will bank)', () => {
    // Monday with 625 minutes already this week (a tampered or carried-over week): 5 minutes of room
    const p = { playtime: ledger({ min: 0, extra: { weekDays: [0, 0, 0, 0, 0, 0, 625 * 60] } }) };
    expect(playtimeLine(p, NOW, 20 * 60)).toBe('Today 5 min · next reward at 15');
    expect(playtimeLine(p, NOW, 20 * 60)).toBe(playtimeLine({ playtime: credit(p.playtime, { sec: 20 * 60, menu: 0, raw: 0, sport: 'nba', act: 0 }, NOW) }, NOW, 0));
  });
});

describe('reduced motion: ring and rail fills show their final value at once', () => {
  const css = (f: string) => fs.readFileSync(new URL('./' + f, import.meta.url), 'utf8');
  const rm = (s: string) => s.slice(s.indexOf('@media (prefers-reduced-motion: reduce)'));
  it('the Minutes screen', () => {
    const r = rm(css('minutes.css'));
    for (const sel of ['.mv-ring .fill', '.mv-bar i', ".mv-node[data-state='ready'] .mv-chest-art"]) expect(r).toContain(sel);
    expect(r).toContain('animation: none');
  });
  it('the Home chip', () => {
    const r = rm(css('playtime-ui.css'));
    expect(r).toContain('.mins-mini .fill');
    expect(r).toContain('animation: none');
  });
  it('the ring is drawn at its final offset; only the animation starts it empty', () => {
    const h = html(<HomeMinutesChip profile={profile(ledger({ min: 15, day: [0, 1] }))} onOpen={() => {}} now={NOW} />);
    const c = 2 * Math.PI * 8.5;
    expect(h).toContain('stroke-dashoffset="' + c * (1 - 15 / 30) + '"');
  });
});

// ---------- the guilt-copy red line (V2 D.11, E.9.7) ----------

/** Phrases that pressure or shame: never in a player-facing ut string. */
const GUILT = [/don['’]?t lose/i, /miss(es|ed)? you/i, /missing you/i, /\bhurry\b/i, /last chance/i, /you['’]ll lose/i, /before it['’]?s gone/i, /don['’]?t miss/i];
/** ut-owned files with player-facing strings (OWNERSHIP.md, team ut) plus this task's new ones. */
const UT_FILES = [
  ...fs
    .readdirSync(new URL('../ut/', import.meta.url))
    .filter((f) =>
      /^(UltimateTeam|Hub|Clubhouse|DailyHubView|InboxView|SeasonBanner|CollectionGallery|SetsView|EvolutionsView|Moments|Rivals|Battles|CupView|LeagueSeason|Events|StreamlinedView|Club|SquadView|DraftView|MatchDebrief|play-art|ui|kit|GoLink|labels|play|play-status|daily-hub|progression|objectives|events|inbox|nav|rivals|battles|circuit|cup.*|league.*|collection|sets|evolutions|moments|match-debrief|streamlined|club-management|draft-mode|minutes|next-action|claimables)\.tsx?$/.test(f),
    )
    .map((f) => '../ut/' + f),
  '../ui/Welcome.tsx',
  '../ui/Results.tsx',
  '../ui/Gauntlet.tsx',
  '../ui/Rewards.tsx',
  '../engine/missions.ts',
  '../ui/MinutesView.tsx',
  '../ui/BreakReminder.tsx',
  '../ui/playtime-ui.tsx',
  '../lib/playtime.ts',
];
/** Code with its comments taken out (a comment may quote the red line). */
const strip = (s: string) => s.replace(/\/\*[^]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1');

describe('no guilt copy (V2 D.11 red line)', () => {
  it('scans the ut-owned files', () => {
    expect(UT_FILES.length).toBeGreaterThan(40);
  });
  it('none of "Don’t lose", "miss you", "hurry" … in any ut-owned string', () => {
    const hits: string[] = [];
    for (const f of UT_FILES) {
      const src = strip(fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
      for (const re of GUILT) {
        const m = src.match(re);
        if (m) hits.push(f + ': ' + m[0]);
      }
    }
    expect(hits).toEqual([]);
  });
  it('the test itself catches one', () => {
    expect(GUILT.some((re) => re.test(strip("const s = 'Don’t lose your streak!'; // fine")))).toBe(true);
    expect(GUILT.some((re) => re.test(strip('// a comment that says hurry'))) ).toBe(false);
  });
});
