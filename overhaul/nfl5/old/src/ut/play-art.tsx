// Claude (Anthropic), 2026-11-08, UI pass: illustrative art for the Play hub tiles, Club Cups and the
// title moment. Presentation only: SVG/CSS plus the squad's own pixel players (the same drawn
// portraits the cards use), so nothing here reads or writes progress. Styles: play-art.css.
import React, { useId, useMemo } from 'react';
import { GoatCrown, portraitUrl, UtCard, UtCardBack } from './CardArt';
import type { CupKind } from './cup-state';
import { byValue, ratedOf, type Pool } from './pool';
import type { UtState } from './state';
import type { CardLine, RatedCard, UtSport } from './types';
import './play-art.css';

/** Your best squad cards (any slot, one per player), for art. Empty when the squad is. */
export function useSquadCards(pool: Pool, ut: UtState, n = 3): RatedCard[] {
  return useMemo(() => {
    const owned = new Map(ut.owned.map((c) => [c.uid, c]));
    const seen = new Set<string>();
    return Object.values(ut.squad ?? {})
      .map((uid) => (uid ? owned.get(uid) : undefined))
      .map((c) => (c ? ratedOf(pool, c) : null))
      .filter((rc): rc is RatedCard => !!rc)
      .sort(byValue)
      .filter((rc) => !seen.has(rc.line.pid) && !!seen.add(rc.line.pid))
      .slice(0, n);
  }, [pool, ut.squad, ut.owned, n]);
}

/** Their players, for the pixel art. */
export function useSquadStars(pool: Pool, ut: UtState, n = 2): CardLine[] {
  const cards = useSquadCards(pool, ut, n);
  return useMemo(() => cards.map((rc) => rc.line), [cards]);
}

/** Your top cards fanned out, in the real card art. */
export function SquadFan({ cards }: { cards: RatedCard[] }) {
  return (
    <span className={'pa pa-squadfan n' + cards.length} aria-hidden="true">
      <i className="pa-glow" />
      <span className="pa-fan">
        {cards.map((rc, k) => (
          <span
            key={rc.line.id}
            style={{ '--i': k - (cards.length - 1) / 2 } as React.CSSProperties}
          >
            <UtCard rc={rc} w={62} />
          </span>
        ))}
      </span>
    </span>
  );
}

