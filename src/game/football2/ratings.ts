// Madden-style ratings (0-99) for a football player, from his real numbers: each stat's rank within
// his season and position (the era adjustment), his size, his honors (All-Pro, Pro Bowl) and draft
// slot where the stats run out (old defenders, every lineman). What he can do in the game comes from
// these: a cannon arm throws deep, a juke artist makes men miss, a shutdown corner blankets his man.
// One implementation for the draft games, Ultimate Team and the played game.
import type { CardLine } from '../../ut/types';

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const r99 = (x: number) => Math.max(25, Math.min(99, Math.round(x)));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp01(t);

/** The attributes each position shows on its card, in order (Madden names, shortened). */
export const NFL_KEYS: Record<string, [string, string][]> = {
  QB: [['THP', 'Throw power'], ['SAC', 'Short accuracy'], ['MAC', 'Medium accuracy'], ['DAC', 'Deep accuracy'], ['TUP', 'Throw under pressure'], ['SPD', 'Speed']],
  RB: [['SPD', 'Speed'], ['ACC', 'Acceleration'], ['BTK', 'Break tackle'], ['JKM', 'Juke move'], ['CAR', 'Carrying'], ['CTH', 'Catching']],
  WR: [['SPD', 'Speed'], ['CTH', 'Catching'], ['RTE', 'Route running'], ['CIT', 'Catch in traffic'], ['SPC', 'Spectacular catch'], ['REL', 'Release']],
  TE: [['CTH', 'Catching'], ['RBK', 'Run block'], ['SPD', 'Speed'], ['CIT', 'Catch in traffic'], ['RTE', 'Route running'], ['STR', 'Strength']],
  OL: [['PBK', 'Pass block'], ['RBK', 'Run block'], ['STR', 'Strength'], ['AWR', 'Awareness'], ['IBL', 'Impact block'], ['AGI', 'Agility']],
  DL: [['PMV', 'Power moves'], ['FMV', 'Finesse moves'], ['BSH', 'Block shedding'], ['STR', 'Strength'], ['SPD', 'Speed'], ['TAK', 'Tackle']],
  LB: [['TAK', 'Tackle'], ['PUR', 'Pursuit'], ['PRC', 'Play recognition'], ['ZCV', 'Zone coverage'], ['SPD', 'Speed'], ['BSH', 'Block shedding']],
  CB: [['SPD', 'Speed'], ['MCV', 'Man coverage'], ['ZCV', 'Zone coverage'], ['PRS', 'Press'], ['CTH', 'Catching'], ['TAK', 'Tackle']],
  S: [['SPD', 'Speed'], ['ZCV', 'Zone coverage'], ['MCV', 'Man coverage'], ['TAK', 'Tackle'], ['HIT', 'Hit power'], ['PRC', 'Play recognition']],
  K: [['KPW', 'Kick power'], ['KAC', 'Kick accuracy'], ['AWR', 'Awareness'], ['STR', 'Strength'], ['SPD', 'Speed'], ['AGI', 'Agility']],
};

export const ABILITY_NAMES: Record<string, string> = {
  cannon: 'Cannon Arm',
  surgeon: 'Pocket Surgeon',
  scrambler: 'Scrambler',
  'truck-stick': 'Truck Stick',
  'juke-box': 'Juke Box',
  'deep-threat': 'Deep Threat',
  'sure-hands': 'Sure Hands',
  'red-zone': 'Red Zone Threat',
  'pocket-wall': 'Pass Pro',
  'road-grader': 'Road Grader',
  'edge-threat': 'Edge Threat',
  'run-stopper': 'Run Stopper',
  enforcer: 'Enforcer',
  shutdown: 'Shutdown Corner',
  ballhawk: 'Ballhawk',
  'big-leg': 'Big Leg',
};

