// The appearance record (studio overhaul players-3, Game Design V2 C.1.4): how a real player looks,
// so "we know who is who". One typed record per player, the same in the match, on his cards and in
// the walkout. The option lists and palettes are V2's, so artists and code agree.
//
// Where a look comes from:
// - Curated players (src/data/appearance/source/<sport>.looks.json, built into the compact
//   src/data/appearance/<sport>.json by scripts/build_appearance.ts): widely known public
//   appearance in that era (hair, facial hair, gear), each row citing its source and reviewed. Skin is
//   set only from a cited public photo (`skinSrc` in the source file), else the neutral default.
//   Uncertain fields are left out and fall back to the defaults below.
// - Everyone else: seeded, era-plausible defaults (by pid, so every phone draws the same man), with
//   the neutral skin. Headbands, goggles, dyed or blond hair and left hands are never defaulted: a
//   wrong signature trait is worse than none.
// Guardrails: there is no race, ethnicity or nationality field (a whitelist test enforces it), and no
// trait is ever derived from a name, nationality, birthplace or team. No tattoos, logos or brand marks.
//
// The data loads lazily, one chunk per sport, with the game or Ultimate Team chunk (never first
// paint): `loadAppearance(sport)`; `pixelReady` (ready.ts) waits for it with the clips.
import { hex, mix, OUTLINE, ramp3, rgb, saturate } from './color';
import { pickFor } from '../../engine/sport';

export type Sport = 'nba' | 'nfl' | 'soccer';

/** Hair silhouettes (V2 C.1.4: 18). Below 24 art px they collapse to four (`lodHair`). */
export const HAIR = ['bald', 'buzz', 'short', 'fade', 'hightop', 'afro', 'afro-big', 'cornrows', 'locs-short', 'locs-long', 'braids', 'ponytail', 'bun', 'mohawk', 'curly-top', 'flow', 'receding', 'band-bound'] as const;
/** Hair colours (V2 C.1.4: 15); 'team' is the kit's main colour. */
export const HAIR_TONE = ['black', 'dark-brown', 'brown', 'light-brown', 'auburn', 'ginger', 'blond', 'platinum', 'grey', 'red', 'blue', 'green', 'pink', 'purple', 'team'] as const;
/** Facial hair: V2's five (none, goatee, full, long, moustache) plus stubble, chinstrap and a short beard. */
export const FACIAL = ['none', 'goatee', 'full', 'long', 'mustache', 'stubble', 'chinstrap', 'short'] as const;
export const HEAD = ['none', 'band', 'wrap', 'skullcap'] as const;
/** Goggles (basketball), and the football helmet's visor: clear, dark or tinted. */
export const EYES = ['none', 'goggles', 'visor-clear', 'visor-dark', 'visor-tint'] as const;
export const ARM = ['none', 'sleeve', 'shooter', 'elbow', 'wrist', 'tape', 'long'] as const;
export const LEG = ['none', 'kneepad', 'kneesleeve', 'brace', 'tights', 'calf'] as const;
export const SOCKS = ['low', 'crew', 'high', 'over-knee'] as const;
/** Gear colours: white, black, the kit's two colours, neon, gold, or tone-on-tone with the jersey. */
export const ACCENT = ['white', 'black', 'team1', 'team2', 'neon', 'gold', 'tone'] as const;
export const BUILD = ['lean', 'avg', 'muscular', 'stocky', 'heavy'] as const;
/** Football: hair out of the back of the helmet. */
export const HELMET_HAIR = ['none', 'locs', 'flow', 'curly'] as const;
export const HAND = ['R', 'L'] as const;
/** Soccer: the preferred foot (B both). */
export const FOOT = ['R', 'L', 'B'] as const;

export type Hair = (typeof HAIR)[number];
export type HairTone = (typeof HAIR_TONE)[number];
export type Facial = (typeof FACIAL)[number];
export type Head = (typeof HEAD)[number];
export type Eyes = (typeof EYES)[number];
export type Arm = (typeof ARM)[number];
export type Leg = (typeof LEG)[number];
export type Socks = (typeof SOCKS)[number];
export type Accent = (typeof ACCENT)[number];
export type Build = (typeof BUILD)[number];
export type HelmetHair = (typeof HELMET_HAIR)[number];

