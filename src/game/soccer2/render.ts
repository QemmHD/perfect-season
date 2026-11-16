// Soccer v2 drawn as pixel art: implemented by Claude (Anthropic), 2026-11-01, in the style of the
// football field (football2/render.ts). A broadcast camera with perspective sits behind the attack
// looking at the goal; the pitch is drawn a row at a time from its top-down picture (persp.ts'
// "mode 7" floor) with the far stand behind the goal. On it: the goal frame and its net, the rigged
// players in their kits playing the motion-capture clips (the CMU kick for passes and shots, the dive
// for a keeper's save and a slide tackle), the ball and its shadow, and the HUD drawn in the world:
// the ring on the man you control, his stamina, the pass he'd play, the power meter's arch with its
// green slice and the aim in the goal mouth with the shot's error cone. Claude 2026-11-02: the pass
// line, the aim reticle and a small goal over the meter (where it's going, past the keeper), a ring
// that tightens as the meter nears the green, and the release read-out (PERFECT / GOOD / EARLY / LATE).
// Claude 2026-11-16 (studio overhaul soccer-3, Game Design V2 B.3.3, C.1.3, C.2, B.3.7): the camera is
// camera.ts' (34 m across, the action-safe box, Clutch 6% tighter); the pitch is one PITCH palette
// (mow stripes, lines, run-off, word-mark boards, light pools, three crowd bands) drawn once and cached
// by the quantised camera; a vignette and depth haze over it; gold, teal and red ground rings; teal
// edge arrows for teammates outside the box; a 3-frame net bulge, the ball's trail on hard shots and a
// post that shivers when it's hit.
// What each player looks like and which clip or pose he shows is chosen in pixel/select-soccer.ts.
import { drawBody, freeCanvas, type Look, SpriteCache, CanvasOut } from '../pixel/body';
import { mix, type RGB, rgb } from '../pixel/color';
import { frameAt, mocapJoints, mocapKey } from '../pixel/mocap';
import { drawGate } from '../pixel/ready';
import { drawFloor, type FieldTex, levels, type PCam, pitchAt, project, skyRamp } from '../pixel/persp';
import { onLine, type PitchTheme } from '../pixel/pitch';
import { noise, PixBuf } from '../pixel/pixbuf';
import { type ArtScale, ART_C, type ArtSprite, blitSprite, quantPx, toView } from '../pixel/art-scale';
import { drawGroundMark, MARK_COLOR } from '../pixel/ground';
import { drawnHeight, shoulderWidthPx } from '../pixel/proportions';
import { animOf, heightM, lookFor, type Memo } from '../pixel/select-soccer';
import { reducedMotion } from '../../ui/motion';
import { artOf, ballR, type Box, camStep, type CamState, heightK, newCamState, SPRITE_TILT, spriteScale, WALL_Y } from './camera';
import { aimPoint, coneMult, GH, GHALF, GX, METER, PL, PW, ctrlOf, timingMiss, timingWord, type PassPlan } from './engine';
import { nearestWithin, TAP_PLAYER_PX } from './controls';
import { shotCone, topSpeed } from './ratings';
import type { Attack, Body, Pt } from './types';

/** moved to pixel/select-soccer.ts (players-2); re-exported for the QA tools that import it here */
export { lookFor } from '../pixel/select-soccer';

export interface SoccerKit {
  jersey: string;
  trim: string;
  shorts: string;
  socks: string;
  shoes: string;
  /** a keeper's */
  gloves?: string;
}

export interface SoccerOverlay {
  /** the teammate a pass would go to now (the stick's choice) */
  target: number | null;
  /** the pass the stick would play now (its line on the grass) */
  pass?: PassPlan | null;
  /** the screen shake this frame (px, from fx.ts' trauma) */
  jolt?: { x: number; y: number };
  flash: number;
  /** names over everyone (before kick-off) */
  names: boolean;
  /**
   * The man in control is ours (V-3, Claude 2026-11-16, soccer-2): our side gets the gold ground ring
   * and a gold name tag; the rival's taker (their penalty in a shootout) a violet ring and tag, never
   * ours. Default true.
   */
  ours?: boolean;
  /** screen bands no tag may print over (the toast line while it shows), canvas px */
  keepOut?: { x: number; y: number; w: number; h: number }[];
}

/** A name tag or a word over the pitch, waiting for the label pass (layoutLabels). */
export interface Tag {
  s: string;
  x: number;
  y: number;
  color: string;
  /** who keeps his spot when two meet: the higher stays, the lower moves up */
  prio: number;
}
/** Tag colours: ours gold, a teammate teal, the rival violet (V2 C.3). */
export const TAG = { ours: '#ffe08a', mate: '#7ff5d6', rival: '#c4b5fd', word: '#d6e5ed', white: '#ffffff' } as const;

/* ---------- the pitch (V2 C.2): one palette, retunable by the players team under its venue grant ---------- */

/** Every colour and amount the pitch, its boards, its crowd and its light are drawn with. */
export const PITCH = {
  /** mow stripes across the pitch, every `stripeM` metres, and a faint checker along it */
  stripes: ['#2e9a4a', '#288a41'] as const,
  stripeM: 5.5,
  checker: 0.035,
  /** grass texture (± share) */
  grain: 0.05,
  /** the markings, blended over the grass */
  line: '#f2fff2',
  lineA: 0.85,
  /** the run-off outside the lines, this much darker */
  runoff: 0.12,
  /** the boards: panel, light strip, word mark */
  board: '#141a2a',
  boardText: '#e9f1ff',
  /** the word mark on the boards behind the goal (original, no sponsor) */
  boardWords: 'PERFECT SEASON   ',
  /** the crowd's three value bands, nearest the pitch last, in 2-texel blocks */
  crowd: ['#221d36', '#342d52', '#4a426e'] as const,
  fleck: 0.06,
  white: 0.02,
  /** four floodlight pools on the grass: centre (m), radius (m), how much brighter toward `poolC` */
  pools: [
    { x: 12, y: 24, r: 24 },
    { x: 56, y: 24, r: 24 },
    { x: 12, y: 82, r: 24 },
    { x: 56, y: 82, r: 24 },
  ],
  poolC: '#fff6d6',
  poolK: 0.14,
  /** the screen overlay: corners this much darker (night vignette); the top this much darker and greyer (depth) */
  vignette: 0.18,
  depth: 0.06,
  haze: '#466e6e',
  /** the far stand's height (m) and texels a metre */
  wallH: 16,
  wallK: 5,
} as const;

/** The texture's span (metres): the pitch, its run-off and boards, the fans along the touchlines. */
const TX0 = -16;
const TX1 = 84;
const TY0 = -4;
const TY1 = 116;