/** the position group a listed position rates as */
export function groupOf(pos: string): string {
  if (pos === 'OT' || pos === 'OG' || pos === 'C' || pos === 'OL' || pos === 'T' || pos === 'G') return 'OL';
  if (pos === 'DE' || pos === 'DT' || pos === 'DL' || pos === 'NT') return 'DL';
  if (pos === 'DB') return 'CB';
  if (pos === 'FB') return 'RB';
  return pos;
}

/** Everything the formulas need, whatever the source (a draft line or a season card). */
export interface FbInput {
  pos: string;
  ht: number | null;
  wt: number | null;
  /** his value's rank within his position (0-1): the fallback for anything his stats don't say */
  rank: number;
  stats: Record<string, number | null | undefined>;
  /** stat ranks within season and position (0-1) */
  rk: Record<string, number | null | undefined>;
  honors: string[];
}

export interface NflRating {
  ovr: number;
  pos: string;
  attrs: Record<string, number>;
  key: [string, string, number][];
  abil: string[];
}

/** typical size by position, when the data has none */
const SIZE: Record<string, [number, number]> = {
  QB: [75, 220],
  RB: [71, 212],
  WR: [72, 198],
  TE: [77, 252],
  OL: [77, 312],
  DL: [76, 285],
  LB: [74, 240],
  CB: [71, 192],
  S: [72, 205],
  K: [72, 195],
};

/** how much honors say (0-1): an All-Pro is elite whatever the box score kept */
function honorLevel(h: string[]): number {
  if (h.includes('MVP') || h.includes('DPOY') || h.includes('OPOY')) return 1;
  if (h.includes('ALLPRO1')) return 0.97;
  if (h.includes('ALLPRO2')) return 0.92;
  if (h.includes('PB')) return 0.85;
  return 0;
}

