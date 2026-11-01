// Claude, 2026-11-01 (wave 3): Live Calendar program cards.
// Id: `<sport>:live:<promoId>[.f]:<season>:<pid>:<fr>` (`.f` = the promo's featured card). A card
// rebuilds from its id alone (the promo's band and delta + its season card), so an owned program card
// resolves forever, after its promo ends and even if selection would no longer pick it.
// Rating: OVR = clamp(base + delta, band) on the reference scale through onScale, capped at 97 for
// every program except the Finale (the only 98–99 cards of the year; SBC-only).
// Selection (which players a promo has) is deterministic per sport and promo id: rule → rating gate
// → order (top by base, or a seeded shuffle) → take with distinct players, per-group caps, waves and
// position slots → featured.
import { hashString, rng, shuffle } from '../engine/rng';
import { compileRule, ruleContext, type RuleLine } from './calendar-rules';
import { per, promoById, wavesOf, type CalPromoOn, type CalWave } from './calendar';
import type { Pool } from './pool';
import { onScale, rateCard } from './rate';
import type { CardLine, RatedCard, UtSport } from './types';

export const PROGRAM_CAP = 97;
export const FINALE_KIND = 'finale';
const PHYSICAL = new Set(['SPD', 'ACC', 'STR', 'VRT', 'STA', 'AGI']);

export function liveId(promoId: string, featured: boolean, s: Pick<CardLine, 'sport' | 'season' | 'pid' | 'fr'>): string {
  return s.sport + ':live:' + promoId + (featured ? '.f' : '') + ':' + s.season + ':' + s.pid + ':' + s.fr;
}

export function parseLiveId(id: string): { sport: UtSport; promoId: string; featured: boolean; seasonId: string } | null {
  const p = id.split(':');
  if (p.length !== 6 || p[1] !== 'live' || (p[0] !== 'nba' && p[0] !== 'nfl') || !/^\d{4}$/.test(p[3])) return null;
  const featured = p[2].endsWith('.f');
  return { sport: p[0] as UtSport, promoId: featured ? p[2].slice(0, -2) : p[2], featured, seasonId: p[0] + ':season:' + p[3] + ':' + p[4] + ':' + p[5] };
}

/** The band a card of this promo lands in (the featured band for `.f`), reference scale. */
function bandOf(promo: CalPromoOn, featured: boolean, sport: UtSport): [number, number] {
  const f = promo.featured ?? wavesOf(promo, sport).find((w) => w.featured)?.featured;
  return featured && f ? f.band : promo.ovrBand;
}

/** A program card's line from its id (null when the promo or the season card is unknown). */
export function deriveLiveLine(id: string, seasonOf: (id: string) => CardLine | undefined): CardLine | null {
  const ref = parseLiveId(id);
  if (!ref) return null;
  const promo = promoById(ref.promoId);
  const base = seasonOf(ref.seasonId);
  if (!promo || !base || base.kind !== 'season') return null;
  const band = bandOf(promo, ref.featured, ref.sport);
  return {
    ...base,
    id,
    kind: 'live',
    boost: promo.delta,
    label: (per(promo.name, ref.sport) ?? promo.baseId).toUpperCase(),
    seasonId: base.id,
    program: promo.id,
    programKind: promo.kind,
    band,
    accent: promo.season.accent,
    featured: ref.featured,
  };
}

/** Rate a program card (rate.ts routes kind `live` here). */
export function rateLive(line: CardLine, level = 1, pos?: string): RatedCard {
  const base = rateCard({ ...line, id: line.seasonId ?? line.id, kind: 'season', boost: undefined, label: undefined }, level, pos);
  const band = line.band ?? [0, 99];
  const top = line.programKind === FINALE_KIND ? 99 : PROGRAM_CAP;
  const lo = Math.min(top, onScale(band[0], line.sport));
  const hi = Math.min(top, onScale(band[1], line.sport));
  const ovr = Math.max(lo, Math.min(hi, base.ovr + (line.boost ?? 0)));
  const d = Math.max(0, ovr - base.ovr);
  const face = new Set(base.key.map(([c]) => c));
  const attrs: Record<string, number> = { ...base.attrs };
  for (const code of Object.keys(attrs)) {
    if (code === 'FT' || !d) continue;
    const add = face.has(code) ? (PHYSICAL.has(code) ? Math.min(2, d) : d) : Math.min(1, d);
    attrs[code] = Math.max(attrs[code], Math.min(99, attrs[code] + add));
  }
  return { ...base, line, ovr, tier: 'program', attrs, key: base.key.map(([c, n]) => [c, n, attrs[c] ?? ovr]) };
}

// ---------- selection ----------

const selections = new WeakMap<Pool, Map<string, { id: string; wave: number; featured: boolean }[]>>();

function candidates(pool: Pool, rule: string | string[] | { pair: [string, string] } | undefined): RuleLine[] {
  if (!rule) return [];
  const ctx = ruleContext(pool.lines);
  if (typeof rule === 'object' && !Array.isArray(rule)) {
    // a pair: two teammates (same franchise and season), selected as a unit
    const a = compileRule(rule.pair[0], ctx);
    const b = compileRule(rule.pair[1], ctx);
    const A = ctx.lines.filter(a);
    const B = new Map<string, RuleLine[]>();
    for (const l of ctx.lines.filter(b)) (B.get(l.fr + l.season) ?? B.set(l.fr + l.season, []).get(l.fr + l.season)!).push(l);
    return A.filter((x) => (B.get(x.fr + x.season) ?? []).some((y) => y.pid !== x.pid)).flatMap((x) => [x, B.get(x.fr + x.season)!.find((y) => y.pid !== x.pid)!]);
  }
  const fs = (Array.isArray(rule) ? rule : [rule]).map((r) => compileRule(r, ctx));
  return ctx.lines.filter((l) => fs.some((f) => f(l)));
}

