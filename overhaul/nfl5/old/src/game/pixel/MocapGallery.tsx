// The motion-capture bench (?pixel=mocap): every clip played on three bodies (a 6'1" guard, a 7'0"
// center, a lineman in pads and helmet) at the games' camera pitches, with a scrubber marked at
// the clip's events. `&clip=jumpshot` opens one clip; `&strip=1` lays its key frames side by side
// instead (for screenshots); `&ground=pin` keeps the feet on the floor; `&root=1` lets the body
// travel with the recording.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_HAIR, DEFAULT_SKIN, drawBody, type Look } from './body';
import { type Clip, CLIPS, frame, type Ground, legScale, loadClip, mocapJoints } from './mocap';

const BODIES: { label: string; look: Look }[] = [
  {
    label: "guard 6'1\" 185",
    look: { sport: 'nba', ht: 73, wt: 185, num: 3, hair: 0, skin: DEFAULT_SKIN, hairColor: DEFAULT_HAIR, jersey: '#1d428a', trim: '#ffc72c', shorts: '#1d428a', socks: '#f2f2f2', shoes: '#1b1b1f' },
  },
  {
    label: "center 7'0\" 255",
    look: { sport: 'nba', ht: 84, wt: 255, num: 34, hair: 4, beard: true, skin: DEFAULT_SKIN, hairColor: DEFAULT_HAIR, jersey: '#ce1141', trim: '#ffffff', shorts: '#ce1141', socks: '#f2f2f2', shoes: '#1b1b1f' },
  },
  {
    label: "lineman 6'4\" 315",
    look: {
      sport: 'nfl',
      ht: 76,
      wt: 315,
      num: 72,
      hair: 0,
      skin: DEFAULT_SKIN,
      hairColor: DEFAULT_HAIR,
      jersey: '#203731',
      trim: '#ffb612',
      shorts: '#ffffff',
      socks: '#203731',
      shoes: '#1b1b1f',
      helmet: '#ffb612',
      stripe: '#203731',
      pants: '#ffffff',
      pads: 1,
    },
  },
];

/** the camera angles the games use: the court side-on, a three-quarter, and from above */
const VIEWS: { label: string; facing: number; pitch: number }[] = [
  { label: 'side 0.45', facing: 0, pitch: 0.45 },
  { label: '3/4 0.45', facing: 0.6, pitch: 0.45 },
  { label: 'above 0.8', facing: -0.5, pitch: 0.8 },
  { label: 'field 0.9', facing: Math.PI * 0.75, pitch: 0.9 },
  // for checking (only in strips, by &views=): straight down, and facing us
  { label: 'top 1.4', facing: 0, pitch: 1.4 },
  { label: 'front 0.45', facing: Math.PI / 2, pitch: 0.45 },
];

const PX = 64;
let SCALE = 2;

/** the frames worth a still: every event, and evenly spaced ones between */
function keyFrames(c: Clip, n = 10): { f: number; label: string }[] {
  const out = new Map<number, string>();
  const ev = c.meta.events;
  for (const [k, t] of Object.entries(ev)) {
    const f = Math.min(c.frames - 1, Math.round(t * c.fps));
    out.set(f, out.has(f) ? out.get(f) + '/' + k : k);
  }
  const spare = Math.max(0, n - out.size);
  for (let i = 0; i < spare; i++) {
    const f = Math.round((i / Math.max(1, spare - 1)) * (c.frames - 1));
    if (![...out.keys()].some((g) => Math.abs(g - f) < 2)) out.set(f, '');
  }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([f, label]) => ({ f, label }));
}

