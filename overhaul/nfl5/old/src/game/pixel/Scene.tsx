// A still of the basketball scene for judging the art (?pixel=court&w=422&h=195): the court, five
// on five, the ball and the hoop at the game's own pixel size, scaled up crisply.
import React, { useEffect, useRef } from 'react';
import { DEFAULT_HAIR, DEFAULT_SKIN, drawBody, hairFor, beardFor, type Look } from './body';
import { at, courtCam, drawCourt, drawHoopBack, drawHoopFront, facingOn, nearness } from './court';
import { PixBuf } from './pixbuf';
import { defend, dribble, idle, jumpShot, run } from './poses';

const home = { c1: '#ce1141', c2: '#ffffff', abbr: 'CHI' };
const road = { jersey: '#1d428a', trim: '#ffc72c' };

export default function Scene() {
  const ref = useRef<HTMLCanvasElement>(null);
  const q = new URLSearchParams(location.search);
  const W = Number(q.get('w') ?? 422);
  const H = Number(q.get('h') ?? 195);
  const zoom = Number(q.get('zoom') ?? 2);
  useEffect(() => {
    const cv = ref.current!;
    cv.width = W;
    cv.height = H;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cam = courtCam(W, H, 30);
    const buf = new PixBuf(W, H);
    drawCourt(buf, cam, home, 0, 0);
    drawHoopBack(buf, cam, home);
    // shadows first, onto the floor
    const players: { cx: number; cz: number; ht: number; wt: number; num: number; off: boolean; pose: string; id: string }[] = [
      { cx: 22, cz: 2, ht: 74, wt: 190, num: 3, off: true, pose: 'dribble', id: 'a' },
      { cx: 41, cz: -19, ht: 77, wt: 210, num: 11, off: true, pose: 'idle', id: 'b' },
      { cx: 35, cz: 16, ht: 79, wt: 225, num: 23, off: true, pose: 'run', id: 'c' },
      { cx: 38, cz: -6, ht: 81, wt: 245, num: 33, off: true, pose: 'idle', id: 'd' },
      { cx: 43, cz: 6, ht: 84, wt: 275, num: 50, off: true, pose: 'shot', id: 'e' },
      { cx: 25, cz: 2.5, ht: 75, wt: 195, num: 1, off: false, pose: 'defend', id: 'f' },
      { cx: 39, cz: -16, ht: 78, wt: 215, num: 8, off: false, pose: 'defend', id: 'g' },
      { cx: 36, cz: 12, ht: 80, wt: 230, num: 32, off: false, pose: 'defend', id: 'h' },
      { cx: 40, cz: -3, ht: 82, wt: 250, num: 42, off: false, pose: 'defend', id: 'i' },
      { cx: 44.5, cz: 3, ht: 85, wt: 280, num: 34, off: false, pose: 'contest', id: 'j' },
    ];
    for (const p of players) {
      const f = at(cam, p.cx, p.cz);
      const rx = cam.k * 1.0;
      const ry = rx * Math.sin(cam.pitch);
      for (let y = Math.floor(f.y - ry); y <= f.y + ry; y++)
        for (let x = Math.floor(f.x - rx); x <= f.x + rx; x++) {
          const d = ((x - f.x) / rx) ** 2 + ((y - f.y) / ry) ** 2;
          if (d <= 1) buf.tint(x, y, [30, 14, 6], 0.45);
        }
    }
    // soften the shadows: blend them back toward the floor
    buf.put(ctx);
    const sorted = [...players].sort((a, b) => nearness(cam, a.cx, a.cz) - nearness(cam, b.cx, b.cz));
    for (const p of sorted) {
      const look: Look = {
        sport: 'nba',
        ht: p.ht,
        wt: p.wt,
        num: p.num,
        hair: hairFor(p.id + 'x'),
        beard: beardFor(p.id),
        skin: DEFAULT_SKIN,
        hairColor: DEFAULT_HAIR,
        jersey: p.off ? road.jersey : '#ffffff',
        trim: p.off ? road.trim : home.c1,
        shorts: p.off ? road.jersey : '#ffffff',
        socks: '#f4f4f4',
        shoes: p.off ? '#111' : '#f4f4f4',
      };
      const pose = p.pose === 'dribble' ? dribble(0.15, 0.5) : p.pose === 'run' ? run(0.35, 1) : p.pose === 'shot' ? jumpShot(0.7) : p.pose === 'defend' ? defend(0.2, 1) : p.pose === 'contest' ? defend(0.2, 1) : idle(0.3);
      const facing = p.off ? facingOn(cam, 1, 0.6) : facingOn(cam, -1, 0.6);
      const px = (p.ht / 12) * cam.k;
      const s = drawBody(look, pose, { facing, pitch: cam.pitch }, px);
      const f = at(cam, p.cx, p.cz);
      ctx.drawImage(s.canvas, Math.round(f.x - s.ax), Math.round(f.y - s.ay));
      if (p.pose === 'dribble') {
        // the ball at his right hand, on its way down
        const bx = Math.round(f.x - s.ax + s.handR.x);
        const by = Math.round(f.y - s.ay + s.handR.y + cam.k * 1.1);
        ctx.fillStyle = '#e46a1c';
        ctx.beginPath();
        ctx.arc(bx, by, cam.k * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const top = new PixBuf(W, H);
    top.data.set(new Uint32Array(ctx.getImageData(0, 0, W, H).data.buffer));
    drawHoopFront(top, cam, 0);
    top.put(ctx);
  }, []);
  return (
    <div style={{ background: '#000', width: W * zoom, height: H * zoom }}>
      <canvas ref={ref} style={{ width: W * zoom, height: H * zoom, imageRendering: 'pixelated' }} />
    </div>
  );
}
