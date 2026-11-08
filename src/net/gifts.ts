import { BOOSTERS } from "../engine/types";
import type { Booster } from "../engine/types";
import { snapshotPack, readPackSnapshot } from "../admin/catalog";
import { SPORT } from "../engine/sport";
// Gifts from the game's admin: coins and packs for one player, a few, or everyone, sent over the
// relays and signed with the admin's key. The key comes from the admin password (the panel in
// Settings), so only someone with the password can sign one; every game checks a gift's signature
// against the admin's public key here and collects each gift once.
//
//  - kind 30078 (app data), d-tag `ps1-gift:<id>`, t-tag `ps1-gift`; a p-tag for each player
//    it's for, or the t-tag `ps1-gift-all` for everyone
//  - content: { id, coins, packs: { bronze, silver, gold, premium }, note }
//  - kept on the relays: a player who isn't online collects it next time they open the game
//    (within two weeks)
import { finalizeEvent, getPublicKey } from "nostr-tools/pure";
import {
  type Event,
  KIND_APP,
  myPubkey,
  NET_ON,
  NS_SUFFIX,
  pool,
} from "./nostr";

/** The admin's public key: the one key whose gifts a game takes. */
export const ADMIN_PUBKEY =
  "d82ab0de2afb953e04620f8f496589a45f1200e29ffc359966d350debfb5c1ec";
const SALT = "perfect-season-admin-v1";
/** slow on purpose, so the password can't be guessed fast from the public key */
const ROUNDS = 210000;
const TAG = "ps1-gift" + NS_SUFFIX;
const ALL = "ps1-gift-all" + NS_SUFFIX;
const STUDIO_TAG = "ps1-gift-studio" + NS_SUFFIX;
const STUDIO_ALL = "ps1-gift-studio-all" + NS_SUFFIX;
/** how far back a game looks for gifts */
const KEEP_S = 14 * 86400;

export type GiftPack =
  | "bronze"
  | "silver"
  | "gold"
  | "premium"
  | "elite"
  | "jumbo"
  | "standout"
  | "roster"
  | "captains"
  | "dynasty"
  | "goat"
  | "icon"
  | "squad"
  | "iconteam";
export const GIFT_PACKS: GiftPack[] = [
  "bronze",
  "silver",
  "gold",
  "premium",
  "elite",
  "jumbo",
  "standout",
  "roster",
  "captains",
  "dynasty",
  "goat",
  "icon",
  "squad",
  "iconteam",
];
export const MAX_GIFT_COINS = 10_000_000;
export const MAX_GIFT_PACKS = 50;

export interface GiftContent {
  coins: number;
  packs: Partial<Record<GiftPack, number>>;
  note: string;
  recipes?: Partial<Record<GiftPack, string>>;
  voucherEvent?: Event;
  xp?: number;
  cardXp?: number;
  boosters?: Partial<Record<Booster, number>>;
  player?: { cardId: string; name: string; count: number };
  goatCardId?: string;
}

export interface Gift extends GiftContent {
  /** unique; what the profile keeps once it's collected */
  id: string;
  /** when it was sent (s) */
  at: number;
}

const nowS = () => Math.floor(Date.now() / 1000);

/** The admin's key from the password (with or without its full stop), or null when it isn't the password. */
export async function adminKey(password: string): Promise<Uint8Array | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password.trim().replace(/\.$/, "")),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(SALT),
      iterations: ROUNDS,
    },
    base,
    256,
  );
  const sk = new Uint8Array(bits);
  try {
    return getPublicKey(sk) === ADMIN_PUBKEY ? sk : null;
  } catch {
    return null;
  }
}

/** What a gift holds, checked and capped; null when it holds nothing. */
export function contentOf(c: unknown): GiftContent | null {
  const o = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
  const coins =
    Number.isInteger(o.coins) && (o.coins as number) > 0
      ? Math.min(o.coins as number, MAX_GIFT_COINS)
      : 0;
  const packs: GiftContent["packs"] = {};
  const p = (o.packs && typeof o.packs === "object" ? o.packs : {}) as Record<
    string,
    unknown
  >;
  for (const k of GIFT_PACKS) {
    const n = p[k];
    if (Number.isInteger(n) && (n as number) > 0)
      packs[k] = Math.min(n as number, MAX_GIFT_PACKS);
  }
  const bounded = (value: unknown, max: number) =>
    Number.isSafeInteger(value) && Number(value) > 0
      ? Math.min(Number(value), max)
      : 0;
  const xp = bounded(o.xp, 100000),
    cardXp = bounded(o.cardXp, 700),
    boosters: GiftContent["boosters"] = {};
  for (const b of BOOSTERS) {
    const n = bounded(
      (o.boosters as Record<string, unknown> | undefined)?.[b],
      50,
    );
    if (n) boosters[b] = n;
  }
  const raw = o.player as GiftContent["player"],
    player =
      raw &&
      typeof raw.cardId === "string" &&
      /^(nba|nfl|soccer):(season|promo|legend|standout|landmark):/.test(
        raw.cardId,
      ) &&
      raw.cardId.length <= 180 &&
      typeof raw.name === "string" &&
      bounded(raw.count, 50)
        ? {
            cardId: raw.cardId,
            name: raw.name.slice(0, 60),
            count: bounded(raw.count, 50),
          }
        : undefined;
  const goatCardId =
    typeof o.goatCardId === "string" &&
    /^(nba|nfl):goat:/.test(o.goatCardId) &&
    o.goatCardId.length <= 180
      ? o.goatCardId
      : undefined;
  if (
    !coins &&
    !Object.keys(packs).length &&
    !xp &&
    !cardXp &&
    !Object.keys(boosters).length &&
    !player
  )
    return null;
  const recipes: GiftContent["recipes"] = {};
  for (const k of GIFT_PACKS) {
    const value = (o.recipes as Record<string, unknown> | undefined)?.[k];
    if (typeof value === "string" && readPackSnapshot(value)?.base === k)
      recipes[k] = value;
  }
  return {
    coins,
    packs,
    ...(xp ? { xp } : {}),
    ...(cardXp ? { cardXp } : {}),
    ...(Object.keys(boosters).length ? { boosters } : {}),
    ...(player ? { player } : {}),
    ...(goatCardId ? { goatCardId } : {}),
    ...(Object.keys(recipes).length ? { recipes } : {}),
    note: typeof o.note === "string" ? o.note.trim().slice(0, 140) : "",
  };
}

