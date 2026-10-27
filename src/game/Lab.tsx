// A test bench for the arcade games: ?arcade opens one with a sample team against a sample defense
// (?arcade&auto lets the autopilot play). Not reachable from the app's menus.
import React, { useMemo, useState } from 'react';
import { CELLS } from '../engine/data';
import { NFL } from '../engine/sport';
import type { Lineup, Player } from '../engine/types';
import type { Progress } from './progress';
import { fbKitsFor, Football2 } from './football2/Football2';
import { Hoops2, kitsFor } from './hoops2/Hoops2';
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

function hoopFive(level: number): Lineup {
  const all = CELLS.flatMap((c) => c.players).sort((a, b) => a.val - b.val);
  const out: Record<string, Player> = {};
  for (const s of ['PG', 'SG', 'SF', 'PF', 'C']) {
    const list = all.filter((p) => p.pos.includes(s));
    out[s] = list[Math.min(list.length - 1, Math.floor(level * (list.length - 1)))];
  }
  return out as Lineup;
}

export default function Lab() {
  const q = new URLSearchParams(location.search);
  const level = Number(q.get('level') ?? 0.85);
  const s = useMemo(() => sample(level), [level]);
  const [prog, setProg] = useState<Progress | null>(null);
  if (!NFL)
    return (
      <div className="screen" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <Hoops2
          lineup={hoopFive(level)}
          rivalLineup={hoopFive(Number(q.get('rival') ?? 0.7))}
          rivalName="Rival"
          seed={q.get('seed') ?? 'lab'}
          rival={{ name: 'Rival', score: 9, drive: 4, done: false }}
          ourKit={kitsFor('#1d428a', '#ffc72c').home}
          theirKit={kitsFor('#ce1141', '#000000').away}
          court={{ c1: '#ce1141', c2: '#ffffff', abbr: 'CHI' }}
          autoplayHook={q.has('auto')}
          onProgress={setProg}
          onDone={setProg}
        />
        <span hidden data-progress={JSON.stringify(prog)} />
      </div>
    );
  return (
    <div className="screen" style={{ paddingTop: 0, paddingBottom: 0 }}>
      <Football2
        lineup={s.lineup}
        rivalLineup={sample(Number(q.get('rival') ?? 0.6)).lineup}
        rivalName="Rival"
        seed={q.get('seed') ?? 'lab'}
        rival={{ name: 'Rival', score: 7, drive: 1, done: false }}
        ourKit={fbKitsFor('#203731', '#ffb612').home}
        theirKit={fbKitsFor('#aa0000', '#b3995d').away}
        field={{ homeC1: '#203731', homeC2: '#ffb612', homeName: 'Packers', awayC1: '#aa0000', awayC2: '#b3995d', awayName: '49ers' }}
        autoplayHook={q.has('auto')}
        onProgress={setProg}
        onDone={setProg}
      />
      <span hidden data-progress={JSON.stringify(prog)} />
    </div>
  );
}
