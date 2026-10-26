// A test bench for the arcade games: ?arcade opens one with a sample team against a sample defense
// (?arcade&auto lets the autopilot play). Not reachable from the app's menus.
import React, { useMemo, useState } from 'react';
import { CELLS } from '../engine/data';
import { NFL } from '../engine/sport';
import type { Lineup, Player } from '../engine/types';
import { Football, type Progress } from './football/Football';
import { rankOf } from './football/model';

function sample(level: number): { lineup: Lineup; def: Player } {
  const by = (pos: string) =>
    CELLS.flatMap((c) => c.players)
      .filter((p) => p.pos[0] === pos)
      .sort((a, b) => rankOf(a) - rankOf(b));
  const at = (pos: string, l: number) => {
    const list = by(pos);
    return list[Math.min(list.length - 1, Math.floor(l * (list.length - 1)))];
  };
  return { lineup: { QB: at('QB', level), RB: at('RB', level), WR: at('WR', level), TE: at('TE', level), FLEX: at('WR', level - 0.04), DEF: at('DEF', level) } as Lineup, def: at('DEF', 0.5) };
}

export default function Lab() {
  const q = new URLSearchParams(location.search);
  const level = Number(q.get('level') ?? 0.85);
  const s = useMemo(() => sample(level), [level]);
  const [prog, setProg] = useState<Progress | null>(null);
  if (!NFL) return <div className="screen" style={{ display: 'grid', placeItems: 'center' }}>Basketball is next. Add ?sport=nfl for football.</div>;
  return (
    <div className="screen" style={{ paddingTop: 0, paddingBottom: 0 }}>
      <Football
        lineup={s.lineup}
        rivalDef={s.def}
        rivalName="Rival"
        seed={q.get('seed') ?? 'lab'}
        rival={{ name: 'Rival', score: 7, drive: 1, done: false }}
        autoplayHook={q.has('auto')}
        onProgress={setProg}
        onDone={setProg}
      />
      <span hidden data-progress={JSON.stringify(prog)} />
    </div>
  );
}
