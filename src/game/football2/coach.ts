// The offense's football brain (Claude, studio overhaul nfl-5; audit P-2, plan §8 nfl-5): one table
// for how often to throw by down and distance (the AI's own call, and how many pass cards the tray
// deals), which concepts fit the distance (the AI's concept and the tray's cards), what each card
// beats and what holds it, Coach Pick and its reason, and the run/pass mirror AUDIBLE flips to.
//
// Coach Pick reads only what a coach in the booth sees before the snap: the down, the distance, the
// spot, the clock and the shell the defense shows (no safety, one high, two deep). It never reads the
// defense's real call, so a disguise that rotates after the snap fools him as it fools you. From the
// shell and the situation he weighs which calls are likely (the defense's own Pro call sheet, and how
// often a shell is a disguise), then which card does best against them: each card's chance to make a
// successful play (40% of the distance on first down, 60% on second, all of it on third and fourth),
// from what it beats, what holds it and how far it usually gets. A tie goes to the first card.
//
// Pure and seeded by the caller: both phones deal the same cards.
import { hashString, rng } from '../../engine/rng';
import { CALL_IDS, CALLS, type DefCallId, DISGUISE, sheet, type Shell, type Situation, zoneOf } from './calls';
import type { Concept, RunPlay } from './types';

export const CONCEPT_LIST: Concept[] = ['verts', 'slants', 'smash', 'flood', 'dagger', 'mesh', 'curls', 'posts'];
export const RUN_LIST: RunPlay[] = ['inside', 'power', 'outside'];

/** A play card: a pass concept or a run (the other field rides along, as the drive keeps both). */
export interface Card {
  call: 'pass' | 'run';
  concept: Concept;
  run: RunPlay;
}
export type CardKey = Concept | RunPlay;
export const cardKey = (c: Card): CardKey => (c.call === 'pass' ? c.concept : c.run);

// ---------- how often to throw ----------

/**
 * The run/pass split by down and distance (the NFL's shape: about 47% passes on first down, 59% on
 * second, 74% on third, 62% on fourth): short yardage runs more, long yardage throws more, the goal
 * line runs, and the two-minute drill throws.
 */
export function passShare(s: Situation): number {
  const short = s.toGo <= 2;
  const long = s.toGo >= 8;
  let p: number;
  if (s.down === 1) p = long ? 0.47 : 0.38;
  else if (s.down === 2) p = short ? 0.36 : long ? 0.7 : 0.56;
  else if (s.down === 3) p = short ? 0.42 : s.toGo <= 4 ? 0.7 : 0.88;
  else p = short ? 0.52 : s.toGo <= 4 ? 0.72 : 0.9;
  if (zoneOf(s) === 'goal') p -= 0.12;
  if (s.clock !== null) p = Math.min(0.95, p + 0.22);
  return Math.max(0.05, Math.min(0.95, p));
}

/** What a successful play needs here (yards): 40% of the distance on first down, 60% on second, all of it after. */
export const successNeed = (s: Pick<Situation, 'down' | 'toGo'>) => (s.down === 1 ? 0.4 : s.down === 2 ? 0.6 : 1) * s.toGo;

// ---------- what each card does ----------

/** Each card's knowledge: what it beats, what holds it, the "beats" note, and how a completion (or a carry) usually goes. */
export interface CardBook {
  beats: DefCallId[];
  holds: DefCallId[];
  /** the card's note: "beats Cover 3" (short, for the 84 px card) */
  note: string;
  /** a pass: completion per dropback against a neutral call; a run: its share of carries that make the yards it usually makes */
  base: number;
  /** a pass: the usual gain when it's caught; a run: the usual carry */
  gain: number;
  /** a pass: how long it takes to develop (0 quick game, 1 a deep dropback): what a blitz costs it */
  slow: number;
}

