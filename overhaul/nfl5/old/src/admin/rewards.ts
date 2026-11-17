// Codex: reusable reward bundles and local owner history; never stores passwords or signing keys.
import type { GiftContent } from "../net/gifts";
import { NS_SUFFIX } from "../net/nostr";
import { SPORT } from "../engine/sport";
const key = "ps-admin-rewards" + NS_SUFFIX + ":" + SPORT;
export interface RewardPreset {
  name: string;
  gift: GiftContent;
}
export interface AdminAction {
  id: string;
  at: number;
  summary: string;
  who: string;
}
export const BUILTIN_REWARDS: RewardPreset[] = [
  {
    name: "Welcome Bundle",
    gift: {
      coins: 5000,
      packs: { gold: 3, premium: 1 },
      note: "Welcome to Perfect Season!",
      xp: 1000,
      boosters: { double: 3, trade: 3, prime: 3 },
    },
  },
  {
    name: "All-Time Bundle",
    gift: {
      coins: 10000,
      packs: { icon: 3, iconteam: 1 },
      note: "Build your all-time team.",
      cardXp: 200,
    },
  },
  {
    name: "Train My Squad",
    gift: { coins: 0, packs: {}, note: "Squad training boost.", cardXp: 700 },
  },
  {
    name: "Gold Team Bundle",
    gift: {
      coins: 5000,
      packs: { squad: 1 },
      note: "A new team to build around.",
      boosters: { double: 5 },
    },
  },
];
export function rewardPresets(): RewardPreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key + ":presets") ?? "[]");
    return Array.isArray(raw)
      ? raw.filter((p) => typeof p?.name === "string" && p.gift).slice(-12)
      : [];
  } catch {
    return [];
  }
}
export function saveRewardPreset(name: string, gift: GiftContent) {
  const { voucherEvent, ...safe } = gift;
  void voucherEvent;
  const next = [
    ...rewardPresets().filter((p) => p.name !== name),
    { name: name.trim().slice(0, 28), gift: safe },
  ].slice(-12);
  localStorage.setItem(key + ":presets", JSON.stringify(next));
  return next;
}
export function actionHistory(): AdminAction[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key + ":history") ?? "[]");
    return Array.isArray(raw)
      ? raw
          .filter(
            (r) =>
              typeof r?.id === "string" &&
              typeof r.summary === "string" &&
              typeof r.who === "string" &&
              Number.isFinite(r.at),
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
export function rememberAction(summary: string, who: string) {
  const item = {
    id: crypto.randomUUID(),
    at: Date.now(),
    summary: summary.slice(0, 500),
    who: who.slice(0, 300),
  };
  const next = [item, ...actionHistory()].slice(0, 50);
  try {
    localStorage.setItem(key + ":history", JSON.stringify(next));
  } catch {
    /* editing is not blocked by history storage */
  }
  return next;
}
