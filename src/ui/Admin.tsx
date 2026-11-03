import { AdminPlayerPicker } from "../admin/AdminPlayerPicker";
import { awardXp } from "../ut/state";
import {
  BUILTIN_REWARDS,
  rewardPresets,
  saveRewardPreset,
  actionHistory,
  rememberAction,
} from "../admin/rewards";
import { myPubkey } from "../net/nostr";
import { shuffle, trueRand } from "../engine/rng";
import { AdminHome, PackStudio, ProgressEditor } from "../admin/AdminStudio";
import { snapshotPack } from "../admin/catalog";
// The admin panel (Settings, at the bottom): behind a password. Tools for this phone's game (coins,
// XP, boosters, Ultimate Team packs and limits, the day's Daily, missions and reward), and gifts of
// coins and packs for players: yourself, ones you pick from who's online, a few online at random, or
// everyone. Gifts go out over the relays signed with the admin's key, which comes from the password
// (src/net/gifts.ts): the page's code is public, so only the matching public key is kept in it.
import React, { useEffect, useState } from "react";
import { BOOSTER_NAMES, levelInfo } from "../engine/economy";
import { pickFor, SPORT, SPORT_NAME } from "../engine/sport";
import { BOOSTERS } from "../engine/types";
import { newId, type Profile } from "../lib/profile";
import { sfx } from "../lib/sound";
import {
  adminKey,
  contentOf,
  GIFT_PACKS,
  type GiftContent,
  type GiftPack,
  MAX_GIFT_COINS,
  MAX_GIFT_PACKS,
  sendGift,
  giftEvent,
  giftOf,
} from "../net/gifts";
import { onRoster, type OnlinePlayer } from "../net/match";
import { NET_ON } from "../net/nostr";
import { packDefs } from "../ut/packs";
import { Sheet } from "./common";

/** the admin's key, kept for the rest of the visit */
const KEY = "ps-admin";
/** wrong tries in a row before a wait, and the wait */
const TRIES = 5;
const WAIT_MS = 30000;
const MAX_COINS = 99_999_999;

const hex = (b: Uint8Array) =>
  Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (h: string) =>
  new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));

function savedKey(): Uint8Array | null {
  try {
    const h = sessionStorage.getItem(KEY);
    return h && /^[0-9a-f]{64}$/.test(h) ? unhex(h) : null;
  } catch {
    return null;
  }
}

function remember(sk: Uint8Array | null) {
  try {
    if (sk) sessionStorage.setItem(KEY, hex(sk));
    else sessionStorage.removeItem(KEY);
  } catch {
    // no storage: unlocked until the sheet closes
  }
}

let fails = 0;
let waitUntil = 0;

