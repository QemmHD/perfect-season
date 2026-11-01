// Claude, 2026-11-01 (wave 3): the Live Calendar's program packs and picks, built on the content-drop
// packs (rare golds, Weekly Standouts, pick sheets). They open on the device like Gold/Premium; the
// registry is never involved.
//   live:<promo>        Program Pack      NBA 8 / NFL 16: 3 / 6 rare golds, 4 / 9 golds and a program
//                                         slot (programOdds, default 30%; the season's other promos via
//                                         extraOdds; otherwise a current Weekly Standout)
//   live-plus:<promo>   Program Guarantee NBA 6 / NFL 12: 5 / 11 rare golds + 1 program card
//   live-pick:<promo>:n pick 1 of n program cards (rewards only, never sold)
// The Finale is SBC-only: it never fills a pack slot.
import { hashString, type Rand, rng, shuffle } from '../engine/rng';
import { packsOn, per, promoById, schedule, type CalPack } from './calendar';
import { contentOf, type PickState } from './content-state';
import { FINALE_KIND, promoCards } from './live-cards';
import { fill, type Odds, type PackDef } from './packs';
import type { Pool } from './pool';
import { weekOf } from './sbc';
import type { UtState } from './state';
import type { RatedCard, UtSport } from './types';

const R: Odds = { rare: 1 };
const G: Odds = { gold: 1 };
const rep = (n: number, o: Odds) => Array.from({ length: n }, () => o);

export const PROGRAM_PRICE = 5000;
export const GUARANTEE_PRICE = 12000;
/**
 * The schedule's prices were planned on a larger coin scale; ours pays 60/30 a match. Each template
 * scales its scheduled price so a base program pack's quick-sell value lands near half its price
 * (FC research: 45-60%); the pricier elite-tier packs keep their relative premium (lower EV, rarer hits).
 */
export const PRICE_FACTOR: Record<UtSport, Record<string, number>> = { nba: { program: 0.7, guarantee: 0.35 }, nfl: { program: 0.45, guarantee: 0.21 } };

/** The pack's promo id (`live:s4-honors-y2` → `s4-honors-y2`). */
export const promoOfPack = (kind: string) => kind.replace(/^live(-plus|-pick)?:/, '').split(':')[0];

/** A program pack's published shape: slots, price, and how its program slot divides. */
export function livePackDef(sport: UtSport, pack: Pick<CalPack, 'id' | 'tpl' | 'name' | 'price' | 'programOdds' | 'extraOdds'>): PackDef & { odds: number; extra: [string, number][] } {
  const tpl = schedule()?.defaults.packTemplates[pack.tpl] ?? {};
  const guarantee = pack.tpl === 'guarantee';
  const odds = guarantee ? 1 : (pack.programOdds ?? tpl.programOdds ?? 0.3);
  // the Finale never fills a pack slot (owner decision: SBC-only)
  const extra = Object.entries(pack.extraOdds ?? {}).filter(([id]) => promoById(id)?.kind !== FINALE_KIND && promoById(id)?.kind !== 'season-finale');
  const extraP = extra.reduce((a, [, p]) => a + p, 0);
  const slot: Odds = guarantee ? { program: 1 } : { program: odds + extraP, standout: 1 - odds - extraP };
  const slots = guarantee ? [...rep(sport === 'nba' ? 5 : 11, R), slot] : [...rep(sport === 'nba' ? 3 : 6, R), ...rep(sport === 'nba' ? 4 : 9, G), slot];
  const name = per(pack.name, sport) ?? pack.id;
  return {
    kind: pack.id as PackDef['kind'],
    name,
    price: Math.round(((pack.price ?? tpl.price ?? (guarantee ? GUARANTEE_PRICE : PROGRAM_PRICE)) * (PRICE_FACTOR[sport][pack.tpl] ?? 1)) / 100) * 100,
    blurb: guarantee
      ? slots.length + ' cards: ' + (slots.length - 1) + ' rare golds and one program card guaranteed'
      : slots.length + ' cards: ' + (sport === 'nba' ? 3 : 6) + ' rare golds, ' + (sport === 'nba' ? 4 : 9) + ' golds and a program slot (' + Math.round((odds + extraP) * 100) + '% a program card, otherwise a Weekly Standout)',
    slots,
    odds,
    extra,
  };
}

/** The pack definition for a pack id, from the schedule (any cycle). */
function packOf(kind: string): (CalPack & { cycleId: string }) | null {
  const s = schedule();
  if (!s) return null;
  const m = /^(.*?)(-y\d+)?$/.exec(kind)!;
  for (const se of s.seasons) for (const p of se.packs) if (p.id === m[1]) return { ...p, id: kind, cycleId: kind };
  return null;
}