function drawCell(ctx: CanvasRenderingContext2D, look: Look, c: Clip, f: number, view: { facing: number; pitch: number }, x: number, y: number, ground: Ground, root: boolean) {
  const px = Math.round((PX * look.ht) / 78);
  const j = mocapJoints(c, f, look, { ground });
  const s = drawBody(look, j, view, px);
  let ox = 0;
  if (root) {
    // the recorded travel, on this body's legs, so planted feet stay planted
    const fr = frame(c, f);
    const k = legScale(look) * px;
    const X = fr.x * Math.cos(view.facing) - fr.z * Math.sin(view.facing);
    ox = Math.round(X * k * SCALE);
  }
  // the floor: a line and the shadow
  ctx.fillStyle = 'rgba(40,20,8,0.35)';
  ctx.fillRect(x - px * 0.4 * SCALE + ox, y - 2, px * 0.8 * SCALE, 4);
  ctx.drawImage(s.canvas, Math.round(x - s.ax * SCALE + ox), Math.round(y - s.ay * SCALE), s.canvas.width * SCALE, s.canvas.height * SCALE);
}

export default function MocapGallery() {
  const q = new URLSearchParams(location.search);
  const names = Object.keys(CLIPS);
  const [name, setName] = useState(q.get('clip') ?? names[0]);
  const [clip, setClip] = useState<Clip | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(!q.has('strip') && !q.has('t'));
  const [rate, setRate] = useState(1);
  const [ground, setGround] = useState<Ground>((q.get('ground') as Ground) ?? 'clip');
  const [root, setRoot] = useState(q.get('root') === '1');
  const strip = q.get('strip') === '1';
  SCALE = Number(q.get('scale') ?? 2);
  // &frames=0,9,21: just these frames in the strip
  const only = q.get('frames')?.split(',').map(Number);
  // &bodies=0,2 and &views=0,1: which rows
  const bodySel = q.get('bodies')?.split(',').map(Number);
  const viewSel = q.get('views')?.split(',').map(Number) ?? [0, 2];
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    setClip(null);
    loadClip(name).then((c) => {
      if (!live) return;
      setClip(c);
      setT(Number(q.get('t') ?? 0));
      (window as unknown as { __mocapReady: string }).__mocapReady = name;
    });
    return () => {
      live = false;
    };
  }, [name]);

  useEffect(() => {
    if (!playing || !clip || strip) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((v) => {
        const n = v + dt * rate;
        return n > clip.meta.duration + (clip.meta.loop ? 0 : 0.6) ? 0 : n;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, clip, rate, strip]);

  const keys = useMemo(() => (clip ? (only ? only.map((f) => ({ f, label: '' })) : keyFrames(clip)) : []), [clip]);

  useEffect(() => {
    const cv = ref.current;
    if (!cv || !clip) return;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const cellW = PX * 1.25 * SCALE;
    const cellH = PX * 1.25 * SCALE * 1.15;
    if (strip) {
      const rows: { look: Look; view: (typeof VIEWS)[number]; label: string }[] = [];
      for (const b of bodySel ? bodySel.map((i) => BODIES[i]) : BODIES) for (const v of viewSel.map((i) => VIEWS[i])) rows.push({ look: b.look, view: v, label: b.label + ' · ' + v.label });
      const w = Math.ceil(cellW * 0.82 * keys.length + 40);
      cv.width = w;
      cv.height = Math.ceil(rows.length * cellH + 40);
      ctx.fillStyle = '#c98d55';
      ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.font = '12px monospace';
      ctx.imageSmoothingEnabled = false;
      keys.forEach((k, i) => {
        ctx.fillStyle = '#20120a';
        ctx.fillText('#' + k.f + ' ' + (k.f / clip.fps).toFixed(2) + 's ' + k.label, 8 + i * cellW * 0.82, 14);
      });
      rows.forEach((r, ri) => {
        const y = 30 + (ri + 1) * cellH - 14;
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(0, y, cv.width, 1);
        ctx.fillStyle = '#20120a';
        ctx.fillText(r.label, 6, y - cellH + 26);
        keys.forEach((k, i) => drawCell(ctx, r.look, clip, k.f, r.view, 8 + i * cellW * 0.82 + cellW * 0.4, y, ground, false));
      });
      return;
    }
    const views = VIEWS.slice(0, 4);
    cv.width = Math.ceil(cellW * views.length + 40);
    cv.height = Math.ceil(cellH * BODIES.length + 30);
    ctx.fillStyle = '#c98d55';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.font = '12px monospace';
    ctx.imageSmoothingEnabled = false;
    const f = Math.min(clip.frames - 1, Math.round(((clip.meta.loop ? t % clip.meta.duration : t) * clip.fps)));
    BODIES.forEach((b, bi) => {
      views.forEach((v, vi) => {
        const y = 20 + (bi + 1) * cellH - 14;
        const x = 20 + vi * cellW + cellW / 2;
        if (bi === 0) {
          ctx.fillStyle = '#20120a';
          ctx.fillText(v.label, x - cellW / 2 + 4, 14);
        }
        drawCell(ctx, b.look, clip, f, v, x, y, ground, root);
      });
      ctx.fillStyle = '#20120a';
      ctx.fillText(b.label, 4, 20 + (bi + 1) * cellH - 2);
    });
  }, [clip, t, keys, ground, root, strip]);

  const dur = clip?.meta.duration ?? 1;
  return (
    <div style={{ padding: 8, fontFamily: 'monospace', fontSize: 12, color: '#eee', background: '#2a1d14', minHeight: '100vh' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
        {names.map((n) => (
          <button key={n} onClick={() => setName(n)} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 6px', background: n === name ? '#ffc72c' : '#4a3626', color: n === name ? '#000' : '#eee', border: 0 }}>
            {n}
          </button>
        ))}
      </div>
      {clip && (
        <div style={{ marginBottom: 6 }}>
          <b>{name}</b> · CMU {clip.meta.src} · {clip.meta.desc} · {clip.frames} frames · {dur.toFixed(2)} s{clip.meta.loop ? ' · loop' : ''}
          {clip.meta.mirrorOf ? ' · mirror of ' + clip.meta.mirrorOf : ''}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <button onClick={() => setPlaying(!playing)}>{playing ? 'pause' : 'play'}</button>
            <select value={rate} onChange={(e) => setRate(Number(e.target.value))}>
              {[0.1, 0.25, 0.5, 1].map((r) => (
                <option key={r} value={r}>
                  {r}x
                </option>
              ))}
            </select>
            <label>
              <input type="checkbox" checked={ground === 'pin'} onChange={(e) => setGround(e.target.checked ? 'pin' : 'clip')} /> pin feet
            </label>
            <label>
              <input type="checkbox" checked={root} onChange={(e) => setRoot(e.target.checked)} /> root motion
            </label>
            <span>
              t {t.toFixed(2)} s · frame {Math.min(clip.frames - 1, Math.round((clip.meta.loop ? t % dur : t) * clip.fps))}
            </span>
          </div>
          <div style={{ position: 'relative', width: 640, height: 34, marginTop: 4 }}>
            <input type="range" min={0} max={dur} step={1 / clip.fps} value={Math.min(dur, clip.meta.loop ? t % dur : t)} onChange={(e) => (setPlaying(false), setT(Number(e.target.value)))} style={{ width: 640 }} />
            {Object.entries(clip.meta.events).map(([k, et]) => (
              <span key={k} title={k} style={{ position: 'absolute', left: (et / dur) * 632 + 4, top: 20, fontSize: 9, color: '#ffc72c', whiteSpace: 'nowrap', borderLeft: '1px solid #ffc72c', paddingLeft: 2 }}>
                {k}
              </span>
            ))}
            {Object.entries(clip.meta.beats ?? {}).flatMap(([k, ts]) =>
              ts.map((bt, i) => <span key={k + i} title={k} style={{ position: 'absolute', left: (bt / dur) * 632 + 4, top: 16, width: 1, height: 6, background: k === 'stepL' ? '#7fd' : k === 'stepR' ? '#f7d' : '#fff' }} />),
            )}
          </div>
        </div>
      )}
      <canvas ref={ref} style={{ imageRendering: 'pixelated', display: 'block' }} />
    </div>
  );
}

