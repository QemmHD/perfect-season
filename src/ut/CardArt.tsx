// An Ultimate Team card: a tier frame (bronze, silver, gold, Hot Season, Legend), the overall and
// position, the team and season, and the player himself in pixel art: the same rigged body the
// played games draw, in that season's team colors and his own number, drawn small and scaled up
// with crisp pixels.
import './card-editions.css';
import { CardStamp } from './CardSerial';
import React, { useEffect, useState } from 'react';
import { drawBody, freeCanvas } from '../game/pixel/body';
import { appearanceLoaded, loadAppearance } from '../game/pixel/appearance';
import { SPORT } from '../engine/sport';
import { cardLook } from '../game/pixel/looks';
import { celebrate, idle } from '../game/pixel/poses';
import { useTilt } from '../ui/Card';
import { shortSeason } from './pool';
import { TIER_NAMES } from './rate';
import { isRare } from './rare';
import { weekLabel } from './editions';
import type { CardLine, RatedCard, CardMint } from './types';

// this page's sport's looks start loading with the Ultimate Team chunk, so the first portraits have them
void loadAppearance(SPORT);

const portraits = new Map<string, string>();

/**
 * The portrait as an image URL: the player in his season's uniform with his appearance record and the
 * match's build (looks.ts `cardLook`), drawn once per card and pose, then cached. Drawn before the
 * sport's appearance data is in, it shows the defaults and isn't kept (usePortrait waits for the data).
 */
export function portraitUrl(line: CardLine, pose: 'stand' | 'cheer' = 'stand'): string {
  const k = line.id + ':' + pose;
  let url = portraits.get(k);
  if (url) return url;
  const keep = appearanceLoaded(line.sport);
  try {
    const look = cardLook(line);
    const px = Math.round((54 * Math.max(68, Math.min(88, look.ht))) / 80);
    const sp = drawBody(look, pose === 'cheer' ? celebrate(0.25) : idle(0.15), { facing: 1.2, pitch: 0.1 }, px);
    // trim to a fixed frame so every card's player stands on the same line
    const W = 72;
    const H = 78;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(sp.canvas, Math.round(W / 2 - sp.ax), Math.round(H - 2 - sp.ay));
    url = c.toDataURL();
    freeCanvas(c);
    freeCanvas(sp.canvas);
  } catch {
    url = '';
  }
  if (!keep) return url;
  // the oldest go first (a Map keeps the order they came in)
  if (portraits.size >= 1500) portraits.delete(portraits.keys().next().value!);
  portraits.set(k, url);
  return url;
}

/**
 * Portraits still to draw, a few a frame: a club of hundreds of cards fills in over a moment
 * instead of holding the page up while every one is drawn (a phone took seconds).
 */
const todo: (() => void)[] = [];
let pumping = false;
function pump() {
  const t0 = performance.now();
  while (todo.length && performance.now() - t0 < 6) todo.shift()!();
  if (todo.length) requestAnimationFrame(pump);
  else pumping = false;
}

/** The portrait now when it's drawn already (or `now`), otherwise as soon as its turn comes. */
function usePortrait(line: CardLine, pose: 'stand' | 'cheer', now: boolean): string | null {
  const k = line.id + ':' + pose;
  const [, redraw] = useState(0);
  const have = portraits.get(k);
  const url = have ?? (now ? portraitUrl(line, pose) : null);
  useEffect(() => {
    if (url !== null && portraits.has(k)) return;
    let live = true;
    // the sport's looks first (one small chunk, usually in already), then a turn in the queue
    void loadAppearance(line.sport).then(() => {
      if (!live) return;
      todo.push(() => {
        if (!live) return;
        portraitUrl(line, pose);
        redraw((n) => n + 1);
      });
      if (!pumping) {
        pumping = true;
        requestAnimationFrame(pump);
      }
    });
    return () => {
      live = false;
    };
  }, [k, url === null || !portraits.has(k)]);
  return url;
}

/** Last name for the plate (the whole name when it's short). */
export function plateName(name: string): string {
  if (name.length <= 13) return name;
  const parts = name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}

/** Codex: one crown mark is shared by GOAT card art and its pack reveal. */
export function GoatCrown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 36" fill="none" aria-hidden="true">
      <path d="m5 9 9 9L24 4l10 14 9-9-5 23H10L5 9Z" fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="2" />
      <path d="M11 27h26M24 12v8" stroke="currentColor" strokeWidth="2" />
      <circle cx="24" cy="4" r="2" fill="currentColor" />
    </svg>
  );
}

/** Claude: the Landmark Seasons laurel (SVG, the shared card/reveal mark). */
export function Laurel({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 30" fill="none" aria-hidden="true">
      <path d="M24 27c-7-1-13-6-15-14M24 27c7-1 13-6 15-14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i} fill="currentColor">
          <ellipse cx={11 + i * 2.6} cy={20 - i * 3.6} rx="3.2" ry="1.4" transform={`rotate(${-40 - i * 12} ${11 + i * 2.6} ${20 - i * 3.6})`} />
          <ellipse cx={37 - i * 2.6} cy={20 - i * 3.6} rx="3.2" ry="1.4" transform={`rotate(${40 + i * 12} ${37 - i * 2.6} ${20 - i * 3.6})`} />
        </g>
      ))}
      <circle cx="24" cy="5" r="2" fill="currentColor" />
    </svg>
  );
}

