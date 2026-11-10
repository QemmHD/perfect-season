// Dev-only test bench for arcade soccer (Claude, 2026-11-01): `?soccer-lab` opens a match between two
// clubs' best elevens from the card file, before the sport is wired into the app. Loaded only in
// `vite` dev (main.tsx gates the import on import.meta.env.DEV), so the card data never reaches the
// production bundle. Parameters: home=BAR&hs=2015&away=RMA&as=2017 (club codes and seasons), seed,
// auto (autopilot), slowmo, attacks=N, scenario=corner (deal only that), pens (straight to
// penalties), tie (the rival's score made level), def=-0.5..1 (difficulty), qa (window.__soccer),
// start=x,y (the man on the ball starts there, pitch metres: x 0-68 across, y up to the goal at 105).
import React, { useEffect, useMemo, useState } from 'react';
import type { Progress } from '../progress';
import { soccerKits } from './kits';
import { aiAttacksOf, ATTACKS, STOPPAGE } from './match';
import { clubSquad, type SoccerCardsFile, soccerLines } from './ratings';
import { Soccer2 } from './Soccer2';
import type { Scenario, Squad } from './types';

export default function SoccerLab() {
  const q = new URLSearchParams(location.search);
  const [teams, setTeams] = useState<{ us: Squad; them: Squad } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    import('../../data/cards-soccer.json')
      .then((mod) => {
        const f = (mod.default ?? mod) as unknown as SoccerCardsFile;
        const { seasons } = soccerLines(f);
        setTeams({ us: clubSquad(seasons, q.get('home') ?? 'BAR', Number(q.get('hs') ?? 2015)), them: clubSquad(seasons, q.get('away') ?? 'RMA', Number(q.get('as') ?? 2017)) });
      })
      .catch((e) => setErr(String(e)));
  }, []);
  const seed = q.get('seed') ?? 'lab';
  const attacks = q.has('attacks') ? Math.max(1, Number(q.get('attacks'))) : ATTACKS;
  const defIQ = Number(q.get('def') ?? 0);
  const [mine, setMine] = useState<Progress | null>(null);
  const ai = useMemo(() => (teams ? aiAttacksOf(teams.them, teams.us, seed, 0.75, attacks, defIQ) : null), [teams]);
  const kits = useMemo(() => (teams ? soccerKits(teams.us, teams.them) : null), [teams]);
  if (err) return <div style={{ padding: 20, color: '#fff' }}>{err}</div>;
  if (!teams || !kits || !ai) return <div style={{ padding: 20, color: '#fff' }}>Loading squads…</div>;
  const total = attacks + STOPPAGE;
  // the AI's attacks come in as you finish yours; `tie` makes the rival's final score yours
  const n = mine?.done ? total : (mine?.drive ?? 0);
  const rivalScore = q.has('tie') && mine?.done ? mine.score : ai.ends.slice(0, n).filter((e) => e === 'G').length;
  const rival = { name: teams.them.abbr, score: rivalScore, drive: n, done: n >= total };
  const sc = q.get('scenario') as Scenario | null;
  const at = (q.get('start') ?? '').split(',').map(Number);
  const start = at.length === 2 && at.every(Number.isFinite) ? { x: at[0], y: at[1] } : undefined;
  return (
    <div className="screen" style={{ paddingTop: 0, paddingBottom: 0 }}>
      <Soccer2
        us={teams.us}
        them={teams.them}
        rivalName={teams.them.abbr}
        seed={seed}
        attacks={attacks}
        deal={sc ? [sc] : undefined}
        defIQ={defIQ}
        rival={rival}
        kits={kits}
        autoplayHook={q.has('auto')}
        timeScale={Number(q.get('slowmo') ?? 1)}
        forceShootout={q.has('pens')}
        start={start}
        debug={
          q.has('qa')
            ? (a, m, ui) => {
                (window as unknown as { __soccer: unknown }).__soccer = { a, m, ui };
              }
            : undefined
        }
        onProgress={setMine}
        onDone={setMine}
        onShootout={(r) => ((window as unknown as { __pens: unknown }).__pens = r)}
      />
      <span hidden data-progress={JSON.stringify(mine)} />
    </div>
  );
}