export function rateNfl(x: FbInput): NflRating {
  const g = groupOf(x.pos);
  const [dh, dw] = SIZE[g] ?? [74, 220];
  const ht = x.ht ?? dh;
  const wt = x.wt ?? dw;
  const s = x.stats;
  const rk = (k: string, fb = x.rank) => {
    const v = x.rk[k];
    return typeof v === 'number' ? v : fb;
  };
  const st = (k: string) => {
    const v = s[k];
    return typeof v === 'number' ? v : null;
  };
  const hon = honorLevel(x.honors);
  // overall standing: his value rank, lifted by honors
  const p = Math.max(x.rank, hon);
  // build: speed falls with weight for the position; strength rises
  const light = clamp01((dw + 25 - wt) / 50);
  const heavy = clamp01((wt - dw + 25) / 50);
  const tall = clamp01((ht - dh + 3) / 6);
  const a: Record<string, number> = {};
  const set = (k: string, v: number) => (a[k] = r99(v));
  // physicals every player has
  const speedBase = { QB: 62, RB: 84, WR: 86, TE: 74, OL: 50, DL: 66, LB: 76, CB: 88, S: 85, K: 55 }[g] ?? 70;
  set('SPD', speedBase + 10 * light - 6 * heavy + 6 * p);
  set('ACC', a.SPD + 2 - 3 * heavy);
  set('AGI', a.SPD - 4 + 6 * light);
  set('STR', ({ OL: 82, DL: 80, TE: 70, LB: 70, RB: 62, QB: 55, S: 58, CB: 50, WR: 52, K: 40 }[g] ?? 60) + 16 * heavy);
  set('AWR', 55 + 40 * p);
  switch (g) {
    case 'QB': {
      const cmp = st('cmp');
      const ypa = st('ypa');
      const acc = cmp !== null ? clamp01((cmp - 0.5) / 0.2) : rk('cmpp');
      const deep = ypa !== null ? clamp01((ypa - 5.8) / 2.8) : rk('ypa');
      const intr = st('intr');
      const careful = intr !== null ? clamp01(1 - (intr - 0.015) / 0.035) : 1 - rk('intr', 1 - x.rank);
      const sk = st('sk');
      const pocket = sk !== null ? clamp01(1 - (sk - 1.2) / 2.5) : 0.5;
      const ry = st('ry') ?? 0;
      set('THP', 70 + 22 * deep + 6 * p + 3 * tall);
      set('SAC', 58 + 34 * acc + 6 * p);
      set('MAC', 55 + 25 * acc + 12 * deep + 6 * p);
      set('DAC', 50 + 30 * deep + 10 * acc + 6 * p);
      set('TUP', 50 + 22 * pocket + 14 * careful + 12 * p);
      set('SPD', 55 + 38 * clamp01(ry / 45) + 5 * light);
      set('AWR', 55 + 28 * p + 14 * careful);
      break;
    }
    case 'RB': {
      const ypc = st('ypc');
      const burst = ypc !== null ? clamp01((ypc - 3.5) / 2) : rk('ypc');
      const vol = rk('ry');
      const rec = st('rec');
      set('SPD', 80 + 12 * burst + 6 * light - 4 * heavy + 2 * p);
      set('ACC', a.SPD + 2);
      set('BTK', 60 + 18 * heavy + 12 * vol + 8 * burst);
      set('TRK', 52 + 32 * heavy + 10 * vol);
      set('JKM', 58 + 22 * burst + 14 * light + 5 * vol);
      set('SPM', 55 + 18 * burst + 10 * light + 8 * vol);
      set('SFA', 55 + 20 * heavy + 12 * vol);
      set('CAR', 62 + 30 * p);
      set('BCV', 58 + 36 * vol);
      set('CTH', 48 + 40 * (rec !== null ? clamp01(rec / 4.5) : rk('rec', 0.4)));
      break;
    }
    case 'WR':
    case 'TE': {
      const ypr = st('ypr');
      const cr = st('cr');
      const deep = ypr !== null ? clamp01((ypr - 9) / 9) : rk('ypr');
      const hands = cr !== null ? clamp01((cr - 0.5) / 0.25) : rk('cr', x.rank);
      const vol = rk('recy');
      const te = g === 'TE';
      set('SPD', (te ? 72 : 82) + 12 * deep + 4 * light - 3 * heavy);
      set('ACC', a.SPD + 1);
      set('CTH', 62 + 22 * hands + 12 * vol);
      set('RTE', 58 + 24 * vol + 12 * hands);
      set('CIT', 55 + 20 * tall + 14 * hands + 8 * vol);
      set('SPC', 55 + 18 * deep + 14 * tall + 8 * vol);
      set('REL', 58 + 24 * vol + 8 * light);
      set('RBK', te ? 52 + 30 * heavy + 8 * p : 38 + 18 * heavy);
      set('BTK', 45 + 20 * heavy + 15 * vol);
      set('JKM', 50 + 22 * light + 15 * deep);
      break;
    }
    case 'OL': {
      const starts = st('starts');
      const steady = starts !== null ? clamp01(starts / 14) : 0.5;
      set('PBK', 60 + 30 * p + 6 * steady + 3 * tall);
      set('RBK', 60 + 26 * p + 6 * steady + 6 * heavy);
      set('IBL', 55 + 25 * p + 12 * heavy);
      set('STR', 80 + 14 * heavy + 4 * p);
      set('AGI', 45 + 18 * light + 10 * p);
      set('AWR', 58 + 36 * p);
      break;
    }
    case 'DL': {
      const sacks = rk('sk');
      const tfl = rk('tfl');
      const hits = rk('qbh');
      const rush = Math.max(sacks, (sacks + hits) / 2);
      const edge = x.pos === 'DE' || (light > 0.4 && x.pos !== 'DT');
      set('PMV', 55 + 24 * rush + 12 * heavy + 8 * p);
      set('FMV', 52 + 26 * rush + (edge ? 12 : 2) * light + 8 * p);
      set('BSH', 55 + 20 * tfl + 14 * heavy + 8 * p);
      set('STR', 76 + 16 * heavy + 5 * p);
      set('SPD', (edge ? 72 : 60) + 14 * light + 4 * p);
      set('TAK', 58 + 18 * rk('tkl') + 12 * tfl + 6 * p);
      set('PUR', 55 + 18 * rk('tkl') + 12 * light + 8 * p);
      set('PRC', 52 + 32 * p + 8 * tfl);
      set('HIT', 60 + 18 * heavy + 12 * p);
      break;
    }
    case 'LB': {
      const tkl = rk('tkl');
      const cover = Math.max(rk('int', 0.3), rk('pd', 0.3));
      set('TAK', 60 + 26 * tkl + 8 * p);
      set('PUR', 60 + 22 * tkl + 8 * light + 6 * p);
      set('PRC', 55 + 26 * p + 12 * tkl);
      set('ZCV', 45 + 30 * cover + 12 * light + 8 * p);
      set('MCV', 40 + 26 * cover + 14 * light + 6 * p);
      set('BSH', 55 + 18 * rk('tfl') + 12 * heavy + 8 * p);
      set('PMV', 45 + 24 * rk('sk', 0.3) + 10 * heavy);
      set('FMV', 45 + 24 * rk('sk', 0.3) + 10 * light);
      set('HIT', 62 + 16 * heavy + 12 * p);
      break;
    }
    case 'CB':
    case 'S': {
      const ints = rk('int');
      const pds = rk('pd', ints);
      const cover = (ints + pds) / 2;
      const cb = g === 'CB';
      set('MCV', (cb ? 58 : 48) + 30 * cover + 10 * p);
      set('ZCV', (cb ? 55 : 60) + 22 * cover + 8 * p + (cb ? 0 : 6));
      set('PRS', (cb ? 55 : 42) + 20 * cover + 10 * heavy + 6 * p);
      set('CTH', 42 + 38 * ints + 8 * p);
      set('TAK', (cb ? 50 : 62) + 18 * rk('tkl') + 10 * heavy + 6 * p);
      set('HIT', (cb ? 45 : 62) + 18 * heavy + 10 * p);
      set('PRC', 55 + 26 * p + 12 * cover);
      set('PUR', 60 + 18 * rk('tkl') + 10 * light + 8 * p);
      break;
    }
    case 'K': {
      const fga = st('fga') ?? 0;
      const fgp = fga >= 8 ? (st('fgm') ?? 0) / fga : null;
      const lng = st('lng');
      const acc = fgp !== null ? clamp01((fgp - 0.62) / 0.3) : rk('fgp');
      const leg = lng !== null ? clamp01((lng - 45) / 18) : rk('lng');
      set('KAC', 58 + 34 * acc + 6 * p);
      set('KPW', 62 + 30 * leg + 6 * p);
      break;
    }
  }
  const ovr = overall(g, a, p);
  const key = (NFL_KEYS[g] ?? NFL_KEYS.WR).map(([k, n]) => [k, n, a[k] ?? 50] as [string, string, number]);
  return { ovr, pos: x.pos, attrs: a, key, abil: abilities(g, a) };
}