/** A gift off the wire: from the admin (and well formed), or null. */
export function giftOf(e: Event, admin = ADMIN_PUBKEY): Gift | null {
  if (
    e.pubkey !== admin ||
    e.kind !== KIND_APP ||
    !e.tags.some((t) => t[0] === "t" && (t[1] === TAG || t[1] === STUDIO_TAG))
  )
    return null;
  let c: unknown;
  try {
    c = JSON.parse(e.content);
  } catch {
    return null;
  }
  const id = (c as { id?: unknown })?.id;
  if (typeof id !== "string" || !/^[\w-]{6,64}$/.test(id)) return null;
  const g = contentOf(c);
  if ((g?.packs.goat || g?.player) && (c as { sport?: string }).sport !== SPORT)
    return null;
  // Claude review 2026-11-08: frozen Club Collection recipes come from the sender's sport catalog
  // (NFL doubles silver/gold). In another sport the receiver's own recipe is frozen on collection.
  const sport = (c as { sport?: unknown }).sport;
  const foreign = typeof sport === "string" && sport !== SPORT;
  const { recipes, ...rest } = g ?? ({} as GiftContent);
  return (
    g && {
      ...rest,
      ...(recipes && !foreign ? { recipes } : {}),
      ...(g.packs.goat ? { voucherEvent: e } : {}),
      id: "admin:" + id,
      at: e.created_at,
    }
  );
}

/** A signed gift: for these players (their keys), or for everyone. */
export function giftEvent(
  sk: Uint8Array,
  to: string[] | "all",
  g: GiftContent,
  id: string,
): Event {
  const upgraded =
    !!(
      g.xp ||
      g.cardXp ||
      g.player ||
      (g.boosters && Object.keys(g.boosters).length)
    ) ||
    GIFT_PACKS.some(
      (k) => !["bronze", "silver", "gold", "premium"].includes(k) && g.packs[k],
    );
  const tag = upgraded ? STUDIO_TAG : TAG,
    all = upgraded ? STUDIO_ALL : ALL;
  const tags = [
    ["d", tag + ":" + id],
    ["t", tag],
    ...(to === "all" ? [["t", all]] : to.map((p) => ["p", p])),
  ];
  return finalizeEvent(
    {
      kind: KIND_APP,
      created_at: nowS(),
      tags,
      content: JSON.stringify({
        id,
        ...g,
        sport: SPORT,
        recipes: Object.fromEntries(
          GIFT_PACKS.filter((k) => g.packs[k])
            .map((k) => [k, g.recipes?.[k] ?? snapshotPack(SPORT, k)])
            .filter(([k, v]) => k !== v),
        ),
      }),
    },
    sk,
  );
}

/** Send a gift; resolves to how many relays took it (0: it didn't go out). */
export function sendGift(
  sk: Uint8Array,
  to: string[] | "all",
  g: GiftContent,
): Promise<number> {
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return pool.publish(giftEvent(sk, to, g, id));
}

/** Gifts for this player (and for everyone) from the last two weeks, and new ones as they come. */
export function watchGifts(onGift: (g: Gift) => void): () => void {
  if (!NET_ON) return () => {};
  const since = nowS() - KEEP_S;
  const sub = pool.subscribe(
    [
      { kinds: [KIND_APP], authors: [ADMIN_PUBKEY], "#p": [myPubkey()], since },
      {
        kinds: [KIND_APP],
        authors: [ADMIN_PUBKEY],
        "#t": [ALL, STUDIO_ALL],
        since,
      },
    ],
    (e) => {
      const g = giftOf(e);
      if (g) onGift(g);
    },
  );
  return () => sub.close();
}
