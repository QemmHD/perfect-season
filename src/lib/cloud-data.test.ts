import { describe, expect, it } from "vitest";
import {
  applyProgress,
  captureProgress,
  checkedSnapshot,
  CLOUD_KEYS,
  decryptProgress,
  encryptProgress,
  progressDigest,
} from "./cloud-data";
import { freshProfile } from "./profile";
function store() {
  const values = new Map<string, string>();
  const storage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v);
    },
    removeItem: (k: string) => {
      values.delete(k);
    },
  };
  const p = freshProfile();
  p.name = "OriginalPlayer";
  p.coins = 12400;
  p.xp = 812;
  p.ut.owned = [
    { uid: "original", cardId: "old-edition", xp: 35, level: 4, at: 1 },
    { uid: "spare", cardId: "old-edition", xp: 12, level: 2, at: 2 },
  ];
  p.ut.duplicateStorage = ["spare"];
  p.ut.squad = { SG: "original" };
  p.ut.collected = ["old-edition"];
  storage.setItem(CLOUD_KEYS[0], JSON.stringify(p));
  storage.setItem(
    CLOUD_KEYS[1],
    JSON.stringify({ ...p, ut: { ...p.ut, squad: { QB: "original" } } }),
  );
  storage.setItem("perfect-season:key:v1", "11".repeat(32));
  storage.setItem("ps-admin", "private-admin-session");
  return { storage, values };
}
describe("encrypted server progress", () => {
  it("preserves both sports, cards, XP, duplicate storage and squad UIDs without sending identity/admin secrets", async () => {
    const { storage, values } = store(),
      snapshot = captureProgress(storage);
    expect(snapshot.values).not.toHaveProperty("perfect-season:key:v1");
    expect(JSON.stringify(snapshot)).not.toContain("private-admin-session");
    const encrypted = await encryptProgress(
      snapshot,
      "11".repeat(32),
      "inspect",
      "actor",
    );
    expect(JSON.stringify(encrypted)).not.toContain("OriginalPlayer");
    const restored = await decryptProgress(
      encrypted,
      "11".repeat(32),
      "inspect",
      "actor",
    );
    expect(restored).toEqual(snapshot);
    storage.setItem(CLOUD_KEYS[0], JSON.stringify(freshProfile()));
    applyProgress(storage, restored);
    expect(JSON.parse(values.get(CLOUD_KEYS[0])!).ut.owned[0]).toMatchObject({
      uid: "original",
      xp: 35,
      level: 4,
    });
    expect(JSON.parse(values.get(CLOUD_KEYS[1])!).ut.squad).toEqual({
      QB: "original",
    });
    expect(values.get("perfect-season:key:v1")).toBe("11".repeat(32));
    expect(values.get("ps-admin")).toBe("private-admin-session");
  });
  it("rejects a different player, namespace or modified ciphertext", async () => {
    const snapshot = captureProgress(store().storage),
      encrypted = await encryptProgress(
        snapshot,
        "11".repeat(32),
        "inspect",
        "actor",
      );
    await expect(
      decryptProgress(encrypted, "22".repeat(32), "inspect", "actor"),
    ).rejects.toThrow();
    await expect(
      decryptProgress(encrypted, "11".repeat(32), "", "actor"),
    ).rejects.toThrow();
    // Codex: always change a significant Base64 character. The old unconditional "A" was a
    // no-op whenever random ciphertext already began with A (about 1/64 encryptions).
    const tampered = {
      ...encrypted,
      cipher: (encrypted.cipher[0] === "A" ? "B" : "A") + encrypted.cipher.slice(1),
    };
    expect(tampered.cipher).not.toBe(encrypted.cipher);
    await expect(
      decryptProgress(
        tampered,
        "11".repeat(32),
        "inspect",
        "actor",
      ),
    ).rejects.toThrow();
  });
  it("rejects unexpected keys or invalid progress before writing anything", () => {
    const { storage, values } = store(),
      snapshot = captureProgress(storage),
      before = new Map(values);
    expect(() =>
      checkedSnapshot({
        ...snapshot,
        values: {
          ...snapshot.values,
          "perfect-season:key:v1": "22".repeat(32),
        },
      }),
    ).toThrow();
    const invalid = {
      ...snapshot,
      values: {
        ...snapshot.values,
        [CLOUD_KEYS[0]]: JSON.stringify({ ...freshProfile(), coins: -1 }),
      },
    };
    expect(() => applyProgress(storage, invalid)).toThrow();
    expect(values).toEqual(before);
  });
  it("rolls back partial writes if phone storage fails and keeps the player key unchanged", () => {
    const { storage, values } = store(),
      snapshot = captureProgress(storage);
    storage.setItem(
      CLOUD_KEYS[0],
      JSON.stringify({ ...freshProfile(), coins: 321 }),
    );
    const before = new Map(values);
    let calls = 0;
    expect(() =>
      applyProgress(
        {
          ...storage,
          setItem: (k, v) => {
            if (++calls === 2) throw Error("disk full");
            storage.setItem(k, v);
          },
        },
        snapshot,
      ),
    ).toThrow();
    expect(values).toEqual(before);
  });
  it("removes active online sessions from the cloud copy without modifying the device copy", async () => {
    const { storage, values } = store();
    const p = JSON.parse(values.get(CLOUD_KEYS[0])!);
    p.activeMatch = { id: "settled-match", opp: "rival" };
    storage.setItem(CLOUD_KEYS[0], JSON.stringify(p));
    const snapshot = captureProgress(storage);
    expect(JSON.parse(snapshot.values[CLOUD_KEYS[0]]!).activeMatch).toBeNull();
    expect(JSON.parse(values.get(CLOUD_KEYS[0])!).activeMatch.id).toBe(
      "settled-match",
    );
    expect(await progressDigest(snapshot)).toBe(
      await progressDigest(captureProgress(storage)),
    );
  });
});
