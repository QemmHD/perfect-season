// Codex: factual identity and inflation regressions across ordinary/special cards, not just GOATs.
import { beforeAll, describe, expect, it } from "vitest";
import { SPORT } from "../engine/sport";
import { getPool, type Pool } from "./pool";
import { rateCard, TIER_CUTS } from "./rate";
import { faceWeights } from "./card-face";
import type { CardLine } from "./types";
let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 60000);
const season = (name: string, year: number) =>
  [...pool.base.values()].find(
    (c) =>
      c.line.kind === "season" &&
      c.line.name === name &&
      c.line.season === year,
  )!;
describe("all-tier ratings corrections (" + SPORT + ")", () => {
  it("retains original edition identity and raw season statistics through every available edition", () => {
    for (const c of pool.base.values())
      if (c.line.seasonId) {
        const original = pool.byId.get(c.line.seasonId)!;
        expect(original).toBeDefined();
        expect(c.line.stats).toEqual(original.stats);
        expect(c.line.pid).toBe(original.pid);
      }
  });
  it("carries same-era provenance through every edition and uses bounded source attributes", () => {
    const referenced = [...pool.base.values()].filter(c => c.line.ratingReference);
    expect(referenced.length).toBeGreaterThan(SPORT === 'nba' ? 8000 : 2000);
    for (const c of referenced) {
      expect(c.line.ratingReference!.source).toMatch(/^https:\/\//);
      if (c.line.seasonId) expect(c.line.ratingReference).toEqual(pool.byId.get(c.line.seasonId)!.ratingReference);
    }
    if (SPORT === 'nfl') {
      const brady=season('Tom Brady',2021), mahomes=season('Patrick Mahomes',2022);
      expect(brady.attrs.SPD).toBe(brady.line.ratingReference!.attrs.SPD);
      expect(mahomes.attrs.THP).toBe(mahomes.line.ratingReference!.attrs.THP);
      expect(mahomes.rawOvr).toBeGreaterThanOrEqual(93); // rating scale (Madden-comparable)
      expect(brady.attrs.SPD).toBeLessThan(75);
    } else {
      const jokic=season('Nikola Jokić',2024), giannis=season('Giannis Antetokounmpo',2024);
      expect(jokic.rawOvr).toBeGreaterThanOrEqual(95); // rating scale (2K-comparable)
      expect(jokic.attrs.SPD).toBeLessThan(75);
      expect(jokic.attrs.PAS).toBeGreaterThan(90);
      expect(giannis.attrs.DNK).toBeGreaterThan(85);
      expect(jokic.attrs['3PT']).toBeGreaterThan(giannis.attrs['3PT']);
    }
  });
  if (SPORT === "nba") {
    it("ordinary overalls cannot turn a middling attribute profile into an all-time superstar", () => {
      expect(season("Bob Rule", 1969).rawOvr).toBeLessThanOrEqual(85);
      expect(season("Neal Walk", 1973).rawOvr).toBeLessThanOrEqual(85);
      const cards = [...pool.base.values()].filter(
        (c) => c.line.kind === "season",
      );
      expect(cards.filter((c) => c.rawOvr === 99).length).toBeLessThan(95);
      expect(season("Michael Jordan", 1996).rawOvr).toBeGreaterThanOrEqual(97);
      // Claude rework: the overall follows the face (Bird's 72 athleticism weighs on it), still a top-tier gold
      expect(season("Larry Bird", 1986).rawOvr).toBeGreaterThanOrEqual(93);
    });
    it("keeps ordinary, legend and 99+ non-shooters distinct from actual shooters", () => {
      for (const c of pool.base.values()) {
        if (c.line.name === "Shaquille O'Neal")
          expect(c.attrs["3PT"]).toBeLessThan(65);
        if (c.line.name === "Stephen Curry" && c.line.kind === "goat") {
          expect(c.attrs["3PT"]).toBeGreaterThan(99);
          expect(c.attrs.DNK).toBeLessThan(60);
        }
        if (c.line.name === "Michael Jordan" && c.line.season === 1989)
          expect(c.attrs["3PT"]).toBeLessThanOrEqual(70);
      }
    });
    it("separates a weaker season from the player’s peak and retains low-FT weaknesses on premium editions", () => {
      expect(season("Kobe Bryant", 2006).ovr).toBeGreaterThan(
        season("Kobe Bryant", 2016).ovr + 5,
      );
      const shaq = [...pool.base.values()].find(
        (c) => c.line.name === "Shaquille O'Neal" && c.line.kind === "goat",
      )!;
      expect(shaq.attrs.FT).toBeLessThan(65);
      expect(shaq.attrs.CLS).toBeGreaterThan(99);
    });
  } else {
    it("preserves pocket passing and actual rushing identity for every tier", () => {
      const cards = [...pool.base.values()];
      for (const c of cards.filter((c) => c.line.name === "Tom Brady"))
        expect(c.attrs.SPD).toBeLessThan(75);
      expect(season("Mike Vick", 2006).attrs.SPD).toBeGreaterThanOrEqual(94);
      const goat = cards.find(
        (c) => c.line.name === "Tom Brady" && c.line.kind === "goat",
      )!;
      expect(goat.attrs.SAC).toBeGreaterThan(99);
      expect(goat.attrs.SPD).toBeLessThan(70);
    });
    it("draft selection alone cannot inflate the same season’s playable ratings", () => {
      const base = season("Tom Brady", 2007).line;
      expect(rateCard({ ...base, rk: { ...base.rk, draft: 1 } }).attrs).toEqual(
        rateCard({ ...base, rk: { ...base.rk, draft: 0 } }).attrs,
      );
      expect(rateCard({ ...base, rk: { ...base.rk, draft: 1 } }).ovr).toBe(
        rateCard({ ...base, rk: { ...base.rk, draft: 0 } }).ovr,
      );
    });
    it("shrinks tiny-sample perfect percentages instead of awarding an unproven 99", () => {
      const base = season("Tom Brady", 2007).line;
      const tiny: CardLine = {
        ...base,
        name: "Unproven backup",
        ratingReference: undefined,
        honors: [],
        games: 2,
        starts: 0,
        stats: {
          ...base.stats,
          att: 10,
          cmp: 10,
          yds: 200,
          td: 2,
          int: 0,
          ry: 0,
          sk: 0,
        },
      };
      const r = rateCard(tiny);
      expect(r.rawOvr).toBeLessThanOrEqual(76);
      expect(r.attrs.SAC).toBeLessThan(90);
    });
  }
});

// Claude ratings rework (2026-11-01): distribution, consistency and famous-season regressions.
// Displayed overalls use the FC-style UT scale (ut-scale.ts); 2K/Madden comparisons use rawOvr.
describe("Ultimate Team ratings rework (" + SPORT + ")", () => {
  const seasons = () => [...pool.base.values()].filter((c) => c.line.kind === "season");
  const share = (xs: { tier: string }[]) => xs.filter((c) => c.tier === "gold").length / xs.length;
  it("follows the UT scale: bronze/silver/gold ≈35/35/30%, a dozen-odd 90+ base cards, top 91", () => {
    const all = seasons();
    expect(share(all)).toBeGreaterThan(0.27);
    expect(share(all)).toBeLessThan(0.33);
    const silver = all.filter((c) => c.tier === "silver").length / all.length;
    expect(silver).toBeGreaterThan(0.3);
    expect(silver).toBeLessThan(0.4);
    const n90 = all.filter((c) => c.ovr >= 90).length;
    expect(n90).toBeGreaterThanOrEqual(8);
    expect(n90).toBeLessThanOrEqual(25);
    expect(Math.max(...all.map((c) => c.ovr))).toBeLessThanOrEqual(91);
    for (const c of all) expect(c.tier).toBe(c.ovr >= TIER_CUTS[SPORT].gold ? "gold" : c.ovr >= TIER_CUTS[SPORT].silver ? "silver" : "bronze");
    // each pair of overalls above 83 is rarer than the pair below (ties at one value can bunch a little)
    const at = (a: number, b: number) => all.filter((c) => c.ovr >= a && c.ovr <= b).length;
    for (let o = 83; o <= 87; o += 2) expect(at(o + 2, o + 3), String(o)).toBeLessThan(at(o, o + 1));
  });
  it("keeps Hot Season promos in 94–97, Legends in 88–95 (a few at 94+), specials above 99", () => {
    const of = (t: string) => [...pool.base.values()].filter((c) => c.tier === t);
    for (const c of of("promo")) {
      expect(c.ovr).toBeGreaterThanOrEqual(94);
      expect(c.ovr).toBeLessThanOrEqual(97);
      expect(c.ovr).toBeGreaterThan(pool.base.get(c.line.seasonId!)!.ovr);
    }
    const legends = of("legend");
    for (const c of legends) {
      expect(c.ovr).toBeGreaterThanOrEqual(88);
      expect(c.ovr).toBeLessThanOrEqual(95);
    }
    expect(legends.filter((c) => c.ovr >= 94).length).toBeLessThanOrEqual(6);
    for (const c of of("spotlight")) expect(c.ovr).toBeGreaterThanOrEqual(100);
    for (const c of of("goat")) expect(c.ovr).toBeGreaterThanOrEqual(106);
  });
  it("balances the gold share across positions (and NBA eras)", () => {
    const all = seasons();
    const group = (c: (typeof all)[number]) => (SPORT === "nba" ? c.line.pos[0] : ({ OT: "OL", OG: "OL", C: "OL", DE: "DL", DT: "DL" } as Record<string, string>)[c.pos] ?? c.pos);
    for (const g of new Set(all.map(group))) {
      const s = share(all.filter((c) => group(c) === g));
      expect(s, g).toBeGreaterThanOrEqual(g === "K" || g === "SF" || g === "TE" ? 0.22 : 0.27);
      expect(s, g).toBeLessThanOrEqual(0.35);
    }
    if (SPORT === "nba")
      for (const [a, b] of [[1950, 1969], [1970, 1979], [1980, 1989], [1990, 1999], [2000, 2009], [2010, 2019], [2020, 2026]]) {
        const s = share(all.filter((c) => c.line.season >= a && c.line.season <= b));
        // the 1960s (small league, no same-season game ratings) sit a little lower
        expect(s, a + "s").toBeGreaterThanOrEqual(a < 1970 ? 0.2 : 0.25);
        expect(s, a + "s").toBeLessThanOrEqual(0.35);
      }
    else {
      const per = new Map<number, number>();
      for (const c of all) if (c.ovr >= 90) per.set(c.line.season, (per.get(c.line.season) ?? 0) + 1);
      expect(Math.max(0, ...per.values())).toBeLessThanOrEqual(6);
      // linemen no longer dominate the top: estimate-path OL never reach 99, and they are a minority of 90+
      expect(all.filter((c) => group(c) === "OL" && !c.line.ratingReference && c.rawOvr! >= 99).length).toBe(0);
      const top = all.filter((c) => c.ovr >= 90);
      expect(top.filter((c) => group(c) === "OL").length / top.length).toBeLessThanOrEqual(0.3);
    }
  });
  it("prints a face whose position-weighted mean matches the overall", () => {
    for (const tier of ["silver", "gold", "promo", "legend"]) {
      const gaps = [...pool.base.values()]
        .filter((c) => c.tier === tier)
        .map((c) => {
          const w = faceWeights(SPORT, SPORT === "nba" ? c.line.pos[0] : c.pos, c.attrs);
          let n = 0, t = 0;
          for (const [k, , v] of c.face!) { n += (w[k] ?? 0) * v; t += w[k] ?? 0; }
          return Math.abs(c.ovr - n / t);
        })
        .sort((a, b) => a - b);
      expect(gaps[Math.floor(gaps.length / 2)], tier).toBeLessThanOrEqual(3);
      expect(gaps[Math.floor(gaps.length * 0.9)], tier).toBeLessThanOrEqual(5);
    }
  });
  it("levels add at most two overall", () => {
    for (const c of seasons().filter((_, i) => i % 97 === 0)) {
      const five = rateCard(c.line, 5);
      expect(five.ovr - c.ovr).toBeLessThanOrEqual(2);
      expect(five.tier).toBe(c.tier);
    }
  });
  it("rates famous seasons near their real standing", () => {
    if (SPORT === "nba") {
      expect(season("Stephen Curry", 2022).attrs["3PT"]).toBeGreaterThanOrEqual(95);
      expect(season("Stephen Curry", 2022).abil).toContain("limitless");
      expect(season("Nikola Jokić", 2024).rawOvr).toBeGreaterThanOrEqual(95);
      expect(season("Nikola Jokić", 2024).ovr).toBeGreaterThanOrEqual(86);
      expect(season("Kyle Korver", 2015).attrs["3PT"]).toBeGreaterThanOrEqual(92);
      expect(season("Russell Westbrook", 2017).attrs.SPD).toBeGreaterThanOrEqual(95);
    } else {
      expect(season("Patrick Mahomes", 2024).rawOvr).toBeGreaterThanOrEqual(88);
      expect(season("Patrick Mahomes", 2024).tier).toBe("gold");
      expect(season("Tyreek Hill", 2018).attrs.SPD).toBeGreaterThanOrEqual(96);
      expect(season("Tyreek Hill", 2016).attrs.SPD).toBeGreaterThanOrEqual(94);
      for (const y of [2007, 2016]) expect(season("Tom Brady", y).attrs.SPD).toBeLessThanOrEqual(66);
      expect(season("Mike Vick", 2006).attrs.SPD).toBeGreaterThanOrEqual(93);
      expect(season("Calvin Johnson", 2012).attrs.SPD).toBeGreaterThanOrEqual(93);
      expect(season("Josh Allen", 2024).tier).toBe("gold");
    }
  });
});
