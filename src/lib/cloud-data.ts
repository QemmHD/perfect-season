// Implemented by Codex. Progress is encrypted on the device; signing keys/admin credentials stay off the server.
import { OPTIONAL_KEYS, PROFILE_STORAGE_KEYS, RECOVERY_KEYS, validateSaveValues } from "./recovery";
import { isoWeek, weekday, type Playtime } from "./playtime";

export const CLOUD_KEYS = RECOVERY_KEYS.filter(
  (k) => k !== "perfect-season:key:v1",
);
export interface CloudSnapshot {
  v: 1;
  values: Record<string, string | null>;
}
export interface CloudCipher {
  v: 1;
  salt: string;
  iv: string;
  cipher: string;
}
const enc = new TextEncoder();
const b64 = (a: Uint8Array) => {
  let s = "";
  for (let i = 0; i < a.length; i += 8192)
    s += String.fromCharCode(...a.subarray(i, i + 8192));
  return btoa(s);
};
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function checkedSnapshot(input: unknown): CloudSnapshot {
  const s = input as CloudSnapshot;
  if (
    s?.v !== 1 ||
    !s.values ||
    Object.keys(s.values).some((k) => !CLOUD_KEYS.includes(k)) ||
    CLOUD_KEYS.some((k) =>
      s.values[k] === undefined
        ? !OPTIONAL_KEYS.includes(k)
        : s.values[k] !== null && typeof s.values[k] !== "string",
    )
  )
    throw Error(
      "The server save is incomplete or invalid. Your device save was kept.",
    );
  validateSaveValues(
    { ...s.values, "perfect-season:key:v1": null },
    Date.now(),
  );
  return s;
}
export function captureProgress(
  storage: Pick<Storage, "getItem">,
): CloudSnapshot {
  // soccer's keys only when there is soccer progress: a save without it stays the one older builds read
  const values = Object.fromEntries(
    CLOUD_KEYS.map((k) => [k, storage.getItem(k)] as const).filter(
      ([k, v]) => v !== null || !OPTIONAL_KEYS.includes(k),
    ),
  );
  // Restoring a save must never resume an already-settled online match.
  for (const k of PROFILE_STORAGE_KEYS)
    if (values[k]) {
      const profile = JSON.parse(values[k]!);
      profile.activeMatch = null;
      values[k] = JSON.stringify(profile);
    }
  return checkedSnapshot({ v: 1, values });
}
// ---------- Claude 2026-11-16 (V2 E.3, E.8): the MINUTES ledger's merge rule ----------
const mx = (a?: number, b?: number) => Math.max(a ?? 0, b ?? 0);
const union = <T,>(a: T[] = [], b: T[] = []) => [...new Set([...a, ...b])];
const later = <T extends string | undefined>(a: T, b: T) => ((a ?? "") >= (b ?? "") ? a : b);

/**
 * Two devices' ledgers as one (cloud apply path): the most of every count (per day and weekday when
 * they share the day or week), the union of claims and receipts, the newer league. A rung claimed on
 * either phone stays claimed; no counted second is lost to a restore or a relaunch.
 */
export function mergePlaytime(a: Playtime | undefined, b: Playtime | undefined): Playtime | undefined {
  if (!a || !b) return a ?? b;
  const hi = a.day >= b.day ? a : b,
    wk = a.week >= b.week ? a : b,
    sameDay = a.day === b.day,
    sameWeek = a.week === b.week,
    ca = a.claimed,
    cb = b.claimed,
    // the newer league: by last week when both have one ("2026-W47"), else by season number ("S2")
    wa = a.league.lastWeek?.week,
    wb = b.league.lastWeek?.week,
    sn = (x: Playtime) => parseInt(x.league.season.slice(1), 10) || 0,
    lg = (wa && wb ? wa >= wb : sn(a) !== sn(b) ? sn(a) > sn(b) : !!wa || !wb) ? a.league : b.league;
  const pair = (k: "day" | "week", key: "dayKey" | "weekKey") =>
    ca[key] === cb[key] ? union(ca[k], cb[k]).sort((x, y) => x - y) : ((ca[key] ?? "") > (cb[key] ?? "") ? ca : cb)[k];
  const m: Playtime = {
    ...(hi === a ? b : a),
    ...hi,
    life: mx(a.life, b.life),
    rawLife: mx(a.rawLife, b.rawLife),
    daySec: sameDay ? mx(a.daySec, b.daySec) : hi.daySec,
    dayMenuSec: sameDay ? mx(a.dayMenuSec, b.dayMenuSec) : hi.dayMenuSec,
    rawDaySec: sameDay ? mx(a.rawDaySec, b.rawDaySec) : hi.rawDaySec,
    week: wk.week,
    weekDays: sameWeek ? a.weekDays.map((v, i) => mx(v, b.weekDays[i])) : wk.weekDays.slice(),
    weekActs: sameWeek ? a.weekActs.map((v, i) => mx(v, b.weekActs[i])) : wk.weekActs.slice(),
    bySport: { nba: mx(a.bySport.nba, b.bySport.nba), nfl: mx(a.bySport.nfl, b.bySport.nfl), soccer: mx(a.bySport.soccer, b.bySport.soccer) },
    acts: mx(a.acts, b.acts),
    claimed: {
      day: pair("day", "dayKey"),
      week: pair("week", "weekKey"),
      life: union(ca.life, cb.life).sort((x, y) => x - y),
      dayKey: later(ca.dayKey, cb.dayKey),
      weekKey: later(ca.weekKey, cb.weekKey),
    },
    league: { ...lg, best: mx(a.league.best, b.league.best) },
  };
  for (const k of ["restedDay", "frozenDay", "endowed"] as const) {
    const v = later(a[k], b[k]);
    if (v) m[k] = v;
  }
  if (a.owed || b.owed) m.owed = union(a.owed, b.owed);
  // ut-3: raw seconds per weekday, the most of each when both phones are on the same week
  if (sameWeek && (a.rawWeek || b.rawWeek)) m.rawWeek = [0, 1, 2, 3, 4, 5, 6].map((i) => mx(a.rawWeek?.[i] ?? 0, b.rawWeek?.[i] ?? 0));
  else if (wk.rawWeek) m.rawWeek = wk.rawWeek.slice();
  else delete m.rawWeek;
  if (a.hook || b.hook) {
    const h: Playtime["hook"] = { ...b.hook, ...a.hook };
    for (const [k, v] of Object.entries(b.hook ?? {})) {
      const w = h[k];
      h[k] = Array.isArray(v) || Array.isArray(w) ? union(w as string[], v as string[]) : typeof v === "number" ? mx(w as number, v) : later(w as string, v as string);
    }
    m.hook = h;
  }
  if (m.week === isoWeek(m.day)) m.weekDays[weekday(m.day)] = mx(m.weekDays[weekday(m.day)], m.daySec);
  return m;
}

