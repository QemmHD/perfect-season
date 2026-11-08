// Codex (OpenAI): optional engine-grounded feedback, opened at the HUD edge without pausing a match.
// Claude (Anthropic), 2026-11-08, UI pass: SVG marks instead of text glyphs; styles match the score bug.
import React, { useEffect, useState } from 'react';
import type { PlayFeedback } from './play-feedback';
import './play-readout.css';
export function PlayReadout({
  readout,
  live,
  resetKey,
}: {
  readout: PlayFeedback | null;
  live: boolean;
  resetKey: number | string;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [resetKey]);
  useEffect(() => { if (live) setOpen(false); }, [live]);
  if (!readout) return null;
  return (
    <aside
      className="play-readout"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
    >
      <button
        className="play-readout-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className="play-readout-mark"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d="M4 18 9 11l4 4 7-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        LAST PLAY
        <svg
          className="play-readout-chev"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            d={open ? 'M6 9l6 6 6-6' : 'M6 15l6-6 6 6'}
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <section className="play-readout-card" aria-label="Last play breakdown">
          <div className="play-readout-heading">
            <span className="eyebrow">{readout.title}</span>
            <button
              aria-label="Close play breakdown"
              onClick={() => setOpen(false)}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M6 6l12 12M18 6 6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <b className="disp">{readout.result}</b>
          <dl>
            {readout.facts.map((f) => (
              <div key={f.label}>
                <dt>{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
          <p>{readout.next}</p>
          {live && <small>Live play continues while this is open.</small>}
        </section>
      )}
    </aside>
  );
}