/** The promo's selected cards: [{id, wave index, featured}] (memoised per pool and promo). */
export function selectPromo(pool: Pool, promoId: string): { id: string; wave: number; featured: boolean }[] {
  let m = selections.get(pool);
  if (!m) selections.set(pool, (m = new Map()));
  const got = m.get(promoId);
  if (got) return got;
  const promo = promoById(promoId);
  const sport = pool.sport;
  const out: { id: string; wave: number; featured: boolean }[] = [];
  if (promo && per(promo.count, sport)) {
    const lo = onScale(promo.ovrBand[0], sport);
    const hi = onScale(promo.ovrBand[1], sport);
    const baseOf = (l: CardLine) => pool.base.get(l.id)?.ovr ?? 0;
    const ws = wavesOf(promo, sport);
    const waves: CalWave[] = ws.length ? ws : [{ d: promo.start, count: promo.count, featured: promo.featured }];
    const used = new Set<string>();
    const perGroup = new Map<string, number>();
    const caps = Object.entries(promo.maxPer ?? {}).map(([k, v]) => [k, per(v, sport) ?? 99] as [string, number]);
    const groupKey = (k: string, l: CardLine) => (k === 'fr' ? l.fr : k === 'era' ? String(Math.floor(l.season / 10)) : l.grp ?? '');
    waves.forEach((w, wi) => {
      const need = per(w.count, sport) ?? 0;
      if (!need) return;
      let pool0 = candidates(pool, (per(w.rule, sport) ?? per(promo.rule, sport)) as string | string[] | { pair: [string, string] } | undefined);
      // the rating gate: every card visibly improves, none floored up more than 2
      let gated: RuleLine[] = [];
      for (let widen = 0; widen <= 3; widen++) {
        gated = pool0.filter((l) => {
          const b = baseOf(l);
          return b >= lo - promo.delta - 2 - widen * 2 && b <= hi - 1;
        });
        if (gated.length >= need) break;
      }
      if (gated.length < need) gated = pool0;
      pool0 = gated;
      const ordered =
        promo.pick === 'top'
          ? pool0.slice().sort((a, b) => baseOf(b) - baseOf(a) || (a.id < b.id ? -1 : 1))
          : shuffle(
              pool0.slice().sort((a, b) => (a.id < b.id ? -1 : 1)),
              rng(hashString('live:' + sport + ':' + promo.baseId + ':' + wi))
            );
      const slots = per(w.slots, sport);
      const posLeft = new Map(Object.entries(slots?.pos ?? {}));
      let anyLeft = slots ? (slots.any ?? 0) : need;
      const picked: RuleLine[] = [];
      // pass 1 keeps the caps and position slots; pass 2 (only if short) fills with anyone left, so a
      // promo never ships light because a cap was tighter than its candidates
      for (const strict of [true, false]) {
        for (const l of ordered) {
          if (picked.length >= need) break;
          if (used.has(l.pid)) continue;
          if (strict) {
            if (caps.some(([k, n]) => (perGroup.get(k + ':' + groupKey(k, l)) ?? 0) >= n)) continue;
            if (slots) {
              const left = posLeft.get(l.pos[0]) ?? 0;
              if (left > 0) posLeft.set(l.pos[0], left - 1);
              else if (anyLeft > 0) anyLeft--;
              else continue;
            }
          }
          picked.push(l);
          used.add(l.pid);
          for (const [k] of caps) perGroup.set(k + ':' + groupKey(k, l), (perGroup.get(k + ':' + groupKey(k, l)) ?? 0) + 1);
        }
      }
      const featuredN = w.featured?.count ?? 0;
      const best = picked.slice().sort((a, b) => baseOf(b) - baseOf(a) || (a.id < b.id ? -1 : 1)).slice(0, featuredN);
      for (const l of picked) out.push({ id: liveId(promo.id, best.includes(l), l), wave: wi, featured: best.includes(l) });
    });
  }
  m.set(promoId, out);
  return out;
}

/** The promo's cards released by a day (waves whose date has come), rated. */
export function promoCards(pool: Pool, promoId: string, day: string): RatedCard[] {
  const promo = promoById(promoId);
  if (!promo || day < promo.start) return [];
  const ws = wavesOf(promo, pool.sport);
  const waves = ws.length ? ws : [{ d: promo.start }];
  return selectPromo(pool, promoId).flatMap((s) => {
    if ((waves[s.wave]?.d ?? promo.start) > day) return [];
    const rc = pool.base.get(s.id);
    return rc ? [rc] : [];
  });
}

/** A program SBC's reward: a random released card of the promo (its featured card when asked). */
export function programReward(pool: Pool, promoId: string, featured: boolean, day: string): RatedCard | null {
  const promo = promoById(promoId);
  // the SBC's window can open before the last wave: take the whole selection once it has started
  const all = promo ? promoCards(pool, promoId, promo.end > day ? promo.end : day) : [];
  const list = featured ? all.filter((rc) => rc.line.featured) : all.filter((rc) => !rc.line.featured);
  const pick = list.length ? list : all;
  return pick.length ? pick[Math.floor(Math.random() * pick.length)] : null;
}
