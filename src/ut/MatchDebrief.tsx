import React from 'react';
import type { UtSport } from './types';
import { matchDebrief } from './match-debrief';
import './match-debrief.css';
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
        {d.metrics.map((m) => (
          <div key={m.label}>
            <b className="disp num">{m.value}</b>
            <small>{m.label}</small>
          </div>
        ))}
      </div>
      {!simulated && (
        <>
          <h3>{d.title}</h3>
          <p>{d.advice}</p>
        </>
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
