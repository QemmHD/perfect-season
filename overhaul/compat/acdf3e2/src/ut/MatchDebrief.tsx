// Codex (OpenAI): engine-grounded match breakdown. Claude (Anthropic), 2026-11-08, UI pass: the same
// numbers as broadcast stat tiles (a fill bar for "x / y" values) and the advice as a coach's note.
// The result screen's scoreboard and reward styling also live in match-debrief.css.
import React from 'react';
import type { UtSport } from './types';
import { matchDebrief } from './match-debrief';
import './match-debrief.css';

/** "11 / 16" → 0.69 for a part of a whole ("Scoring possessions", "Goals / attacks"); a pair of
 * counts ("Touchdowns / field goals", "Lost / offside") or a plain number has no bar. */
function share(label: string, value: string): number | null {
  if (label.includes('/') && !/attacks$/i.test(label)) return null;
  const m = /^(\d+)\s*\/\s*(\d+)$/.exec(value.trim());
  if (!m) return null;
  const a = Number(m[1]),
    b = Number(m[2]);
  return b > 0 ? Math.min(1, a / b) : null;
}

export function MatchDebrief({
  sport,
  ends,
  simulated,
  onPractice,
}: {
  sport: UtSport;
  ends: readonly string[];
  simulated: boolean;
  onPractice?: () => void;
}) {
  const d = matchDebrief(sport, ends);
  if (!d.total) return null;
  return (
    <section className="match-debrief" aria-label="Match breakdown">
      <span className="eyebrow">
        {simulated ? 'SIMULATED MATCH' : 'YOUR MATCH'} · BREAKDOWN
      </span>
      <div className="match-debrief-metrics">
        {d.metrics.map((m, i) => {
          const f = share(m.label, m.value);
          return (
            <div key={m.label} style={{ animationDelay: 120 + i * 90 + 'ms' }}>
              <b className="disp num">{m.value}</b>
              <small>{m.label}</small>
              {f !== null && (
                <span className="match-debrief-bar" aria-hidden="true">
                  <i style={{ width: Math.round(f * 100) + '%' }} />
                </span>
              )}
            </div>
          );
        })}
      </div>
      {!simulated && (
        <div className="match-debrief-note">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="5" y="4" width="14" height="17" rx="2" />
            <path d="M9 4V3h6v1M9 10l2 2 4-4M9 16h6" />
          </svg>
          <span>
            <h3>{d.title}</h3>
            <p>{d.advice}</p>
          </span>
        </div>
      )}
      {simulated && (
        <p>
          These are simulated outcomes. Play the next match to practice your
          timing and decisions.
        </p>
      )}
      {!simulated && onPractice && (
        <button className="btn" onClick={onPractice}>
          PRACTICE YOUR SKILLS
        </button>
      )}
    </section>
  );
}