export const BOOK: Record<CardKey, CardBook> = {
  verts: { beats: ['c3', 'c2', 'fire', 'sim'], holds: ['c4', 'prevent', 't2'], note: 'COVER 3', base: 0.5, gain: 22, slow: 1 },
  slants: { beats: ['c0', 'c1', 'fire', 'goal'], holds: ['t2', 'c2', 'c4'], note: 'BLITZ', base: 0.66, gain: 8, slow: 0 },
  smash: { beats: ['c2', 't2', 'c4'], holds: ['c0', 'c1', 'c1r'], note: 'COVER 2', base: 0.55, gain: 12, slow: 0.6 },
  flood: { beats: ['c3', 'fire', 'sim', 'c4'], holds: ['c2', 'goal', 'prevent'], note: 'COVER 3', base: 0.56, gain: 13, slow: 0.7 },
  dagger: { beats: ['c4', 'c3', 'c2'], holds: ['c1r', 'c1', 'goal'], note: 'QUARTERS', base: 0.55, gain: 16, slow: 0.8 },
  mesh: { beats: ['c1', 'c1r', 'c0', 'goal'], holds: ['t2', 'c3', 'c2'], note: 'MAN', base: 0.68, gain: 7, slow: 0.2 },
  curls: { beats: ['c3', 'c4', 'prevent', 'sim'], holds: ['c2', 'c1', 'c0'], note: 'ZONE', base: 0.64, gain: 8, slow: 0.3 },
  posts: { beats: ['c1', 'c3', 'fire'], holds: ['c4', 'c2', 'prevent'], note: 'ONE HIGH', base: 0.5, gain: 18, slow: 0.9 },
  inside: { beats: ['c2', 't2', 'c4', 'prevent'], holds: ['goal', 'c0', 'c1r'], note: 'TWO DEEP', base: 0.5, gain: 4.2, slow: 0 },
  power: { beats: ['c3', 'sim', 'c2'], holds: ['goal', 'fire', 'c1'], note: 'ONE HIGH', base: 0.5, gain: 4.4, slow: 0 },
  outside: { beats: ['c0', 'fire', 'c1'], holds: ['c2', 't2', 'goal'], note: 'BLITZ', base: 0.45, gain: 4.6, slow: 0 }
};

/** The card's note on the tray: what it beats. */
export const cardNote = (c: Card) => BOOK[cardKey(c)].note;

/** How a matchup moves a pass's completion (or a run's chance) up or down. */
const EDGE = 0.16;
/** what a blitz takes off a slow-developing pass (sacks and hurried throws) */
const BLITZ_COST = 0.14;

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

/** A card's chance of a successful play against one call, in this situation. */
export function cardValue(c: Card, call: DefCallId, s: Situation): number {
  const b = BOOK[cardKey(c)];
  const edge = b.beats.includes(call) ? 1 : b.holds.includes(call) ? -1 : 0;
  const need = successNeed(s);
  if (c.call === 'run') {
    // a carry's yards spread about 2.6 yd either way; the goal line and the end zone's back line cap it
    const gain = b.gain + edge * 1.4;
    return logistic((gain - need) / 2.2);
  }
  const blitz = CALLS[call].family === 'BLITZ' ? BLITZ_COST * b.slow : 0;
  const cmp = Math.max(0.05, Math.min(0.95, b.base + EDGE * edge - blitz));
  // a completion's gain spreads with its depth; inside the 10 the field is short for a deep shot
  const room = 100 - s.ballOn;
  const gain = Math.min(b.gain, room + 4);
  return cmp * logistic((gain - need) / Math.max(2.5, gain * 0.45));
}

/**
 * How likely each call is, given the situation and the shell shown: the Pro call sheet (what any
 * defense here tends to call), times how often that call shows this shell (its own, unless it's
 * disguising: Pro's rate).
 */
export function callOdds(s: Situation, shown: Shell): Record<DefCallId, number> {
  const w = sheet(s);
  const d = DISGUISE.pro;
  const odds = {} as Record<DefCallId, number>;
  let total = 0;
  for (const id of CALL_IDS) {
    const shell = CALLS[id].shell;
    // a disguise of `shell` shows each of its other looks this often (calls.ts disguiseOf)
    const looks = shell === 'one' ? { two: 0.5, zero: 0.5, one: 0 } : { one: 1, two: 0, zero: 0 };
    const p = (w[id] ?? 0) * (shown === shell ? 1 - d : d * looks[shown]);
    odds[id] = p;
    total += p;
  }
  for (const id of CALL_IDS) odds[id] = total > 0 ? odds[id] / total : 1 / CALL_IDS.length;
  return odds;
}

/** A card's expected chance of a successful play, given the shell shown. */
export function expectedValue(c: Card, s: Situation, shown: Shell): number {
  const odds = callOdds(s, shown);
  return CALL_IDS.reduce((n, id) => n + odds[id] * cardValue(c, id, s), 0);
}

// ---------- Coach Pick ----------

