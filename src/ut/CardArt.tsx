// An Ultimate Team card: a tier frame (bronze, silver, gold, Hot Season, Legend), the overall and
// position, the team and season, and the player himself in pixel art: the same rigged body the
// played games draw, in that season's team colors and his own number, drawn small and scaled up
// with crisp pixels.
import React from 'react';
import { DEFAULT_HAIR, DEFAULT_SKIN, beardFor, drawBody, freeCanvas, hairFor, type Look } from '../game/pixel/body';
import { celebrate, idle } from '../game/pixel/poses';
import { useTilt } from '../ui/Card';
import { shortSeason } from './pool';
import { TIER_NAMES } from './rate';
import type { CardLine, RatedCard } from './types';

const lum = (hex: string): number => {
  const h = hex.replace('#', '');
  if (h.length < 6) return 0.5;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** The player in his season's uniform. */
export function lookOf(line: CardLine): Look {
  const ht = line.ht ?? (line.sport === 'nba' ? 79 : 74);
  const wt = line.wt ?? (line.sport === 'nba' ? 215 : 230);
  const base = { ht, wt, num: line.num, hair: hairFor(line.pid), beard: beardFor(line.pid), skin: DEFAULT_SKIN, hairColor: DEFAULT_HAIR, jersey: line.c1, trim: line.c2, shoes: '#1b1b1f' };
  if (line.sport === 'nba') return { ...base, sport: 'nba', shorts: line.c1, socks: '#f2f2f2' };
  const big = ['OT', 'OG', 'C', 'DE', 'DT'].includes(line.pos[0]);
  // pants: white against a dark jersey, the trim color against a light one
  const pants = lum(line.c1) < 0.5 ? '#e8e8e4' : line.c2;
  return { ...base, sport: 'nfl', shorts: pants, socks: line.c1, helmet: line.c1, stripe: line.c2, mask: lum(line.c1) < 0.35 ? '#c9ccd0' : '#2a2d33', pants, pads: big ? 1.25 : 1, sleeves: 'short' };
}

const portraits = new Map<string, string>();

/** The portrait as an image URL: drawn once per card and pose, then cached. */
export function portraitUrl(line: CardLine, pose: 'stand' | 'cheer' = 'stand'): string {
  const k = line.id + ':' + pose;
  let url = portraits.get(k);
  if (url) return url;
  try {
    const look = lookOf(line);
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
  if (portraits.size > 600) portraits.clear();
  portraits.set(k, url);
  return url;
}

/** Last name for the plate (the whole name when it's short). */
export function plateName(name: string): string {
  if (name.length <= 13) return name;
  const parts = name.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : name;
}

export interface UtCardProps {
  rc: RatedCard;
  /** the card's width in frame px; everything on it scales from that */
  w: number;
  level?: number;
  /** show the six key attributes (the bigger views) */
  attrs?: boolean;
  pose?: 'stand' | 'cheer';
  tilt?: boolean;
  /** shown in the top corner instead of the card's own position (a squad slot) */
  slot?: string;
  className?: string;
}

/** The card. */
export function UtCard({ rc, w, level = 1, attrs, pose = 'stand', tilt, slot, className }: UtCardProps) {
  const { ref, handlers } = useTilt<HTMLSpanElement>(w > 150 ? 16 : 10);
  const l = rc.line;
  const name = plateName(l.name);
  const src = portraitUrl(l, pose);
  return (
    <span
      ref={ref}
      {...(tilt ? handlers : {})}
      className={'utc t-' + rc.tier + (attrs ? ' with-attrs' : '') + (w < 52 ? ' xs' : w < 70 ? ' sm' : '') + (name.length > 9 ? ' long' : '') + (className ? ' ' + className : '')}
      style={{ '--w': w + 'px', '--c1': l.c1, '--c2': l.c2 } as React.CSSProperties}
      role="img"
      aria-label={l.name + ', ' + rc.ovr + ' overall ' + rc.pos + ', ' + l.season + ' ' + l.teamName + ', ' + TIER_NAMES[rc.tier]}
    >
      <span className="utc-face">
        <span className="utc-glow" aria-hidden="true" />
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
          <b className="utc-name">{name}</b>
          {attrs && (
            <span className="utc-attrs">
              {rc.key.map(([c, , v]) => (
                <span key={c}>
                  <b>{v}</b>
                  <i>{c}</i>
                </span>
              ))}
            </span>
          )}
        </span>
      </span>
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
