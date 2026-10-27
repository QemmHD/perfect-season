// A test sheet for the pixel art (?pixel): players of different sizes in every move, from several
// angles, at game scale. Not reachable from the app's menus. ?pixel=mocap opens the motion-capture
// bench (MocapGallery.tsx) instead.
import React, { useEffect, useRef } from 'react';
import { DEFAULT_HAIR, DEFAULT_SKIN, drawBody, type Look } from './body';
import MocapGallery from './MocapGallery';
import { celebrate, contest, defend, dribble, dunk, idle, jumpShot, layup, pass, run } from './poses';
import type { Pose } from './rig';

const nba = (ht: number, wt: number, num: number, hair: number, jersey: string, trim: string, beard = false): Look => ({
  sport: 'nba',
  ht,
  wt,
  num,
  hair,
  beard,
  skin: DEFAULT_SKIN,
  hairColor: DEFAULT_HAIR,
  jersey,
  trim,
  shorts: jersey,
  socks: '#f2f2f2',
  shoes: '#1b1b1f',
});

const nfl = (ht: number, wt: number, num: number, jersey: string, trim: string, helmet: string, pants: string): Look => ({
  sport: 'nfl',
  ht,
  wt,
  num,
  hair: 0,
  skin: DEFAULT_SKIN,
  hairColor: DEFAULT_HAIR,
  jersey,
  trim,
  shorts: pants,
  socks: jersey,
  shoes: '#1b1b1f',
  helmet,
  stripe: trim,
  pants,
  pads: 1,
});

export default function Gallery() {
  return new URLSearchParams(location.search).get('pixel') === 'mocap' ? <MocapGallery /> : <Sheet />;
}

function Sheet() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const scale = Number(q.get('scale') ?? 2.5);
    const px = Number(q.get('px') ?? 56);
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    c.width = 1400;
    c.height = 1800;
    ctx.fillStyle = '#c98d55';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false;
    const players: Look[] = [
      nba(73, 185, 3, 0, '#1d428a', '#ffc72c'),
      nba(78, 215, 23, 2, '#ce1141', '#000000', true),
      nba(81, 250, 34, 3, '#552583', '#fdb927'),
      nba(85, 300, 50, 4, '#007a33', '#ffffff', true),
      nba(80, 230, 6, 5, '#ffffff', '#ce1141'),
    ];
    const moves: [string, (t: number) => Pose][] = [
      ['idle', (t) => idle(t)],
      ['run', (t) => run(t, 1)],
      ['dribble', (t) => dribble(t, 0.6)],
      ['shot', (t) => jumpShot(t)],
      ['layup', (t) => layup(t)],
      ['dunk', (t) => dunk(t, 'two')],
      ['contact', (t) => dunk(t, 'contact')],
      ['pass', (t) => pass(t)],
      ['defend', (t) => defend(t, 1)],
      ['block', (t) => contest(t)],
      ['celebrate', (t) => celebrate(t)],
    ];
    let y = 20;
    ctx.font = '12px monospace';
    // row 1: each player in a few moves, side-on (3/4 toward us)
    for (const look of players) {
      let x = 10;
      for (const [name, f] of moves.slice(0, 8)) {
        const sp = drawBody(look, f(name === 'run' || name === 'dribble' || name === 'idle' ? 0.2 : 0.8), { facing: 0.62, pitch: 0.3 }, Math.round((px * look.ht) / 78));
        ctx.drawImage(sp.canvas, x, y, sp.canvas.width * scale, sp.canvas.height * scale);
        x += sp.canvas.width * scale * 0.72;
      }
      y += px * 1.7 * scale * 0.82;
    }
    // facing angles
    let x = 10;
    for (let k = 0; k < 8; k++) {
      const sp = drawBody(players[1], run((k * 0.13) % 1, 1), { facing: (k * Math.PI) / 4, pitch: 0.32 }, px);
      ctx.drawImage(sp.canvas, x, y, sp.canvas.width * scale, sp.canvas.height * scale);
      x += sp.canvas.width * scale * 0.75;
    }
    y += px * 1.7 * scale * 0.8;
    // football, from above
    x = 10;
    const fb = [nfl(76, 225, 12, '#002244', '#c60c30', '#002244', '#b0b7bc'), nfl(73, 205, 81, '#aa0000', '#b3995d', '#b3995d', '#b3995d'), nfl(77, 320, 72, '#203731', '#ffb612', '#ffb612', '#ffffff'), nfl(74, 250, 52, '#ffffff', '#002c5f', '#002c5f', '#002c5f')];
    for (const look of fb)
      for (const f of [0.55, Math.PI / 2, -Math.PI / 2]) {
        const sp = drawBody(look, run(0.3, 0.8), { facing: f, pitch: 0.5 }, Math.round((px * 0.85 * look.ht) / 78));
        ctx.drawImage(sp.canvas, x, y, sp.canvas.width * scale, sp.canvas.height * scale);
        x += sp.canvas.width * scale * 0.7;
      }
  }, []);
  return <canvas ref={ref} style={{ width: 1400, height: 1800, imageRendering: 'pixelated' }} />;
}