const SHELL_LEAD: Record<Shell, string> = { zero: 'No safety', one: 'One high', two: 'Two deep' };
/** why a card is right against a look (what the shell leaves open) */
const WHY: Record<CardKey, Partial<Record<Shell, string>> & { any: string }> = {
  verts: { one: 'four verts on three deep', two: 'the seams split them', zero: 'nobody deep: take the shot', any: 'stretch them deep' },
  slants: { zero: 'throw hot, it is coming', one: 'quick slants beat the press', any: 'get it out quick' },
  smash: { two: 'the corner behind the squat', any: 'high-low the corner' },
  flood: { one: 'three levels on one side', any: 'flood the sideline' },
  dagger: { two: 'the dig behind the backers', one: 'the dig under the safety', any: 'the dig over the middle' },
  mesh: { zero: 'crossers rub off man', one: 'crossers beat man', any: 'crossers find space' },
  curls: { one: 'curls sit in the zone', two: 'the flats are soft', any: 'sit down in the zone' },
  posts: { one: 'two posts on one safety', any: 'attack the middle deep' },
  inside: { two: 'light box, run it', any: 'run it downhill' },
  power: { one: 'pull a guard into the gap', any: 'run behind the guard' },
  outside: { zero: 'they sold out: get the edge', any: 'get to the edge' }
};

/** Coach Pick's reason in a few words, from the shell shown and the situation. */
export function coachReason(c: Card, s: Situation, shown: Shell): string {
  const k = cardKey(c);
  if (s.down >= 3 && s.toGo <= 2 && c.call === 'run') return 'Short yardage: move the chains';
  if (s.down >= 3 && s.toGo >= 8 && c.call === 'pass' && BOOK[k].gain >= s.toGo) return 'Long yardage: past the sticks';
  const w = WHY[k];
  const shellLine = w[shown];
  return shellLine ? SHELL_LEAD[shown] + ': ' + shellLine : w.any.charAt(0).toUpperCase() + w.any.slice(1);
}

/** Coach Pick among the tray's cards: the best expected play for the look shown, and why. */
export function coachPick(cards: readonly Card[], s: Situation, shown: Shell): { index: number; reason: string } {
  let index = 0;
  let best = -Infinity;
  cards.forEach((c, i) => {
    const v = expectedValue(c, s, shown);
    if (v > best + 1e-9) {
      best = v;
      index = i;
    }
  });
  return { index, reason: cards.length ? coachReason(cards[index], s, shown) : '' };
}

// ---------- the deal ----------

/**
 * The pass concepts that fit this situation, `count` of them, drawn without replacement from the
 * snap's own seed (every concept stays possible; the ones likeliest to make the yards come up most).
 */
export function dealConcepts(seed: string, s: Situation, count: number): Concept[] {
  const r = rng(hashString('deal:' + seed));
  const need = successNeed(s);
  const pool = CONCEPT_LIST.map((k) => {
    const b = BOOK[k];
    const fit = b.base * logistic((Math.min(b.gain, 100 - s.ballOn + 4) - need) / Math.max(2.5, b.gain * 0.45));
    return { k, w: 0.12 + fit };
  });
  const out: Concept[] = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((n, x) => n + x.w, 0);
    let u = r() * total;
    let i = 0;
    while (i < pool.length - 1 && (u -= pool[i].w) >= 0) i++;
    out.push(pool[i].k);
    pool.splice(i, 1);
  }
  return out;
}

/** The runs for this snap, `count` of them in a seeded order (short yardage leads with the downhill runs). */
export function dealRuns(seed: string, s: Situation, count: number): RunPlay[] {
  const r = rng(hashString('runs:' + seed));
  const order = [...RUN_LIST].sort((a, b) => (s.toGo <= 2 ? Number(a === 'outside') - Number(b === 'outside') : 0) || r() - 0.5);
  return order.slice(0, count);
}

/** How many of the tray's three cards are passes here (the same table the AI calls from). */
export const passCards = (s: Situation) => {
  const p = passShare(s);
  return p >= 0.75 ? 3 : p >= 0.45 ? 2 : 1;
};

// ---------- AUDIBLE ----------

/** Each card's run/pass mirror out of the same formation (AUDIBLE on B flips the picked card to it). */
export const MIRROR: Record<CardKey, CardKey> = {
  verts: 'power',
  slants: 'inside',
  smash: 'outside',
  flood: 'outside',
  dagger: 'power',
  mesh: 'inside',
  curls: 'outside',
  posts: 'power',
  inside: 'slants',
  power: 'posts',
  outside: 'flood'
};

/** The card AUDIBLE flips `c` to: its mirror, keeping the other field as it was. */
export function mirrorOf(c: Card): Card {
  const m = MIRROR[cardKey(c)];
  return c.call === 'pass' ? { call: 'run', concept: c.concept, run: m as RunPlay } : { call: 'pass', concept: m as Concept, run: c.run };
}
