// Implemented by Codex. Uses the existing signed player identity; no new account or downloaded backup file.
import { NS_SUFFIX, myPubkey, NET_ON, sign } from "../net/nostr";
import {
  applyProgress,
  captureProgress,
  decryptProgress,
  encryptProgress,
  progressDigest,
} from "./cloud-data";
import { CloudSync, type CloudStatus, type SaveMeta } from "./cloud-sync";
import { SAVE_CHANGED } from "./save-events";

export const CLOUD_ENDPOINT =
  "https://ryqaibujweiwwvdtswxj.supabase.co/functions/v1/player-save";
const PUBLIC_KEY = "sb_publishable_Zl7MIzwPXVO_2azYNqh0Bw_DYZvQRbo";
const namespace = () => NS_SUFFIX.replace(/^-/, "");
let status: CloudStatus = {
  phase: "starting",
  revision: 0,
  updatedAt: null,
  message: "Checking your server save…",
};
const listeners = new Set<() => void>();
export const cloudStatus = () => status;
export const subscribeCloud = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
const publish = (next: CloudStatus) => {
  status = next;
  listeners.forEach((fn) => fn());
};
let controller: CloudSync | null = null;
let kick: (() => void) | null = null;
function secret() {
  myPubkey();
  const key = localStorage.getItem("perfect-season:key:v1");
  if (!key)
    throw Error(
      "This phone could not store your player identity. Server sync is paused.",
    );
  return key;
}
async function request(op: string, extra: Record<string, unknown> = {}) {
  const content = JSON.stringify({
    v: 1,
    namespace: namespace(),
    op,
    ...extra,
  });
  const event = sign(
    27235,
    [
      ["u", CLOUD_ENDPOINT],
      ["method", "POST"],
    ],
    content,
  );
  const body = JSON.stringify({ event });
  const abort = new AbortController(),
    timer = setTimeout(() => abort.abort(), 20000);
  try {
    const response = await fetch(CLOUD_ENDPOINT, {
      method: "POST",
      headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json" },
      body,
      signal: abort.signal,
      keepalive: body.length < 60000,
    });
    const data = await response.json();
    if (!response.ok && response.status !== 409)
      throw Error(
        data.error || "The server is unavailable. Your phone keeps saving.",
      );
    return data;
  } catch (e) {
    throw Error(
      e instanceof Error && e.name !== "AbortError"
        ? e.message
        : "Server sync is taking too long. Your phone keeps saving.",
    );
  } finally {
    clearTimeout(timer);
  }
}
export function startCloudSaving(
  canRestore: () => boolean,
  onRestored: () => void,
): () => void {
  if (!NET_ON) {
    publish({
      phase: "blocked",
      revision: 0,
      updatedAt: null,
      message: "Server saves are available in the installed or browser game.",
    });
    return () => {};
  }
  let timer: ReturnType<typeof setTimeout> | null = null,
    stopped = false;
  const actor = myPubkey(),
    ns = namespace(),
    metaKey = "perfect-season:cloud:v1:" + ns + ":" + actor;
  const current = new CloudSync({
    read: () => captureProgress(localStorage),
    digest: progressDigest,
    encrypt: (s) => encryptProgress(s, secret(), ns, actor),
    decrypt: (r) => decryptProgress(r.payload, secret(), ns, actor),
    load: async () => (await request("load")).record,
    save: (revision, digest, payload) =>
      request("save", {
        revision,
        digest,
        payload,
        requestId: crypto.randomUUID(),
      }),
    archive: async (digest, payload) => {
      await request("archive", {
        digest,
        payload,
        requestId: crypto.randomUUID(),
      });
    },
    readMeta: () => {
      try {
        const m = JSON.parse(localStorage.getItem(metaKey) ?? "null");
        return m &&
          Number.isSafeInteger(m.revision) &&
          m.revision > 0 &&
          /^[a-f0-9]{64}$/.test(m.digest)
          ? (m as SaveMeta)
          : null;
      } catch {
        return null;
      }
    },
    writeMeta: (m) =>
      localStorage.setItem(
        metaKey,
        JSON.stringify({
          revision: m.revision,
          digest: m.digest,
          updatedAt: m.updatedAt,
        }),
      ),
    canRestore,
    restore: (s) => {
      applyProgress(localStorage, s);
      onRestored();
    },
    changed: publish,
  });
  controller = current;
  const run = async (check = false) => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    timer = null;
    if (check) await current.refresh();
    else await current.sync();
    if (stopped) return;
    if (
      current.status.phase === "offline" ||
      current.status.phase === "pending"
    )
      timer = setTimeout(
        run,
        current.status.phase === "offline" ? 15000 : 1400,
      );
  };
  const queue = () => {
    current.markChanged();
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 1400);
  };
  const resume = () => {
    void run(document.visibilityState === "visible");
  };
  const reconnect = () => {
    void run(true);
  };
  const leaving = () => {
    void run();
  };
  const otherTab = (e: StorageEvent) => {
    if (
      e.key?.startsWith("perfect-season:") &&
      !e.key.startsWith("perfect-season:cloud:")
    )
      queue();
  };
  kick = () => void run(true);
  window.addEventListener(SAVE_CHANGED, queue);
  window.addEventListener("online", reconnect);
  window.addEventListener("pagehide", leaving);
  window.addEventListener("storage", otherTab);
  document.addEventListener("visibilitychange", resume);
  void run();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    current.dispose();
    if (controller === current) {
      controller = null;
      kick = null;
    }
    window.removeEventListener(SAVE_CHANGED, queue);
    window.removeEventListener("online", reconnect);
    window.removeEventListener("pagehide", leaving);
    window.removeEventListener("storage", otherTab);
    document.removeEventListener("visibilitychange", resume);
  };
}
export function syncCloudNow() {
  kick?.();
}
export async function resolveCloud(choice: "device" | "server") {
  await controller?.resolve(choice);
}
