// Codex (OpenAI): pure reward application stays in the shell without loading the owner interface.
// Keep the public Admin.tsx re-exports for existing imports and save/gift compatibility.
import { BOOSTER_NAMES } from '../engine/economy';
import { SPORT } from '../engine/sport';
import { BOOSTERS } from '../engine/types';
import { newId, type Profile } from '../lib/profile';
import { snapshotPack } from '../admin/catalog';
import { awardXp } from '../ut/state';
import { GIFT_PACKS, type GiftContent, type GiftPack } from './gifts';

export const PACK_NAME: Record<GiftPack, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  premium: "Premium",
  elite: "Elite Gold",
  jumbo: "Jumbo Premium",
  standout: "Standout Guarantee",
  roster: "Roster Builder",
  captains: "Captains",
  dynasty: "Dynasty",
  goat: "GOAT",
  icon: "Icon",
  squad: "Gold Squad",
  iconteam: "All-Time Squad",
};

/** "5,000 coins and 2 Gold packs" */
export function giftText(g: GiftContent): string {
  const parts = g.coins ? [g.coins.toLocaleString("en-US") + " coins"] : [];
  for (const k of GIFT_PACKS) {
    const n = g.packs[k] ?? 0;
    if (n) parts.push(n + " " + PACK_NAME[k] + (n === 1 ? " pack" : " packs"));
  }
  if (g.xp) parts.push(g.xp.toLocaleString() + " account XP");
  if (g.cardXp) parts.push(g.cardXp + " XP per equipped card");
  for (const b of BOOSTERS)
    if (g.boosters?.[b])
      parts.push(g.boosters[b] + " " + BOOSTER_NAMES[b] + " boosters");
  if (g.player)
    parts.push(
      g.player.count +
        " " +
        g.player.name +
        " card" +
        (g.player.count === 1 ? "" : "s"),
    );
  return parts.length > 1
    ? parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1]
    : (parts[0] ?? "");
}

/** The profile with a gift in it: the coins added, the packs waiting in the Store; once per `id`. */
export function withGift(p: Profile, g: GiftContent, id?: string): Profile {
  if (id && (p.gifts ?? []).includes(id)) return p;
  const at = Date.now();
  const packs = GIFT_PACKS.flatMap((k) =>
    Array.from({ length: g.packs[k] ?? 0 }, (_, i) => ({
      id: newId(),
      kind:
        k === "goat"
          ? "admin-goat"
          : k === "icon"
            ? "admin-icon"
            : k === "squad"
              ? "admin-squad"
              : k === "iconteam"
                ? "admin-icon-team"
                : (g.recipes?.[k] ?? snapshotPack(SPORT, k)),
      at,
      ...(k === "goat" && g.voucherEvent
        ? { voucher: { event: g.voucherEvent, index: i } }
        : {}),
    })),
  );
  if (g.player)
    for (let i = 0; i < g.player.count; i++)
      packs.push({
        id: newId(),
        kind:
          "admin-card:" +
          encodeURIComponent(g.player.cardId) +
          ":" +
          encodeURIComponent(g.player.name),
        at,
      });
  const trained = g.cardXp
    ? awardXp(p.ut, Object.values(p.ut.squad), g.cardXp).ut
    : p.ut;
  const inventory = { ...p.inventory };
  for (const b of BOOSTERS) inventory[b] += g.boosters?.[b] ?? 0;
  return {
    ...p,
    coins: p.coins + g.coins,
    xp: p.xp + (g.xp ?? 0),
    inventory,
    ut: { ...trained, packs: [...trained.packs, ...packs] },
    ...(id ? { gifts: [...(p.gifts ?? []), id] } : {}),
  };
}