/** Claude: the Weekly Standouts pulse line. */
export function Pulse({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 20" preserveAspectRatio="none" fill="none" aria-hidden="true">
      <path d="M0 12h30l4-8 5 14 5-12 3 6h53" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export interface UtCardProps {
  rc: RatedCard;
  /** the card's width in frame px; everything on it scales from that */
  w: number;
  level?: number;
  mint?: CardMint;
  /** kept for callers; 90+ copies show their stamp once numbered */
  numbered?: boolean;
  /** show the six key attributes (the bigger views) */
  attrs?: boolean;
  pose?: 'stand' | 'cheer';
  tilt?: boolean;
  /** shown in the top corner instead of the card's own position (a squad slot) */
  slot?: string;
  className?: string;
}

/** The card. */
export function UtCard({ rc, w, level = 1, attrs, pose = 'stand', tilt, slot, className, mint }: UtCardProps) {
  const { ref, handlers } = useTilt<HTMLSpanElement>(w > 150 ? 16 : 10);
  const l = rc.line;
  const name = plateName(l.name);
  // a big card (the details, a pack's reveal) is drawn there and then; the small ones of a list
  // or grid as their turn comes
  const big = w >= 120;
  const src = usePortrait(l, pose, big);
  const rare = isRare(rc);
  return (
    <span
      ref={ref}
      {...(tilt || (l.holo && w >= 120) ? handlers : {})}
      className={
        'utc t-' +
        rc.tier +
        (big ? ' big' : '') +
        (attrs ? ' with-attrs' : '') +
        (mint ? ' has-serial' : '') +
        (w < 52 ? ' xs' : w < 70 ? ' sm' : '') +
        (name.length > 9 ? ' long' : '') +
        (rare ? ' is-rare' : '') +
        (l.featured ? ' is-featured' : '') +
        (l.holo ? ' is-holo' : '') +
        (className ? ' ' + className : '')
      }
      style={{ '--w': w + 'px', '--c1': l.c1, '--c2': l.c2, ...(l.accent ? { '--pa': l.accent[0], '--pb': l.accent[1], '--pc': l.accent[2] ?? l.accent[0] } : {}) } as React.CSSProperties}
      role="img"
      aria-label={l.name + ', ' + rc.ovr + ' overall ' + rc.pos + ', ' + l.season + ' ' + l.teamName + ', ' + (l.holo ? 'Holographic ' : '') + (rare ? 'Rare ' : '') + TIER_NAMES[rc.tier] + (l.evo?.length ? ', evolved' : '') + (l.landmark ? ', ' + l.landmark : '') + (l.week ? ', ' + weekLabel(l.week) : '') + (mint ? ', issue number ' + mint.serial : '')}
    >
      <span className="utc-face">
        <span className="utc-glow" aria-hidden="true" />
        {rc.tier === 'goat' && <GoatCrown className="utc-crown" />}
        {(rc.tier === 'goat' || rc.tier === 'spotlight') && (
          <span className="utc-edition" aria-hidden="true">
            {rc.tier === 'goat' ? 'GREATEST OF ALL TIME' : 'SPOTLIGHT'}
          </span>
        )}
        {rc.tier === 'standout' && (
          <>
            <Pulse className="utc-pulse" />
            <span className="utc-wk" aria-hidden="true">
              {l.week ? weekLabel(l.week) : 'STANDOUT'}
            </span>
          </>
        )}
        {rc.tier === 'program' && (
          <span className="utc-ribbon" aria-hidden="true">
            {l.label}
          </span>
        )}
        {rc.tier === 'landmark' && (
          <>
            <span className="utc-grain" aria-hidden="true" />
            <Laurel className="utc-laurel" />
            <span className="utc-edition" aria-hidden="true">
              LANDMARK
            </span>
          </>
        )}
        {src && <img className="utc-px" src={src} alt="" draggable={false} />}
        <span className="utc-top">
          <b className="utc-ovr">{rc.ovr}</b>
          <i className="utc-pos">{slot ?? rc.pos}</i>
        </span>
        <span className="utc-team">
          <i className="utc-badge">{l.abbr}</i>
          <i className="utc-yr">{shortSeason(l)}</i>
        </span>
        {level > 1 && (
          <span className="utc-lv" aria-hidden="true">
            {Array.from({ length: level - 1 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        )}
        <span className="utc-plate">
          {/* Claude (UI reorganisation): no placeholder stamp while a 90+ copy waits for its number (card details says so) */}
          {mint ? <CardStamp mint={mint} cardId={l.id} sport={l.sport} /> : null}
          {rc.tier === 'landmark' && l.landmark && <span className="utc-ticker">{l.landmark}</span>}
          <b className="utc-name">{name}</b>
          {attrs && (
            <span className="utc-attrs">
              {(rc.face ?? rc.key).map(([c, , v]) => (
                <span key={c}>
                  <b>{v}</b>
                  <i>{c}</i>
                </span>
              ))}
            </span>
          )}
        </span>
      </span>
      {l.holo && <span className="utc-holo" aria-hidden="true" />}
      {!!l.evo?.length && (
        <span className="utc-evo" aria-hidden="true">
          EVO{l.evo.length > 1 ? ' ' + l.evo.length : ''}
        </span>
      )}
      <span className="utc-shine" aria-hidden="true" />
      <span className="tc-glare" aria-hidden="true" />
    </span>
  );
}

/** The back of a card: what the pack opening flips over. */
export function UtCardBack({ w, tier }: { w: number; tier?: string }) {
  return (
    <span className={'utc-back' + (tier ? ' b-' + tier : '')} style={{ '--w': w + 'px' } as React.CSSProperties} aria-hidden="true">
      <i className="disp">UT</i>
    </span>
  );
}