/** The pitch, from straight above (8 texels a metre), as the perspective camera's floor, with its far stand. */
export function pitchTex(theme: PitchTheme): FieldTex {
  const k = 8;
  const W = (TX1 - TX0) * k;
  const H = (TY1 - TY0) * k;
  const buf = new PixBuf(W, H);
  const home = rgb(theme.homeC1);
  const trim = rgb(theme.homeC2);
  const away = rgb(theme.awayC1);
  const stripes = PITCH.stripes.map(rgb);
  const line = rgb(PITCH.line);
  const pool = rgb(PITCH.poolC);
  const board = rgb(PITCH.board);
  const boardText = rgb(PITCH.boardText);
  const bands = PITCH.crowd.map(rgb);
  const dark: RGB = [14, 22, 16];
  const word = PITCH.boardWords.toUpperCase();
  // the boards behind the goal line, 1.25 m deep: the word mark in 2-texel letter pixels
  const BOARD_Y0 = PL + 4.6;
  const BOARD_Y1 = BOARD_Y0 + 1.25;
  const fan = (side: number, row: number, seat: number): RGB => {
    const n = noise(seat, row, side);
    const band = bands[Math.max(0, 2 - Math.min(2, Math.floor(row / 3)))];
    if (n < PITCH.white) return [236, 236, 240];
    if (n < PITCH.white + PITCH.fleck) return n < PITCH.white + PITCH.fleck / 2 ? home : away;
    return mix(band, [0, 0, 0], noise(seat, row, side + 7) * 0.18);
  };
  for (let ty = 0; ty < H; ty++) {
    const y = TY1 - (ty + 0.5) / k;
    for (let tx = 0; tx < W; tx++) {
      const x = TX0 + (tx + 0.5) / k;
      let col: RGB;
      if (x >= -4 && x <= PW + 4 && y >= -4 && y <= PL + 4) {
        const stripe = ((Math.floor((y + 1e-4) / PITCH.stripeM) % 2) + 2) % 2;
        const across = ((Math.floor((x + 1e-4) / 8.5) % 2) + 2) % 2;
        col = mix(stripes[stripe], across ? [255, 255, 255] : [0, 0, 0], PITCH.checker * 0.5);
        const n = noise(Math.floor(x * 3), Math.floor(y * 3), 3) * 2 - 1;
        col = mix(col, n > 0 ? [190, 230, 150] : [16, 44, 18], Math.abs(n) * PITCH.grain);
        let light = 0;
        for (const p of PITCH.pools) light = Math.max(light, 1 - Math.hypot(x - p.x, y - p.y) / p.r);
        if (light > 0) col = mix(col, pool, light * light * PITCH.poolK);
        if (x < 0 || x > PW || y < 0 || y > PL) col = mix(col, dark, PITCH.runoff);
        if (onLine(x, y)) col = mix(col, line, PITCH.lineA);
      } else if (y > BOARD_Y0 && y < BOARD_Y1 && x > -6 && x < PW + 6) {
        // the boards behind the goal: a lit top edge and the word mark (letters read upright from the camera)
        const gy = Math.floor((BOARD_Y1 - y) * k) - 2;
        const gx = Math.floor((x + 6) * k);
        col = gy < 0 ? mix(board, boardText, 0.35) : board;
        const ch = Math.floor(gx / 8);
        const g = F35[word[ch % word.length]];
        const cx = Math.floor((gx % 8) / 2);
        const cy = Math.floor(gy / 2);
        if (g && cx < 3 && cy >= 0 && cy < 5 && g[cy * 3 + cx] === '1') col = boardText;
      } else if (x > -6 && x < PW + 6 && y > -6 && y < PL + 6) {
        // the boards along the touchlines: home colours in panels with a light strip
        const along = ((Math.floor(y / 3.2) % 2) + 2) % 2;
        col = Math.abs(x + 5) < 0.6 || Math.abs(x - (PW + 5)) < 0.6 ? (along ? mix(trim, [255, 255, 255], 0.2) : home) : board;
      } else if (x > -8 && x < PW + 8 && y > -8 && y < PL + 8) col = [18, 20, 30];
      else {
        // the fans from above, rows of 2-texel blocks in the three bands
        const side = x < 0 ? -x - 8 : x - (PW + 8);
        const row = Math.floor(Math.max(0, side) / 0.9);
        const seat = Math.floor(y * 4);
        col = Math.max(0, side) % 0.9 < 0.2 ? [16, 14, 26] : fan(x < 0 ? 1 : 2, row, seat);
      }
      buf.set(tx, ty, PixBuf.pack(col));
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  buf.put(canvas.getContext('2d')!);
  const lv = levels(canvas, k);
  freeCanvas(canvas);
  const { wall, wallW } = crowdWall(home, trim, away, bands);
  return { lv, x0: TX0, y0: TY1, dark: PixBuf.pack(dark), wallY: WALL_Y, wallH: PITCH.wallH, wallK: PITCH.wallK, wall, wallW, sky: skyRamp() };
}

/** The far stand: a padded wall, an LED ribbon in the home colours, then the crowd in three bands
 * (brightest nearest the pitch) of 2-texel blocks with team flecks and a few white shirts. */
function crowdWall(home: RGB, trim: RGB, away: RGB, bands: RGB[]): { wall: Uint32Array; wallW: number } {
  const wallW = 512;
  const k = PITCH.wallK;
  const wallH = Math.round(PITCH.wallH * k);
  const wall = new Uint32Array(wallW * wallH);
  for (let y = 0; y < wallH; y++) {
    const up = PITCH.wallH - y / k;
    for (let x = 0; x < wallW; x++) {
      let c: RGB;
      if (up < 0.9) c = [20, 18, 28];
      else if (up < 1.8) c = Math.floor(x / 24) % 2 ? mix(home, [255, 255, 255], 0.15) : trim;
      else {
        const bx = x >> 1;
        const by = y >> 1;
        const n = noise(bx, by, 11);
        const tier = up < 6.5 ? 2 : up < 11 ? 1 : 0;
        if (n < PITCH.white) c = [236, 236, 240];
        else if (n < PITCH.white + PITCH.fleck) c = n < PITCH.white + PITCH.fleck / 2 ? home : away;
        else c = mix(bands[tier], [0, 0, 0], noise(bx, by, 5) * 0.2);
        if (by % 3 === 2) c = mix(c, [0, 0, 0], 0.3);
      }
      wall[y * wallW + x] = PixBuf.pack(c);
    }
  }
  return { wall, wallW };
}

/** his drawn height in metres (V2's spread around the game's mean height) */
const drawnM = (b: Body) => (drawnHeight('soccer', b.p.ht / 2.54) * 2.54) / 100;

export class SoccerRenderer {
  W = 0;
  H = 0;
  zoom = 1;
  private cam: PCam | null = null;
  private tex: FieldTex | null = null;
  private floor: { canvas: HTMLCanvasElement; img: ImageData; px: Uint32Array } | null = null;
  private sprites = new SpriteCache<ArtSprite>(700);
  /** the art pixel (pixel/art-scale.ts), set by the screen from its canvas each frame */
  art: ArtScale = ART_C;
  private looks = new Map<string, Look>();
  private memos = new Map<string, Memo>();
  private last = new Map<string, ArtSprite>();
  private budget = 0;
  private bits: { x: number; y: number; h: number; vx: number; vy: number; vh: number; life: number; color: string; size: number }[] = [];
  private acts = new Map<string, string>();
  private lastNow = 0;
  private goalAt: number | null = null;
  /** an instant replay: push the camera in on this spot */
  replay: Pt | null = null;
  /** the camera's memory (camera.ts) */
  private camSt: CamState = newCamState();
  /** the sprites' size factor and the heights' lift for this screen (camera.ts; 1 in landscape) */
  private artK = 1;
  private hk = 1;
  /**
   * What the host tells the camera and the HUD each frame: the action-safe box, the rects no name tag
   * may print over (the buttons, the stick, the bug, pause), the stoppage attack (Clutch).
   */
  frameInfo: { safe: Box | null; controls: Box[]; clutch: boolean } = { safe: null, controls: [], clutch: false };
  /** the floor drawn last, and the camera it was drawn for (redrawn only when that changes) */
  private floorKey = '';
  /** the night vignette and depth haze, drawn once per screen size */
  private overlay: HTMLCanvasElement | null = null;
  /** the 3-frame net bulge: frames drawn since the goal */
  private bulgeFrames = -1;
  /** the post that rang (performance.now() ms) */
  private postAt = -1e9;
  /** the ball's last few spots on screen (its trail on a hard shot) */
  private trail: { x: number; y: number }[] = [];
  /** teammates outside the box: their arrows at its edge (for tap-to-pass) */
  arrows: { id: number; x: number; y: number; ang: number }[] = [];
  /** draws, sprites asked for, stale sprites reused, floor redraws; the man's and the ball's size on screen */
  stats = { draws: 0, sprites: 0, stale: 0, floors: 0, ctrlPx: 0, ballPx: 0 };
  /** set once the first frame with the pitch and the players has been drawn (shell's ps:arena-ready) */
  firstFrame = false;
  private lastDraw = 0;

  constructor(
    private theme: PitchTheme,
    private kits: { us: SoccerKit; them: SoccerKit; usGk: SoccerKit; themGk: SoccerKit },
  ) {}

  dispose() {
    this.sprites.dispose();
    for (const s of this.last.values()) freeCanvas(s.canvas);
    this.last.clear();
    freeCanvas(this.floor?.canvas);
    this.floor = null;
    freeCanvas(this.overlay);
    this.overlay = null;
  }

  /** a new attack (or a shootout kick by the other side): the kits swap with the sides */
  sidesSwapped = false;

  resize(cssW: number, cssH: number) {
    const W = Math.max(1, Math.round(cssW));
    const H = Math.max(1, Math.round(cssH));
    if (W === this.W && H === this.H) return;
    this.W = W;
    this.H = H;
    freeCanvas(this.floor?.canvas);
    this.floor = null;
    this.floorKey = '';
    freeCanvas(this.overlay);
    this.overlay = null;
    const land = W > H;
    this.artK = land ? 1 : artOf(W);
    this.hk = land ? 1 : heightK(W);
    this.camSt = newCamState();
  }

  /** The action-safe box this frame: the host's, or (before it has one) the screen under a bug's height. */
  private safe(): Box {
    return this.frameInfo.safe ?? { x: 0, y: Math.round(this.H * 0.13), w: this.W, h: Math.round(this.H * 0.54) };
  }

  /** A pitch point on screen; heights are lifted with the sprites (camera.ts heightK). */
  private lens(x: number, y: number, h = 0) {
    return project(this.cam!, x, y, h * this.hk);
  }

  /** The sprites' look-down angle at a pitch row: never steeper than SPRITE_TILT (camera.ts). */
  private tiltAt(y: number) {
    return Math.min(SPRITE_TILT, pitchAt(this.cam!, y));
  }

  private sprite(b: Body, t: number, s: number, kitSide: 'us' | 'them'): ArtSprite {
    const who = b.p.id + '|' + b.side + '|' + kitSide;
    let memo = this.memos.get(who);
    if (!memo) {
      memo = { gait: { t, frac: (b.id * 0.29) % 1 }, face: { x: b.fx, y: b.fy }, faceAt: t };
      this.memos.set(who, memo);
    }
    const grounded = b.act === 'tackle' || b.act === 'down' || b.act === 'dive';
    let dir = { x: b.fx, y: b.fy };
    if (b.role === 'gk' && b.act === 'dive') dir = { x: Math.sign(b.vx) || 1, y: 0 };
    if (!grounded || b.role === 'gk') {
      const target = Math.atan2(dir.y, dir.x);
      const old = Math.atan2(memo.face.y, memo.face.x);
      const delta = Math.atan2(Math.sin(target - old), Math.cos(target - old));
      const k = b.act === 'dive' || b.act === 'kick' ? 1 : Math.min(1, Math.max(0, t - memo.faceAt) * 12);
      const f = old + delta * k;
      memo.face = { x: Math.cos(f), y: Math.sin(f) };
    }
    memo.faceAt = t;
    dir = memo.face;
    // drawn with V2's height spread around the game's mean (render only: the engine keeps b.p.ht)
    // rasterised at its own art size (far players natively, never scaled down from a bigger drawing)
    const raw = Math.max(8, this.art.artPxFor(drawnM(b) * s));
    const px = quantPx(raw, this.art.viewPerArt);
    const dirs = px < 22 ? 8 : 16;
    const facing = Math.atan2(-dir.y, dir.x);
    const fb = (Math.round((facing / (Math.PI * 2)) * dirs) + dirs) % dirs;
    const pitch = Math.round(this.tiltAt(b.y) / 0.15) * 0.15;
    let look = this.looks.get(who);
    if (!look) {
      const kit = kitSide === 'us' ? this.kits.us : this.kits.them;
      const gk = kitSide === 'us' ? this.kits.usGk : this.kits.themGk;
      look = lookFor(b, kit, gk);
      this.looks.set(who, look);
    }
    const an = animOf(b, t, look, memo);
    const step = an.clip ? (px < 22 ? Math.max(3, an.step ?? 2) : (an.step ?? 2)) : 1;
    const frame = an.clip ? frameAt(an.clip, an.ct ?? 0, step) : 0;
    const key = an.clip ? mocapKey(an.clip, frame, 'clip') : an.key;
    const k = who + '|' + key + '|' + fb + '/' + dirs + '|' + px + '|' + pitch + this.art.keySuffix;
    let spr = this.sprites.get(k);
    this.stats.sprites++;
    if (!spr) {
      const last = this.last.get(who);
      if (this.budget <= 0 && last) {
        this.stats.stale++;
        return last;
      }
      this.budget--;
      const view = { facing: (fb / dirs) * Math.PI * 2, pitch };
      const make = () => (an.clip ? drawBody(look!, mocapJoints(an.clip, frame, look!, { ground: 'clip' }), view, px) : drawBody(look!, { ...an.pose, lift: 0 }, view, px));
      try {
        spr = toView(make(), this.art);
      } catch (e) {
        if (!(e instanceof CanvasOut)) throw e;
        this.sprites.dispose(this.last.values());
        try {
          spr = toView(make(), this.art);
        } catch {
          if (last) return last;
          throw e;
        }
      }
      this.sprites.set(k, spr, this.last.values());
    }
    this.last.set(who, spr);
    return spr;
  }

  /**
   * The floor (grass, boards, the far stand, the sky), drawn at half resolution into an offscreen
   * canvas and redrawn only when the camera has moved by a pixel or more (V2 C.6: a still camera costs
   * one blit).
   */
  private drawGround(ctx: CanvasRenderingContext2D) {
    if (!this.tex) this.tex = pitchTex(this.theme);
    const q = 2;
    if (!this.floor) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(this.W / q);
      canvas.height = Math.ceil(this.H / q);
      const img = canvas.getContext('2d')!.createImageData(canvas.width, canvas.height);
      this.floor = { canvas, img, px: new Uint32Array(img.data.buffer) };
      this.floorKey = '';
    }
    const fl = this.floor;
    const c = this.cam!;
    // the camera to about a pixel (a tenth of a metre at 9-12 px a metre), the axis row, the lens
    const px = 10;
    const key = [Math.round(c.cx * px), Math.round(c.cy * px), Math.round(c.ch * px), Math.round(c.hy), Math.round(c.f), c.pitch.toFixed(3)].join(',');
    if (key !== this.floorKey) {
      this.floorKey = key;
      this.stats.floors++;
      drawFloor(c, this.tex, fl.px, q);
      fl.canvas.getContext('2d')!.putImageData(fl.img, 0, 0);
    }
    ctx.drawImage(fl.canvas, 0, 0, fl.canvas.width * q, fl.canvas.height * q);
  }

  /** The night vignette (corners darker) and the depth haze (the top of the screen darker and greyer),
   * built once per screen size and laid over the scene in one blit. */
  private drawOverlay(ctx: CanvasRenderingContext2D) {
    if (!this.overlay) {
      const cv = document.createElement('canvas');
      cv.width = this.W;
      cv.height = this.H;
      const g = cv.getContext('2d')!;
      const haze = rgb(PITCH.haze);
      const depth = g.createLinearGradient(0, 0, 0, this.H * 0.6);
      depth.addColorStop(0, 'rgba(' + haze.join(',') + ',' + (PITCH.depth * 2).toFixed(3) + ')');
      depth.addColorStop(1, 'rgba(' + haze.join(',') + ',0)');
      g.fillStyle = depth;
      g.fillRect(0, 0, this.W, this.H);
      const r = Math.hypot(this.W, this.H) / 2;
      const vig = g.createRadialGradient(this.W / 2, this.H * 0.48, r * 0.45, this.W / 2, this.H * 0.48, r);
      vig.addColorStop(0, 'rgba(4,6,14,0)');
      vig.addColorStop(1, 'rgba(4,6,14,' + PITCH.vignette.toFixed(2) + ')');
      g.fillStyle = vig;
      g.fillRect(0, 0, this.W, this.H);
      this.overlay = cv;
    }
    ctx.drawImage(this.overlay, 0, 0);
  }

  /** The net (behind the frame): its back, sides and roof, in a mesh, bulging where the ball hit:
   * three frames out, then back over a quarter second (none with reduced motion). */
  private net(ctx: CanvasRenderingContext2D, a: Attack) {
    const D = 2.1;
    const backH = 1.95;
    const f = this.bulgeFrames;
    const bulge = f < 0 || reducedMotion() ? 0 : f < 3 ? 1 : Math.max(0, 1 - (f - 3) / 15);
    const bx = a.ball.x;
    const back = (x: number, h: number) => {
      const near = Math.max(0, 1 - Math.hypot(x - bx, h - Math.min(a.ball.h, 1.5)) / 1.6);
      return this.lens(x, PL + D + bulge * near * 0.6, h);
    };
    ctx.save();
    // the shadow inside the goal
    ctx.fillStyle = 'rgba(8,18,10,0.35)';
    const g0 = this.lens(GX - GHALF, PL);
    const g1 = this.lens(GX + GHALF, PL);
    const g2 = this.lens(GX + GHALF, PL + D);
    const g3 = this.lens(GX - GHALF, PL + D);
    ctx.beginPath();
    ctx.moveTo(g0.x, g0.y);
    ctx.lineTo(g1.x, g1.y);
    ctx.lineTo(g2.x, g2.y);
    ctx.lineTo(g3.x, g3.y);
    ctx.fill();
    // the back net, a light film
    const c0 = back(GX - GHALF, 0);
    const c1 = back(GX + GHALF, 0);
    const c2 = back(GX + GHALF, backH);
    const c3 = back(GX - GHALF, backH);
    ctx.fillStyle = 'rgba(235,240,245,0.12)';
    ctx.beginPath();
    ctx.moveTo(c0.x, c0.y);
    ctx.lineTo(c1.x, c1.y);
    ctx.lineTo(c2.x, c2.y);
    ctx.lineTo(c3.x, c3.y);
    ctx.fill();
    const s = this.lens(GX, PL).s;
    ctx.strokeStyle = 'rgba(240,244,248,0.42)';
    ctx.lineWidth = Math.max(1, Math.round(s * 0.035));
    ctx.beginPath();
    const mesh = s > 14 ? 0.35 : 0.55;
    // the back: verticals and rows
    for (let x = GX - GHALF; x <= GX + GHALF + 1e-6; x += mesh) {
      const p0 = back(x, 0);
      const p1 = back(x, backH);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    for (let h = 0; h <= backH + 1e-6; h += mesh) {
      ctx.moveTo(back(GX - GHALF, h).x, back(GX - GHALF, h).y);
      for (let x = GX - GHALF + mesh; x <= GX + GHALF + 1e-6; x += mesh) {
        const p = back(x, h);
        ctx.lineTo(p.x, p.y);
      }
    }
    // the roof: from the crossbar back to the top of the back net
    for (let x = GX - GHALF; x <= GX + GHALF + 1e-6; x += mesh) {
      const p0 = this.lens(x, PL, GH);
      const p1 = back(x, backH);
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
    }
    // the sides
    for (const sx of [GX - GHALF, GX + GHALF]) {
      for (let d = 0; d <= D + 1e-6; d += mesh) {
        const hgt = GH + (backH - GH) * (d / D);
        const p0 = this.lens(sx, PL + d, 0);
        const p1 = this.lens(sx, PL + d, hgt);
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
      for (let h = 0; h <= GH; h += mesh) {
        const p0 = this.lens(sx, PL, h);
        const p1 = back(sx, Math.min(h, backH));
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  /** The frame: two white posts and the bar, 7.32 by 2.44, with a shaded edge. */
  private frame(ctx: CanvasRenderingContext2D) {
    const base = this.lens(GX, PL);
    const w = Math.max(2, Math.round(base.s * 0.12));
    const pts = [this.lens(GX - GHALF, PL), this.lens(GX - GHALF, PL, GH), this.lens(GX + GHALF, PL, GH), this.lens(GX + GHALF, PL)];
    ctx.save();
    // the woodwork rang: the frame shivers a pixel either way for a third of a second (V2 B.3.7)
    const since = performance.now() - this.postAt;
    if (since < 340 && !reducedMotion()) ctx.translate(Math.floor(since / 34) % 2 ? 1 : -1, 0);
    ctx.lineJoin = 'miter';
    for (const [color, lw, dy] of [
      ['rgba(0,0,0,0.35)', w + 2, 1],
      ['#c9ccd2', w, 0],
      ['#fbfbf7', Math.max(1, w - 1), -0.5],
    ] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(Math.round(pts[0].x), Math.round(pts[0].y + dy));
      for (let i = 1; i < 4; i++) ctx.lineTo(Math.round(pts[i].x), Math.round(pts[i].y + dy));
      ctx.stroke();
    }
    ctx.restore();
  }

  private ball(ctx: CanvasRenderingContext2D, a: Attack) {
    const b = a.ball;
    const g = this.lens(b.x, b.y);
    const r = ballR(g.s, this.artK);
    // the shadow on the grass, smaller and fainter as it rises
    const lift = Math.min(1, b.h / 4);
    ctx.fillStyle = 'rgba(8,26,8,' + (0.45 - lift * 0.25).toFixed(2) + ')';
    ctx.beginPath();
    ctx.ellipse(Math.round(g.x), Math.round(g.y), Math.max(1.5, r * (1 - lift * 0.4)), Math.max(1, r * 0.45 * (1 - lift * 0.4)), 0, 0, Math.PI * 2);
    ctx.fill();
    const at = this.lens(b.x, b.y, b.h + 0.11);
    const R = ballR(at.s, this.artK);
    const X = Math.round(at.x);
    const Y = Math.round(at.y);
    this.stats.ballPx = 2 * (R + 1);
    // a hard shot leaves a trail (over 22 m/s, V2 B.3.7): its last spots, fading
    const speed = Math.hypot(b.vx, b.vy, b.vh);
    const hard = b.owner === null && speed > 22 && (b.flight?.kind === 'shot' || b.flight?.kind === 'parry');
    if (hard) {
      this.trail.push({ x: X, y: Y });
      if (this.trail.length > 7) this.trail.shift();
      for (let i = 0; i < this.trail.length - 1; i++) {
        const q = this.trail[i];
        const k = (i + 1) / this.trail.length;
        ctx.fillStyle = 'rgba(255,246,214,' + (0.5 * k).toFixed(2) + ')';
        const d = Math.max(1, Math.round(R * (0.5 + 0.6 * k)));
        ctx.fillRect(q.x - d, q.y - d, d * 2, d * 2);
      }
    } else this.trail.length = 0;
    ctx.fillStyle = '#1a1c22';
    ctx.beginPath();
    ctx.arc(X, Y, R + 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f6f6f2';
    ctx.beginPath();
    ctx.arc(X, Y, R, 0, Math.PI * 2);
    ctx.fill();
    // the panels, turning with the ball's travel
    const spin = (b.x * 1.7 + b.y * 1.3) % 2;
    ctx.fillStyle = '#2a2d35';
    const d = Math.max(1, Math.round(R * 0.5));
    if (R >= 3) {
      ctx.fillRect(X - (spin < 1 ? d : 0), Y - Math.round(d / 2), d, d);
      if (R >= 4) ctx.fillRect(X + Math.round(R * 0.35), Y + (spin < 1 ? 0 : -d), Math.max(1, d - 1), Math.max(1, d - 1));
    } else ctx.fillRect(X - 1 + (spin < 1 ? 0 : 1), Y - 1, 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(X - Math.round(R * 0.5), Y - Math.round(R * 0.6), 1, 1);
  }

  /** Turf kicked up by a tackle or a dive, or confetti for a goal in the scorer's kit (J-3, Claude
   * 2026-11-10: it was always your colours, the rival's goals included). No confetti with reduced motion. */
  private burst(x: number, y: number, n: number, kind: 'turf' | 'confetti', kit: SoccerKit = this.kits.us) {
    if (kind === 'confetti' && reducedMotion()) return;
    const turf = ['#3c7a2c', '#58993c', '#6b4a2a', '#8a6a3c'];
    const conf = [kit.jersey, kit.trim, '#ffffff', '#ffd23a'];
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const sp = kind === 'turf' ? 1.5 + Math.random() * 2.5 : 2 + Math.random() * 5;
      this.bits.push({ x, y, h: kind === 'turf' ? 0.1 : 2 + Math.random() * 2, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vh: kind === 'turf' ? 2 + Math.random() * 3 : 4 + Math.random() * 6, life: kind === 'turf' ? 0.5 : 1.6 + Math.random() * 0.8, color: (kind === 'turf' ? turf : conf)[Math.floor(Math.random() * 4)], size: kind === 'turf' ? 0.14 : 0.24 });
    }
    if (this.bits.length > 400) this.bits.splice(0, this.bits.length - 400);
  }

  private particles(ctx: CanvasRenderingContext2D, a: Attack, kitOf: (b: Body) => 'us' | 'them') {
    const now = performance.now() / 1000;
    const dt = this.lastNow ? Math.min(0.05, now - this.lastNow) : 0;
    this.lastNow = now;
    for (const b of a.bodies) {
      const k = b.p.id + b.side;
      const was = this.acts.get(k);
      if (was !== b.act) {
        if (was !== undefined && (b.act === 'tackle' || b.act === 'down' || b.act === 'dive')) this.burst(b.x, b.y, 9, 'turf');
        if (b.act === 'celebrate') this.burst(b.x, b.y, 70, 'confetti', this.kits[kitOf(b)]);
        this.acts.set(k, b.act);
      }
    }
    this.bits = this.bits.filter((q) => (q.life -= dt) > 0);
    for (const q of this.bits) {
      const conf = q.size > 0.2;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.h = Math.max(0, q.h + q.vh * dt);
      q.vh -= (conf ? 3.2 : 14) * dt;
      if (conf) {
        q.vh = Math.max(q.vh, -1.6);
        q.vx *= 0.98;
        q.vy *= 0.98;
      }
      const p = this.lens(q.x, q.y, q.h);
      const d = Math.max(1, Math.round(p.s * q.size));
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(p.x - d / 2), Math.round(p.y - d / 2), d, d);
    }
  }

  /** The power meter: an arch over the shooter, filling as SHOOT is held, the green slice at its
   * top and a fainter "good" band around it (closer to the green is truer); after the strike it stays
   * a moment with a tick where it was let go and the word for it. */
  private meter(ctx: CanvasRenderingContext2D, a: Attack, head: { x: number; y: number }) {
    const m = a.meter;
    const r = a.release;
    const ghost = !m && r && a.t - r.at < 0.9 ? r : null;
    if (!m && !ghost) return;
    const top = m ? m.top : ghost!.top;
    const green = m ? m.green : ghost!.green;
    const held = m ? a.t - m.t0 : ghost!.top + ghost!.off;
    const span = METER * 1.3;
    const frac = Math.min(1, Math.max(0, held / span));
    const R = Math.max(24, Math.round(Math.min(this.W, this.H) * 0.085));
    const th = Math.max(7, Math.round(R * 0.27));
    const cx = head.x;
    const cy = Math.max(R + th + 64, head.y + Math.round(R * 0.25));
    const A0 = Math.PI + 0.36;
    const SW = Math.PI - 0.72;
    const band = (a0: number, a1: number, rr: number, w: number, color: string) => {
      if (a1 <= a0) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, a0, a1);
      ctx.stroke();
    };
    const at = (t: number) => A0 + Math.min(1, Math.max(0, t / span)) * SW;
    ctx.save();
    if (ghost) ctx.globalAlpha = Math.max(0, Math.min(1, (0.9 - (a.t - ghost.at)) / 0.3));
    ctx.lineCap = 'butt';
    band(A0 - 0.05, A0 + SW + 0.05, R, th + 5, '#05070d');
    band(A0 - 0.03, A0 + SW + 0.03, R, th + 2, '#e8ecf5');
    band(A0, A0 + SW, R, th, '#1a2235');
    // the good band (accuracy falls off smoothly away from the green: 2.2 greens is still GOOD)
    band(at(top - green * 2.2), at(top + green * 2.2), R, th, '#33618f');
    const glow = m ? Math.max(0, 1 - Math.abs(held - top) / 0.12) : 0;
    band(at(top - green), at(top + green), R, th, glow > 0 ? mixHex('#1f9e4c', '#7dffab', glow) : '#1f9e4c');
    band(at(top - green), at(top + green), R + th / 2 + 2, 2, '#3ef07a');
    band(at(top - green), at(top + green), R - th / 2 - 2, 2, '#3ef07a');
    const fillTo = A0 + frac * SW;
    const u = timingMiss(held - top, green);
    const fill = held > top + green ? (u > 2.2 ? '#ff7a4a' : '#ffb04a') : u <= 1 ? '#7dffab' : '#ffd35a';
    band(A0, fillTo, R, th - 2, fill);
    band(A0, fillTo, R - th / 2 + 2, 1, 'rgba(255,255,255,0.55)');
    if (frac > 0.01) band(fillTo - 0.035, fillTo, R, th + 4, '#ffffff');
    ctx.restore();
    if (ghost) {
      const w = timingWord(ghost.off, ghost.green);
      const col = w === 'PERFECT' ? '#3ef07a' : w === 'GOOD' ? '#d6e5ed' : '#ffb04a';
      this.tag(w, cx, cy - R - th - 16, col, 3);
      return;
    }
    this.tag(m!.first ? 'FIRST TIME' : a.setPiece?.kind === 'penalty' ? 'PENALTY' : a.setPiece ? 'FREE KICK' : 'POWER', cx, cy - R - th - 16, TAG.word, 3);
    this.miniGoal(ctx, a, cx, cy - R - th - 30);
  }

  /** The cone (degrees, 1 sd) a release now would have: it tightens toward the green and opens past it. */
  private liveCone(a: Attack): number {
    const m = a.meter;
    const c = ctrlOf(a);
    if (!m) return shotCone(c.p);
    return shotCone(c.p) * coneMult(a.t - m.t0 - m.top, m.green);
  }

  /** A small goal over the meter: the keeper, and where the shot is going (a dot, AUTO when it's the assist). */
  private miniGoal(ctx: CanvasRenderingContext2D, a: Attack, cx: number, bottom: number) {
    const m = a.meter;
    if (!m) return;
    const c = ctrlOf(a);
    const tp = aimPoint(a, c, m.aim ?? null);
    const gk = a.bodies.find((b) => b.role === 'gk');
    const W = Math.max(66, Math.round(this.W * 0.2));
    const H = Math.round((W * GH) / (GHALF * 2));
    const x0 = Math.round(Math.max(6, Math.min(this.W - W - 6, cx - W / 2)));
    const y0 = Math.round(Math.max(4, bottom - H));
    const sx = (x: number) => x0 + ((x - (GX - GHALF)) / (GHALF * 2)) * W;
    const sy = (h: number) => y0 + H - (h / GH) * H;
    ctx.save();
    ctx.fillStyle = 'rgba(6,10,8,0.72)';
    ctx.fillRect(x0 - 4, y0 - 4, W + 8, H + 6);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(x0, y0, W, H);
    ctx.strokeStyle = '#f4f6fb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + H);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + W, y0);
    ctx.lineTo(x0 + W, y0 + H);
    ctx.stroke();
    // the keeper: as the shooter sees him across the goal (his angle, not his place on the line)
    if (gk) {
      const sh = { x: a.ball.x, y: a.ball.y };
      const k = (gk.x - sh.x) / Math.max(0.5, gk.y - sh.y);
      const kx = Math.max(GX - GHALF - 0.5, Math.min(GX + GHALF + 0.5, sh.x + k * (PL - sh.y)));
      const kw = Math.max(5, Math.round(W * 0.09));
      ctx.fillStyle = '#ff9d3a';
      ctx.fillRect(Math.round(sx(kx) - kw / 2), Math.round(sy(1.85)), kw, Math.round(H * 0.76));
    }
    // the aim: the dot, and the ring the timing gives it right now
    const px = Math.round(sx(tp.x));
    const py = Math.round(sy(tp.h));
    const d = Math.hypot(tp.x - a.ball.x, PL - a.ball.y);
    const rr = Math.max(3, Math.round(((d * Math.tan((this.liveCone(a) * Math.PI) / 180)) / (GHALF * 2)) * W * 1.3));
    ctx.beginPath();
    ctx.rect(x0 - 4, y0 - 4, W + 8, H + 6);
    ctx.clip();
    ctx.strokeStyle = '#ffe08a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, Math.min(rr, W * 0.45), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(px - 2, py - 2, 5, 5);
    ctx.restore();
    if (!m.aim) this.tag('AUTO', x0 + W / 2, y0 - 16, TAG.mate, 4);
  }

  /** Where the shot is going: a reticle in the goal mouth, its ring the error cone a release now would
   * have (tight at the green, wide off it). */
  private aim(ctx: CanvasRenderingContext2D, a: Attack) {
    const m = a.meter;
    if (!m) return;
    const c = ctrlOf(a);
    const tp = aimPoint(a, c, m.aim ?? null);
    const p = this.lens(tp.x, PL, tp.h);
    const dist = Math.hypot(tp.x - a.ball.x, PL - a.ball.y);
    const rM = Math.max(0.2, dist * Math.tan((this.liveCone(a) * Math.PI) / 180) * 1.3);
    const r = Math.max(5, Math.round(rM * p.s));
    const x = Math.round(p.x);
    const y = Math.round(p.y);
    ctx.save();
    for (const [w, col] of [
      [4, 'rgba(0,0,0,0.55)'],
      [2, '#ffe08a'],
    ] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.moveTo(x - r - 5, y);
      ctx.lineTo(x - Math.max(2, r - 3), y);
      ctx.moveTo(x + Math.max(2, r - 3), y);
      ctx.lineTo(x + r + 5, y);
      ctx.moveTo(x, y - r - 5);
      ctx.lineTo(x, y - Math.max(2, r - 3));
      ctx.moveTo(x, y + Math.max(2, r - 3));
      ctx.lineTo(x, y + r + 5);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffe08a';
    ctx.fillRect(x - 1, y - 1, 3, 3);
    ctx.restore();
  }

  /** The pass the stick would play: a dashed line on the grass to where it's going, a ring on the man it's for. */
  private passLine(ctx: CanvasRenderingContext2D, a: Attack, plan: PassPlan) {
    const f = this.lens(a.ball.x, a.ball.y);
    const t = this.lens(plan.spot.x, plan.spot.y);
    const col = plan.to ? 'rgba(62,240,192,0.9)' : 'rgba(240,244,250,0.75)';
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 4;
    ctx.setLineDash([6, 5]);
    ctx.beginPath();
    ctx.moveTo(f.x, f.y);
    ctx.lineTo(t.x, t.y);
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    // the arrowhead at the far end
    const ang = Math.atan2(t.y - f.y, t.x - f.x);
    const L = 8;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x - Math.cos(ang - 0.45) * L, t.y - Math.sin(ang - 0.45) * L);
    ctx.lineTo(t.x - Math.cos(ang + 0.45) * L, t.y - Math.sin(ang + 0.45) * L);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** A goal went in: the net bulges (three frames out, then back). */
  goalScored(t: number) {
    this.goalAt = t;
    this.bulgeFrames = 0;
  }

  /** The ball rang off the woodwork: the frame shivers. */
  postHit() {
    this.postAt = performance.now();
  }

  /** the tags this frame, painted together after layoutLabels */
  private tags: Tag[] = [];
  private tag(s: string, x: number, y: number, color: string, prio: number) {
    this.tags.push({ s, x, y, color, prio });
  }

  /** The goal mouth on screen now (posts to crossbar), for the HUD's keep-clear checks. */
  goalMouth(): { x: number; y: number; w: number; h: number } | null {
    if (!this.cam) return null;
    const l = this.lens(GX - GHALF, PL, GH);
    const r = this.lens(GX + GHALF, PL, 0);
    return { x: Math.min(l.x, r.x), y: Math.min(l.y, r.y), w: Math.abs(r.x - l.x), h: Math.abs(r.y - l.y) };
  }

  /** The camera this frame (camera.ts): the safe box, Clutch, reduced motion and a replay's spot. */
  private aimCamera(a: Attack) {
    const now = performance.now();
    const dt = this.lastDraw ? Math.min(0.1, (now - this.lastDraw) / 1000) : 1 / 60;
    this.lastDraw = now;
    // new sprites this frame: five, or three when the last frame ran long (a slow phone catching up)
    this.budget = dt > 0.025 ? 3 : 5;
    this.cam = camStep(this.camSt, a, { W: this.W, H: this.H, safe: this.safe(), clutch: this.frameInfo.clutch, reduced: reducedMotion(), replay: this.replay }, dt, a.t);
  }

  /** Ground rings (V2 C.1.3): 2 px, flat on the grass round his feet. `arc`: the front half only. */
  private ring(ctx: CanvasRenderingContext2D, b: Body, color: string, k: number, arc?: number) {
    const f = this.lens(b.x, b.y);
    const rx = Math.max(6, Math.round(f.s * this.artK * k));
    const ry = Math.max(3, Math.round(rx * Math.sin(this.cam!.pitch) * 0.62));
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    if (arc === undefined) ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, ry, 0, 0, Math.PI * 2);
    else ctx.ellipse(Math.round(f.x), Math.round(f.y), rx, ry, 0, arc - 1.1, arc + 1.1);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  /**
   * Teal edge arrows (V2 B.3.2, the mockup's "R9"): every teammate off the screen, under the bug or
   * under the thumbs gets a chevron at the action-safe box's edge, pointing at him, with his initial and
   * number. Tapping one passes to him.
   */
  private edgeArrows(ctx: CanvasRenderingContext2D, a: Attack, c: Body) {
    const mates = a.bodies.filter((b) => b.side === c.side && b !== c && b.role !== 'gk').map((b) => ({ id: b.id, ...this.lens(b.x, b.y) }));
    this.arrows = placeArrows(mates, this.safe(), this.W);
    for (const { id, x, y, ang } of this.arrows) {
      const b = a.bodies[id];
      const text = (b.p.tag[0] ?? '?') + (b.p.num ?? '');
      ctx.save();
      ctx.translate(x, y);
      // the chevron, pointing out toward him
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(4,22,26,0.82)';
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(2, -10);
      ctx.lineTo(2, 10);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = MARK_COLOR.target;
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -7);
      ctx.lineTo(4, 7);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // the chip: his initial and number, on the inside of the arrow
      const w = (text.length * 4 - 1) * 2;
      const tx = Math.round(x - Math.cos(ang) * (w / 2 + 8));
      const ty = Math.round(y - Math.sin(ang) * 10) - 5;
      label(ctx, text, tx, ty, '#062a24', this.W, MARK_COLOR.target);
    }
  }

  draw(ctx: CanvasRenderingContext2D, a: Attack, o: SoccerOverlay, kitOf: (b: Body) => 'us' | 'them') {
    // the first frame waits for the clips and looks (players-3, pixel/ready.ts)
    if (!drawGate('soccer')) return;
    ctx.setTransform(this.art.backing, 0, 0, this.art.backing, 0, 0);
    this.tags.length = 0;
    this.stats.draws++;
    ctx.imageSmoothingEnabled = false;
    this.aimCamera(a);
    if (a.end?.kind === 'G' && this.goalAt === null) this.goalAt = a.t;
    if (!a.end) {
      this.goalAt = null;
      this.bulgeFrames = -1;
    } else if (this.bulgeFrames >= 0) this.bulgeFrames++;
    const jx = o.jolt?.x ?? 0;
    const jy = o.jolt?.y ?? 0;
    ctx.save();
    ctx.translate(jx, jy);
    this.drawGround(ctx);
    this.net(ctx, a);
    const ballBehind = a.ball.y > PL + 0.05;
    if (ballBehind) this.ball(ctx, a);
    this.frame(ctx);
    // shadows (pixel/ground.ts: V2's soft contact shadow, shrinking as he rises)
    for (const b of a.bodies) {
      const f = this.lens(b.x, b.y);
      const look = this.looks.get(b.p.id + '|' + b.side + '|' + kitOf(b));
      drawGroundMark(ctx, { x: f.x, y: f.y, shoulderPx: shoulderWidthPx(b.p.ht / 2.54, look?.wt ?? Math.round(23 * heightM(b) ** 2 * 2.2046), drawnM(b) * f.s * this.artK), pitch: pitchAt(this.cam!, b.y), lift: b.h / heightM(b) });
    }
    const c = ctrlOf(a);
    const ours = o.ours !== false;
    if (!a.end) {
      // gold under the man you control (violet for the rival's taker), teal under the pass's man,
      // a red arc on the defender closing the ball (V2 C.1.3)
      this.ring(ctx, c, ours ? RING.gold : RING.rival, 0.62);
      if (ours && o.target !== null && a.bodies[o.target]) this.ring(ctx, a.bodies[o.target], RING.teal, 0.55);
      const carrier = a.ball.owner !== null ? a.bodies[a.ball.owner] : null;
      if (ours && carrier && carrier.side === 'A') {
        let near: Body | null = null;
        let nd = 3.5;
        for (const b of a.bodies)
          if (b.side === 'D' && b.role !== 'gk') {
            const d = Math.hypot(b.x - carrier.x, b.y - carrier.y);
            if (d < nd) {
              nd = d;
              near = b;
            }
          }
        if (near) {
          const p = this.lens(near.x, near.y);
          const q = this.lens(carrier.x, carrier.y);
          this.ring(ctx, near, RING.red, 0.6, Math.atan2(q.y - p.y, q.x - p.x));
        }
      }
    }
    // the players and the ball, far to near
    const items: { y: number; draw: () => void }[] = [];
    const heads: Record<number, { x: number; y: number }> = {};
    let drew = 0;
    for (const b of a.bodies) {
      items.push({
        y: b.y,
        draw: () => {
          const f = this.lens(b.x, b.y, b.h);
          if (f.y < -90 || f.y > this.H + 120 || f.x < -90 || f.x > this.W + 90) return;
          const spr = this.sprite(b, a.t, this.W > this.H ? this.lens(b.x, b.y).s : spriteScale(this.lens(b.x, b.y).s, this.artK), kitOf(b));
          const x = Math.round(f.x - spr.ax);
          const y = Math.round(f.y - spr.ay);
          blitSprite(ctx, spr, x, y);
          heads[b.id] = { x: Math.round(f.x), y: y + spr.top };
          if (b === c) this.stats.ctrlPx = spr.ay - spr.top;
          drew++;
        },
      });
    }
    if (!ballBehind) items.push({ y: a.ball.y - 0.25, draw: () => this.ball(ctx, a) });
    items.sort((p, q) => q.y - p.y);
    for (const it of items) it.draw();
    this.particles(ctx, a, kitOf);
    if (this.W <= this.H) this.drawOverlay(ctx);
    // the man you're on: his name; his stamina once sprinting has cost some
    const h = heads[c.id];
    if (h && !a.end) {
      const f = this.lens(c.x, c.y);
      const S = f.s * this.artK;
      if (a.stamina < 0.99) {
        const w = Math.max(18, Math.round(S * 1.4));
        const hh = Math.max(3, Math.round(S * 0.13));
        const x = Math.round(f.x - w / 2);
        const y = Math.round(f.y + Math.max(5, S * 0.42));
        ctx.fillStyle = 'rgba(6,10,8,0.8)';
        ctx.fillRect(x - 1, y - 1, w + 2, hh + 2);
        ctx.fillStyle = a.stamina < 0.25 ? '#ff5a5a' : a.stamina < 0.5 ? '#ffd23a' : '#3ef0c0';
        ctx.fillRect(x, y, Math.max(1, Math.round(w * a.stamina)), hh);
      }
      // his name under his feet (over his head it would hide the ball he's about to play); over his
      // head when under his feet it would print on a button, the stick or the bug (V2 C.3)
      if (!a.meter) {
        const spot = ctrlTagSpot(c.p.tag, f.x, f.y, h.y, f.s * this.artK, this.W, this.frameInfo.controls);
        this.tag(c.p.tag, f.x, spot.ty, ours ? TAG.ours : TAG.rival, 5);
      }
    }
    if (ours && o.target !== null && heads[o.target] && !a.end && !a.meter) {
      const t = a.bodies[o.target];
      this.tag(t.p.tag, heads[o.target].x, heads[o.target].y - 15, TAG.mate, 2);
    }
    if (o.names && ours) for (const b of a.bodies) if (b.side === 'A' && b !== c && heads[b.id]) this.tag(b.p.tag, heads[b.id].x, heads[b.id].y - 15, TAG.white, 1);
    if (o.pass && !a.meter && !a.end) this.passLine(ctx, a, o.pass);
    if (a.meter) this.aim(ctx, a);
    if (h && !a.end) this.meter(ctx, a, h);
    // a free kick's bend: an arrow over the ball the way it will swing
    if (a.setPiece?.kind === 'freekick' && Math.abs(a.curl) > 0.05 && !a.end) {
      const p0 = this.lens(a.ball.x, a.ball.y, 1.6);
      const dir = a.curl > 0 ? -1 : 1;
      const len = Math.max(14, Math.round(p0.s * 1.4 * Math.abs(a.curl)));
      ctx.strokeStyle = '#ffd23a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p0.x + dir * len * 0.2, p0.y + len * 0.8, len, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5);
      ctx.stroke();
      // the word only before SHOOT is held: with the meter up the arrow says it, and the meter's own word is there
      if (!a.meter) this.tag('BEND', p0.x, p0.y - 22, '#ffd23a', 2);
    }
    // teammates outside the box: arrows at its edge (ours, in open play and at set pieces)
    if (ours && !a.end && this.W <= this.H) this.edgeArrows(ctx, a, c);
    else this.arrows.length = 0;
    // every tag at once, stacked where two would print over each other ("FBENDICK", V-3)
    for (const t of layoutLabels(this.tags.splice(0), this.W, this.H, o.keepOut)) label(ctx, t.s, t.x, t.y, t.color, this.W);
    ctx.restore();
    if (o.flash > 0) {
      ctx.fillStyle = 'rgba(255,255,255,' + Math.min(reducedMotion() ? 0.3 : 0.8, o.flash).toFixed(2) + ')';
      ctx.fillRect(0, 0, this.W, this.H);
    }
    if (drew > 0) this.firstFrame = true;
  }

  /** The teammate under a screen point (for tap-to-pass): an edge arrow (22 px, a 44 px target), else
   * the nearest man's body within `r` pixels. */
  bodyAt(a: Attack, sx: number, sy: number, r = TAP_PLAYER_PX): number | null {
    if (!this.cam) return null;
    const arrow = nearestWithin(this.arrows, sx, sy, 22);
    if (arrow) return arrow.id;
    const pts = a.bodies
      .filter((b) => b.side === 'A')
      .map((b) => {
        const f = this.lens(b.x, b.y);
        // the middle of his sprite: half his height up from his feet
        return { id: b.id, x: f.x, y: f.y - (b.p.ht / 100) * f.s * this.artK * 0.43 };
      });
    return nearestWithin(pts, sx, sy, r)?.id ?? null;
  }
}

/** Does a teammate at screen point `f` get an edge arrow: off the screen across, above the safe box
 * (under the bug) or well below it (under the thumbs)? */
export const arrowFor = (f: { x: number; y: number }, box: Box, W: number) => f.x < 6 || f.x > W - 6 || f.y < box.y - 10 || f.y > box.y + box.h + 40;

/**
 * Where the edge arrows go: for each teammate `arrowFor` picks, on the line from the safe box's centre
 * to him, 20 px inside its edge; two never closer than 30 × 24 px (the later moves along the edge).
 * Pure, for camera.test.
 */
export function placeArrows(mates: readonly { id: number; x: number; y: number }[], box: Box, W: number): { id: number; x: number; y: number; ang: number }[] {
  const m = 20;
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const out: { id: number; x: number; y: number; ang: number }[] = [];
  for (const f of mates) {
    if (!arrowFor(f, box, W)) continue;
    const dx = f.x - cx;
    const dy = f.y - cy;
    const k = Math.min(dx ? (box.w / 2 - m) / Math.abs(dx) : Infinity, dy ? (box.h / 2 - m) / Math.abs(dy) : Infinity);
    const x0 = Math.round(cx + dx * k);
    const y0 = Math.round(cy + dy * k);
    // on a side edge it slides up or down; on the top or bottom edge, across (nearest free spot first)
    const side = Math.abs(dx) * box.h > Math.abs(dy) * box.w;
    let x = x0;
    let y = y0;
    for (let n = 1; n < 24 && out.some((p) => Math.abs(p.x - x) < 30 && Math.abs(p.y - y) < 24); n++) {
      const o = (n % 2 ? 1 : -1) * Math.ceil(n / 2);
      if (side) y = Math.max(box.y + m, Math.min(box.y + box.h - m, y0 + o * 26));
      else x = Math.max(box.x + m, Math.min(box.x + box.w - m, x0 + o * 32));
    }
    out.push({ id: f.id, x, y, ang: Math.atan2(dy, dx) });
  }
  return out;
}

/** The ground rings' colours (V2 C.1.3): you, the pass's man, the defender on the ball, the rival's taker. */
// the ground-mark palette is players' (pixel/ground.ts MARK_COLOR), so the rings and the marks always agree
export const RING = { gold: MARK_COLOR.you, teal: MARK_COLOR.target, red: MARK_COLOR.pressure, rival: '#a78bfa' } as const;

/**
 * Where the controlled man's name tag goes: under his feet, or over his head when under his feet
 * it would meet a control (a button, the stick's ring, the bug, pause). Returns the chip's box and the
 * label's y. Pure, for the camera's harness and tests.
 */
export function ctrlTagSpot(text: string, x: number, feetY: number, headY: number, s: number, W: number, controls: readonly Box[]): Box & { ty: number } {
  const meets = (p: Box) => controls.some((r) => p.x < r.x + r.w && r.x < p.x + p.w && p.y < r.y + r.h && r.y < p.y + p.h);
  const under = Math.round(feetY + Math.max(10, s * 0.42) + 6);
  const box = tagBox(text, x, under, W);
  if (!meets(box)) return { ...box, ty: under };
  const over = Math.round(headY - 18);
  return { ...tagBox(text, x, over, W), ty: over };
}

/** Is the speed the man is moving near his top (for the drawing's sprint dust)? */
export const sprinting = (b: Body) => Math.hypot(b.vx, b.vy) > topSpeed(b.p) * 0.92;

function mixHex(a: string, b: string, k: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * k));
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0');
}

const F35: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111', '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010', '8': '111101111101111', '9': '111101111001111', ' ': '000000000000000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000', '!': '010010010000010',
};

/** A tag's chip on screen, as `label` draws it (kept on screen; 16 px tall: 10 px letters and padding). */
export function tagBox(s: string, x: number, y: number, W: number): { x: number; y: number; w: number; h: number } {
  const w = (s.length * 4 - 1) * 2;
  const x0 = Math.max(3, Math.min(W - w - 3, Math.round(x - w / 2)));
  return { x: x0 - 3, y: y - 3, w: w + 6, h: 16 };
}

/**
 * The label pass (V-3, Claude 2026-11-16, soccer-2): tags that would print over each other are
 * stacked. The most important keeps its place; each other one moves up just clear of whatever it
 * meets (down instead if that would leave the top of the screen), so "FREE KICK" over the meter and
 * "BEND" over the ball read as two words, never "FBENDICK". The keep-outs (the toast line and the
 * cluster's buttons, soccer-2 fix) are walked the same way: a tag goes above them first, and below
 * only when there is no room above, so it never lands under a DOM button. Pure, for hud-layout.test.
 */
export function layoutLabels(tags: readonly Tag[], W: number, H: number, keepOut: readonly { x: number; y: number; w: number; h: number }[] = []): Tag[] {
  type Box = ReturnType<typeof tagBox>;
  const placed: { t: Tag | null; b: Box }[] = keepOut.map((b) => ({ t: null, b }));
  const meets = (p: Box, q: Box) => p.x < q.x + q.w + 1 && q.x < p.x + p.w + 1 && p.y < q.y + q.h + 1 && q.y < p.y + p.h + 1;
  const hitAt = (t: Tag, y: number) => {
    const b = tagBox(t.s, t.x, y, W);
    return placed.find((p) => meets(b, p.b));
  };
  const order = tags.map((t, i) => ({ t, i })).sort((p, q) => q.t.prio - p.t.prio || p.i - q.i);
  for (const { t } of order) {
    let y: number | null = null;
    // up: just above whatever it meets, until clear (or off the top)
    for (let yu = t.y, n = 0; n < 24 && yu >= 3; n++) {
      const hit = hitAt(t, yu);
      if (!hit) {
        y = yu;
        break;
      }
      yu = hit.b.y - 17 + 3;
    }
    // no room above: down, just below whatever it meets
    for (let yd = t.y, n = 0; y === null && n < 24 && yd <= H - 13; n++) {
      const hit = hitAt(t, yd);
      if (!hit) y = yd;
      else yd = hit.b.y + hit.b.h + 2 + 3;
    }
    const t2 = { ...t, y: Math.max(3, Math.min(H - 13, y ?? t.y)) };
    placed.push({ t: t2, b: tagBox(t.s, t.x, t2.y, W) });
  }
  return placed.flatMap((p) => (p.t ? [p.t] : []));
}

/** A name tag: 3x5 letters doubled up, on a dark chip, kept on screen (the football field's). */
export function label(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string, W: number, chip: string | null = 'rgba(6,10,8,0.78)') {
  const z = 2;
  const up = s.toUpperCase();
  const w = (up.length * 4 - 1) * z;
  const x0 = Math.max(3, Math.min(W - w - 3, Math.round(x - w / 2)));
  if (chip) {
    ctx.fillStyle = chip;
    ctx.fillRect(x0 - 3, y - 3, w + 6, 5 * z + 6);
  }
  ctx.fillStyle = color;
  for (let i = 0; i < up.length; i++) {
    const g = F35[up[i]] ?? F35[' '];
    for (let r = 0; r < 5; r++) for (let col = 0; col < 3; col++) if (g[r * 3 + col] === '1') ctx.fillRect(x0 + (i * 4 + col) * z, y + r * z, z, z);
  }
}
