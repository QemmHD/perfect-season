import { describe, it, expect, beforeAll } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import { catalogEventOf } from "./catalog-net";
import {
  catalogOf,
  defaultCatalog,
  checkedCatalog,
  setCatalog,
  snapshotPack,
  readPackSnapshot,
  STUDIO_PACKS,
} from "./catalog";
import { SPORT } from "../engine/sport";
import { NS_SUFFIX, KIND_APP } from "../net/nostr";
import { openPack, packName, packDefs } from "../ut/packs";
import { getPool, type Pool } from "../ut/pool";
import { giftEvent, giftOf } from "../net/gifts";
import { withGift } from "../ui/Admin";
import { freshProfile } from "../lib/profile";
let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 60000);
describe("Codex admin studio " + SPORT, () => {
  it("validates finite prices and bounded complete recipes", () => {
    const c = defaultCatalog(SPORT);
    expect(checkedCatalog(c)).toEqual(c);
    for (const value of [NaN, Infinity, -1, 0, 499, 100001])
      expect(
        checkedCatalog({ ...c, captains: { ...c.captains, price: value } }),
      ).toBeNull();
    expect(
      checkedCatalog({
        ...c,
        captains: {
          ...c.captains,
          counts: { silver: 20, gold: 20, rare: 20, standout: 20 },
        },
      }),
    ).toBeNull();
    expect(checkedCatalog({})).toBeNull();
  });
  it("opens each new recipe in the actual sport pool and supports original packs", () => {
    for (const k of STUDIO_PACKS) {
      const d = packDefs(SPORT)[k],
        cards = openPack(pool, k, "studio-qa");
      expect(cards).toHaveLength(d.slots.length);
      expect(cards.every((c) => c.line.sport === SPORT)).toBe(true);
      expect(cards.filter((c) => c.line.kind === "standout")).toHaveLength(
        catalogOf(SPORT)[k].counts.standout,
      );
    }
    expect(openPack(pool, "gold", "original")).not.toHaveLength(0);
  });
  it("freezes an awarded recipe and name across later published edits", () => {
    const old = defaultCatalog(SPORT);
    setCatalog(SPORT, old);
    const kind = snapshotPack(SPORT, "captains"),
      before = openPack(pool, kind, "fixed").map((c) => c.line.id);
    const changed = defaultCatalog(SPORT);
    changed.captains.name = "Changed";
    changed.captains.counts.gold = 12;
    setCatalog(SPORT, changed);
    expect(packName(SPORT, kind)).toBe(old.captains.name);
    expect(openPack(pool, kind, "fixed").map((c) => c.line.id)).toEqual(before);
    expect(openPack(pool, "captains", "fixed").length).not.toBe(before.length);
    setCatalog(SPORT, old);
  });
  it("rejects malformed saved recipes instead of silently charging for an empty pack", () => {
    expect(readPackSnapshot("studio:captains:1,2,3:Bad")).toBeNull();
    expect(() =>
      openPack(pool, "studio:captains:NaN,1,1,0:Bad", "qa"),
    ).toThrow();
  });
  it("requires the exact signer, namespace, signature and valid payload for global changes", () => {
    const sk = new Uint8Array(32).fill(3),
      pub = getPublicKey(sk),
      draft = { v: 1, sport: SPORT, catalog: defaultCatalog(SPORT) },
      e = finalizeEvent(
        {
          kind: KIND_APP,
          created_at: Math.floor(Date.now() / 1000),
          tags: [["d", "ps-admin-catalog" + NS_SUFFIX + ":" + SPORT]],
          content: JSON.stringify(draft),
        },
        sk,
      );
    expect(catalogEventOf(e, pub)?.catalog).toEqual(draft.catalog);
    expect(catalogEventOf(e)).toBeNull();
    expect(catalogEventOf({ ...e, content: e.content + " " }, pub)).toBeNull();
    const wrong = finalizeEvent(
      {
        kind: KIND_APP,
        created_at: e.created_at,
        tags: [["d", "ps-admin-catalog-wrong:" + SPORT]],
        content: e.content,
      },
      sk,
    );
    expect(catalogEventOf(wrong, pub)).toBeNull();
  });
  it("keeps legacy gift routing and defers upgraded gifts for older clients", () => {
    const sk = new Uint8Array(32).fill(4),
      pub = getPublicKey(sk),
      old = giftEvent(
        sk,
        "all",
        { coins: 10, packs: { gold: 1 }, note: "" },
        "legacy123",
      ),
      fresh = giftEvent(
        sk,
        ["aa".repeat(32)],
        { coins: 10, packs: { captains: 1 }, note: "" },
        "studio123",
      );
    expect(old.tags).toContainEqual(["t", "ps1-gift" + NS_SUFFIX]);
    expect(fresh.tags).not.toContainEqual(["t", "ps1-gift" + NS_SUFFIX]);
    expect(fresh.tags).toContainEqual(["p", "aa".repeat(32)]);
    const g = giftOf(fresh, pub)!;
    expect(g.packs.captains).toBe(1);
    expect(readPackSnapshot(g.recipes!.captains!)?.base).toBe("captains");
  });
  // Claude review 2026-11-08: a Club Collection recipe frozen in another sport's catalog (NFL doubles
  // the silver/gold counts) must not be applied to this sport's pack; the receiver's own recipe is used.
  it("ignores another sport's frozen Club Collection recipe in a shared gift", () => {
    const sk = new Uint8Array(32).fill(5),
      pub = getPublicKey(sk),
      other = SPORT === "nfl" ? "nba" : "nfl",
      foreign = snapshotPack(other as typeof SPORT, "roster").replace(
        /:[\d,]+:/,
        ":" + (SPORT === "nfl" ? "6,3,1,0" : "12,6,1,0") + ":",
      ),
      e = finalizeEvent(
        {
          kind: KIND_APP,
          created_at: Math.floor(Date.now() / 1000),
          tags: [["t", "ps1-gift-studio" + NS_SUFFIX]],
          content: JSON.stringify({
            id: "foreign123",
            coins: 0,
            packs: { roster: 1 },
            note: "",
            sport: other,
            recipes: { roster: foreign },
          }),
        },
        sk,
      ),
      g = giftOf(e, pub)!;
    expect(g.packs.roster).toBe(1);
    expect(g.recipes?.roster).toBeUndefined();
    const p = withGift(freshProfile(), g, g.id);
    expect(p.ut.packs[0].kind).toBe(snapshotPack(SPORT, "roster"));
  });
  it("adds new gift packs exactly once while preserving every existing profile field", () => {
    const p = freshProfile();
    p.ut.owned = [{ uid: "old", cardId: "old-id", level: 3, xp: 42, at: 1 }];
    p.ut.squad = { PG: "old" };
    const g = { coins: 100, packs: { captains: 2 }, note: "Support" },
      once = withGift(p, g, "same");
    expect(once.ut.packs).toHaveLength(2);
    expect(once.ut.packs.every((x) => !!readPackSnapshot(x.kind))).toBe(true);
    expect(withGift(once, g, "same")).toBe(once);
    expect(once.ut.owned).toBe(p.ut.owned);
    expect(once.ut.squad).toBe(p.ut.squad);
    expect(once.coins).toBe(p.coins + 100);
  });
});