export interface Appearance {
  v: 1;
  /** index into SKIN_TONES; absent = NEUTRAL_SKIN */
  skin?: number;
  /** the public photo the skin tone was picked from (source files and tools only) */
  skinSrc?: string;
  hair: Hair;
  hairTone: HairTone;
  facial: Facial;
  head: Head;
  headC?: Accent;
  eyes: Eyes;
  armL: Arm;
  armR: Arm;
  armC?: Accent;
  legL: Leg;
  legR: Leg;
  legC?: Accent;
  socks: Socks;
  shoe: Accent;
  gloves?: Accent;
  towel?: boolean;
  mouthguard?: boolean;
  neckRoll?: boolean;
  helmetHair?: HelmetHair;
  /** a curated silhouette override; otherwise the build comes from height and weight (buildOf) */
  build?: Build;
  hand: 'R' | 'L';
  foot?: 'R' | 'L' | 'B';
  src: 'curated' | 'default';
}

/** The fields a look can set (what a source row or an era override holds). */
export type LookFields = Omit<Appearance, 'v' | 'src' | 'skinSrc'>;
/** A look for part of a career: from and to are seasons (NBA the year it ends, NFL the year it starts). */
export type LookEra = { from: number; to: number } & Partial<LookFields>;

const BOOL = ['0', '1'] as const;
const SKIN_IDX = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

/** Every field of the compact code, in order, with its options (one base-36 character each). */
export const FIELDS: readonly (readonly [keyof LookFields, readonly string[]])[] = [
  ['skin', SKIN_IDX],
  ['hair', HAIR],
  ['hairTone', HAIR_TONE],
  ['facial', FACIAL],
  ['head', HEAD],
  ['headC', ACCENT],
  ['eyes', EYES],
  ['armL', ARM],
  ['armR', ARM],
  ['armC', ACCENT],
  ['legL', LEG],
  ['legR', LEG],
  ['legC', ACCENT],
  ['socks', SOCKS],
  ['shoe', ACCENT],
  ['gloves', ACCENT],
  ['towel', BOOL],
  ['mouthguard', BOOL],
  ['neckRoll', BOOL],
  ['helmetHair', HELMET_HAIR],
  ['build', BUILD],
  ['hand', HAND],
  ['foot', FOOT],
];

/** The only keys an appearance may carry. No race, ethnicity, nationality or anything like them. */
export const APPEARANCE_KEYS: readonly string[] = ['v', 'src', 'skinSrc', ...FIELDS.map(([k]) => k)];

/** Throws on any key outside the whitelist (the build script and the tests run every row through it). */
export function checkKeys(o: object, extra: readonly string[] = []): void {
  for (const k of Object.keys(o)) if (!APPEARANCE_KEYS.includes(k) && !extra.includes(k)) throw new Error('appearance: no field "' + k + '"');
}

// ---------- palettes ----------

/** The 10 Monk Skin Tone scale bases (Google, CC BY 4.0), lightest to darkest (V2 C.1.4). */
export const SKIN_TONES = ['#f6ede4', '#f3e7db', '#f7ead0', '#eadaba', '#d7bd96', '#a07e56', '#825c43', '#604134', '#3a312a', '#292420'] as const;
/** In the game the bases are 12% more saturated (V2: 8–15%), so they hold up beside kit colours. */
const SKIN_SAT = 1.12;
/** The neutral default skin of every uncurated player, unchanged from before the appearance record. */
export const NEUTRAL_SKIN = '#a8714f';

/** A curated skin tone's in-game base colour. */
export function skinTone(i: number): string {
  return hex(saturate(rgb(SKIN_TONES[Math.max(0, Math.min(9, Math.round(i)))]), SKIN_SAT));
}

