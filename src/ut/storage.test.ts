import { freshUt, migrateUt } from "./state";
import {
  organizeStorage,
  removeCards,
  storedCards,
  useStoredCopy,
} from "./storage";
import type { OwnedCard } from "./types";

const copy = (
  uid: string,
  cardId = "nba:season:1996:jordan:CHI",
  level = 1,
  xp = 0,
): OwnedCard => ({ uid, cardId, level, xp, at: 100 });
const all = (ut: ReturnType<typeof freshUt>) =>
  ut.owned.slice().sort((a, b) => a.uid.localeCompare(b.uid));
const clubIds = (ut: ReturnType<typeof freshUt>) =>
  ut.owned
    .filter((c) => !ut.duplicateStorage?.includes(c.uid))
    .map((c) => c.uid);

describe("duplicate storage", () => {
  it("moves existing extras without losing a UID, level, XP, coins-independent state or squad", () => {
    const owned = [
      copy("a", undefined, 2, 40),
      copy("b", undefined, 5),
      copy("c"),
      copy("other", "nba:season:1997:jordan:CHI"),
      copy("promo", "nba:promo:1996:jordan:CHI"),
    ];
    const raw = {
      ...freshUt(),
      owned,
      squad: { SG: "a" },
      packsOpened: 37,
      starterClaimed: true,
      rivals: { week: "2026-W44", rp: 120, wins: 4, claimed: [], settled: [] },
    };
    const ut = migrateUt(raw);
    expect(all(ut)).toEqual(
      owned.slice().sort((a, b) => a.uid.localeCompare(b.uid)),
    );
    expect(clubIds(ut)).toEqual(["a", "other", "promo"]);
    expect(ut.duplicateStorage).toEqual(["b", "c"]);
    expect(ut.squad).toEqual({ SG: "a" });
    expect(ut.packsOpened).toBe(37);
    expect(ut.starterClaimed).toBe(true);
    expect(migrateUt(JSON.parse(JSON.stringify(ut)))).toEqual(ut);
  });

  it("keeps the strongest existing unequipped copy; treats seasons and editions separately", () => {
    const ut = organizeStorage({
      ...freshUt(),
      owned: [
        copy("low"),
        copy("high", undefined, 3, 40),
        copy("same-level", undefined, 3, 10),
        copy("other", "goat:jordan"),
      ],
    });
    expect(clubIds(ut)).toEqual(["high", "other"]);
    expect(ut.duplicateStorage).toEqual(["low", "same-level"]);
    expect(organizeStorage(ut)).toEqual(ut);
  });

  it("stores newly packed exact duplicates and never replaces the existing club copy", () => {
    const ut = organizeStorage(
      { ...freshUt(), owned: [copy("original", undefined, 2, 15)] },
      [copy("pull1"), copy("pull2"), copy("new", "different")],
    );
    expect(clubIds(ut)).toEqual(["original", "new"]);
    expect(ut.duplicateStorage).toEqual(["pull1", "pull2"]);
    expect(all(organizeStorage(ut, [copy("pull1")]))).toHaveLength(4);
  });

  it("supports old lineups with several identical equipped copies without removing anyone", () => {
    const ut = migrateUt({
      ...freshUt(),
      owned: [copy("a"), copy("b"), copy("c")],
      squad: { SG: "a", B1: "b" },
    });
    expect(ut.squad).toEqual({ SG: "a", B1: "b" });
    expect(clubIds(ut)).toEqual(["a", "b"]);
    expect(ut.duplicateStorage).toEqual(["c"]);
  });

  it("swaps exact copies and their squad UID, preserving every level and XP through reload", () => {
    const ut = organizeStorage({
      ...freshUt(),
      owned: [copy("a", undefined, 4, 110), copy("b")],
      squad: { SG: "a" },
    });
    const next = useStoredCopy(ut, "b");
    expect(next.squad).toEqual({ SG: "b" });
    expect(
      next.owned.find((c) => !next.duplicateStorage?.includes(c.uid)),
    ).toEqual(copy("b"));
    expect(storedCards(next)[0]).toEqual(copy("a", undefined, 4, 110));
    expect(all(next)).toEqual(all(ut));
    expect(migrateUt(next)).toEqual(next);
    expect(useStoredCopy(next, "missing")).toBe(next);
  });

  it("consumes only selected copies for SBCs or sales and promotes a spare if the club copy leaves", () => {
    const ut = organizeStorage({
      ...freshUt(),
      owned: [copy("a"), copy("b"), copy("c"), copy("other", "different")],
      squad: { SG: "a" },
    });
    const usedSpare = removeCards(ut, ["b"]);
    expect(clubIds(usedSpare)).toEqual(["a", "other"]);
    expect(usedSpare.duplicateStorage).toEqual(["c"]);
    expect(usedSpare.squad).toEqual({ SG: "a" });
    const soldClub = removeCards(usedSpare, ["a"]);
    expect(clubIds(soldClub)).toEqual(["c", "other"]);
    expect(soldClub.duplicateStorage).toEqual([]);
    expect(soldClub.squad).toEqual({});
    expect(removeCards(soldClub, ["a", "b"])).toEqual(soldClub);
  });
});
