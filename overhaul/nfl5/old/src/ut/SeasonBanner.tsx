// Claude, 2026-11-01 (wave 3): Home's "This Season" banner and "Coming next" teaser, from the Live
// Calendar. Season name, tagline, days left and accent; the programs live now (tap: the Store); the
// next three drops by name only (players are never revealed early) and, five days out, the next season.
import React, { useState } from 'react';
import { daysBetween, nextSeason, per, promosOn, seasonOn, upcoming } from './calendar';
import { HQArrow } from './Clubhouse';
import { fcToDisplay } from './fc-scale';
import type { UtSport } from './types';

const fmtDay = (d: string) => {
  const dt = new Date(d + 'T12:00:00Z');
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
};

// Claude, UI reorganisation: `compact` (Home) shows the first Coming-next line with a toggle for the rest.
export function SeasonBanner({ day, sport, onStore, compact = false }: { day: string; sport: UtSport; onStore: () => void; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const s = seasonOn(day);
  if (!s) return null;
  const left = daysBetween(day, s.end) + 1;
  const live = promosOn(day).filter((p) => per(p.count, sport));
  const next = upcoming(day, 3, sport);
  const ns = nextSeason(day);
  const soon = ns && daysBetween(day, ns.start) <= 5 ? ns : null;
  const band = (b: [number, number]) => (b[0] === b[1] ? String(fcToDisplay(b[0], sport)) : fcToDisplay(b[0], sport) + '–' + fcToDisplay(b[1], sport));
  return (
    <div className="ut-season-banner" style={{ '--sa': s.accent[0], '--sb': s.accent[1], '--sc': s.accent[2] ?? s.accent[0] } as React.CSSProperties}>
      <span className="eyebrow">
        THIS SEASON · {String(s.n).padStart(2, '0')} · {left} {left === 1 ? 'DAY' : 'DAYS'} LEFT
      </span>
      <b className="disp">{s.name}</b>
      <small>{s.tagline}</small>
      {live.length > 0 && (
        <span className="ut-season-chips">
          {live.map((p) => (
            <button key={p.id} className="ut-season-chip" onClick={onStore}>
              <b>{per(p.name, sport)}</b>
              <i>
                {band(p.ovrBand)} · ends {fmtDay(p.end)}
              </i>
            </button>
          ))}
        </span>
      )}
      <span className={'ut-season-next' + (compact && !open ? ' folded' : '')}>
        <span className="ut-season-next-head">
          <i className="eyebrow">COMING NEXT</i>
          {compact && next.length + (soon ? 1 : 0) > 1 && (
            <button className="ut-season-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
              {open ? 'LESS' : '+' + (next.length + (soon ? 1 : 0) - 1) + ' MORE'}
            </button>
          )}
        </span>
        {next.map((u) => (
          <span key={u.date + u.title}>
            <b>{fmtDay(u.date)}</b> {u.title} <em>{band(u.band)}</em>
          </span>
        ))}
        {soon && (
          <span>
            <b>{fmtDay(soon.start)}</b> Season {String(soon.n).padStart(2, '0')}: {soon.name}
          </span>
        )}
        {!next.length && !soon && <span>New programs drop on Fridays.</span>}
      </span>
      {live.length > 0 && !compact && (
        <button className="ut-season-store" onClick={onStore}>
          PROGRAM PACKS <HQArrow />
        </button>
      )}
    </div>
  );
}