/** A squad player in crisp pixels; `ghost` draws an anonymous rival silhouette. */
export function PixelPlayer({
  line,
  pose = 'stand',
  className,
  ghost,
}: {
  line: CardLine;
  pose?: 'stand' | 'cheer';
  className?: string;
  ghost?: boolean;
}) {
  const url = useMemo(() => portraitUrl(line, pose), [line, pose]);
  if (!url) return null;
  return (
    <img
      className={
        'px-player' +
        (ghost ? ' ghost' : '') +
        (className ? ' ' + className : '')
      }
      src={url}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}

export const CUP_TONE: Record<CupKind, string> = {
  open: '#f5b83d',
  silver: '#d6e2ea',
  chemistry: '#19e3c9',
};

const CUP_METAL: Record<CupKind, [string, string, string, string, string]> = {
  // dark edge, highlight, body, dark edge, plinth
  open: ['#9a6610', '#ffe9a8', '#f5b83d', '#8a5a0c', '#2a1c06'],
  silver: ['#66737d', '#ffffff', '#c6d2da', '#5b6770', '#1c242a'],
  chemistry: ['#08574e', '#b6fff3', '#19e3c9', '#06483f', '#03241f'],
};

/** Each Cup's own trophy: Open is the classic two-handled cup, Silver a tall chalice, Chemistry a
 * cut-crystal cup with linked nodes. */
export function CupTrophy({
  kind,
  size = 64,
  className,
}: {
  kind: CupKind;
  size?: number;
  className?: string;
}) {
  const id = 'ct' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [d1, hi, body, d2, plinth] = CUP_METAL[kind];
  const metal = `url(#${id}m)`;
  return (
    <svg
      className={'cup-trophy k-' + kind + (className ? ' ' + className : '')}
      width={size}
      height={(size * 140) / 120}
      viewBox="0 0 120 140"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id + 'm'} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={d1} />
          <stop offset="0.32" stopColor={hi} />
          <stop offset="0.58" stopColor={body} />
          <stop offset="1" stopColor={d2} />
        </linearGradient>
      </defs>
      {kind === 'open' && (
        <g>
          <path
            d="M31 27C14 25 12 52 35 57M89 27c17-2 19 25-4 30"
            stroke={metal}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M28 16h64v22c0 28-15 44-32 46-17-2-32-18-32-46Z"
            fill={metal}
          />
          <ellipse cx="60" cy="16" rx="32" ry="5.5" fill={hi} opacity="0.85" />
          <path
            d="M39 24c0 25 6 42 16 50"
            stroke="#fff"
            strokeOpacity="0.55"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="m60 34 4.2 8.6 9.4 1.3-6.8 6.6 1.6 9.3-8.4-4.4-8.4 4.4 1.6-9.3-6.8-6.6 9.4-1.3Z"
            fill={d2}
            opacity="0.55"
          />
          <path d="M53 84h14l-2 16h-10Z" fill={metal} />
        </g>
      )}
      {kind === 'silver' && (
        <g>
          <path
            d="M38 22C22 16 20 44 44 48M82 22c16-6 18 22-6 26"
            stroke={metal}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d="M30 10h60l-7 22c-5 20-13 32-23 34-10-2-18-14-23-34Z"
            fill={metal}
          />
          <ellipse cx="60" cy="10" rx="30" ry="4.5" fill={hi} opacity="0.9" />
          <path
            d="M42 18c3 18 8 32 15 40"
            stroke="#fff"
            strokeOpacity="0.6"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <path d="m60 26 9 11-9 11-9-11Z" fill={d2} opacity="0.5" />
          <path d="M56 66h8l-1 34h-6Z" fill={metal} />
          <ellipse cx="60" cy="82" rx="7" ry="3" fill={metal} />
        </g>
      )}
      {kind === 'chemistry' && (
        <g>
          <path
            d="M30 22 16 26l5 22 17 6M90 22l14 4-5 22-17 6"
            stroke={metal}
            strokeWidth="5"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path d="M26 14h68l-6 38-28 30-28-30Z" fill={metal} />
          <path d="M26 14h68l-3 8H29Z" fill={hi} opacity="0.75" />
          <path
            d="M36 24l6 26 18 22"
            stroke="#fff"
            strokeOpacity="0.5"
            strokeWidth="3.5"
            fill="none"
            strokeLinecap="round"
          />
          <g stroke={d2} strokeWidth="2.6" opacity="0.75" fill="none">
            <path d="M60 30 48 50h24Z" />
          </g>
          <g fill={d2} opacity="0.85">
            <circle cx="60" cy="30" r="4.5" />
            <circle cx="48" cy="50" r="4.5" />
            <circle cx="72" cy="50" r="4.5" />
          </g>
          <path d="M54 82h12l-2 18h-8Z" fill={metal} />
        </g>
      )}
      <rect x="47" y="98" width="26" height="6" rx="3" fill={metal} />
      <path d="M38 104h44l5 20H33Z" fill={metal} />
      <rect x="30" y="122" width="60" height="12" rx="2.5" fill={plinth} />
      <rect
        x="40"
        y="126"
        width="40"
        height="3"
        rx="1.5"
        fill={body}
        opacity="0.55"
      />
    </svg>
  );
}

export type ModeArtId =
  | 'battles'
  | 'cup'
  | 'league'
  | 'events'
  | 'moments'
  | 'circuit'
  | 'draft'
  | 'starter';

