import { SPORT_LABEL } from '../engine/sport';
// Existing foil wrapper, moved without visual changes by Codex so clubhouse/rewards share it.
import React from 'react';
import './pack-art.css';
import type { UtSport } from './types';
export function PackArt({
  kind,
  label,
  sport,
  small
}: {
  kind: string;
  label: string;
  sport: UtSport;
  small?: boolean;
}) {
  // Claude wave 3: Live Calendar packs share one wrapper per kind (live / live-plus / live-pick)
  const k = kind.startsWith('position') ? 'position' : kind.startsWith('live') ? kind.split(':')[0] : kind;
  return (
    <span
      className={'ut-pack p-' + k + (small ? ' small' : '')}
      aria-hidden="true"
    >
      <span className="ut-pack-crimp" />
      <span className="ut-pack-body">
        <i className="ut-pack-sport">{SPORT_LABEL[sport]}</i>
        <b className="disp">UT</b>
        <i className="ut-pack-label">{label}</i>
      </span>
      <span className="ut-pack-crimp bottom" />
      <span className="ut-pack-foil" />
    </span>
  );
}
