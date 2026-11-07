// Codex (OpenAI): optional engine-grounded feedback, opened at the HUD edge without pausing a match.
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
        LAST PLAY <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <section className="play-readout-card" aria-label="Last play breakdown">
          <div className="play-readout-heading">
            <span className="eyebrow">{readout.title}</span>
            <button
              aria-label="Close play breakdown"
              onClick={() => setOpen(false)}
            >
              ×
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