/** The art panel of a Play tile (decorative). */
export function ModeArt({
  id,
  stars,
  sport,
}: {
  id: ModeArtId | string;
  stars: CardLine[];
  sport: UtSport;
}) {
  const [a, b] = stars;
  switch (id) {
    case 'battles':
      return (
        <span className="pa pa-battles" aria-hidden="true">
          <i className="pa-glow" />
          <i className="pa-floor" />
          {a ? (
            <>
              <PixelPlayer line={a} className="pa-p1" />
              <PixelPlayer line={b ?? a} className="pa-p2" ghost />
            </>
          ) : (
            <span className="pa-shield">
              <ShieldArt />
            </span>
          )}
          <b className="pa-vs disp">VS</b>
        </span>
      );
    case 'cup':
      return (
        <span className="pa pa-cup" aria-hidden="true">
          <i className="pa-rays" />
          <BracketLines />
          <CupTrophy kind="open" size={62} className="pa-trophy" />
        </span>
      );
    case 'league':
      return (
        <span className="pa pa-league" aria-hidden="true">
          <i className="pa-glow" />
          <b className="pa-big disp num">
            {{ nba: '82', nfl: '17', soccer: '38' }[sport]}
          </b>
          <svg className="pa-table" viewBox="0 0 120 74">
            {[0, 1, 2, 3].map((r) => (
              <g
                key={r}
                transform={`translate(0 ${r * 18})`}
                className={r === 1 ? 'is-you' : ''}
              >
                <rect x="0" y="0" width="120" height="14" rx="4" />
                <text x="8" y="10.5">
                  {r + 1}
                </text>
                <rect
                  className="bar"
                  x="22"
                  y="5"
                  width={[70, 62, 48, 36][r]}
                  height="4"
                  rx="2"
                />
                <text x="112" y="10.5" textAnchor="end">
                  {[14, 12, 9, 7][r]}
                </text>
              </g>
            ))}
          </svg>
        </span>
      );
    case 'events':
      return (
        <span className="pa pa-events" aria-hidden="true">
          <i className="pa-glow" />
          <span className="pa-fan">
            {[-1, 0, 1].map((k) => (
              <span key={k} style={{ '--i': k } as React.CSSProperties}>
                <UtCardBack w={44} />
              </span>
            ))}
          </span>
          <GoatCrown className="pa-crown" />
        </span>
      );
    case 'moments':
      return (
        <span className="pa pa-moments" aria-hidden="true">
          <i className="pa-glow" />
          <svg className="pa-watch" viewBox="0 0 100 100">
            <path className="speed" d="M4 40h18M0 54h20M8 68h14" />
            <rect className="crown" x="44" y="6" width="12" height="8" rx="2" />
            <circle className="ring" cx="50" cy="56" r="34" />
            <path className="arc" d="M50 22a34 34 0 0 1 29.4 51" />
            <path className="bolt" d="M54 34 38 60h12l-4 20 18-28H52Z" />
          </svg>
        </span>
      );
    case 'circuit':
      return (
        <span className="pa pa-circuit" aria-hidden="true">
          <i className="pa-glow" />
          <svg className="pa-route" viewBox="0 0 150 80">
            <path
              className="track"
              d="M8 66C30 66 28 40 50 40s22 26 44 26 18-44 46-50"
            />
            {[
              [8, 66],
              [30, 54],
              [50, 40],
              [72, 54],
              [94, 66],
              [116, 40],
            ].map(([x, y], i) => (
              <circle
                key={i}
                className={i < 3 ? 'done' : ''}
                cx={x}
                cy={y}
                r="5"
              />
            ))}
          </svg>
          <GoatCrown className="pa-route-crown" />
        </span>
      );
    case 'draft':
    case 'starter':
      return (
        <span
          className={'pa pa-draft' + (id === 'starter' ? ' starter' : '')}
          aria-hidden="true"
        >
          <i className="pa-glow" />
          <span className="pa-fan">
            {[-1, 0, 1].map((k) => (
              <span key={k} style={{ '--i': k } as React.CSSProperties}>
                <UtCardBack w={46} />
              </span>
            ))}
          </span>
        </span>
      );
    default:
      return null;
  }
}

function BracketLines() {
  return (
    <svg className="pa-bracket" viewBox="0 0 160 90" aria-hidden="true">
      <path d="M4 12h22v22H4M4 56h22v22H4M26 23h18v44H26M44 45h14M156 12h-22v22h22M156 56h-22v22h22M134 23h-18v44h18M116 45h-14" />
    </svg>
  );
}

function ShieldArt() {
  return (
    <svg viewBox="0 0 48 56" aria-hidden="true">
      <path d="M24 3 44 11v16c0 13-9 22-20 26C13 49 4 40 4 27V11Z" />
      <path d="m15 18 18 18M33 18 15 36" />
    </svg>
  );
}
