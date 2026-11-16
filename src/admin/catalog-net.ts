// Codex: only signed owner events can change the public store; secrets never enter config/cache.
import { finalizeEvent, getPublicKey, verifyEvent } from "nostr-tools/pure";
import { ADMIN_PUBKEY } from "../net/gifts";
import { pool, NET_ON, NS_SUFFIX, KIND_APP, type Event } from "../net/nostr";
import { checkedCatalog, setCatalog, type Catalog } from "./catalog";
import type { UtSport } from "../ut/types";
const tag = "ps-admin-catalog" + NS_SUFFIX;
const latest: Partial<Record<UtSport, Event>> = {};
export function catalogEventOf(e: Event, admin = ADMIN_PUBKEY) {
  if (
    e.pubkey !== admin ||
    e.kind !== KIND_APP ||
    !verifyEvent({
      id: e.id,
      pubkey: e.pubkey,
      created_at: e.created_at,
      kind: e.kind,
      tags: e.tags,
      content: e.content,
      sig: e.sig,
    }) ||
    e.content.length > 10000 ||
    e.created_at > Math.floor(Date.now() / 1000) + 300
  )
    return null;
  try {
    const c = JSON.parse(e.content);
    if (
      c.v !== 1 ||
      !["nba", "nfl", "soccer"].includes(c.sport) ||
      !e.tags.some((t) => t[0] === "d" && t[1] === tag + ":" + c.sport)
    )
      return null;
    const catalog = checkedCatalog(c.catalog);
    return catalog ? { sport: c.sport as UtSport, catalog } : null;
  } catch {
    return null;
  }
}
function accept(e: Event) {
  const c = catalogEventOf(e);
  if (!c) return;
  const prev = latest[c.sport];
  if (
    prev &&
    (prev.created_at > e.created_at ||
      (prev.created_at === e.created_at && prev.id <= e.id))
  )
    return;
  latest[c.sport] = e;
  setCatalog(c.sport, c.catalog);
  try {
    localStorage.setItem(tag + ":" + c.sport, JSON.stringify(e));
  } catch {
    /* live config remains usable */
  }
}
export function watchCatalog() {
  for (const sport of ["nba", "nfl", "soccer"])
    try {
      const raw = localStorage.getItem(tag + ":" + sport);
      if (raw) accept(JSON.parse(raw));
    } catch {
      /* invalid cache is ignored */
    }
  if (!NET_ON) return () => {};
  const sub = pool.subscribe(
    [
      {
        kinds: [KIND_APP],
        authors: [ADMIN_PUBKEY],
        "#d": ["nba", "nfl", "soccer"].map((s) => tag + ":" + s),
      },
    ],
    accept,
  );
  return () => sub.close();
}
export async function publishCatalog(
  sk: Uint8Array,
  sport: UtSport,
  catalog: Catalog,
) {
  if (getPublicKey(sk) !== ADMIN_PUBKEY)
    throw Error("Unlock the owner account first.");
  const checked = checkedCatalog(catalog);
  if (!checked)
    throw Error("Use 1–40 cards, counts 0–20 and a price of 500–100,000.");
  const e = finalizeEvent(
    {
      kind: KIND_APP,
      created_at: Math.max(
        Math.floor(Date.now() / 1000),
        (latest[sport]?.created_at ?? 0) + 1,
      ),
      tags: [["d", tag + ":" + sport]],
      content: JSON.stringify({ v: 1, sport, catalog: checked }),
    },
    sk,
  );
  const count = await pool.publish(e);
  if (!count)
    throw Error("No relay accepted the update. Your current store was kept.");
  accept(e);
  return count;
}