/** Overall by position weights, then spread so the league looks like a Madden roster. */
function overall(g: string, a: Record<string, number>, p: number): number {
  const w: Record<string, Record<string, number>> = {
    QB: { THP: 0.22, SAC: 0.18, MAC: 0.2, DAC: 0.14, TUP: 0.14, AWR: 0.1, SPD: 0.02 },
    RB: { SPD: 0.22, ACC: 0.14, BTK: 0.16, JKM: 0.1, CAR: 0.12, BCV: 0.16, CTH: 0.1 },
    WR: { SPD: 0.2, CTH: 0.2, RTE: 0.22, CIT: 0.12, SPC: 0.08, REL: 0.18 },
    TE: { CTH: 0.24, RBK: 0.2, SPD: 0.14, CIT: 0.16, RTE: 0.18, STR: 0.08 },
    OL: { PBK: 0.32, RBK: 0.3, STR: 0.16, AWR: 0.14, IBL: 0.08 },
    DL: { PMV: 0.2, FMV: 0.2, BSH: 0.22, STR: 0.14, SPD: 0.1, TAK: 0.08, PRC: 0.06 },
    LB: { TAK: 0.22, PUR: 0.18, PRC: 0.2, ZCV: 0.14, SPD: 0.12, BSH: 0.14 },
    CB: { SPD: 0.2, MCV: 0.26, ZCV: 0.2, PRS: 0.12, PRC: 0.12, CTH: 0.1 },
    S: { SPD: 0.16, ZCV: 0.24, MCV: 0.16, TAK: 0.16, HIT: 0.1, PRC: 0.18 },
    K: { KAC: 0.55, KPW: 0.45 },
  };
  const ws = w[g] ?? w.WR;
  let sum = 0;
  let tot = 0;
  for (const [k, v] of Object.entries(ws)) {
    sum += (a[k] ?? 60) * v;
    tot += v;
  }
  const raw = sum / tot;
  // blend the attribute average with the standing, then stretch to a Madden-like spread
  const blended = 0.6 * raw + 0.4 * lerp(55, 99, Math.pow(p, 1.6));
  return r99(50 + (blended - 50) * 1.08);
}

