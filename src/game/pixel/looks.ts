// A player's drawn look (studio overhaul players-3): the kit he wears this game or on his card, plus
// his appearance record (appearance.ts), turned into the `Look` the body raster draws. One place for
// the match (`matchLook`) and the cards (`cardLook`), so a man looks the same on both: one build
// formula (`buildOf`), one hair, one skin.
//
// The legacy `hair`/`beard`/`skin`/`hairColor` fields are filled from the record, so today's raster
// draws curated looks as they are; `app` carries the whole record for the detail the raster learns
// next (players-4: the 18 silhouettes, facial hair, gear).
import { type Accent, type Appearance, appearanceFor, buildOf, type BuildCtx, hairHex, NEUTRAL_SKIN, type Ref, skinTone, type Sport } from './appearance';
import type { Look } from './body';
import type { CardLine } from '../../ut/types';
import { pickFor } from '../../engine/sport';

/** The colours a kit hands the look (each sport's renderer kit has these, or a subset). */
export interface KitColors {
  jersey: string;
  trim: string;
  shorts: string;
  socks: string;
  shoes: string;
  /** football */
  helmet?: string;
  stripe?: string;
  mask?: string;
  pants?: string;
  /** soccer: a keeper's gloves */
  gloves?: string;
}

/**
 * The reserved cosmetic hook (Ultimate Team mastery and Minutes rewards): gold shoes, a ground-ring
 * colour. Render only; absent for everyone without one.
 */
export interface Cosmetic {
  shoes?: string;
  ring?: string;
}

export interface MatchCtx extends BuildCtx {
  num: number | null;
  /** soccer: the keeper */
  gk?: boolean;
  /** football pads (1 skill, 1.25 a big man) */
  pads?: number;
  cosmetic?: Cosmetic;
}

export type AppLook = Look & { app: Appearance };

/** A gear colour against the kit. */
export function accentHex(a: Accent, kit: Pick<KitColors, 'jersey' | 'trim'>): string {
  return { white: '#f2f2ee', black: '#1b1b1f', team1: kit.jersey, team2: kit.trim, neon: '#c6f53a', gold: '#e8b83a', tone: kit.jersey }[a];
}

/** Today's raster's hair codes (0 short, 1 buzz, 2 high top, 3 bald, 4 headband, 5 locs) for a record. */
export function legacyHair(app: Appearance): number {
  if (app.head === 'band' || app.hair === 'band-bound') return 4;
  switch (app.hair) {
    case 'bald':
      return 3;
    case 'buzz':
    case 'fade':
    case 'receding':
    case 'cornrows':
      return 1;
    case 'hightop':
    case 'afro':
    case 'afro-big':
    case 'mohawk':
      return 2;
    case 'locs-short':
    case 'locs-long':
    case 'braids':
    case 'ponytail':
    case 'bun':
    case 'flow':
      return 5;
    default:
      return 0;
  }
}

/** Facial hair the legacy raster shows as a beard. */
const BEARDS = ['goatee', 'full', 'long', 'chinstrap', 'short'];

function fromApp(sport: Sport, app: Appearance, kit: KitColors, htIn: number, wt: number, num: number | null): AppLook {
  return {
    sport,
    ht: htIn,
    wt,
    num,
    hair: legacyHair(app),
    beard: BEARDS.includes(app.facial),
    skin: app.skin === undefined ? NEUTRAL_SKIN : skinTone(app.skin),
    hairColor: hairHex(app.hairTone, kit.jersey),
    jersey: kit.jersey,
    trim: kit.trim,
    shorts: kit.shorts,
    socks: kit.socks,
    shoes: accentHex(app.shoe, kit),
    app,
  };
}

/**
 * A body's look in the match. `ref` is who he is (refOf on the engine id); a stand-in (null) gets
 * the seeded defaults for `ctx.id`. Build from `buildOf`, gear and hair from the record.
 */
export function matchLook(sport: Sport, ref: Ref | null, kit: KitColors, ctx: MatchCtx): AppLook {
  const app = ref ? appearanceFor(sport, ref.pid, ref.season, { pos: ctx.pos, span: ref.span }) : appearanceFor(sport, ctx.id ?? '', undefined, { pos: ctx.pos });
  const { htIn, wt } = buildOf(sport, ctx);
  const look = fromApp(sport, app, kit, htIn, wt, ctx.num);
  const longSleeves = app.armL === 'long' && app.armR === 'long';
  pickFor(sport, {
    nba: () => undefined,
    nfl: () => {
      Object.assign(look, { helmet: kit.helmet, stripe: kit.stripe, mask: kit.mask, pants: kit.pants, pads: ctx.pads ?? 1, sleeves: longSleeves ? 'long' : 'short' });
      if (app.gloves) look.gloves = accentHex(app.gloves, kit);
    },
    soccer: () => {
      look.sleeves = longSleeves || ctx.gk ? 'long' : 'short';
      if (ctx.gk) look.gloves = kit.gloves ?? accentHex(app.gloves ?? 'white', kit);
    },
  })();
  if (ctx.cosmetic?.shoes) look.shoes = ctx.cosmetic.shoes;
  if (ctx.cosmetic?.ring) look.ring = ctx.cosmetic.ring;
  return look;
}

/** Relative luminance 0–1 of a #rrggbb colour. */
function lum(c: string): number {
  const h = c.replace('#', '');
  if (h.length < 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A card's look: his season's colours (club colours only, no real kits) and his record for that season. */
export function cardLook(line: CardLine): AppLook {
  const sport = line.sport;
  const keeper = line.pos[0] === 'GK';
  const app = appearanceFor(sport, line.pid, line.season, { pos: line.pos[0] });
  const { htIn, wt } = buildOf(sport, { ht: line.ht, wt: line.wt, pos: line.pos[0] });
  // pants: white against a dark jersey, the trim colour against a light one
  const fbPants = lum(line.c1) < 0.5 ? '#e8e8e4' : line.c2;
  const shirt = keeper ? '#b6f23a' : line.c1;
  const kit: KitColors = pickFor(sport, {
    nba: { jersey: line.c1, trim: line.c2, shorts: line.c1, socks: '#f2f2f2', shoes: '#1b1b1f' },
    nfl: { jersey: line.c1, trim: line.c2, shorts: fbPants, socks: line.c1, shoes: '#1b1b1f', helmet: line.c1, stripe: line.c2, mask: lum(line.c1) < 0.35 ? '#c9ccd0' : '#2a2d33', pants: fbPants },
    soccer: { jersey: shirt, trim: keeper ? '#16161c' : line.c2, shorts: keeper ? shirt : lum(line.c2) > 0.75 ? line.c2 : line.c1, socks: shirt, shoes: '#1b1b1f', gloves: keeper ? '#f2f2ee' : undefined },
  });
  const look = fromApp(sport, app, kit, htIn, wt, line.num);
  const longSleeves = app.armL === 'long' && app.armR === 'long';
  pickFor(sport, {
    nba: () => undefined,
    nfl: () => {
      Object.assign(look, { helmet: kit.helmet, stripe: kit.stripe, mask: kit.mask, pants: kit.pants, pads: ['OT', 'OG', 'C', 'DE', 'DT'].includes(line.pos[0]) ? 1.25 : 1, sleeves: longSleeves ? 'long' : 'short' });
      if (app.gloves) look.gloves = accentHex(app.gloves, kit);
    },
    soccer: () => {
      look.sleeves = longSleeves || keeper ? 'long' : 'short';
      if (keeper) look.gloves = kit.gloves;
    },
  })();
  return look;
}
