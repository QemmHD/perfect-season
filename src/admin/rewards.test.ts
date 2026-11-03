import { beforeAll, describe, it, expect } from "vitest";
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import {
  verifyAdminPack,
  adminPackId,
} from "../../supabase/functions/card-registry/admin-packs";
import { SPORT } from "../engine/sport";
import { BOOSTERS } from "../engine/types";
import { NS_SUFFIX } from "../net/nostr";
import { contentOf, giftEvent, giftOf } from "../net/gifts";
import { withGift } from "../ui/Admin";
import { freshProfile } from "../lib/profile";
import { getPool, type Pool } from "../ut/pool";
import { openPack, registeredPack, packName } from "../ut/packs";
import { slotsFor, canPlay } from "../ut/squad";
import { migrateUt } from "../ut/state";
let pool: Pool;
beforeAll(async () => {
  pool = await getPool();
}, 60000);
describe("Codex expanded admin rewards " + SPORT, () => {
  it("keeps old gift payloads identical and bounds new optional rewards", () => {
    expect(
      contentOf({ coins: 50, packs: { gold: 1 }, note: "original" }),
    ).toEqual({ coins: 50, packs: { gold: 1 }, note: "original" });
    expect(
      contentOf({
        xp: 1000000,
        cardXp: 10000,
        boosters: { double: 999, prime: 3, unknown: 50 },
      }),
    ).toMatchObject({
      xp: 100000,
      cardXp: 700,
      boosters: { double: 50, prime: 3 },
    });
    expect(
      contentOf({
        coins: 0,
        packs: {},
        xp: NaN,
        cardXp: -1,
        boosters: { double: -5 },
      }),
    ).toBeNull();
    expect(
      contentOf({
        player: { cardId: "nba:goat:anything", name: "No bypass", count: 1 },
      }),
    ).toBeNull();
  });
  it("grants account XP, boosters and equipped-card training once without changing identity or other cards", () => {
    const p = freshProfile();
    p.ut.owned = [
      { uid: "in", cardId: "old", level: 1, xp: 25, at: 1 },
      { uid: "out", cardId: "other", level: 2, xp: 42, at: 2 },
    ];
    p.ut.squad = { X: "in" };
    const g = contentOf({
        xp: 1500,
        cardXp: 700,
        boosters: { double: 5, trade: 3 },
        coins: 500,
        packs: { icon: 1 },
      })!,
      r = withGift(p, g, "one-time");
    expect(r.xp).toBe(p.xp + 1500);
    expect(r.inventory.double).toBe(p.inventory.double + 5);
    expect(r.inventory.prime).toBe(p.inventory.prime);
    expect(r.ut.owned[0]).toMatchObject({ uid: "in", cardId: "old", level: 5 });
    expect(r.ut.owned[1]).toEqual(p.ut.owned[1]);
    expect(r.ut.squad).toBe(p.ut.squad);
    expect(withGift(r, g, "one-time")).toBe(r);
  });
  it("opens full-position gold squads, all-time squads and guaranteed Icon packs", () => {
    for (const kind of ["admin-squad", "admin-icon-team"]) {
      const cards = openPack(pool, kind, "positions");
      const slots = slotsFor(SPORT).filter((s) => s.weight > 0);
      expect(cards).toHaveLength(slots.length);
      expect(new Set(cards.map((c) => c.line.pid)).size).toBe(cards.length);
      for (let i = 0; i < slots.length; i++)
        expect(canPlay(slots[i], cards[i])).toBe(true);
      expect(cards.every((c) => ["gold", "legend"].includes(c.tier))).toBe(
        true,
      );
    }
    expect(openPack(pool, "admin-icon", "icon")).toHaveLength(1);
    expect(openPack(pool, "admin-icon", "icon")[0].tier).toBe("legend");
  });
  it("delivers the exact chosen ordinary player edition, while refusing an unregistered GOAT", () => {
    const c = [...pool.base.values()].find((c) => c.line.kind === "legend")!,
      p = freshProfile(),
      r = withGift(
        p,
        {
          coins: 0,
          packs: {},
          note: "",
          player: { cardId: c.line.id, name: c.line.name, count: 2 },
        },
        "player",
      );
    expect(r.ut.packs).toHaveLength(2);
    const kind = r.ut.packs[0].kind;
    expect(packName(SPORT, kind)).toBe(c.line.name + " Pack");
    expect(openPack(pool, kind, "chosen")[0].line.id).toBe(c.line.id);
    expect(() => openPack(pool, "admin-goat")).toThrow();
  });
  it("uses upgraded routing for new reward types while preserving ME/targeted/everyone signed envelopes", () => {
    const sk = new Uint8Array(32).fill(9),
      pub = getPublicKey(sk);
    for (const target of ["all", ["aa".repeat(32)]] as const) {
      const e = giftEvent(
        sk,
        target === "all" ? target : [...target],
        { coins: 0, packs: {}, note: "", xp: 1500, boosters: { double: 2 } },
        "reward123",
      );
      expect(giftOf(e, pub)).toMatchObject({
        xp: 1500,
        boosters: { double: 2 },
      });
      expect(e.tags).toContainEqual(["t", "ps1-gift-studio" + NS_SUFFIX]);
    }
  });
  it("validates owner signature, recipient, namespace, sport, award count and stable replay identity for GOATs", async () => {
    const sk = new Uint8Array(32).fill(8),
      owner = getPublicKey(sk),
      actor = "aa".repeat(32),
      ns = NS_SUFFIX.replace(/^-/, "");
    const e = finalizeEvent(
        {
          kind: 30078,
          created_at: Math.floor(Date.now() / 1000),
          tags: [
            ["t", "ps1-gift-studio" + NS_SUFFIX],
            ["p", actor],
          ],
          content: JSON.stringify({ sport: "nba", packs: { goat: 2 } }),
        },
        sk,
      ),
      voucher = { event: e, index: 0 };
    const id = await verifyAdminPack(voucher, actor, "nba", ns, owner);
    expect(id).toBe(await adminPackId(voucher));
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    expect(
      await verifyAdminPack({ ...voucher, index: 1 }, actor, "nba", ns, owner),
    ).not.toBe(id);
    for (const bad of [
      { v: voucher, a: "bb".repeat(32), s: "nba", ns },
      { v: { ...voucher, index: 2 }, a: actor, s: "nba", ns },
      { v: voucher, a: actor, s: "nfl", ns },
      { v: voucher, a: actor, s: "nba", ns: "wrong" },
      {
        v: { ...voucher, event: { ...e, content: e.content + " " } },
        a: actor,
        s: "nba",
        ns,
      },
    ])
      expect(
        await verifyAdminPack(bad.v, bad.a, bad.s, bad.ns, owner),
      ).toBeNull();
    expect(await verifyAdminPack(voucher, actor, "nba", ns)).toBeNull();
  });
  it("preserves the signed voucher through profile migration and uses the existing registered-copy layout", async () => {
    const sk = new Uint8Array(32).fill(7),
      pub = getPublicKey(sk),
      e = giftEvent(
        sk,
        ["aa".repeat(32)],
        { coins: 0, packs: { goat: 1 }, note: "" },
        "goat1234",
      );
    if (SPORT === "soccer") {
      expect(giftOf(e, pub)).toMatchObject({ packs: { goat: 1 } });
      return;
    }
    const gift = giftOf(e, pub)!,
      p = withGift(freshProfile(), gift, gift.id),
      ut = migrateUt(p.ut);
    expect(ut.packs[0].voucher).toEqual({ event: e, index: 0 });
    const goat = [...pool.base.values()].find((c) => c.tier === "goat")!;
    const cards = registeredPack(pool, "admin-goat", "mint-seed", goat.line.id);
    expect(cards).toHaveLength(SPORT === "nba" ? 8 : 16);
    expect(cards[cards.length - 1].tier).toBe("goat");
    expect(BOOSTERS.length).toBe(3);
  });
  it('accepts everyone vouchers in production and preview namespaces',async()=>{
    const sk=new Uint8Array(32).fill(8),owner=getPublicKey(sk),actor='aa'.repeat(32);
    for(const namespace of ['', 'preview2026']){
      const suffix=namespace?'-'+namespace:'';
      const e=finalizeEvent({kind:30078,created_at:Math.floor(Date.now()/1000),tags:[['t','ps1-gift-studio'+suffix],['t','ps1-gift-studio-all'+suffix]],content:JSON.stringify({sport:'nba',packs:{goat:1}})},sk);
      const voucher={event:e,index:0};
      expect(await verifyAdminPack(voucher,actor,'nba',namespace,owner)).toBe(await adminPackId(voucher));
    }
  });

});
