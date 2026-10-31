// Implemented by Codex. Progress is encrypted on the device; signing keys/admin credentials stay off the server.
import { RECOVERY_KEYS, validateSaveValues } from "./recovery";

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
    CLOUD_KEYS.some(
      (k) => s.values[k] !== null && typeof s.values[k] !== "string",
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
  const values = Object.fromEntries(
    CLOUD_KEYS.map((k) => [k, storage.getItem(k)]),
  );
  // Restoring a save must never resume an already-settled online match.
  for (const k of CLOUD_KEYS.slice(0, 2))
    if (values[k]) {
      const profile = JSON.parse(values[k]!);
      profile.activeMatch = null;
      values[k] = JSON.stringify(profile);
    }
  return checkedSnapshot({ v: 1, values });
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
      const v = snapshot.values[k];
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