export function livePackName(sport: UtSport, kind: string): string {
  if (kind.startsWith('live-pick:')) return (per(promoById(promoOfPack(kind))?.name, sport) ?? 'Program') + ' Pick';
  const p = packOf(kind);
  return p ? (per(p.name, sport) ?? 'Program Pack') : 'Program Pack';
}

/** Open a program pack: its slots, the program slot drawn from the released cards of its promos. */
export function openLivePack(pool: Pool, kind: string, rand: Rand, day: string, week = weekOf(day)): RatedCard[] {
  const p = packOf(kind);
  if (!p) return [];
  const def = livePackDef(pool.sport, p);
  const promo = promoOfPack(kind);
  const draw = (r: Rand): RatedCard | null => {
    // which promo this slot is (the pack's own, or one of its extras), in proportion to their odds
    const total = def.odds + def.extra.reduce((a, [, x]) => a + x, 0);
    let x = r() * total;
    let id = promo;
    for (const [e, o] of def.extra) {
      if (x < o) {
        id = e;
        break;
      }
      x -= o;
    }
    const list = promoCards(pool, id, day);
    return list.length ? list[Math.floor(r() * list.length)] : null;
  };
  return fill(pool, def.slots, rand, undefined, week, draw);
}

/** Program packs on sale on a day (the Store's This Season row). */
export function livePacksOn(day: string): (CalPack & { cycle: number })[] {
  return packsOn(day);
}

// ---------- limits ----------

export function liveLimitKey(pack: Pick<CalPack, 'id' | 'tpl'>, day: string): string {
  return pack.tpl === 'guarantee' ? 'live:' + pack.id + ':' + weekOf(day) : 'live:' + pack.id + ':' + day;
}
export function liveLimit(pack: Pick<CalPack, 'tpl'>): number {
  const l = schedule()?.defaults.packTemplates[pack.tpl]?.limit;
  return pack.tpl === 'guarantee' ? (l?.perWeek ?? 1) : (l?.perDay ?? 3);
}
export function liveBuysLeft(ut: UtState, pack: Pick<CalPack, 'id' | 'tpl'>, day: string): number {
  return Math.max(0, liveLimit(pack) - (contentOf(ut).buys?.[liveLimitKey(pack, day)] ?? 0));
}
export function recordLiveBuy(ut: UtState, pack: Pick<CalPack, 'id' | 'tpl'>, day: string): UtState {
  const c = contentOf(ut);
  const key = liveLimitKey(pack, day);
  const week = weekOf(day);
  const kept = Object.fromEntries(Object.entries(c.buys ?? {}).filter(([k]) => !k.startsWith('live:') || k.endsWith(day) || k.endsWith(week)));
  return { ...ut, content: { ...c, buys: { ...kept, [key]: (kept[key] ?? 0) + 1 } } };
}

// ---------- program picks ----------

/** A `live-pick:<promo>:<n>` reward as a pick sheet (seeded by its pending id). */
export function livePick(pool: Pool, kind: string, id: string, day: string, at: number): PickState | null {
  const [, promo, n] = kind.split(':');
  const cards = promoCards(pool, promo, day);
  if (!cards.length) return null;
  const options = shuffle(cards, rng(hashString('live-pick:' + id))).slice(0, Math.max(1, Math.min(5, Number(n) || 3)));
  return { id, kind: 'live-pick', title: livePackName(pool.sport, kind), options: options.map((rc) => rc.line.id), at };
}

/** Pack kinds the schedule names in rewards, as this build's kinds (the content-drop packs). */
export function resolvePackKind(kind: string, day: string): string {
  const map: Record<string, string> = { 'daily-drop': 'daily', 'scout-choice': 'scout', 'elite-gold': 'elite', 'jumbo-premium': 'jumbo', 'standout-guarantee': 'standout' };
  if (map[kind]) return map[kind];
  if (kind.startsWith('season-program')) {
    const packs = packsOn(day);
    const prog = packs.find((p) => p.tpl === (kind === 'season-program-guarantee' ? 'guarantee' : 'program'));
    if (kind === 'season-program-pick') {
      const se = packs[0]?.season;
      return se?.raw.programPick ? se.raw.programPick + (se.cycle ? '' : '') : prog ? 'live-pick:' + promoOfPack(prog.id) + ':3' : 'scout';
    }
    return prog?.id ?? 'premium';
  }
  return kind;
}
