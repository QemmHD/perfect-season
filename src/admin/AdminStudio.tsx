import { PackArt } from "../ut/PackArt";
import { IconClub, IconStore, IconSquad } from "../ut/icons";
import { Coin } from "../ui/icons";
// Codex (OpenAI): owner tools use the existing identity, gifts and exact owned-copy IDs.
import React, { useState } from "react";
import { SPORT, SPORT_NAME } from "../engine/sport";
import type { Profile } from "../lib/profile";
import {
  catalogOf,
  checkedCatalog,
  defaultCatalog,
  STUDIO_PACKS,
  STUDIO_TIERS,
  type Catalog,
  type StudioKind,
  useCatalog,
} from "./catalog";
import { publishCatalog } from "./catalog-net";
import { getPool } from "../ut/pool";
import "./admin-studio.css";
export function AdminHome({
  profile,
  onGo,
}: {
  profile: Profile;
  onGo: (tab: string) => void;
}) {
  return (
    <div className="adm-home">
      <div className="adm-hero">
        <span className="eyebrow">PERFECT SEASON · OWNER ACCESS</span>
        <h3 className="disp">
          ADMIN
          <br />
          TOOLS.
        </h3>
        <div className="adm-fan" aria-hidden="true">
          <PackArt kind="gold" label="CAPTAINS" sport={SPORT} />
          <PackArt kind="premium" label="DYNASTY" sport={SPORT} />
        </div>
      </div>
      <div className="adm-balance">
        <span>
          <Coin size={17} />
          <b className="num">{profile.coins.toLocaleString()}</b>
        </span>
        <small>
          {profile.ut.owned.length} CARDS · {profile.ut.packs.length} PACKS
          WAITING
        </small>
      </div>
      {[
        {
          tab: "players",
          title: "Send Gifts",
          sub: "Give packs, cards, coins and boosts.",
          Icon: IconSquad,
        },
        {
          tab: "packs",
          title: "Store Packs",
          sub: "Edit pack contents, prices and availability.",
          Icon: IconStore,
        },
        {
          tab: "local",
          title: "My Account",
          sub: "Your balance, cards and replay tools.",
          Icon: IconClub,
        },
      ].map(({ tab, title, sub, Icon }) => (
        <button key={tab} className="adm-launch" onClick={() => onGo(tab)}>
          <Icon size={25} />
          <span>
            <b className="disp">{title}</b>
            <small>{sub}</small>
          </span>
          <span className="adm-arrow" aria-hidden="true">
            →
          </span>
        </button>
      ))}
    </div>
  );
}
export function PackStudio({
  sk,
  onToast,
}: {
  sk: Uint8Array;
  onToast: (s: string) => void;
}) {
  useCatalog();
  const [draft, setDraft] = useState<Catalog>(() =>
      structuredClone(catalogOf(SPORT)),
    ),
    [kind, setKind] = useState<StudioKind>("captains"),
    [editing, setEditing] = useState(false),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const p = draft[kind],
    valid = checkedCatalog(draft),
    total = Object.values(p.counts).reduce((a, b) => a + b, 0),
    edit = (fn: (c: Catalog) => void) =>
      setDraft((c) => {
        const next = structuredClone(c);
        fn(next);
        return next;
      });
  const publish = async () => {
    if (busy || !valid) return;
    setBusy(true);
    setMessage("");
    try {
      await publishCatalog(sk, SPORT, valid);
      setMessage("Store updated. Connected players will receive the changes.");
      onToast("Store catalog published.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not publish.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="adm-packs">
      <div className="adm-heading">
        <span className="eyebrow">{SPORT_NAME[SPORT]} · PACK STUDIO</span>
        <h3 className="disp">
          {review
            ? "REVIEW STORE PACKS"
            : editing
              ? "EDIT PACK"
              : "STORE PACKS"}
        </h3>
      </div>
      {review ? (
        <>
          <p className="adm-note">
            Review all three packs before updating the store.
          </p>
          <div className="adm-review-list">
            {STUDIO_PACKS.map((k) => (
              <div key={k}>
                <PackArt kind={k} label={k.toUpperCase()} sport={SPORT} small />
                <span>
                  <b>{draft[k].name}</b>
                  <small>
                    {draft[k].price.toLocaleString()} coins ·{" "}
                    {draft[k].enabled ? "Available" : "Hidden"}
                  </small>
                  <small>
                    {STUDIO_TIERS.filter((t) => draft[k].counts[t])
                      .map((t) => draft[k].counts[t] + " " + t)
                      .join(" · ")}
                  </small>
                </span>
              </div>
            ))}
          </div>
          <button
            className="btn gold"
            disabled={!valid || busy}
            onClick={publish}
          >
            {busy ? "PUBLISHING…" : "PUBLISH STORE UPDATE"}
          </button>
          <button
            className="btn"
            disabled={busy}
            onClick={() => setReview(false)}
          >
            BACK TO EDITING
          </button>
        </>
      ) : !editing ? (
        <>
          <div className="adm-pack-deck">
            {STUDIO_PACKS.map((k) => (
              <button
                key={k}
                onClick={() => {
                  setKind(k);
                  setEditing(true);
                }}
              >
                <PackArt kind={k} label={k.toUpperCase()} sport={SPORT} />
                <b>{draft[k].name}</b>
                <small>
                  <Coin size={11} />
                  {draft[k].price.toLocaleString()}
                </small>
                <span>EDIT PACK</span>
              </button>
            ))}
          </div>
          <p className="adm-note">
            Choose a pack to edit its contents, price and availability.
          </p>
          <button
            className="btn gold"
            disabled={!valid}
            onClick={() => setReview(true)}
          >
            REVIEW STORE UPDATE
          </button>
          <button
            className="adm-quiet"
            onClick={() => setDraft(structuredClone(catalogOf(SPORT)))}
          >
            Reload published packs
          </button>
        </>
      ) : (
        <>
          <button
            className="adm-quiet adm-back"
            onClick={() => setEditing(false)}
          >
            ← ALL PACKS
          </button>
          <div className="adm-pack-hero">
            <PackArt kind={kind} label={kind.toUpperCase()} sport={SPORT} />
            <span>
              <b className="disp">{p.name}</b>
              <small>
                <Coin size={14} />
                {p.price.toLocaleString()} · {total} CARDS
              </small>
              <button
                className={"adm-status" + (p.enabled ? " on" : "")}
                aria-pressed={p.enabled}
                onClick={() =>
                  edit((c) => {
                    c[kind].enabled = !p.enabled;
                  })
                }
              >
                {p.enabled ? "AVAILABLE" : "HIDDEN"}
              </button>
            </span>
          </div>
          <details className="adm-details">
            <summary>
              Pack details <span>EDIT</span>
            </summary>
            <div className="admin-studio">
              <label>
                Pack name
                <input
                  value={p.name}
                  maxLength={32}
                  onChange={(e) =>
                    edit((c) => {
                      c[kind].name = e.target.value;
                    })
                  }
                />
              </label>
              <label>
                Coin price
                <input
                  type="number"
                  min={500}
                  max={100000}
                  value={p.price}
                  onChange={(e) =>
                    edit((c) => {
                      c[kind].price = Number(e.target.value);
                    })
                  }
                />
              </label>
            </div>
          </details>
          <div className="adm-contents">
            <span className="eyebrow">
              GUARANTEED CONTENTS <b className="num">{total} / 40</b>
            </span>
            {STUDIO_TIERS.map((t) => (
              <div className={"adm-tier t-" + t} key={t}>
                <i />
                <b>
                  {t === "rare"
                    ? "Rare Gold"
                    : t === "standout"
                      ? "Weekly Standout"
                      : t === "gold"
                        ? "Gold"
                        : "Silver"}
                </b>
                <button
                  aria-label={"Remove " + t + " card"}
                  disabled={!p.counts[t]}
                  onClick={() =>
                    edit((c) => {
                      c[kind].counts[t]--;
                    })
                  }
                >
                  −
                </button>
                <span className="num">{p.counts[t]}</span>
                <button
                  aria-label={"Add " + t + " card"}
                  disabled={p.counts[t] >= 20 || total >= 40}
                  onClick={() =>
                    edit((c) => {
                      c[kind].counts[t]++;
                    })
                  }
                >
                  +
                </button>
              </div>
            ))}
          </div>
          <p className="adm-note">
            Already-owned packs keep their contents. GOAT and Spotlight odds
            stay on their existing packs.
          </p>
          <button
            className="btn gold"
            disabled={!valid}
            onClick={() => setReview(true)}
          >
            REVIEW STORE UPDATE
          </button>
          <button
            className="adm-quiet"
            onClick={() => setDraft(defaultCatalog(SPORT))}
          >
            Reset draft to defaults
          </button>
        </>
      )}
      {!valid && (
        <p className="adm-error" role="alert">
          Use a name, 500–100,000 coins and 1–40 cards per pack.
        </p>
      )}
      <p className="adm-note" role="status">
        {message}
      </p>
    </section>
  );
}
export function ProgressEditor({
  profile,
  update,
  onToast,
}: {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  onToast: (s: string) => void;
}) {
  const [query, setQuery] = useState(""),
    [names, setNames] = useState<Record<string, string>>({}),
    [uid, setUid] = useState(""),
    [level, setLevel] = useState(1);
  React.useEffect(() => {
    let live = true;
    void getPool().then((pool) => {
      if (live)
        setNames(
          Object.fromEntries(
            profile.ut.owned.map((c) => [
              c.uid,
              pool.byId.get(c.cardId)?.name ?? c.cardId,
            ]),
          ),
        );
    });
    return () => {
      live = false;
    };
  }, [profile.ut.owned]);
  const cards = profile.ut.owned
      .filter((c) =>
        (names[c.uid] ?? c.cardId).toLowerCase().includes(query.toLowerCase()),
      )
      .slice(0, 100),
    card = profile.ut.owned.find((c) => c.uid === uid);
  return (
    <section className="admin-sec admin-studio">
      <span className="eyebrow">YOUR CLUB · EXACT-COPY EDITOR</span>
      <p>
        Only your current sport’s club changes. Card identity, serial number and
        every other copy are retained.
      </p>
      <label>
        Search your cards
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setUid("");
          }}
          placeholder="Player name"
        />
      </label>
      <label>
        Owned copy
        <select
          aria-label="Owned copy"
          value={uid}
          onChange={(e) => {
            setUid(e.target.value);
            setLevel(
              profile.ut.owned.find((c) => c.uid === e.target.value)?.level ??
                1,
            );
          }}
        >
          <option value="">Choose a card</option>
          {cards.map((c) => (
            <option key={c.uid} value={c.uid}>
              {names[c.uid] ?? c.cardId} · LV {c.level} · {c.uid.slice(-6)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Card level
        <select
          aria-label="Card level"
          value={level}
          onChange={(e) => setLevel(Number(e.target.value))}
        >
          {[1, 2, 3, 4, 5].map((l) => (
            <option key={l} value={l}>
              Level {l}
            </option>
          ))}
        </select>
      </label>
      {card && (
        <p>
          Current: level {card.level}, {card.xp} XP
          {card.mint ? " · Serial #" + card.mint.serial : ""}. Setting a level
          starts that level at 0 XP.
        </p>
      )}
      <button
        className="btn"
        disabled={!card}
        onClick={() => {
          update((p) => ({
            ...p,
            ut: {
              ...p.ut,
              owned: p.ut.owned.map((c) =>
                c.uid === uid ? { ...c, level, xp: 0 } : c,
              ),
            },
          }));
          onToast("Selected card level updated.");
        }}
      >
        APPLY TO THIS COPY
      </button>
    </section>
  );
}
