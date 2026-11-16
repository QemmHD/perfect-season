// Claude, 2026-11-16 (studio overhaul, team ut-1): the GO chip on a progress row (audit H5). It leads
// to the screen where the goal moves (go.ts); when that is the Store's random packs it says the odds
// are shown there, so a goal never sends a player to a pack without saying so (the ethics rule).
import React from 'react';
import type { GoTarget } from './go';
import { GoChip } from './kit';
import './progress-go.css';
import type { UtView } from './UltimateTeam';

export function GoLink(props: { go: GoTarget; what: string; onGo: (view: UtView) => void }) {
  const { go } = props;
  return (
    <span className="ut-golink">
      <GoChip
        label={go.label}
        ariaLabel={go.label + ': ' + props.what + (go.odds ? ' (pack odds are shown in the Store)' : '')}
        onClick={() => props.onGo(go.view)}
      />
      {go.odds && <small className="ut-golink-odds">ODDS SHOWN</small>}
    </span>
  );
}
