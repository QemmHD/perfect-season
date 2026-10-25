import React, { useRef } from 'react';
import { primeVersion } from '../engine/data';
import { RARITY_COLORS, RARITY_NAMES, rarityOf } from '../engine/rarity';
import { NFL } from '../engine/sport';
import type { Player, Slot } from '../engine/types';
import { initials, seasonLabel, Sheet, shortEra } from './common';
import { reducedMotion } from './motion';
import { cardName, isDefense, posLabel, statCols } from './sportui';

/** A card's era, which sets its frame: the decade's look, not any maker's design. */
export type Era = 'vintage' | 'retro' | 'chrome' | 'diecut' | 'modern';

export function eraOf(era: string): Era {
  const y = parseInt(era, 10);
  if (y < 1980) return 'vintage';
  if (y < 1990) return 'retro';
  if (y < 2000) return 'chrome';
  if (y < 2010) return 'diecut';
  return 'modern';
}

/**
 * Tilt toward the finger (or the mouse), with a glare that follows it. Writes CSS variables on
 * the card, so it never re-renders.
 */
export function useTilt<T extends HTMLElement>(max = 14) {
  const ref = useRef<T>(null);
  const on = useRef(false);
  const set = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = Math.min(1, Math.max(0, (x - r.left) / r.width));
    const py = Math.min(1, Math.max(0, (y - r.top) / r.height));
    el.style.setProperty('--rx', ((0.5 - py) * max).toFixed(2) + 'deg');
    el.style.setProperty('--ry', ((px - 0.5) * max).toFixed(2) + 'deg');
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    el.style.setProperty('--glare', '1');
  };
  const reset = () => {
    const el = ref.current;
    on.current = false;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
    el.style.setProperty('--glare', '0');
  };
  const handlers = reducedMotion()
    ? {}
    : {
        onPointerDown: (e: React.PointerEvent) => {
          on.current = true;
          set(e.clientX, e.clientY);
        },
        onPointerMove: (e: React.PointerEvent) => {
          if (on.current || e.pointerType === 'mouse') set(e.clientX, e.clientY);
        },
        onPointerUp: reset,
        onPointerLeave: reset,
        onPointerCancel: reset,
      };
  return { ref, handlers };
}

/** The art: the player's jersey in his team's colors, his initials for a number. A defense gets its shield. */
export function Jersey({ c1, c2, text, defense }: { c1: string; c2: string; text: string; defense?: boolean }) {
  if (defense)
    return (
      <svg className="tc-jersey" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M50 6 L86 18 V48 C86 72 70 86 50 95 C30 86 14 72 14 48 V18 Z" fill={c1} stroke={c2} strokeWidth="5" strokeLinejoin="round" />
        <path d="M50 16 L76 25 V48 C76 66 65 77 50 84 C35 77 24 66 24 48 V25 Z" fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="2" />
        <text x="50" y="60" textAnchor="middle" className="tc-num" fill="#fff" fontSize="28">
          {text}
        </text>
      </svg>
    );
  if (NFL)
    // a football jersey: shoulder pads, short sleeves, a stripe on each sleeve
    return (
      <svg className="tc-jersey" viewBox="0 0 100 100" aria-hidden="true">
        <path d="M30 10 Q50 20 70 10 L92 22 L98 48 L80 52 L78 40 L78 94 H22 L22 40 L20 52 L2 48 L8 22 Z" fill={c1} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M30 10 Q50 26 70 10" fill="none" stroke={c2} strokeWidth="5" />
        <path d="M86 30 L95 40 M14 30 L5 40" stroke={c2} strokeWidth="5" />
        <text x="50" y="74" textAnchor="middle" className="tc-num" fill="#fff" stroke={c2} strokeWidth="1.6" paintOrder="stroke" fontSize="34">
          {text}
        </text>
      </svg>
    );
  // a basketball tank top
  return (
    <svg className="tc-jersey" viewBox="0 0 100 100" aria-hidden="true">
      <path d="M30 6 L38 6 Q50 24 62 6 L70 6 Q72 22 84 30 L84 96 H16 L16 30 Q28 22 30 6 Z" fill={c1} stroke="rgba(0,0,0,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M38 6 Q50 24 62 6 M30 6 Q28 22 16 30 M70 6 Q72 22 84 30" fill="none" stroke={c2} strokeWidth="4" />
      <text x="50" y="74" textAnchor="middle" className="tc-num" fill="#fff" stroke={c2} strokeWidth="1.6" paintOrder="stroke" fontSize="34">
        {text}
      </text>
    </svg>
  );
}