function abilities(g: string, a: Record<string, number>): string[] {
  const out: string[] = [];
  if (g === 'QB') {
    if (a.THP >= 92) out.push('cannon');
    if (a.SAC >= 90 && a.TUP >= 85) out.push('surgeon');
    if (a.SPD >= 85) out.push('scrambler');
  }
  if (g === 'RB') {
    if (a.TRK >= 88) out.push('truck-stick');
    if (a.JKM >= 90) out.push('juke-box');
  }
  if (g === 'WR' || g === 'TE') {
    if (a.SPD >= 93 && a.SPC >= 82) out.push('deep-threat');
    if (a.CTH >= 92) out.push('sure-hands');
    if (a.CIT >= 90) out.push('red-zone');
  }
  if (g === 'OL') {
    if (a.PBK >= 90) out.push('pocket-wall');
    if (a.RBK >= 90) out.push('road-grader');
  }
  if (g === 'DL' || g === 'LB') {
    if (Math.max(a.PMV ?? 0, a.FMV ?? 0) >= 90) out.push('edge-threat');
    if ((a.BSH ?? 0) >= 90 || (g === 'LB' && a.TAK >= 92)) out.push('run-stopper');
    if ((a.HIT ?? 0) >= 90) out.push('enforcer');
  }
  if (g === 'CB' || g === 'S') {
    if (a.MCV >= 90) out.push('shutdown');
    if (a.CTH >= 85) out.push('ballhawk');
    if (g === 'S' && a.HIT >= 88) out.push('enforcer');
  }
  if (g === 'K' && a.KPW >= 92) out.push('big-leg');
  return out;
}

/** A season card's rating (Ultimate Team): its own ranks, honors and size. */
export function rateNflLine(line: CardLine, pos = line.pos[0]): NflRating {
  // the standing: the best of its main ranks, honors aside
  const main = Object.values(line.rk).filter((v): v is number => typeof v === 'number');
  const rank = main.length ? main.reduce((s, v) => s + v, 0) / main.length * 0.5 + Math.max(...main) * 0.5 : 0.35;
  const r = rateNfl({ pos, ht: line.ht, wt: line.wt, rank, stats: line.stats, rk: line.rk, honors: line.honors });
  if (line.boost) {
    r.ovr = Math.min(99, r.ovr + line.boost);
    for (const k of Object.keys(r.attrs)) r.attrs[k] = Math.min(99, r.attrs[k] + Math.round(line.boost * 0.8));
    r.key = r.key.map(([k, n]) => [k, n, r.attrs[k] ?? 50]);
  }
  return r;
}