/**
 * Claude 2026-11-16 (V2 E.3): the MINUTES ledger is merged, never replaced, when a save is applied
 * over this phone's (the most of each count, the union of claimed rungs), so a restore can neither
 * lose minutes nor make a rung claimable twice. Everything else in the snapshot is applied as is.
 */
export function withDeviceLedger(server: string | null | undefined, device: string | null): string | null | undefined {
  if (!server || !device) return server;
  try {
    const s = JSON.parse(server),
      m = mergePlaytime(JSON.parse(device).playtime, s.playtime);
    return !m || m === s.playtime ? server : JSON.stringify({ ...s, playtime: m });
  } catch {
    return server;
  }
}
/** Atomic best-effort rollback, preserving identity and all non-progress storage. */
export function applyProgress(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  input: CloudSnapshot,
) {
  const snapshot = checkedSnapshot(input),
    before = CLOUD_KEYS.map((k) => [k, storage.getItem(k)] as const);
  try {
    for (const k of CLOUD_KEYS) {
      const v =
        k === PROFILE_STORAGE_KEYS[0]
          ? withDeviceLedger(snapshot.values[k], storage.getItem(k))
          : snapshot.values[k];
      // an older build's save has no soccer keys: this phone's soccer progress stays
      if (v === undefined) continue;
      v === null ? storage.removeItem(k) : storage.setItem(k, v);
    }
  } catch {
    for (const [k, v] of before)
      try {
        v === null ? storage.removeItem(k) : storage.setItem(k, v);
      } catch {
        /* report the original storage failure */
      }
    throw Error(
      "This phone could not restore the save. Its previous progress was kept where possible.",
    );
  }
}
export async function progressDigest(s: CloudSnapshot): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(JSON.stringify(s)),
  );
  return [...new Uint8Array(bytes)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("");
}
async function cipherKey(
  secret: string,
  salt: Uint8Array,
  namespace: string,
  actor: string,
) {
  if (!/^[a-f0-9]{64}$/.test(secret))
    throw Error("Your player identity is not available on this phone.");
  const raw = Uint8Array.from(secret.match(/../g)!, (v) => parseInt(v, 16));
  const base = await crypto.subtle.importKey(
    "raw",
    raw as BufferSource,
    "HKDF",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt as BufferSource,
      info: enc.encode("perfect-season:cloud:v1:" + namespace + ":" + actor),
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptProgress(
  s: CloudSnapshot,
  secret: string,
  namespace: string,
  actor: string,
): Promise<CloudCipher> {
  checkedSnapshot(s);
  const plain = enc.encode(JSON.stringify(s));
  if (plain.byteLength > 5_000_000)
    throw Error(
      "This save is too large to sync. Your device progress is still safe.",
    );
  const salt = crypto.getRandomValues(new Uint8Array(16)),
    iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: enc.encode(namespace + ":" + actor),
    },
    await cipherKey(secret, salt, namespace, actor),
    plain,
  );
  return {
    v: 1,
    salt: b64(salt),
    iv: b64(iv),
    cipher: b64(new Uint8Array(cipher)),
  };
}
export async function decryptProgress(
  c: CloudCipher,
  secret: string,
  namespace: string,
  actor: string,
): Promise<CloudSnapshot> {
  try {
    if (
      c?.v !== 1 ||
      c.cipher.length > 7_000_000 ||
      unb64(c.salt).length !== 16 ||
      unb64(c.iv).length !== 12
    )
      throw Error();
    const plain = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: unb64(c.iv) as BufferSource,
        additionalData: enc.encode(namespace + ":" + actor),
      },
      await cipherKey(secret, unb64(c.salt), namespace, actor),
      unb64(c.cipher) as BufferSource,
    );
    return checkedSnapshot(JSON.parse(new TextDecoder().decode(plain)));
  } catch {
    throw Error(
      "The server save could not be verified. Your device progress was kept.",
    );
  }
}
export function hasPlayed(s: CloudSnapshot): boolean {
  return (
    CLOUD_KEYS.slice(0, 2).some((k) => {
      const p = JSON.parse(s.values[k] ?? "null");
      return (
        p &&
        (p.xp > 0 ||
          p.coins > 50 ||
          p.history?.length ||
          p.ut?.owned?.length ||
          p.ut?.starterClaimed ||
          p.stats?.games)
      );
    }) ||
    ["nba", "nfl"].some(
      (sport) => !!s.values["perfect-season:checkpoint:" + sport],
    )
  );
}