/** A skin tone's ramp: [shadow, base, light, outline, rim]; the rim is the lit edge V2 C.1.3 asks for. */
export function skinRamp(i: number): [string, string, string, string, string] {
  const [s, b, l] = ramp3(rgb(skinTone(i)));
  return [hex(s), hex(b), hex(l), hex(OUTLINE), hex(mix(l, [255, 246, 214], 0.35))];
}

/** V2's hair colours; 'team' resolves to the kit's main colour (`hairHex`). */
export const HAIR_TONES: Record<Exclude<HairTone, 'team'>, string> = {
  black: '#1d1612',
  'dark-brown': '#3b2a20',
  brown: '#6a4a32',
  'light-brown': '#8f6a48',
  auburn: '#8a3f22',
  ginger: '#b5562a',
  blond: '#d6b36a',
  platinum: '#ece6d2',
  grey: '#9b9b9b',
  red: '#c8343c',
  blue: '#3a6fd8',
  green: '#3fae5a',
  pink: '#e070b0',
  purple: '#7a4ac8',
};

export function hairHex(tone: HairTone, teamColor: string): string {
  return tone === 'team' ? teamColor : HAIR_TONES[tone];
}

/** The natural tones; the rest (dyed, and blond or lighter) are curated only. */
export const NATURAL_TONES: readonly HairTone[] = ['black', 'dark-brown', 'brown', 'light-brown', 'auburn', 'ginger', 'grey'];

// ---------- level of detail ----------

/** The four silhouettes small sprites keep (V2 C.1.4, below 24 art px). */
export type HairLod = 'none' | 'cap' | 'tall' | 'long';
const HAIR_LOD: Record<Hair, HairLod> = {
  bald: 'none',
  buzz: 'cap',
  short: 'cap',
  fade: 'cap',
  cornrows: 'cap',
  'locs-short': 'cap',
  'curly-top': 'cap',
  receding: 'cap',
  'band-bound': 'cap',
  hightop: 'tall',
  afro: 'tall',
  'afro-big': 'tall',
  mohawk: 'tall',
  bun: 'tall',
  'locs-long': 'long',
  braids: 'long',
  ponytail: 'long',
  flow: 'long',
};

/** The hair a sprite of this height draws: its own silhouette from 24 art px, else one of four. */
export function lodHair(hair: Hair, artPx: number): Hair | HairLod {
  return artPx >= 24 ? hair : HAIR_LOD[hair];
}

/** Facial hair at this height: off below 20 art px, except a full beard (a long one shows as full). */
export function lodFacial(facial: Facial, artPx: number): Facial {
  if (artPx >= 20) return facial;
  return facial === 'full' || facial === 'long' ? 'full' : 'none';
}

// ---------- build ----------

/** Basketball heights by spot and football sizes by position, when a card has none (the same values
 * as hoops2/ratings.ts SPOT_HT and ut/teams.ts SIZE). */
const NBA_HT: Record<string, number> = { PG: 74, SG: 77, SF: 79, PF: 81, C: 83 };
const NFL_SIZE: Record<string, [number, number]> = { QB: [75, 222], RB: [71, 212], WR: [72, 196], TE: [77, 252], OT: [78, 315], OG: [76, 312], C: [75, 300], DE: [76, 270], DT: [75, 305], LB: [74, 240], CB: [71, 192], S: [72, 206], K: [72, 196] };
/** Body-mass index by position where a weight is missing: soccer's from the plan (players-3), NBA's
 * from the league's typical builds by spot. */
const NBA_BMI: Record<string, number> = { PG: 23.6, SG: 23.6, SF: 24.2, PF: 24.9, C: 25.4 };
const SOCCER_BMI: Record<string, number> = { GK: 23.5, CB: 23.6, FB: 22.3, DM: 22.6, CM: 22.6, AM: 22.0, W: 22.0, ST: 23.2 };

const bmiOf = (htIn: number, wt: number) => (wt * 703) / (htIn * htIn);
const wtOf = (htIn: number, bmi: number) => Math.round((bmi * htIn * htIn) / 703);
const ok = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;

