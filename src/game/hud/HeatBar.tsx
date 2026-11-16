// The Heat bar (plan §4.3, V2 B.0.2 / C.3; nba-3): 232 × 6 directly under the score bug (200 × 5 on the
// SE). An inset track, a gold-to-red fill with moving highlight stripes, a tick at the HEATING UP mark
// (66), flames at the leading edge, all along it when ON FIRE; the rival's bar is the thin violet line
// along its bottom. Fed by heat.ts (nba-4); until then a game passes zeros and it sits empty.
import React, { type CSSProperties } from 'react';
import type { HeatView } from './ScoreBug';
import './bug.css';

export const HEATING_UP = 66;

export function HeatBar({ you, rival }: { you: HeatView; rival?: HeatView }) {
  const v = Math.max(0, Math.min(100, you.v));
  const word = you.stage === 'fire' ? 'ON FIRE' : you.stage === 'heating' ? 'HEATING UP' : '';
  return (
    <div className={'ps-heat st-' + you.stage} role="meter" aria-label="Heat" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v)} aria-valuetext={word || 'cold'}>
      <span className="ps-heat-fill" style={{ '--heat': v / 100 } as CSSProperties} />
      <span className="ps-heat-tick" style={{ left: HEATING_UP + '%' }} aria-hidden="true" />
      {rival && <span className="ps-heat-riv" style={{ width: Math.max(0, Math.min(100, rival.v)) + '%' }} aria-hidden="true" />}
      {word && <span className="ps-heat-word">{word}</span>}
    </div>
  );
}
