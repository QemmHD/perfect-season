// The score bug (plan §4.3, V2 A.5 / C.3; nba-3): a 232 × 40 broadcast capsule (200 × 34 on the SE)
// centred under the island: two skewed team blocks in their colours with a top highlight, a dark
// bottom edge and an accent stripe, big italic scores; a dark centre with the period and a glowing
// shot / play clock; a 3 px possession line along the bottom. It turns gold with CLUTCH in the last
// segment and violet with OT in overtime. Every sport mounts it; `clockRef` lets a game loop write
// the clock itself every frame without re-rendering (NBA-08).
import React, { type CSSProperties, type ReactNode, type Ref } from 'react';
import './bug.css';

export interface HeatView {
  /** 0..100 */
  v: number;
  stage: 'cold' | 'heating' | 'fire';
}

export interface BugProps {
  you: number;
  rival: number;
  youName?: string;
  rivalName?: string;
  /** 'Q2' · '2ND & 4' · "67'" */
  period: string;
  /** a second line under the period (NBA: which possession, '5/16') */
  sub?: string;
  /** the shot / play clock, as text */
  clock?: string;
  clockLow?: boolean;
  /** the host writes the clock itself (every frame): the element, with `data-low` for the warning */
  clockRef?: Ref<HTMLElement>;
  /** 0..1, the 3 px possession line */
  progress?: number;
  phase?: 'normal' | 'clutch' | 'ot';
  heat?: { you: HeatView; rival?: HeatView };
  /** the team colours (any CSS colour); the brand teal and violet when absent */
  youColor?: string;
  rivalColor?: string;
  /** an icon button that sits beside the bug (NBA: LAST PLAY) */
  aside?: ReactNode;
}

const PHASE_LABEL = { clutch: 'CLUTCH', ot: 'OT' } as const;

export function ScoreBug(p: BugProps) {
  const phase = p.phase ?? 'normal';
  const style = { '--bug-you': p.youColor ?? '#1fb8a6', '--bug-riv': p.rivalColor ?? '#7a5cf0' } as CSSProperties;
  const label = phase === 'normal' ? p.period : PHASE_LABEL[phase];
  return (
    <>
      <div className={'ps-bug ph-' + phase} style={style} role="group" aria-label={`Score: you ${p.you}, ${p.rivalName ?? 'rival'} ${p.rival}, ${label}`}>
        <span className="ps-bug-team t-you">
          <i>{(p.youName ?? 'YOU').toUpperCase()}</i>
          <b className="num">{p.you}</b>
        </span>
        <span className="ps-bug-mid">
          <span className="ps-bug-per">
            <em>{label}</em>
            {phase !== 'normal' ? <small>{p.period}</small> : p.sub ? <small className="num">{p.sub}</small> : null}
          </span>
          {(p.clockRef || p.clock !== undefined) && (
            <b className="ps-bug-clock num" ref={p.clockRef} data-low={p.clockRef ? undefined : p.clockLow ? '1' : undefined}>
              {p.clockRef ? undefined : p.clock}
            </b>
          )}
        </span>
        <span className="ps-bug-team t-riv">
          <b className="num">{p.rival}</b>
          <i>{(p.rivalName ?? 'RIV').toUpperCase()}</i>
        </span>
        <span className="ps-bug-line" aria-hidden="true">
          <span style={{ transform: `scaleX(${Math.max(0, Math.min(1, p.progress ?? 0))})` }} />
        </span>
      </div>
      {p.aside && <div className="ps-bug-aside">{p.aside}</div>}
    </>
  );
}
