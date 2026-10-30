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
  const k = kind.startsWith('position') ? 'position' : kind;
  return (
    <span
      className={'ut-pack p-' + k + (small ? ' small' : '')}
      aria-hidden="true"
    >
      <span className="ut-pack-crimp" />
      <span className="ut-pack-body">
        <i className="ut-pack-sport">{sport === 'nfl' ? 'NFL' : 'NBA'}</i>
        <b className="disp">UT</b>
        <i className="ut-pack-label">{label}</i>
      </span>
      <span className="ut-pack-crimp bottom" />
      <span className="ut-pack-foil" />
    </span>
  );
}
