// Codex: factual identity and inflation regressions across ordinary/special cards, not just GOATs.
import { beforeAll, describe, expect, it } from "vitest";
import { SPORT } from "../engine/sport";
import { getPool, type Pool } from "./pool";
import { rateCard } from "./rate";
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
  if (SPORT === "nba") {
    it("ordinary overalls cannot turn a middling attribute profile into an all-time superstar", () => {
      expect(season("Bob Rule", 1969).ovr).toBeLessThanOrEqual(85);
      expect(season("Neal Walk", 1973).ovr).toBeLessThanOrEqual(85);
      const cards = [...pool.base.values()].filter(
        (c) => c.line.kind === "season",
      );
      expect(cards.filter((c) => c.ovr === 99).length).toBeLessThan(95);
      expect(season("Michael Jordan", 1996).ovr).toBeGreaterThanOrEqual(97);
      expect(season("Larry Bird", 1986).ovr).toBeGreaterThanOrEqual(95);
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
      expect(r.ovr).toBeLessThanOrEqual(76);
      expect(r.attrs.SAC).toBeLessThan(90);
    });
  }
});