const PACK_NAME: Record<GiftPack, string> = {
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

type To = "me" | "pick" | "random" | "all";

export function AdminSheet({
  profile,
  update,
  onToast,
  onClose,
}: {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  onToast: (t: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState("overview");
  const [sk, setSk] = useState(savedKey);
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [checking, setChecking] = useState(false);
  const [coins, setCoins] = useState("");
  const secure = typeof crypto !== "undefined" && !!crypto.subtle;

  const tryUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (checking) return;
    if (Date.now() < waitUntil)
      return setMsg("Too many tries. Wait a few seconds.");
    setChecking(true);
    const key = await adminKey(pw).catch(() => null);
    setChecking(false);
    if (!key) {
      sfx.nope();
      setPw("");
      if (++fails >= TRIES) {
        fails = 0;
        waitUntil = Date.now() + WAIT_MS;
        return setMsg("Too many tries. Wait 30 seconds.");
      }
      return setMsg("Wrong password.");
    }
    fails = 0;
    sfx.select();
    remember(key);
    setSk(key);
    setMsg("");
  };

  /** Make a change and say what it did. */
  const act = (text: string, fn: (p: Profile) => Profile) => {
    sfx.coin();
    update(fn);
    onToast(text);
  };
  const amount = () => {
    const n = Math.floor(Number(coins));
    return coins.trim() !== "" && Number.isFinite(n)
      ? Math.max(0, Math.min(MAX_COINS, n))
      : null;
  };
  const addCoins = (n: number) =>
    act("+" + n.toLocaleString("en-US") + " coins", (p) => ({
      ...p,
      coins: Math.min(MAX_COINS, p.coins + n),
    }));
  const lv = levelInfo(profile.xp);
  // (a position pack is bought for a position: not one to hand out blind)
  const packs = Object.values(packDefs(SPORT)).filter(
    (d) => d.kind !== "position",
  );
  const pending = profile.ut.packs.length;

  return (
    <Sheet label="Admin" onClose={onClose}>
      {(close) =>
        !sk ? (
          <form className="admin" onSubmit={tryUnlock}>
            <h2 className="disp">Admin</h2>
            {secure ? (
              <>
                <label className="admin-pw">
                  <span className="eyebrow">Password</span>
                  <input
                    type="password"
                    value={pw}
                    onChange={(e) => (setPw(e.target.value), setMsg(""))}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    autoFocus
                  />
                </label>
                {msg && <p className="admin-msg">{msg}</p>}
                <div className="btnrow">
                  <button type="button" className="btn" onClick={() => close()}>
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={!pw || checking}
                  >
                    {checking ? "CHECKING…" : "UNLOCK"}
                  </button>
                </div>
              </>
            ) : (
              <p className="note">
                The admin panel needs the game’s secure (https) address.
              </p>
            )}
          </form>
        ) : (
          <div className="admin">
            <div className="adm-top">
              <h2 className="disp">CONTROL ROOM</h2>
              <span>{SPORT_NAME[SPORT]}</span>
            </div>
            <div className="admin-nav" role="group" aria-label="Admin sections">
              {["overview", "packs", "players", "local"].map((t) => (
                <button
                  key={t}
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                >
                  {
                    (
                      {
                        overview: "HOME",
                        packs: "PACKS",
                        players: "PLAYERS",
                        local: "CLUB",
                      } as Record<string, string>
                    )[t]
                  }
                </button>
              ))}
            </div>
            {tab === "overview" && (
              <AdminHome profile={profile} onGo={setTab} />
            )}
            {tab === "packs" && <PackStudio sk={sk} onToast={onToast} />}
            {tab === "local" && (
              <ProgressEditor
                profile={profile}
                update={update}
                onToast={onToast}
              />
            )}
            {tab === "local" && (
              <>
                <section className="admin-sec">
                  <span className="eyebrow">
                    Your coins · {profile.coins.toLocaleString("en-US")}
                  </span>
                  <div className="admin-row">
                    {[1000, 10000, 100000].map((n) => (
                      <button
                        key={n}
                        className="btn"
                        onClick={() => addCoins(n)}
                      >
                        +{n.toLocaleString("en-US")}
                      </button>
                    ))}
                  </div>
                  <form
                    className="admin-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = amount();
                      if (n === null) return;
                      addCoins(n);
                      setCoins("");
                    }}
                  >
                    <input
                      className="admin-num"
                      inputMode="numeric"
                      placeholder="Any amount"
                      value={coins}
                      onChange={(e) =>
                        setCoins(
                          e.target.value.replace(/[^\d]/g, "").slice(0, 8),
                        )
                      }
                      aria-label="Coins"
                    />
                    <button type="submit" className="btn" disabled={!coins}>
                      ADD
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!coins}
                      onClick={() => {
                        const n = amount();
                        if (n === null) return;
                        act(
                          "Coins set to " + n.toLocaleString("en-US"),
                          (p) => ({ ...p, coins: n }),
                        );
                        setCoins("");
                      }}
                    >
                      SET
                    </button>
                  </form>
                </section>

                <section className="admin-sec">
                  <span className="eyebrow">
                    Level {lv.level} · {profile.xp.toLocaleString("en-US")} XP
                  </span>
                  <div className="admin-row">
                    <button
                      className="btn"
                      onClick={() =>
                        act("Level " + (lv.level + 1), (p) => ({
                          ...p,
                          xp: p.xp + (lv.need - lv.into),
                        }))
                      }
                    >
                      +1 LEVEL
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        act("+1,000 XP", (p) => ({ ...p, xp: p.xp + 1000 }))
                      }
                    >
                      +1,000 XP
                    </button>
                  </div>
                </section>

                <section className="admin-sec">
                  <span className="eyebrow">
                    Boosters ·{" "}
                    {BOOSTERS.map(
                      (b) => BOOSTER_NAMES[b] + " " + profile.inventory[b],
                    ).join(" · ")}
                  </span>
                  <div className="admin-row">
                    <button
                      className="btn"
                      onClick={() =>
                        act("+5 of every booster", (p) => ({
                          ...p,
                          inventory: Object.fromEntries(
                            BOOSTERS.map((b) => [b, (p.inventory[b] ?? 0) + 5]),
                          ) as Profile["inventory"],
                        }))
                      }
                    >
                      +5 OF EACH
                    </button>
                  </div>
                </section>

                <section className="admin-sec">
                  <span className="eyebrow">
                    Your Ultimate Team ({SPORT_NAME[SPORT]}) · {pending}{" "}
                    {pending === 1 ? "pack" : "packs"} waiting in the Store
                  </span>
                  <div className="admin-row">
                    {packs.map((d) => (
                      <button
                        key={d.kind}
                        className="btn"
                        onClick={() =>
                          act(
                            "A " + d.name + " is waiting in the Store",
                            (p) => ({
                              ...p,
                              ut: {
                                ...p.ut,
                                packs: [
                                  ...p.ut.packs,
                                  {
                                    id: newId(),
                                    kind: snapshotPack(SPORT, d.kind),
                                    at: Date.now(),
                                  },
                                ],
                              },
                            }),
                          )
                        }
                      >
                        +{d.name.replace(/ Pack$/, "").toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="admin-row">
                    {(
                      [
                        "icon",
                        ...(SPORT !== "soccer" ? ["goat"] : []),
                      ] as GiftPack[]
                    ).map((kind) => (
                      <button
                        className="btn gold"
                        key={kind}
                        onClick={() => {
                          const g = giftOf(
                            giftEvent(
                              sk,
                              [myPubkey()],
                              { coins: 0, packs: { [kind]: 1 }, note: "" },
                              newId(),
                            ),
                          );
                          if (g)
                            act(PACK_NAME[kind] + " pack added", (p) =>
                              withGift(p, g, g.id),
                            );
                          else onToast("Unlock the owner account first.");
                        }}
                      >
                        +{PACK_NAME[kind].toUpperCase()} PACK
                      </button>
                    ))}
                  </div>
                  <div className="admin-row">
                    <button
                      className="btn"
                      onClick={() =>
                        act("Today’s paid games reset", (p) => ({
                          ...p,
                          ut: { ...p.ut, paid: { day: "", n: 0 } },
                        }))
                      }
                    >
                      RESET PAID GAMES
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        act("Every challenge can be done again", (p) => ({
                          ...p,
                          ut: { ...p.ut, sbc: { done: {} } },
                        }))
                      }
                    >
                      REDO CHALLENGES
                    </button>
                  </div>
                  <div className="admin-row">
                    <button
                      className="btn"
                      onClick={() =>
                        act("Squad Battles back to rung 1", (p) => ({
                          ...p,
                          ut: {
                            ...p.ut,
                            battles: { ...p.ut.battles, cleared: 0, round: 0 },
                          },
                        }))
                      }
                    >
                      RESTART LADDER
                    </button>
                  </div>
                </section>

                <section className="admin-sec">
                  <span className="eyebrow">Today</span>
                  <div className="admin-row">
                    <button
                      className="btn"
                      onClick={() =>
                        act("The Daily can be played again", (p) => ({
                          ...p,
                          daily: null,
                        }))
                      }
                    >
                      REPLAY DAILY
                    </button>
                    <button
                      className="btn"
                      onClick={() =>
                        act("Missions reset", (p) => ({ ...p, missions: null }))
                      }
                    >
                      RESET MISSIONS
                    </button>
                  </div>
                  <div className="admin-row">
                    <button
                      className="btn"
                      onClick={() =>
                        act("The daily reward can be opened again", (p) => ({
                          ...p,
                          rewardDay: null,
                        }))
                      }
                    >
                      DAILY REWARD AGAIN
                    </button>
                  </div>
                </section>
              </>
            )}
            {tab === "players" && (
              <GiftComposer
                sk={sk}
                onSelf={(g) =>
                  act("Gift added: " + giftText(g), (p) => withGift(p, g))
                }
                onToast={onToast}
              />
            )}
            <div className="btnrow">
              <button
                className="btn"
                onClick={() => {
                  remember(null);
                  setSk(null);
                  setPw("");
                }}
              >
                LOCK
              </button>
              <button className="btn primary" onClick={() => close()}>
                DONE
              </button>
            </div>
          </div>
        )
      }
    </Sheet>
  );
}

/** Coins and packs for yourself, players you pick, a few online at random, or everyone. */
function GiftComposer({
  sk,
  onSelf,
  onToast,
}: {
  sk: Uint8Array;
  onSelf: (g: GiftContent) => void;
  onToast: (t: string) => void;
}) {
  const [search, setSearch] = useState(""),
    [recipient, setRecipient] = useState("");
  const [coins, setCoins] = useState("");
  const [packs, setPacks] = useState<Record<GiftPack, number>>(
    () =>
      Object.fromEntries(GIFT_PACKS.map((k) => [k, 0])) as Record<
        GiftPack,
        number
      >,
  );
  const [xp, setXp] = useState(""),
    [cardXp, setCardXp] = useState(""),
    [boosterRewards, setBoosterRewards] = useState<
      Partial<Record<(typeof BOOSTERS)[number], number>>
    >({}),
    [player, setPlayer] = useState<GiftContent["player"]>(),
    [goatCardId, setGoatCardId] = useState<string>(),
    [presetName, setPresetName] = useState(""),
    [presets, setPresets] = useState(rewardPresets),
    [history, setHistory] = useState(actionHistory);
  const [note, setNote] = useState("");
  const [to, setTo] = useState<To>(NET_ON ? "pick" : "me");
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [howMany, setHowMany] = useState(3);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  useEffect(
    () =>
      NET_ON ? onRoster((r) => setOnline(r.filter((o) => !o.me))) : undefined,
    [],
  );

  const gift = contentOf({
    coins: Number(coins) || 0,
    packs,
    note,
    xp: Number(xp),
    cardXp: Number(cardXp),
    boosters: boosterRewards,
    player,
    goatCardId,
  });
  const pickedNow = online.filter((o) => picked.has(o.pubkey));
  const n = Math.min(howMany, online.length);
  const manual = /^[a-f0-9]{64}$/i.test(recipient.trim())
    ? recipient.trim().toLowerCase()
    : null;
  const count =
    to === "me"
      ? 1
      : to === "pick"
        ? new Set([
            ...pickedNow.map((p) => p.pubkey),
            ...(manual ? [manual] : []),
          ]).size
        : to === "random"
          ? n
          : 0;
  const ready = !!gift && !busy && (to === "all" || to === "me" || count > 0);
  const label = busy
    ? "SENDING…"
    : to === "me"
      ? "GIVE TO ME"
      : to === "all"
        ? "SEND TO EVERYONE"
        : "SEND TO " + count + (count === 1 ? " PLAYER" : " PLAYERS");

  const send = async () => {
    if (!gift || !ready) return;
    if (to === "me") {
      if (gift.packs.goat) {
        const signed = giftOf(giftEvent(sk, [myPubkey()], gift, newId()));
        if (!signed)
          return onToast("Unlock the owner account to issue a GOAT pack.");
        setHistory(rememberAction(giftText(gift), "Me"));
        return onSelf(signed);
      }
      setHistory(rememberAction(giftText(gift), "Me"));
      return onSelf(gift);
    }
    const chosen =
      to === "pick"
        ? pickedNow
        : to === "random"
          ? shuffle(online, trueRand()).slice(0, n)
          : [];
    setBusy(true);
    const ok = await sendGift(
      sk,
      to === "all"
        ? "all"
        : [
            ...new Set([
              ...chosen.map((o) => o.pubkey),
              ...(to === "pick" && manual ? [manual] : []),
            ]),
          ],
      gift,
    ).catch(() => 0);
    setBusy(false);
    if (!ok) {
      sfx.nope();
      onToast("Couldn’t reach the network. Try again.");
      return;
    }
    sfx.coin();
    const who =
      to === "all"
        ? "everyone"
        : [
            ...chosen.map((o) => o.name),
            ...(to === "pick" && manual ? [manual.slice(0, 12) + "…"] : []),
          ].join(", ");
    onToast(
      "Gift sent to " +
        (to === "all"
          ? "everyone"
          : count + (count === 1 ? " player" : " players")),
    );
    setLog((l) => [giftText(gift) + " → " + who, ...l].slice(0, 6));
    setHistory(rememberAction(giftText(gift), who));
    setPicked(new Set());
  };

  const step = (k: GiftPack, d: number) =>
    setPacks((p) => ({
      ...p,
      [k]: Math.max(0, Math.min(MAX_GIFT_PACKS, p[k] + d)),
    }));
  return (
    <section className="admin-sec admin-gift">
      <span className="eyebrow">PLAYER REWARDS</span>
      <span className="seg admin-to" role="group" aria-label="Send to">
        {(NET_ON
          ? (["me", "pick", "random", "all"] as To[])
          : (["me"] as To[])
        ).map((k) => (
          <button
            key={k}
            className={to === k ? "on" : ""}
            aria-pressed={to === k}
            onClick={() => setTo(k)}
          >
            {k === "me"
              ? "ME"
              : k === "pick"
                ? "PICK"
                : k === "random"
                  ? "RANDOM"
                  : "EVERYONE"}
          </button>
        ))}
      </span>
      {to === "pick" && (
        <div className="admin-studio">
          <label>
            Find online player
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or public key"
            />
          </label>
          <label>
            Offline player public key
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="64-character public key"
              maxLength={64}
            />
          </label>
          {recipient && !manual && (
            <p>Enter the full 64-character hexadecimal public key.</p>
          )}
        </div>
      )}
      {to === "pick" &&
        (online.length ? (
          <div className="admin-online">
            {online
              .filter((o) =>
                (o.name + " " + o.pubkey)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )
              .map((o) => (
                <button
                  key={o.pubkey}
                  className={
                    "admin-player" + (picked.has(o.pubkey) ? " on" : "")
                  }
                  aria-pressed={picked.has(o.pubkey)}
                  onClick={() =>
                    setPicked((s) => {
                      const next = new Set(s);
                      if (next.has(o.pubkey)) next.delete(o.pubkey);
                      else next.add(o.pubkey);
                      return next;
                    })
                  }
                >
                  <b>{o.name}</b>
                  <small>
                    {pickFor(o.sport, {
                      nba: "Basketball",
                      nfl: "Football",
                      soccer: "Soccer",
                    })}{" "}
                    ·{" "}
                    {o.st === "match"
                      ? "in a match"
                      : o.st === "queue"
                        ? "searching"
                        : "in the menus"}
                  </small>
                </button>
              ))}
          </div>
        ) : (
          <p className="note">
            Nobody else is online right now. EVERYONE reaches players the next
            time they open the game.
          </p>
        ))}
      {to === "random" && (
        <div className="admin-row admin-random">
          <button
            className="chip"
            onClick={() => setHowMany((h) => Math.max(1, h - 1))}
            aria-label="Fewer"
          >
            −
          </button>
          <b className="num">{n}</b>
          <button
            className="chip"
            onClick={() =>
              setHowMany((h) => Math.min(Math.max(1, online.length), h + 1))
            }
            aria-label="More"
          >
            +
          </button>
          <span className="note">
            of {online.length} online now, picked at random
          </span>
        </div>
      )}
      {to === "all" && (
        <p className="note">
          Every player who opens the game in the next two weeks gets it, once.
        </p>
      )}
      {to === "pick" && (pickedNow.length > 0 || manual) && (
        <p className="admin-sends">
          Recipients:{" "}
          {[
            ...pickedNow.map((p) => p.name),
            ...(manual ? [manual.slice(0, 12) + "…"] : []),
          ].join(", ")}
        </p>
      )}

      <div className="adm-presets">
        {[
          ...BUILTIN_REWARDS,
          ...(SPORT !== "soccer"
            ? [
                {
                  name: "GOAT Bundle",
                  gift: {
                    coins: 5000,
                    packs: { goat: 1, icon: 1 },
                    note: "An all-time reward.",
                  },
                },
              ]
            : []),
          ...presets,
        ].map((r, i) => (
          <button
            key={i}
            onClick={() => {
              const g = contentOf(r.gift);
              if (!g) return;
              setCoins(String(g.coins || ""));
              setPacks(
                Object.fromEntries(
                  GIFT_PACKS.map((k) => [k, g.packs[k] ?? 0]),
                ) as Record<GiftPack, number>,
              );
              setXp(String(g.xp ?? ""));
              setCardXp(String(g.cardXp ?? ""));
              setBoosterRewards(g.boosters ?? {});
              setNote(g.note);
              setPlayer(g.player);
              setGoatCardId(g.goatCardId);
            }}
          >
            {r.name}
          </button>
        ))}
      </div>
      <details className="adm-details">
        <summary>
          XP & boosters <span>EDIT</span>
        </summary>
        <div className="admin-studio">
          <label>
            Account XP
            <input
              aria-label="Gift account XP"
              type="number"
              min={0}
              max={100000}
              value={xp}
              onChange={(e) => setXp(e.target.value)}
            />
          </label>
          <label>
            XP for each equipped card
            <input
              aria-label="Gift squad card XP"
              type="number"
              min={0}
              max={700}
              value={cardXp}
              onChange={(e) => setCardXp(e.target.value)}
            />
          </label>
          <p>
            Training applies to the recipient’s equipped squad, up to the
            existing level cap.
          </p>
          <div className="admin-recipe">
            {BOOSTERS.map((b) => (
              <label key={b}>
                {BOOSTER_NAMES[b]} boosters
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={boosterRewards[b] ?? 0}
                  onChange={(e) =>
                    setBoosterRewards((v) => ({
                      ...v,
                      [b]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      </details>
      <details className="adm-details">
        <summary>
          Choose a specific player <span>SEARCH</span>
        </summary>
        <AdminPlayerPicker
          onSelect={(c) => {
            if (c.tier === "goat") {
              setGoatCardId(c.line.id);
              setPacks((p) => ({ ...p, goat: Math.max(1, p.goat) }));
              setPlayer(undefined);
            } else {
              setPlayer({ cardId: c.line.id, name: c.line.name, count: 1 });
              setGoatCardId(undefined);
            }
            onToast(c.line.name + " selected.");
          }}
        />
        {player && (
          <div className="admin-studio">
            <p>Selected: {player.name}</p>
            <label>
              Copies to give
              <input
                aria-label="Player reward copies"
                type="number"
                min={1}
                max={50}
                value={player.count}
                onChange={(e) =>
                  setPlayer((p) =>
                    p ? { ...p, count: Number(e.target.value) } : undefined,
                  )
                }
              />
            </label>
            <button className="btn" onClick={() => setPlayer(undefined)}>
              CLEAR PLAYER
            </button>
          </div>
        )}
        {goatCardId && (
          <p className="adm-note">
            A specific GOAT edition is selected. The GOAT packs will award that
            edition, each with its own registry serial.
            <button
              className="adm-quiet"
              onClick={() => setGoatCardId(undefined)}
            >
              CLEAR GOAT SELECTION
            </button>
          </p>
        )}
      </details>
      <details className="adm-details">
        <summary>
          Save a reward preset <span>SAVE</span>
        </summary>
        <div className="admin-studio">
          <label>
            Preset name
            <input
              value={presetName}
              maxLength={28}
              onChange={(e) => setPresetName(e.target.value)}
            />
          </label>
          <button
            className="btn"
            disabled={!gift || !presetName.trim()}
            onClick={() => {
              if (gift) {
                setPresets(saveRewardPreset(presetName, gift));
                setPresetName("");
                onToast("Reward preset saved.");
              }
            }}
          >
            SAVE CURRENT REWARDS
          </button>
        </div>
      </details>
      <button
        className="adm-quiet"
        onClick={() => {
          setCoins("");
          setPacks(
            Object.fromEntries(GIFT_PACKS.map((k) => [k, 0])) as Record<
              GiftPack,
              number
            >,
          );
          setXp("");
          setCardXp("");
          setBoosterRewards({});
          setPlayer(undefined);
          setGoatCardId(undefined);
          setNote("");
        }}
      >
        CLEAR REWARDS
      </button>
      <input
        className="admin-num"
        inputMode="numeric"
        placeholder="Coins (any amount)"
        value={coins}
        onChange={(e) =>
          setCoins(
            String(
              Math.min(
                MAX_GIFT_COINS,
                Number(e.target.value.replace(/[^\d]/g, "").slice(0, 8)) || 0,
              ) || "",
            ),
          )
        }
        aria-label="Gift coins"
      />
      {[
        {
          title: "Special packs",
          kinds: ["goat", "icon", "squad", "iconteam"],
        },
        {
          title: "Club Collection packs",
          kinds: ["roster", "captains", "dynasty"],
        },
        {
          title: "Classic & premium packs",
          kinds: [
            "bronze",
            "silver",
            "gold",
            "premium",
            "elite",
            "jumbo",
            "standout",
          ],
        },
      ].map((group, i) => (
        <details
          className="adm-details adm-pack-group"
          key={group.title}
          open={i === 0 || undefined}
        >
          <summary>
            {group.title}
            <span>
              {group.kinds.reduce((sum, k) => sum + packs[k as GiftPack], 0) ||
                "ADD"}
            </span>
          </summary>
          <div className="admin-packs">
            {(group.kinds as GiftPack[])
              .filter((k) => k !== "goat" || SPORT !== "soccer")
              .map((k) => (
                <span key={k} className="admin-pack">
                  <b>{PACK_NAME[k]}</b>
                  <button
                    className="chip"
                    onClick={() => step(k, -1)}
                    aria-label={"One less " + PACK_NAME[k] + " pack"}
                    disabled={!packs[k]}
                  >
                    −
                  </button>
                  <i className="num">{packs[k]}</i>
                  <button
                    className="chip"
                    onClick={() => step(k, 1)}
                    aria-label={"One more " + PACK_NAME[k] + " pack"}
                  >
                    +
                  </button>
                </span>
              ))}
          </div>
        </details>
      ))}
      <input
        className="admin-num"
        placeholder="A note with it (optional)"
        maxLength={140}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        aria-label="Note"
      />

      {gift && (
        <p className="admin-sends">
          Sends {giftText(gift)}
          {gift.note ? ", with your note" : ""}.
        </p>
      )}
      <button className="btn gold" disabled={!ready} onClick={send}>
        {label}
      </button>
      <details className="adm-details">
        <summary>
          Gift history <span>{history.length}</span>
        </summary>
        {history.length ? (
          history.map((h) => (
            <p className="adm-note" key={h.id}>
              <b>{h.who}</b> · {new Date(h.at).toLocaleString()}
              <br />
              {h.summary}
            </p>
          ))
        ) : (
          <p className="adm-note">
            Your recent gifts will appear here. Sent means accepted by the
            relays, not a confirmed player claim.
          </p>
        )}
      </details>
      {log.length > 0 && (
        <div className="admin-log">
          {log.map((l, i) => (
            <small key={i}>{l}</small>
          ))}
        </div>
      )}
    </section>
  );
}
