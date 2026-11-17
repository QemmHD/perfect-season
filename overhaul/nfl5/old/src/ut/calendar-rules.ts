// Claude, 2026-11-01 (wave 3): the Live Calendar's selection-rule grammar, ported as-is from the
// planning reference (content-plan-tools/rules.js). A rule picks card lines from fields the card data
// already has:
//   rule := clause (' & ' clause)* ;  clause := ['!'] key ':' value ;  value := alt ('|' alt)*
// Keys: franchise era season pos anypos group honor stat rk career careerYear kind years games starts
// num traded franchises dense base (base is checked at runtime against the rated pool).
// Unknown keys throw, so a typo in the schedule fails its test instead of selecting nothing.
import type { CardLine } from './types';

/** A line with its career facts (built once per card list). */
export interface RuleLine extends CardLine {
  first: boolean;
  last: boolean;
  final: boolean;
  cy: number;
  years: number;
  legend: boolean;
}

const cmp = (v: number | null | undefined, op: string, n: number) =>
  v != null && (op === '>=' ? v >= n : op === '<=' ? v <= n : op === '>' ? v > n : op === '<' ? v < n : v === n);
const range = (v: number | null | undefined, s: string) => {
  const m = /^(>=|<=|>|<)?(-?[\d.]+)(?:-([\d.]+))?$/.exec(s);
  if (!m) throw new Error('bad range ' + s);
  if (m[3]) return v != null && v >= +m[2] && v <= +m[3];
  return cmp(v, m[1] || '=', +m[2]);
};

export interface RuleContext {
  lines: RuleLine[];
  traded: (l: CardLine) => boolean;
  franchises: (l: CardLine) => number;
}

const contexts = new WeakMap<CardLine[], RuleContext>();

/** Career facts for every season line (and legend lines flagged): built once per list. */
export function ruleContext(all: CardLine[]): RuleContext {
  let c = contexts.get(all);
  if (c) return c;
  const seasons = all.filter((l) => l.kind === 'season');
  const legendSeasons = new Set(all.filter((l) => l.kind === 'legend').map((l) => l.seasonId));
  const newest = Math.max(...seasons.map((l) => l.season));
  const byPid = new Map<string, number[]>();
  const bySeasonPid = new Map<string, number>();
  const frs = new Map<string, Set<string>>();
  for (const l of seasons) {
    (byPid.get(l.pid) ?? byPid.set(l.pid, []).get(l.pid)!).push(l.season);
    const k = l.pid + ':' + l.season;
    bySeasonPid.set(k, (bySeasonPid.get(k) ?? 0) + 1);
    (frs.get(l.pid) ?? frs.set(l.pid, new Set()).get(l.pid)!).add(l.fr);
  }
  const careers = new Map<string, number[]>();
  for (const [pid, ss] of byPid) careers.set(pid, [...new Set(ss)].sort((a, b) => a - b));
  const lines: RuleLine[] = seasons.map((l) => {
    const cs = careers.get(l.pid)!;
    const last = l.season === cs[cs.length - 1];
    return { ...l, first: l.season === cs[0], last, final: last && l.season < newest, cy: cs.indexOf(l.season) + 1, years: cs.length, legend: legendSeasons.has(l.id) };
  });
  c = { lines, traded: (l) => (bySeasonPid.get(l.pid + ':' + l.season) ?? 0) > 1, franchises: (l) => frs.get(l.pid)?.size ?? 0 };
  contexts.set(all, c);
  return c;
}

/** A rule as a predicate over rule lines (throws on an unknown key or a malformed value). */
export function compileRule(rule: string, ctx: Pick<RuleContext, 'traded' | 'franchises'>): (l: RuleLine) => boolean {
  const clauses = rule.split(' & ').map((raw) => {
    let c = raw.trim();
    const neg = c.startsWith('!');
    if (neg) c = c.slice(1);
    const i = c.indexOf(':');
    const key = i < 0 ? c : c.slice(0, i);
    const val = i < 0 ? '' : c.slice(i + 1);
    const alts = val.split('|');
    let f: (l: RuleLine) => boolean;
    switch (key) {
      case 'franchise':
        f = (l) => alts.includes(l.fr);
        break;
      case 'era':
        f = (l) => alts.includes(Math.floor(l.season / 10) * 10 + 's');
        break;
      case 'season':
        f = (l) => alts.some((a) => range(l.season, a));
        break;
      case 'pos':
        f = (l) => alts.includes(l.pos[0]);
        break;
      case 'anypos':
        f = (l) => l.pos.some((p) => alts.includes(p));
        break;
      case 'group':
        f = (l) => alts.includes(l.grp ?? '');
        break;
      case 'honor':
        f = (l) => l.honors.some((h) => alts.includes(h));
        break;
      case 'stat':
      case 'rk':
        for (const a of alts) if (!/^(\w+)(>=|<=|>|<|=)([\d.]+)$/.test(a)) throw new Error('bad ' + a);
        f = (l) =>
          alts.some((a) => {
            const m = /^(\w+)(>=|<=|>|<|=)([\d.]+)$/.exec(a)!;
            return cmp((key === 'stat' ? l.stats : l.rk)[m[1]], m[2], +m[3]);
          });
        break;
      case 'career':
        f = (l) => alts.some((a) => (a === 'first' ? l.first : a === 'last' ? l.last : a === 'final' ? l.final : false));
        break;
      case 'careerYear':
        f = (l) => alts.some((a) => range(l.cy, a));
        break;
      case 'kind':
        f = (l) => alts.some((a) => (a === 'legend' ? l.legend : a === 'season'));
        break;
      case 'years':
        f = (l) => alts.some((a) => range(l.years, a));
        break;
      case 'games':
        f = (l) => alts.some((a) => range(l.games, a));
        break;
      case 'starts':
        f = (l) => alts.some((a) => range(l.starts, a));
        break;
      case 'num':
        f = (l) => alts.some((a) => range(l.num, a));
        break;
      case 'traded':
        f = (l) => ctx.traded(l);
        break;
      case 'franchises':
        f = (l) => alts.some((a) => range(ctx.franchises(l), a));
        break;
      case 'dense':
        f = (l) => !l.sparse;
        break;
      case 'base':
        f = () => true;
        break;
      default:
        throw new Error('unknown rule key ' + key);
    }
    return neg ? (l: RuleLine) => !f(l) : f;
  });
  return (l) => clauses.every((f) => f(l));
}