/** His weight in pounds: the one given, else his position's typical build at his height. */
export function weightFor(sport: Sport, htIn: number, wt: number | null | undefined, pos?: string): number {
  if (ok(wt)) return wt;
  const p = pos ?? '';
  return pickFor(sport, {
    nba: () => wtOf(htIn, NBA_BMI[p] ?? 24.3),
    nfl: () => {
      const [h, w] = NFL_SIZE[p] ?? [74, 220];
      return wtOf(htIn, bmiOf(h, w));
    },
    soccer: () => wtOf(htIn, SOCCER_BMI[p] ?? 22.6),
  })();
}

export interface BuildCtx {
  /** the card's or the engine body's height: inches (NBA, NFL), centimetres (soccer) */
  ht?: number | null;
  /** pounds (soccer cards carry none) */
  wt?: number | null;
  /** his main position */
  pos?: string;
  /** a draft player's id (`CELL:pid`), for the install-cached attrs */
  id?: string;
  /** the attrs lookup (`nba-attrs.json` / `nfl-attrs.json`, keyed `CELL:pid`) when loaded */
  attrs?: (id: string) => { ht?: number | null; wt?: number | null } | null;
}

/**
 * One build for every place a player is drawn (match, UT and draft cards, the walkout): his height in
 * inches, weight in pounds and BMI. The card line or the engine body first, then the attrs file for a
 * draft cell, then his position's typical build.
 */
export function buildOf(sport: Sport, ctx: BuildCtx): { htIn: number; wt: number; bmi: number } {
  const a = ctx.id && ctx.attrs ? ctx.attrs(ctx.id) : null;
  const pos = ctx.pos ?? '';
  const htIn = pickFor(sport, {
    nba: () => (ok(ctx.ht) ? ctx.ht : ok(a?.ht) ? a.ht : (NBA_HT[pos] ?? 79)),
    nfl: () => (ok(ctx.ht) ? ctx.ht : ok(a?.ht) ? a.ht : (NFL_SIZE[pos]?.[0] ?? 74)),
    // the match clamps soccer heights to 155–205 cm and uses 181 without one: the card does the same
    soccer: () => Math.max(155, Math.min(205, ok(ctx.ht) ? ctx.ht : 181)) / 2.54,
  })();
  const wt = weightFor(sport, htIn, ok(ctx.wt) ? ctx.wt : a?.wt, pos);
  return { htIn, wt, bmi: bmiOf(htIn, wt) };
}

// ---------- the compact code ----------

