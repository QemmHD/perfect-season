// The arena's floor, stands and roof under the broadcast camera (nba-3; Claude 2026-11-16). The same
// top-down court picture and wall of fans the players team draws (`pixel/persp.ts courtTexture`), cast
// through the yawed three-quarter camera (`camera.ts`) a row at a time: a row of the screen meets the
// floor along a straight line, so its texels step evenly across it (two adds a pixel); only rows
// that reach the stands are cast pixel by pixel. Drawn at 1/q resolution and scaled up square.
import type { FieldTex } from '../pixel/persp';
import type { Cam3 } from './camera';

/** Draw the floor, the far wall and the sky into `out` (ceil(W/q) × ceil(H/q) pixels). */
export function drawCourtFloor(c: Cam3, tex: FieldTex, out: Uint32Array, q = 2): void {
  const { W, H, f, ch, pos, fwd, across } = c;
  const Wq = Math.ceil(W / q);
  const Hq = Math.ceil(H / q);
  const cs = Math.cos(c.pitch);
  const sn = Math.sin(c.pitch);
  const WALL = tex.wallY;
  const WALL_H = tex.wallH;
  const WK = tex.wallK;
  const wallRows = Math.round(WALL_H * WK);
  const lv0 = tex.lv[0];
  // court (cx along, cz across) → texture: col = (cz − x0)·k, row = (y0 − cx)·k
  const x0 = tex.x0;
  const y0 = tex.y0;
  for (let oy = 0; oy < Hq; oy++) {
    const sy = oy * q + q / 2;
    const row = oy * Wq;
    const v = (c.hy - sy) / f;
    // the ray through this row: forward (along the floor) and down parts, then across per pixel
    const fw = cs + v * sn;
    const dn = sn - v * cs;
    const x0p = (q / 2 - W / 2) / f;
    const dxp = q / f;
    // where the row's two ends meet the floor (if it reaches the floor at all)
    const t = dn > 1e-4 ? ch / dn : Infinity;
    const groundAt = (xp: number) => pos.cx + t * (fw * fwd.cx + xp * across.cx);
    const allFloor = t < 1e6 && groundAt(x0p) <= WALL && groundAt(x0p + dxp * (Wq - 1)) <= WALL;
    if (allFloor) {
      // the whole row is floor: one straight run through the texture
      const step = (t * q) / f;
      const want = step * lv0.k;
      const L = tex.lv[want < 1.6 ? 0 : want < 3.2 ? 1 : 2];
      const gcx = pos.cx + t * fw * fwd.cx + t * x0p * across.cx;
      const gcz = pos.cz + t * fw * fwd.cz + t * x0p * across.cz;
      let u = (gcz - x0) * L.k;
      let w = (y0 - gcx) * L.k;
      const du = t * dxp * across.cz * L.k;
      const dw = -t * dxp * across.cx * L.k;
      for (let ox = 0; ox < Wq; ox++, u += du, w += dw) {
        const tu = u | 0;
        const tw = w | 0;
        out[row + ox] = u >= 0 && w >= 0 && tu < L.w && tw < L.h ? L.px[tw * L.w + tu] : tex.dark;
      }
      continue;
    }
    // a row that reaches the stands (or the sky): pixel by pixel
    const L = tex.lv[2];
    for (let ox = 0; ox < Wq; ox++) {
      const xp = x0p + ox * dxp;
      const dcx = fw * fwd.cx + xp * across.cx;
      const dcz = fw * fwd.cz + xp * across.cz;
      if (t < 1e6 && pos.cx + t * dcx <= WALL) {
        const gcx = pos.cx + t * dcx;
        const gcz = pos.cz + t * dcz;
        const tu = ((gcz - x0) * L.k) | 0;
        const tw = ((y0 - gcx) * L.k) | 0;
        out[row + ox] = gcz >= x0 && gcx <= y0 && tu < L.w && tw < L.h ? L.px[tw * L.w + tu] : tex.dark;
        continue;
      }
      // the wall of fans: where the ray crosses its plane, and how high
      const lam = dcx > 1e-4 ? (WALL - pos.cx) / dcx : -1;
      const hgt = ch - lam * dn;
      if (lam > 0 && hgt >= 0 && hgt <= WALL_H) {
        const wy = Math.min(wallRows - 1, Math.max(0, Math.floor((WALL_H - hgt) * WK)));
        const wx = Math.floor((pos.cz + lam * dcz) * WK + tex.wallW * 64) % tex.wallW;
        out[row + ox] = tex.wall[wy * tex.wallW + (wx < 0 ? wx + tex.wallW : wx)];
      } else out[row + ox] = lam > 0 && hgt < 0 ? tex.dark : tex.sky[Math.max(0, Math.min(255, Math.round((sy / Math.max(1, H * 0.3)) * 255)))];
    }
  }
}