/**
 * A player as a trading card: a frame from his era, his jersey in his team's colors, and a finish
 * for his rarity (foil, refractor, holo). Sized by its parent; `big` is the inspect view.
 */
export function TradingCard({ p, slot, blind, big, tilt = true }: { p: Player; slot?: Slot; blind?: boolean; big?: boolean; tilt?: boolean }) {
  const { ref, handlers } = useTilt<HTMLSpanElement>(big ? 18 : 12);
  const rar = blind ? 'common' : rarityOf(p);
  const era = eraOf(p.era);
  const def = isDefense(p);
  const name = cardName(p);
  return (
    <span
      ref={ref}
      {...(tilt ? handlers : {})}
      className={'tcard era-' + era + ' rar-' + rar + (big ? ' tc-big' : '') + (name.length > 9 ? ' longname' : '')}
      style={{ '--c1': p.c1, '--c2': p.c2 } as React.CSSProperties}
    >
      <span className="tc-body">
        <span className="tc-art">
          <span className="tc-pattern" aria-hidden="true" />
          <Jersey c1={p.c1} c2={p.c2} text={def ? p.abbr.slice(0, 3) : initials(p.name)} defense={def} />
        </span>
        <span className="tc-plate">
          <b className="tc-name">{name}</b>
          <small>
            {p.abbr} {shortEra(p.era)}
          </small>
        </span>
        {slot && <span className="tc-slot">{slot}</span>}
        {!blind && <b className="tc-val num">{p.val.toFixed(0)}</b>}
      </span>
      {rar !== 'common' && <span className="tc-foil" aria-hidden="true" />}
      <span className="tc-glare" aria-hidden="true" />
    </span>
  );
}

/** A card up close: the big card (tilt it), and the line it stands for. */
export function CardSheet({ p, slot, blind, onClose }: { p: Player; slot?: Slot; blind?: boolean; onClose: () => void }) {
  const rar = blind ? 'common' : rarityOf(p);
  const up = blind ? null : primeVersion(p);
  const years = p.from === p.to ? seasonLabel(p.from) : seasonLabel(p.from) + ' to ' + seasonLabel(p.to);
  return (
    <Sheet label={p.name} kind="center" onClose={onClose}>
      {(close) => (
        <div className="cardsheet">
          <div className="cs-card">
            <span className="bigcard s27">
              <TradingCard p={p} slot={slot} blind={blind} big />
            </span>
          </div>
          <div className="cs-info">
            <span className="cs-rar" style={{ color: RARITY_COLORS[rar] }}>
              {RARITY_NAMES[rar].toUpperCase()}
              {!blind ? ' · VALUE ' + p.val.toFixed(1) : ''}
            </span>
            <strong>{p.name}</strong>
            <small>
              {posLabel(p)} · {p.teamName} · {years}
            </small>
            <small>
              {p.g} games{p.seasons > 1 ? ' over ' + p.seasons + ' seasons' : ''}
              {p.primedFrom ? ' · primed to ' + p.primedFrom.abbr + ' ' + p.primedFrom.era : ''}
            </small>
            {!blind && (
              <div className="cs-stats">
                {statCols(p).map((c) => (
                  <span key={c.key}>
                    <b className="num">{c.text}</b>
                    <i>{c.label}</i>
                  </span>
                ))}
              </div>
            )}
            {up && <small className="cs-prime">Best decade: {up.primedFrom?.abbr} {up.primedFrom?.era} (value {up.val.toFixed(1)})</small>}
          </div>
          <span className="cs-hint">Drag the card to tilt it</span>
          <button className="btn" onClick={() => close()}>
            CLOSE
          </button>
        </div>
      )}
    </Sheet>
  );
}
