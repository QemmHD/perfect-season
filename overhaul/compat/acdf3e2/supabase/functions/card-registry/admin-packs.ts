// Codex (OpenAI): one owner-signed entitlement per recipient and award index, no client-forged GOATs.
import { verifyEvent, type Event } from "nostr-tools/pure";
export const OWNER_PUBKEY =
  "d82ab0de2afb953e04620f8f496589a45f1200e29ffc359966d350debfb5c1ec";
export interface AdminPackVoucher {
  event: Event;
  index: number;
}
export async function adminPackId(voucher: AdminPackVoucher): Promise<string> {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(
      "perfect-season:admin-goat:" + voucher.event.id + ":" + voucher.index,
    ),
  );
  const hex = Array.from(new Uint8Array(bytes).slice(0, 16), (v) =>
    v.toString(16).padStart(2, "0"),
  ).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-4" +
    hex.slice(13, 16) +
    "-a" +
    hex.slice(17, 20) +
    "-" +
    hex.slice(20)
  );
}
export async function verifyAdminPack(
  v: unknown,
  actor: string,
  sport: string,
  namespace: string,
  owner = OWNER_PUBKEY,
): Promise<string | null> {
  try {
    const voucher = v as AdminPackVoucher,
      e = voucher?.event;
    if (
      !e ||
      e.pubkey !== owner ||
      e.kind !== 30078 ||
      !Number.isInteger(voucher.index) ||
      voucher.index < 0 ||
      voucher.index >= 50 ||
      e.content.length > 5000 ||
      e.created_at > Math.floor(Date.now() / 1000) + 300
    )
      return null;
    if (
      !verifyEvent({
        id: e.id,
        pubkey: e.pubkey,
        kind: e.kind,
        created_at: e.created_at,
        tags: e.tags,
        content: e.content,
        sig: e.sig,
      })
    )
      return null;
    const tag = "ps1-gift-studio" + (namespace ? "-" + namespace : ""),
      c = JSON.parse(e.content);
    if (
      !["nba", "nfl"].includes(sport) ||
      c.sport !== sport ||
      !Number.isInteger(c.packs?.goat) ||
      c.packs.goat < 1 ||
      c.packs.goat > 50 ||
      voucher.index >= c.packs.goat ||
      !e.tags.some((t) => t[0] === "t" && t[1] === tag)
    )
      return null;
    if (
      !e.tags.some((t) => t[0] === "p" && t[1] === actor) &&
      !e.tags.some(
        (t) =>
          t[0] === "t" &&
          t[1] === "ps1-gift-studio-all" + (namespace ? "-" + namespace : ""),
      )
    )
      return null;
    if (
      c.goatCardId !== undefined &&
      (typeof c.goatCardId !== "string" ||
        !c.goatCardId.startsWith(sport + ":goat:") ||
        c.goatCardId.length > 180)
    )
      return null;
    return adminPackId(voucher);
  } catch {
    return null;
  }
}
