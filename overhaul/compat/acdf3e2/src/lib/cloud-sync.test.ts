import { describe, expect, it } from "vitest";
import {
  CloudSync,
  type SaveMeta,
  type ServerSave,
  type SyncAdapter,
} from "./cloud-sync";
import {
  CLOUD_KEYS,
  type CloudCipher,
  type CloudSnapshot,
  progressDigest,
} from "./cloud-data";
import { freshProfile } from "./profile";
function snapshot(coins = 50): CloudSnapshot {
  const p = freshProfile();
  p.coins = coins;
  return {
    v: 1,
    values: Object.fromEntries(
      CLOUD_KEYS.map((k, i) => [k, i === 0 ? JSON.stringify(p) : null]),
    ),
  };
}
function server() {
  return {
    current: null as ServerSave | null,
    old: [] as ServerSave[],
    archives: [] as CloudCipher[],
    failAfterWrite: false,
    offline: false,
    saves: 0,
  };
}
function device(s: ReturnType<typeof server>, initial = snapshot()) {
  let local = initial,
    meta: SaveMeta | null = null,
    restored = false,
    safe = true;
  const a: SyncAdapter = {
    read: () => local,
    digest: progressDigest,
    encrypt: async (p) => ({
      v: 1,
      salt: "",
      iv: "",
      cipher: JSON.stringify(p),
    }),
    decrypt: async (r) => JSON.parse(r.payload.cipher),
    load: async () => {
      if (s.offline) throw Error("offline");
      return structuredClone(s.current);
    },
    save: async (revision, digest, payload) => {
      if (s.offline) throw Error("offline");
      if ((s.current?.revision ?? 0) !== revision)
        return {
          conflict: true,
          revision: s.current!.revision,
          updatedAt: "server",
        };
      if (s.current) s.old.push(s.current);
      s.current = {
        revision: revision + 1,
        digest,
        payload,
        updatedAt: "server-" + (revision + 1),
      };
      s.saves++;
      if (s.failAfterWrite) {
        s.failAfterWrite = false;
        throw Error("lost reply");
      }
      return {
        revision: s.current.revision,
        digest,
        updatedAt: s.current.updatedAt,
      };
    },
    archive: async (_d, p) => {
      if (s.offline) throw Error("offline");
      s.archives.push(p);
    },
    readMeta: () => meta,
    writeMeta: (m) => {
      meta = { revision: m.revision, digest: m.digest, updatedAt: m.updatedAt };
    },
    restore: (p) => {
      local = p;
      restored = true;
    },
    canRestore: () => safe,
    changed: () => {},
  };
  const sync = new CloudSync(a);
  return {
    sync,
    set: (p: CloudSnapshot) => {
      local = p;
      sync.markChanged();
    },
    get: () => local,
    meta: () => meta,
    setMeta: (m: SaveMeta | null) => {
      meta = m;
    },
    restored: () => restored,
    safe: (v: boolean) => {
      safe = v;
    },
  };
}
describe("server autosave preservation", () => {
  it("uploads an existing club once and retries unchanged progress without duplicate writes", async () => {
    const s = server(),
      a = device(s, snapshot(11000));
    await a.sync.sync();
    await a.sync.sync();
    expect(s.saves).toBe(1);
    expect(a.sync.status.phase).toBe("saved");
    expect(a.get()).toEqual(snapshot(11000));
  });
  it("keeps offline changes on the device and syncs them after reconnecting", async () => {
    const s = server(),
      a = device(s, snapshot(100));
    await a.sync.sync();
    s.offline = true;
    a.set(snapshot(950));
    await a.sync.sync();
    expect(a.sync.status.phase).toBe("offline");
    expect(a.get()).toEqual(snapshot(950));
    s.offline = false;
    await a.sync.sync();
    expect(s.current?.revision).toBe(2);
    expect(a.sync.status.phase).toBe("saved");
  });
  it("recovers a lost save acknowledgement without writing a second revision", async () => {
    const s = server(),
      a = device(s, snapshot(9000));
    s.failAfterWrite = true;
    await a.sync.sync();
    expect(a.sync.status.phase).toBe("offline");
    await a.sync.sync();
    expect(s.saves).toBe(1);
    expect(a.meta()?.revision).toBe(1);
    expect(a.sync.status.phase).toBe("saved");
  });
  it("restores a known identity with an empty local profile instead of overwriting its club", async () => {
    const s = server(),
      a = device(s, snapshot(12000));
    await a.sync.sync();
    const b = device(s);
    await b.sync.sync();
    expect(b.restored()).toBe(true);
    expect(b.get()).toEqual(a.get());
    expect(s.saves).toBe(1);
  });
  it("pauses conflicting devices and preserves the current server copy", async () => {
    const s = server(),
      a = device(s, snapshot(1000));
    await a.sync.sync();
    const b = device(s, a.get());
    await b.sync.sync();
    a.set(snapshot(1300));
    await a.sync.sync();
    b.set(snapshot(750));
    await b.sync.sync();
    expect(b.sync.status.phase).toBe("conflict");
    expect(b.get()).toEqual(snapshot(750));
    expect(s.current?.digest).toBe(await progressDigest(snapshot(1300)));
    await b.sync.resolve("device");
    expect(s.current?.digest).toBe(await progressDigest(snapshot(750)));
    expect(s.old[s.old.length - 1]?.digest).toBe(
      await progressDigest(snapshot(1300)),
    );
  });
  it("archives the divergent device save before choosing the server save", async () => {
    const s = server(),
      a = device(s, snapshot(3000));
    await a.sync.sync();
    const b = device(s, snapshot(5000));
    await b.sync.sync();
    expect(b.sync.status.phase).toBe("conflict");
    await b.sync.resolve("server");
    expect(b.restored()).toBe(true);
    expect(b.get()).toEqual(snapshot(3000));
    expect(JSON.parse(s.archives[0].cipher)).toEqual(snapshot(5000));
  });
  it("never restores while a game is active", async () => {
    const s = server(),
      a = device(s, snapshot(9500));
    await a.sync.sync();
    const b = device(s);
    b.safe(false);
    await b.sync.sync();
    expect(b.restored()).toBe(false);
    expect(b.sync.status.phase).toBe("conflict");
    expect(b.get()).toEqual(snapshot());
  });
  it("retains newer local activity if progress changes while a server restore is downloading", async () => {
    const s = server(),
      a = device(s, snapshot(900));
    await a.sync.sync();
    const b = device(s);
    const decrypt = (b.sync as unknown as { a: SyncAdapter }).a.decrypt;
    (b.sync as unknown as { a: SyncAdapter }).a.decrypt = async (r) => {
      b.set(snapshot(300));
      return decrypt(r);
    };
    await b.sync.sync();
    expect(b.restored()).toBe(false);
    expect(b.get()).toEqual(snapshot(300));
    expect(b.sync.status.phase).toBe("conflict");
  });
  it("does not treat a missing previously synced record as permission to reset the server", async () => {
    const s = server(),
      a = device(s, snapshot(10000));
    await a.sync.sync();
    s.current = null;
    const b = device(s, a.get());
    b.setMeta(a.meta());
    await b.sync.sync();
    expect(b.sync.status.phase).toBe("blocked");
    expect(s.saves).toBe(1);
    expect(b.get()).toEqual(snapshot(10000));
  });
  it("loads a newer server revision on resume when this device has no unsynced changes", async () => {
    const s = server(),
      a = device(s, snapshot(1200));
    await a.sync.sync();
    const b = device(s, a.get());
    await b.sync.sync();
    a.set(snapshot(1500));
    await a.sync.sync();
    await b.sync.refresh();
    expect(b.restored()).toBe(true);
    expect(b.get()).toEqual(snapshot(1500));
    expect(s.saves).toBe(2);
  });
  it("can retry a temporarily missing server record without uploading over it", async () => {
    const s = server(),
      a = device(s, snapshot(1200));
    await a.sync.sync();
    const existing = s.current;
    s.current = null;
    const b = device(s, a.get());
    b.setMeta(a.meta());
    await b.sync.sync();
    expect(b.sync.status.phase).toBe("blocked");
    s.current = existing;
    await b.sync.refresh();
    expect(b.sync.status.phase).toBe("saved");
    expect(s.saves).toBe(1);
  });
});