/** One base-36 character per field ('.' = not set), trailing dots dropped. */
export function encodeFields(f: Partial<LookFields>): string {
  checkKeys(f, ['from', 'to']);
  let s = '';
  for (const [k, opts] of FIELDS) {
    const v = f[k];
    if (v === undefined) {
      s += '.';
      continue;
    }
    const i = opts.indexOf(typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    if (i < 0) throw new Error('appearance: ' + k + ' cannot be ' + JSON.stringify(v));
    s += i.toString(36);
  }
  return s.replace(/\.+$/, '');
}

export function decodeFields(code: string): Partial<LookFields> {
  const out: Record<string, unknown> = {};
  FIELDS.forEach(([k, opts], i) => {
    const c = code[i];
    if (c === undefined || c === '.') return;
    const v = opts[parseInt(c, 36)];
    if (v === undefined) throw new Error('appearance: bad code ' + code);
    out[k] = opts === BOOL ? v === '1' : opts === SKIN_IDX ? Number(v) : v;
  });
  return out as Partial<LookFields>;
}

/** A player's whole entry: base code, then `|from-to:code` per era. */
export function encodeAppearance(base: Partial<LookFields>, eras: LookEra[] = []): string {
  return [encodeFields(base), ...eras.map(({ from, to, ...f }) => from + '-' + to + ':' + encodeFields(f))].join('|');
}

export function decodeAppearance(s: string): { base: Partial<LookFields>; eras: LookEra[] } {
  const [b, ...rest] = s.split('|');
  const eras = rest.map((e) => {
    const m = /^(\d{4})-(\d{4}):(.*)$/.exec(e);
    if (!m) throw new Error('appearance: bad era ' + e);
    return { from: Number(m[1]), to: Number(m[2]), ...decodeFields(m[3]) };
  });
  return { base: decodeFields(b), eras };
}

/** A built per-sport file (src/data/appearance/<sport>.json). */
export interface AppearanceFile {
  v: 1;
  sport: Sport;
  /** the field order of the codes (FIELDS), so an old file is read correctly */
  fields: string[];
  players: Record<string, string>;
  /** soccer: pids whose preferred foot is left, both, or not recorded (everyone else: right) */
  feet?: { L: string[]; B: string[]; U: string[] };
}

// ---------- seeded defaults ----------

/** A steady number in [0, 1) per player and field (FNV-1a): every phone draws the same default. */
export function roll(pid: string, field: string): number {
  let h = 2166136261;
  const s = pid + ':' + field;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

function weighted<T>(table: readonly (readonly [T, number])[], r: number): T {
  const tot = table.reduce((a, [, w]) => a + w, 0);
  let x = r * tot;
  for (const [v, w] of table) {
    if (x < w) return v;
    x -= w;
  }
  return table[table.length - 1][0];
}

type HairTable = readonly (readonly [Hair, number])[];
/** Hair by decade (research §3.6 and the plan's table): plausible ranges, no style above 40% in a
 * bucket, at least five silhouettes; headband-bound, ponytail, bun and mohawk are curated only. */
const HAIR_BY_ERA: Record<Sport, Record<number, HairTable>> = {
  nba: {
    1960: [['short', 0.36], ['buzz', 0.22], ['receding', 0.12], ['afro', 0.1], ['curly-top', 0.1], ['bald', 0.1]],
    1970: [['short', 0.32], ['afro', 0.22], ['afro-big', 0.08], ['buzz', 0.12], ['curly-top', 0.1], ['receding', 0.09], ['bald', 0.07]],
    1980: [['short', 0.3], ['buzz', 0.18], ['curly-top', 0.14], ['afro', 0.1], ['hightop', 0.08], ['receding', 0.1], ['bald', 0.1]],
    1990: [['short', 0.24], ['buzz', 0.22], ['bald', 0.14], ['fade', 0.12], ['hightop', 0.07], ['cornrows', 0.05], ['receding', 0.08], ['curly-top', 0.08]],
    2000: [['buzz', 0.26], ['short', 0.2], ['bald', 0.15], ['fade', 0.14], ['cornrows', 0.1], ['locs-short', 0.06], ['receding', 0.05], ['afro', 0.04]],
    2010: [['fade', 0.3], ['buzz', 0.2], ['short', 0.15], ['locs-short', 0.07], ['locs-long', 0.05], ['bald', 0.08], ['braids', 0.04], ['curly-top', 0.06], ['afro', 0.05]],
    2020: [['fade', 0.28], ['buzz', 0.16], ['short', 0.14], ['locs-short', 0.08], ['locs-long', 0.06], ['braids', 0.06], ['curly-top', 0.08], ['bald', 0.07], ['afro', 0.07]],
  },
  nfl: {
    1970: [['short', 0.36], ['buzz', 0.18], ['receding', 0.1], ['curly-top', 0.12], ['afro', 0.14], ['bald', 0.1]],
    1980: [['short', 0.34], ['buzz', 0.2], ['curly-top', 0.12], ['afro', 0.08], ['receding', 0.1], ['bald', 0.08], ['hightop', 0.08]],
    1990: [['short', 0.3], ['buzz', 0.26], ['bald', 0.12], ['fade', 0.12], ['receding', 0.08], ['curly-top', 0.06], ['locs-long', 0.06]],
    2000: [['buzz', 0.28], ['short', 0.22], ['bald', 0.12], ['fade', 0.13], ['locs-long', 0.08], ['cornrows', 0.07], ['receding', 0.06], ['braids', 0.04]],
    2010: [['fade', 0.28], ['buzz', 0.2], ['short', 0.17], ['locs-long', 0.08], ['locs-short', 0.07], ['bald', 0.09], ['braids', 0.02], ['flow', 0.03], ['curly-top', 0.06]],
  },
  soccer: {
    1950: [['short', 0.38], ['receding', 0.16], ['buzz', 0.12], ['curly-top', 0.12], ['flow', 0.1], ['bald', 0.12]],
    1970: [['short', 0.36], ['flow', 0.16], ['curly-top', 0.14], ['receding', 0.1], ['buzz', 0.08], ['afro', 0.08], ['bald', 0.08]],
    1980: [['short', 0.34], ['flow', 0.16], ['curly-top', 0.14], ['receding', 0.1], ['buzz', 0.1], ['afro', 0.06], ['bald', 0.1]],
    1990: [['short', 0.32], ['buzz', 0.18], ['flow', 0.12], ['curly-top', 0.1], ['bald', 0.1], ['receding', 0.08], ['fade', 0.1]],
    2000: [['short', 0.3], ['buzz', 0.2], ['fade', 0.16], ['flow', 0.1], ['curly-top', 0.08], ['bald', 0.08], ['receding', 0.08]],
    2010: [['short', 0.3], ['fade', 0.25], ['buzz', 0.15], ['flow', 0.1], ['curly-top', 0.08], ['bald', 0.05], ['locs-short', 0.04], ['braids', 0.03]],
  },
};

/** The decade bucket a season falls in (the first and last buckets take everything beyond them). */
export function eraBucket(sport: Sport, season: number): number {
  const keys = Object.keys(HAIR_BY_ERA[sport]).map(Number);
  let best = keys[0];
  for (const k of keys) if (season >= k) best = k;
  return best;
}

/** Every sport's era buckets (for the defaults tests). */
export const ERA_BUCKETS: Record<Sport, readonly number[]> = {
  nba: Object.keys(HAIR_BY_ERA.nba).map(Number),
  nfl: Object.keys(HAIR_BY_ERA.nfl).map(Number),
  soccer: Object.keys(HAIR_BY_ERA.soccer).map(Number),
};

const TONES: readonly (readonly [HairTone, number])[] = [['black', 0.55], ['dark-brown', 0.3], ['brown', 0.15]];
const FACIALS: readonly (readonly [Facial, number])[] = [['none', 0.6], ['stubble', 0.15], ['short', 0.12], ['goatee', 0.07], ['full', 0.06]];
const SKILL = ['QB', 'RB', 'WR', 'TE', 'CB', 'S'];
const LINE = ['OT', 'OG', 'C'];

/** Shoes by era: white through the 1980s, then black and team colours, neon from the 2010s. */
function shoeFor(season: number, r: number): Accent {
  if (season < 1990) return weighted<Accent>([['white', 0.8], ['black', 0.2]], r);
  if (season < 2010) return weighted<Accent>([['white', 0.45], ['black', 0.35], ['team1', 0.2]], r);
  return weighted<Accent>([['white', 0.3], ['black', 0.25], ['team1', 0.25], ['neon', 0.15], ['team2', 0.05]], r);
}

/** Basketball's high socks: half the league in the 1970s, a few since. */
function nbaHighSocks(season: number): number {
  return season < 1970 ? 0.4 : season < 1980 ? 0.5 : season < 1990 ? 0.3 : season < 2000 ? 0.1 : season < 2010 ? 0.12 : 0.15;
}

/** Football: the hair that shows out of the back of a helmet. */
function helmetHairOf(hair: Hair): HelmetHair {
  return hair === 'locs-long' || hair === 'braids' ? 'locs' : hair === 'flow' ? 'flow' : 'none';
}

/** The seeded default look: neutral skin, era-plausible hair, the accepted gear priors. */
export function defaultAppearance(sport: Sport, pid: string, season: number, pos?: string): Appearance {
  const r = (f: string) => roll(pid, f);
  const hair = weighted(HAIR_BY_ERA[sport][eraBucket(sport, season)], r('hair'));
  const a: Appearance = {
    v: 1,
    hair,
    hairTone: weighted(TONES, r('tone')),
    facial: weighted(FACIALS, r('facial')),
    head: 'none',
    eyes: 'none',
    armL: 'none',
    armR: 'none',
    legL: 'none',
    legR: 'none',
    socks: 'crew',
    shoe: shoeFor(season, r('shoe')),
    hand: 'R',
    src: 'default',
  };
  const p = pos ?? '';
  pickFor(sport, {
    nba: () => {
      // a sleeve on the shooting arm (2004 on), a knee sleeve on either leg, era socks
      if (season >= 2004 && r('arm') < 0.12) a.armR = 'sleeve';
      if (r('knee') < 0.1) a[r('kneeSide') < 0.5 ? 'legL' : 'legR'] = 'kneesleeve';
      a.socks = r('socks') < nbaHighSocks(season) ? 'high' : 'crew';
    },
    nfl: () => {
      a.socks = 'high';
      if (SKILL.includes(p) && season >= 2005 && r('visor') < 0.25) a.eyes = 'visor-clear';
      if (['QB', 'RB', 'WR'].includes(p) && season >= 1990 && r('towel') < 0.3) a.towel = true;
      if (['WR', 'RB'].includes(p) && season >= 2000 && r('gloves') < 0.9) a.gloves = r('glovesC') < 0.5 ? 'team1' : 'black';
      if (LINE.includes(p) && r('sleeves') < 0.15) a.armL = a.armR = 'long';
      a.helmetHair = helmetHairOf(hair);
    },
    soccer: () => {
      a.socks = r('socks') < 0.08 ? 'low' : 'high';
      if (r('sleeves') < 0.15) a.armL = a.armR = 'long';
      if (p === 'GK') {
        a.gloves = 'white';
        a.armL = a.armR = 'long';
      }
    },
  })();
  return a;
}

// ---------- ids ----------

export interface Ref {
  pid: string;
  /** the season to draw (an era override applies when it covers it) */
  season: number;
  /** a draft cell: his own seasons in it; an era applies only when it covers all of them */
  span?: [number, number];
}

/**
 * Who an engine or card id is, and when: draft `CHI-1990:jordami01`, UT `nba:season:1996:jordami01:CHI`
 * (and every edition: promo, legend, goat, spotlight, landmark, `standout:<week>`, live
 * `nba:live:<promo>[.f]:…`), the variants `holo~<id>` and `evo~<a+b>~<id>`, soccer `108830:2019:BAR`.
 * Stand-ins (`reserve:PG`, `depth:WR:…`, `squad-3`) have no one to look like: null. `ctx.from`/`to`
 * are a draft player's own seasons inside the cell.
 */
export function refOf(sport: Sport, id: string, ctx?: { from?: number; to?: number }): Ref | null {
  if (id.startsWith('holo~')) return refOf(sport, id.slice(5), ctx);
  if (id.startsWith('evo~')) {
    const at = id.indexOf('~', 4);
    return at < 0 ? null : refOf(sport, id.slice(at + 1), ctx);
  }
  const parts = id.split(':');
  if (parts[0] === sport && parts.length >= 5) {
    const season = Number(parts[parts.length - 3]);
    const pid = parts[parts.length - 2];
    return /^\d{4}$/.test(parts[parts.length - 3]) && pid ? { pid, season } : null;
  }
  const cell = /^[A-Z0-9]+-(\d{4}):(.+)$/.exec(id);
  if (cell) {
    const decade = Number(cell[1]);
    const from = ctx?.from ?? decade;
    const to = ctx?.to ?? decade + 9;
    return { pid: cell[2], season: Math.round((from + to) / 2), span: [from, to] };
  }
  const soc = /^(\d+):(\d{4}):[^:]+$/.exec(id);
  if (soc) return { pid: soc[1], season: Number(soc[2]) };
  return null;
}

// ---------- data and lookup ----------

const FILES: Record<string, () => Promise<{ default: AppearanceFile }>> = {
  ...import.meta.glob<{ default: AppearanceFile }>(['../../data/appearance/nba.json', '../../data/appearance/nfl.json']),
  // the single-file artifact build plays NBA and NFL only: it leaves soccer's data out
  ...(__SOCCER__ ? import.meta.glob<{ default: AppearanceFile }>('../../data/appearance/soccer.json') : {}),
};

interface Loaded {
  players: Map<string, { base: Partial<LookFields>; eras: LookEra[] }>;
  feet: Map<string, 'L' | 'B' | null>;
}
const data: Partial<Record<Sport, Loaded>> = {};
const loading: Partial<Record<Sport, Promise<boolean>>> = {};
const memo = new Map<string, Appearance>();

/** Read a built file into the lookup (also for tests and tools that read the JSON themselves). */
export function useAppearanceFile(f: AppearanceFile): void {
  const order = FIELDS.map(([k]) => k as string);
  if (f.v !== 1 || f.fields.join() !== order.slice(0, f.fields.length).join()) throw new Error('appearance: unknown file layout');
  const players = new Map(Object.entries(f.players).map(([pid, s]) => [pid, decodeAppearance(s)] as const));
  const feet = new Map<string, 'L' | 'B' | null>();
  for (const pid of f.feet?.L ?? []) feet.set(pid, 'L');
  for (const pid of f.feet?.B ?? []) feet.set(pid, 'B');
  for (const pid of f.feet?.U ?? []) feet.set(pid, null);
  data[f.sport] = { players, feet };
  for (const k of [...memo.keys()]) if (k.startsWith(f.sport + '|')) memo.delete(k);
}

/** Load a sport's looks (one small chunk); resolves false if it can't (the defaults carry on). */
export function loadAppearance(sport: Sport): Promise<boolean> {
  if (data[sport]) return Promise.resolve(true);
  const file = FILES['../../data/appearance/' + sport + '.json'];
  if (!file) return Promise.resolve(false);
  const p = (loading[sport] ??= file().then(
    (m) => {
      useAppearanceFile(m.default);
      return true;
    },
    () => {
      delete loading[sport];
      return false;
    },
  ));
  return p;
}

export function appearanceLoaded(sport: Sport): boolean {
  return !!data[sport];
}

/** The season a lookup without one draws (the middle of the sport's data). */
const MID_SEASON: Record<Sport, number> = { nba: 2000, nfl: 2005, soccer: 2016 };

function covers(from: number, to: number, season: number, span?: [number, number]): boolean {
  return span ? from <= span[0] && span[1] <= to : from <= season && season <= to;
}

/**
 * How a player looks in a season: his curated look (with the era override that covers the season, or
 * a draft cell's whole span), filled in with the seeded defaults; everyone else gets the defaults.
 * `ctx.pos` (his main position) only steers default gear. Memoised.
 */
export function appearanceFor(sport: Sport, pid: string, season?: number, ctx?: { pos?: string; span?: [number, number] }): Appearance {
  const s = season ?? MID_SEASON[sport];
  const key = sport + '|' + pid + '|' + (season ?? '') + '|' + (ctx?.span?.join('-') ?? '') + '|' + (ctx?.pos ?? '');
  const hit = memo.get(key);
  if (hit) return hit;
  const d = data[sport];
  const out = defaultAppearance(sport, pid, s, ctx?.pos);
  const row = d?.players.get(pid);
  if (row) {
    Object.assign(out, row.base);
    let helmet = row.base.helmetHair;
    if (season !== undefined)
      for (const { from, to, ...e } of row.eras)
        if (covers(from, to, s, ctx?.span)) {
          Object.assign(out, e);
          helmet = e.helmetHair ?? helmet;
        }
    // a curated hair the record says nothing about under the helmet: what that hair shows out of it
    if (out.helmetHair !== undefined && helmet === undefined) out.helmetHair = helmetHairOf(out.hair);
    out.src = 'curated';
  }
  if (sport === 'soccer' && d && out.foot === undefined && d.feet.get(pid) !== null) out.foot = d.feet.get(pid) ?? 'R';
  if (memo.size > 5000) memo.clear();
  memo.set(key, out);
  return out;
}
