// Implemented by Codex. Original procedural particles, capped at 30fps / 72 motes / 2x DPR.
import React, { useEffect, useRef } from 'react';
export interface PackAtmosphereProps {
  phase: string;
  step: number;
  surge: boolean;
  goat: boolean;
  premium: boolean;
  seed: string;
}
export function PackAtmosphere(props: PackAtmosphereProps) {
  const canvas = useRef<HTMLCanvasElement>(null),
    latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const el = canvas.current,
      ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    let W = 1,
      H = 1,
      raf = 0,
      last = 0,
      scene = '',
      since = 0,
      seed = 2166136261;
    for (const ch of latest.current.seed) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const motes = Array.from({ length: 72 }, () => ({
      angle: rand() * Math.PI * 2,
      depth: rand(),
      speed: 0.08 + rand() * 0.14,
      size: 0.6 + rand() * 1.5,
      drift: rand(),
    }));
    const resize = () => {
      const r = el.getBoundingClientRect();
      W = r.width;
      H = r.height;
      const d = Math.min(2, window.devicePixelRatio || 1);
      el.width = Math.max(1, Math.round(W * d));
      el.height = Math.max(1, Math.round(H * d));
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (document.hidden || now - last < 1000 / 30) return;
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const p = latest.current,
        key = p.phase + ':' + p.step + ':' + p.surge;
      if (key !== scene) {
        scene = key;
        since = now;
      }
      const age = (now - since) / 1000,
        cx = W / 2,
        cy = H * (p.phase === 'pack' || p.phase === 'tear' ? 0.44 : 0.49),
        radius = Math.min(W, H) * 0.48;
      const gold = p.goat && (p.surge || p.step >= 3),
        ink = gold ? '246,211,139' : p.premium ? '159,226,226' : '82,222,203';
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      // A deep, quiet light well. Text and card faces always render above this canvas.
      const halo = ctx.createRadialGradient(cx, cy, 8, cx, cy, radius * 1.25);
      halo.addColorStop(0, `rgba(${ink},${p.step >= 3 ? 0.13 : 0.06})`);
      halo.addColorStop(1, `rgba(${ink},0)`);
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, W, H);
      const burst = p.phase === 'walkout' && (p.step === 3 || (p.surge && p.step < 3));
      for (const m of motes) {
        m.depth = (m.depth + dt * m.speed * (p.phase === 'tear' ? 2.8 : p.phase === 'walkout' ? 1.4 : 0.14)) % 1;
        const d = burst ? (m.depth + age * 0.35) % 1 : m.depth;
        const r = radius * (0.08 + d * d * 1.65),
          a = m.angle + Math.sin(now / 1800 + m.drift * 7) * 0.025;
        const x = cx + Math.cos(a) * r,
          y = cy + Math.sin(a) * r * ((H / W) * 0.6);
        const alpha = (1 - d) * (0.18 + (p.phase === 'tear' || burst ? 0.42 : 0.14));
        ctx.strokeStyle = `rgba(${ink},${alpha})`;
        ctx.fillStyle = `rgba(${ink},${alpha})`;
        ctx.lineWidth = m.size;
        if (p.phase === 'tear' || (p.phase === 'walkout' && p.step < 3)) {
          const trail = 1 - Math.min(0.18, dt * (p.phase === 'tear' ? 9 : 4));
          ctx.beginPath();
          ctx.moveTo(cx + (x - cx) * trail, cy + (y - cy) * trail);
          ctx.lineTo(x, y);
          ctx.stroke();
        } else ctx.fillRect(x, y, m.size, m.size * (gold ? 1.9 : 1));
      }
      if (burst && age < 1.15) {
        for (let i = 0; i < 2; i++) {
          const k = Math.max(0, age - i * 0.12);
          if (!k) continue;
          ctx.strokeStyle = `rgba(${ink},${Math.max(0, 0.3 - k * 0.28)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.ellipse(cx, cy, radius * (0.2 + k * 1.6), radius * (0.2 + k * 1.6) * 0.58, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      el.width = 1;
      el.height = 1;
    };
  }, []);
  return <canvas className="ut-cinema-fx" ref={canvas} aria-hidden="true" />;
}
