// Claude, 2026-11-01: the Weekly Standouts program page (Home → Weekly Standouts): this week's
// featured card and squad, how to get them, the weekly SBC and the objective.
import React from 'react';
import { UtCard } from './CardArt';
import { claimed } from './content-state';
import { STANDOUT_OBJECTIVE_NEED, STANDOUT_OBJECTIVE_WINS, standoutProgram } from './standouts';
import { standoutObjectiveId, standoutWins } from './content-progress';
import { decadeOf, type Pool, seasonText } from './pool';
import { weekLabel } from './editions';
import { HQArrow } from './Clubhouse';
import type { UtState } from './state';
import type { UtView } from './UltimateTeam';

export function StandoutsView(props: { pool: Pool; ut: UtState; week: string; sbcDone: boolean; onGo: (v: UtView) => void; onClaim: () => void }) {
  const p = standoutProgram(props.pool, props.week);
  const wins = standoutWins(props.ut, props.week);
  const got = claimed(props.ut, standoutObjectiveId(props.week));
  const f = p.featured;
  return (
    <div className="page ut-standouts">
      <div className="ut-so-hero">
        <span className="eyebrow">WEEKLY STANDOUTS · {weekLabel(props.week)}</span>
        <h1 className="disp">
          THE WEEK’S
          <br />
          <em>STANDOUTS.</em>
        </h1>
        <p>
          {p.cards.length} real seasons, boosted for one week: +3 overall, +5 for the Featured Standout (top 97). Theme: the {decadeOf(p.decade)}. Owned copies keep their week
          stamp forever.
        </p>
        {f && (
          <div className="ut-so-featured">
            <UtCard rc={f} w={132} attrs />
            <span>
              <i className="eyebrow">FEATURED</i>
              <b className="disp">{f.line.name}</b>
              <small>
                {f.pos} · {seasonText(f.line)} {f.line.teamName}
              </small>
            </span>
          </div>
        )}
      </div>
      <div className="ut-so-grid">
        {p.cards.slice(1).map((rc) => (
          <span key={rc.line.id} className="ut-so-cell">
            <UtCard rc={rc} w={70} />
          </span>
        ))}
      </div>
      <span className="eyebrow">HOW TO GET THEM</span>
      <button className="ut-so-way" onClick={() => props.onGo('store')}>
        <b>Standout Guarantee pack</b>
        <small>One current Standout guaranteed. Weekend Lightning copies are 25% off. Gold, Premium and Elite packs can pull one too.</small>
        <HQArrow />
      </button>
      <button className="ut-so-way" onClick={() => props.onGo('sbc')} disabled={props.sbcDone}>
        <b>{props.sbcDone ? 'Standout Squad SBC · done' : 'Standout Squad SBC'}</b>
        <small>Eight golds at a good team overall for a random Standout of the week.</small>
        <HQArrow />
      </button>
      <div className="ut-so-objective">
        <span>
          <b>Weekly objective</b>
          <small>
            Win {STANDOUT_OBJECTIVE_WINS} matches with {STANDOUT_OBJECTIVE_NEED}+ Standouts in your squad (any week’s). Reward: a Standout pick, three this week’s Standouts, keep one.
          </small>
          <span className="bar">
            <i style={{ width: (100 * wins) / STANDOUT_OBJECTIVE_WINS + '%' }} />
          </span>
        </span>
        {got ? (
          <i className="ut-so-done">CLAIMED</i>
        ) : (
          <button className="btn primary" disabled={wins < STANDOUT_OBJECTIVE_WINS} onClick={props.onClaim}>
            {wins}/{STANDOUT_OBJECTIVE_WINS}
            {wins >= STANDOUT_OBJECTIVE_WINS ? ' · CLAIM' : ''}
          </button>
        )}
      </div>
    </div>
  );
}
