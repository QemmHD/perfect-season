// Codex: choose the exact canonical player edition; GOATs remain registry-backed admin awards.
import React, { useEffect, useMemo, useState } from "react";
import { getPool, type Pool } from "../ut/pool";
import { UtCard } from "../ut/CardArt";
import type { RatedCard } from "../ut/types";
export function AdminPlayerPicker({
  onSelect,
}: {
  onSelect: (card: RatedCard) => void;
}) {
  const [pool, setPool] = useState<Pool | null>(null),
    [query, setQuery] = useState(""),
    [tier, setTier] = useState("all");
  useEffect(() => {
    let live = true;
    void getPool().then((p) => {
      if (live) setPool(p);
    });
    return () => {
      live = false;
    };
  }, []);
  const cards = useMemo(
    () =>
      pool
        ? [...pool.base.values()]
            .filter(
              (c) =>
                /^(nba|nfl|soccer):(season|promo|legend|standout|landmark|goat):/.test(
                  c.line.id,
                ) &&
                (tier === "all" || c.tier === tier) &&
                c.line.name.toLowerCase().includes(query.toLowerCase()),
            )
            .sort((a, b) => b.ovr - a.ovr)
            .slice(0, 12)
        : [],
    [pool, query, tier],
  );
  return (
    <div className="admin-studio">
      <label>
        Find a player
        <input
          value={query}
          placeholder="LeBron, Jordan, Messi…"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label>
        Card edition
        <select
          aria-label="Reward card tier"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
        >
          {["all", "gold", "legend", "goat", "standout", "promo"].map((t) => (
            <option value={t} key={t}>
              {t === "all"
                ? "All editions"
                : t === "legend"
                  ? "Icons / Legends"
                  : t.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <div className="adm-player-results">
        {cards.map((c) => (
          <button key={c.line.id} onClick={() => onSelect(c)}>
            <UtCard rc={c} w={55} />
            <span>
              <b>{c.line.name}</b>
              <small>
                {c.line.season} · {c.line.abbr} · {c.line.pos.join(" / ")}
              </small>
              <small>
                {c.ovr} OVR ·{" "}
                {c.tier === "goat" ? "Registered GOAT award" : c.tier}
              </small>
            </span>
          </button>
        ))}
      </div>
      {!cards.length && (
        <p>{pool ? "No matching editions." : "Loading player editions…"}</p>
      )}
    </div>
  );
}
