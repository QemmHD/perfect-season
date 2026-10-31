import React, { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CELL_BY_ID, ERAS, TEAM_ABBRS, primeVersion } from '../engine/data';
import {
  botChoose,
  botPicksFirst,
  canMove,
  ROUNDS,
  currentCell,
  draftReducer,
  effectivePlayer,
  eligibleSlots,
  filledCount,
  isDraftComplete,
  newDraft,
  nextCell,
  noOneFits,
  type BotPick,
  type DraftState,
  type SpinKind,
  whyUnavailable,
} from '../engine/draft';
import { BOOSTER_NAMES, BOOSTER_PRICES, BOOSTER_UNLOCK_LEVEL, RESPIN_PRICE, levelInfo } from '../engine/economy';
import { bestPickFor, onlineOrder, redrawCell, SHOT_CLOCK } from '../engine/online';
import { bestRarity, RARITY_NAMES, type Rarity, rarityOf } from '../engine/rarity';
import { rateTeam } from '../engine/rating';
import { NFL } from '../engine/sport';
import { type Booster, BOOSTERS, type BotLevel, type Mode, type Player, type Slot, SLOTS } from '../engine/types';
import { sfx, vibrate } from '../lib/sound';
import type { OnlinePick } from '../net/match';
import { frameY, useLayout } from '../stage';
import { CoinChip, Confirm, Fit, initials, seasonLabel } from './common';
import { Back, Crown, Down, Lock, Refresh } from './icons';
import { CountUp, reducedMotion, Sparks } from './motion';
import { cardName, FLOOR, hotFor, isDefender, roleLabel, type SortKey, SORTS, sortValue, statCols } from './sportui';
import { CardSheet, TradingCard } from './Card';

/** Card left edges on the basketball court's five spots. */
const COURT_X: Record<Slot, number> = { C: 70, PF: 236, SF: 26, SG: 280, PG: 153 };
/**
 * Football's field, top to bottom: the defense across the line of scrimmage (DL, LB, DB), the
 * receivers (WR, TE, FLEX), and the backfield (QB, RB). Card centers across the 390 frame.
 */
const FIELD_CX: Record<Slot, number> = { DL: 62, LB: 195, DB: 328, WR: 62, TE: 195, FLEX: 328, QB: 128.5, RB: 261.5 };
const COURT_ORDER: Slot[] = NFL ? ['DL', 'LB', 'DB', 'WR', 'TE', 'FLEX', 'QB', 'RB'] : ['C', 'PF', 'SF', 'SG', 'PG'];
const CARD_W = 84;
/** a football card's height before it's scaled down to fit three rows on a short field */
const FIELD_CH = 104;
const BAR_LABELS = NFL ? ['PASSING', 'RUSHING', 'RECEIVING', 'DEFENSE'] : ['SCORING', 'BOARDS', 'PASSING', 'DEFENSE'];
const MODE_NAMES: Record<Mode, string> = { classic: 'CLASSIC', blind: 'BLIND', daily: 'DAILY', '1v1': '1 VS 1' };
const TEAM_MS = 1150;
const ERA_MS = 1550;
/** pause between the reels stopping and the player list sliding up */
const OPEN_DELAY = 360;

/** A head-to-head draft against a real player. */
export interface OnlineProps {
  seed: string;
  host: boolean;
  oppName: string;
  /** the other player's picks so far */
  oppPicks: OnlinePick[];
  /** nothing heard from them for a while, or they left: the AI picks for them */
  oppGone: boolean;
  /** they took over for us: the match is over on this phone, do nothing more */
  halted: boolean;
  onPick: (p: OnlinePick) => void;
  onLineup: (l: Partial<Record<Slot, string>>) => void;
  /** we started picking for them */
  onTakeover: () => void;
}

export interface DraftProps {
  mode: Mode;
  botLevel: BotLevel;
  botFirst: boolean;
  dailyKey: string | null;
  coins: number;
  xp: number;
  inventory: Record<Booster, number>;
  hints: boolean;
  firstRun: boolean;
  onSpend: (coins: number) => boolean;
  onBooster: (b: Booster, delta: number) => void;
  onToast: (text: string) => void;
  /** leaving; carries the draft when it was already complete, so its result still counts */
  onExit: (done?: DraftState) => void;
  initial?: DraftState;
  onCheckpoint?: (s: DraftState) => void;
  onComplete: (s: DraftState) => void;
  onCoachDone: () => void;
  online?: OnlineProps;
}

interface ReelState {
  /** current face first, then the blur of passing items, the result, and one filler below it */
  items: string[];
  key: number;
  moving: boolean;
  landed: number;
}

function strip(from: string, final: string, pool: string[], n: number): string[] {
  const out = [from];
  for (let i = 0; i < n; i++) out.push(pool[Math.floor(Math.random() * pool.length)]);
  out.push(final, pool[Math.floor(Math.random() * pool.length)]);
  return out;
}

function Reel({ label, caption, era, reel, ms, tint }: { label: string; caption: string | null; era?: boolean; reel: ReelState; ms: number; tint: string | null }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const winRef = useRef<HTMLDivElement>(null);
  const n = reel.items.length;
  // the strip rests with the result in the window; percentages keep it right at any reel height
  const pct = (i: number) => (-100 * i) / n;
  const rest = pct(Math.max(0, n - 2));
  useLayoutEffect(() => {
    const el = stripRef.current;
    if (!el || !reel.key || reducedMotion() || !el.animate) return;
    const one = 100 / n;
    const end = rest;
    el.animate(
      [
        { transform: 'translateY(0%)', filter: 'blur(0px)', easing: 'cubic-bezier(.3,.7,.4,1)' },
        { transform: 'translateY(' + one * 0.24 + '%)', filter: 'blur(0px)', offset: 0.07, easing: 'cubic-bezier(.6,0,1,.55)' },
        { transform: 'translateY(' + end * 0.3 + '%)', filter: 'blur(2.4px)', offset: 0.27, easing: 'cubic-bezier(.1,.6,.26,1)' },
        { transform: 'translateY(' + (end - one * 0.18) + '%)', filter: 'blur(0px)', offset: 0.88, easing: 'cubic-bezier(.4,0,.3,1)' },
        { transform: 'translateY(' + end + '%)', filter: 'blur(0px)' },
      ],
      { duration: ms }
    );
  }, [reel.key]);
  useEffect(() => {
    if (!reel.landed || reducedMotion()) return;
    winRef.current?.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(5px)', offset: 0.3 }, { transform: 'translateY(-1.5px)', offset: 0.65 }, { transform: 'translateY(0)' }], {
      duration: 380,
      easing: 'ease-out',
    });
  }, [reel.landed]);
  const lit = !!caption && !reel.moving && reel.landed > 0;
  return (
    <div className={'reel' + (era ? ' era' : '') + (lit ? ' lit' : '') + (reel.moving ? ' spinning' : '')} style={tint ? ({ '--tint': tint } as React.CSSProperties) : undefined}>
      <div className="reel-label">
        <span className="lbl-a">{label}</span>
        <span className="lbl-b">{caption}</span>
      </div>
      <div className="reel-window" ref={winRef}>
        <span className="tint" aria-hidden="true" />
        <div className="strip" ref={stripRef} style={{ transform: 'translateY(' + rest + '%)' }}>
          {reel.items.map((t, i) => (
            <div key={reel.key + ':' + i} aria-hidden={i !== n - 2}>
              {t}
            </div>
          ))}
        </div>
        {reel.landed > 0 && <span className="flash" key={reel.landed} aria-hidden="true" />}
      </div>
    </div>
  );
}

/** What the bot (or the other player) did, for the toast. A pick from their own redraw names the team-decade drawn. */
function botLine(pick: BotPick, roundCell: string, lead: string, who = 'the AI'): string {
  if (pick.cellId === roundCell) return lead + pick.player.name + ' for ' + pick.slot + '.';
  const c = CELL_BY_ID[pick.cellId];
  return 'Nobody here fit ' + who + ', so they drew the ' + c.era + ' ' + c.name + ' and took ' + pick.player.name + '.';
}

interface CourtLayout {
  /** each spot's card box, left and top (football: the box before its scale) */
  x: Record<Slot, number>;
  y: Record<Slot, number>;
  /** football: how much the cards are scaled down to fit the field (1 = full size) */
  k: number;
  /** football: the line of scrimmage and the first-down line */
  los: number;
  first: number;
}

/** The spots' cards, fitted to the court's (or field's) height. */
function courtLayout(h: number, ch: number): CourtLayout {
  if (NFL) {
    // three rows: full size when they fit, else scaled down together (each card about its center)
    const pad = 8;
    const los = 18;
    const gap = 10;
    const k = Math.max(0.5, Math.min(1, (h - 2 * pad - los - gap) / (3 * ch)));
    const vh = ch * k;
    const slack = Math.max(0, h - (2 * pad + los + gap + 3 * vh));
    const yD = pad + slack * 0.3;
    const y1 = yD + vh + los + slack * 0.4;
    const y2 = y1 + vh + gap + slack * 0.12;
    const top: Record<Slot, number> = { DL: yD, LB: yD, DB: yD, WR: y1, TE: y1, FLEX: y1, QB: y2, RB: y2 };
    const x: Record<Slot, number> = {};
    const y: Record<Slot, number> = {};
    for (const s of COURT_ORDER) {
      x[s] = FIELD_CX[s] - CARD_W / 2;
      y[s] = top[s] - (ch * (1 - k)) / 2;
    }
    return { x, y, k, los: yD + vh + los / 2, first: Math.max(4, yD - 6) };
  }
  const pad = 8;
  const gap = 10;
  const slack = Math.max(0, h - (pad + ch + gap + ch + pad));
  const s = Math.min(slack, 92);
  const e = slack - s;
  const y1 = pad + s * 0.565 + e * 0.35;
  const y2 = y1 + ch + gap + e * 0.15;
  const y3 = y2 + s * 0.435 + e * 0.1;
  return { x: COURT_X, y: { C: y1, PF: y1, SF: y2, SG: y2, PG: y3 }, k: 1, los: 0, first: 0 };
}

function CourtLines({ h, ys, ch }: { h: number; ys: Record<Slot, number>; ch: number }) {
  // the 3-point arc runs just under the top of the point guard's card
  const arcBottom = ys.PG + ch * 0.12;
  const sag = Math.min(128, arcBottom - 14);
  const corner = arcBottom - sag;
  const r = (170 * 170 + sag * sag) / (2 * sag);
  const keyBottom = Math.max(70, ys.C + ch - 18);
  return (
    <svg className="court-lines" width="390" height={h} viewBox={'0 0 390 ' + h} aria-hidden="true">
      <defs>
        <radialGradient id="spot" cx="50%" cy="0%" r="75%">
          <stop offset="0%" stopColor="#19E3C9" stopOpacity="0.16" />
          <stop offset="60%" stopColor="#19E3C9" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#19E3C9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B2631" />
          <stop offset="100%" stopColor="#061820" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="390" height={h} fill="url(#floor)" />
      <rect x="0" y="0" width="390" height={h} fill="url(#spot)" />
      <g fill="none" stroke="#19E3C9" strokeWidth="2" strokeOpacity="0.24">
        <path d={'M25 0 L25 ' + corner + ' A' + r + ' ' + r + ' 0 0 0 365 ' + corner + ' L365 0'} />
        <rect x="135" y="-2" width="120" height={keyBottom + 2} fill="#19E3C9" fillOpacity="0.045" />
        <circle cx="195" cy={keyBottom} r="56" strokeDasharray={'0 0'} />
        <line x1="0" y1={h - 1} x2="390" y2={h - 1} />
        <path d={'M135 ' + h + ' A60 60 0 0 1 255 ' + h} />
      </g>
      <line x1="165" y1="16" x2="225" y2="16" stroke="#F2F6F7" strokeOpacity="0.55" strokeWidth="3" strokeLinecap="round" />
      <circle cx="195" cy="28" r="10" fill="none" stroke="#F5B83D" strokeWidth="2.5" />
    </svg>
  );
}

/** A football field under the eight cards: yard lines, hash marks, the line of scrimmage between
    the defense and the offense, and the first-down line beyond the defense. */
function FieldLines({ h, los, first }: { h: number; los: number; first: number }) {
  const step = 46;
  const lines: number[] = [];
  for (let y = los % step; y < h; y += step) lines.push(y);
  return (
    <svg className="court-lines field" width="390" height={h} viewBox={'0 0 390 ' + h} aria-hidden="true">
      <defs>
        <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B2A22" />
          <stop offset="100%" stopColor="#061A16" />
        </linearGradient>
        <radialGradient id="spot" cx="50%" cy="0%" r="75%">
          <stop offset="0%" stopColor="#19E3C9" stopOpacity="0.14" />
          <stop offset="60%" stopColor="#19E3C9" stopOpacity="0.03" />
          <stop offset="100%" stopColor="#19E3C9" stopOpacity="0" />
        </radialGradient>
        <pattern id="mow" width="390" height={step * 2} patternUnits="userSpaceOnUse" y={los % (step * 2)}>
          <rect width="390" height={step} fill="#ffffff" fillOpacity="0.018" />
        </pattern>
      </defs>
      <rect x="0" y="0" width="390" height={h} fill="url(#turf)" />
      <rect x="0" y="0" width="390" height={h} fill="url(#mow)" />
      <rect x="0" y="0" width="390" height={h} fill="url(#spot)" />
      <g stroke="#F2F6F7" strokeOpacity="0.16" strokeWidth="1.5">
        {lines.map((y) => (
          <line key={y} x1="10" y1={y} x2="380" y2={y} />
        ))}
        {lines.map((y) =>
          [0.2, 0.4, 0.6, 0.8].map((f) => (
            <g key={y + ':' + f}>
              <line x1="140" y1={y + step * f} x2="150" y2={y + step * f} />
              <line x1="240" y1={y + step * f} x2="250" y2={y + step * f} />
            </g>
          ))
        )}
        <line x1="10" y1="0" x2="10" y2={h} strokeOpacity="0.3" />
        <line x1="380" y1="0" x2="380" y2={h} strokeOpacity="0.3" />
      </g>
      <line x1="10" y1={los} x2="380" y2={los} stroke="#4FA3FF" strokeOpacity="0.55" strokeWidth="2.5" />
      <line x1="10" y1={first} x2="380" y2={first} stroke="#F5B83D" strokeOpacity="0.5" strokeWidth="2.5" />
    </svg>
  );
}

export function Draft(props: DraftProps) {
  const { mode, botLevel, dailyKey, online } = props;
  const layout = useLayout();
  const [s, dispatch] = useReducer(draftReducer, undefined, () => {
    if (props.initial && !online) return props.initial;
    if (!online) return newDraft(mode, botLevel, dailyKey, props.botFirst);
    // the host picks first in rounds 1, 3 and 5; the AI that covers a dropped player plays like Pro
    return { ...newDraft('1v1', 'pro', null, !online.host), order: onlineOrder(online.seed) };
  });
  useEffect(() => { if (!online) props.onCheckpoint?.(s); }, [s]);
  const sRef = useRef(s);
  sRef.current = s;
  const [team, setTeam] = useState<ReelState>({ items: [s.cellId ? CELL_BY_ID[s.cellId].abbr : '?', ''], key: 0, moving: false, landed: 0 });
  const [era, setEra] = useState<ReelState>({ items: [s.cellId ? CELL_BY_ID[s.cellId].era : '?', ''], key: 0, moving: false, landed: 0 });
  const [spinning, setSpinning] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [swapFrom, setSwapFrom] = useState<Slot | null>(null);
  const [bursts, setBursts] = useState<{ id: number; slot: Slot; color: string }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>('val');
  const [coach, setCoach] = useState(props.firstRun && !online ? 0 : -1);
  const [buy, setBuy] = useState<Booster | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [botBusy, setBotBusy] = useState(false);
  const [courtH, setCourtH] = useState(300);
  /** the big moment when you draft an Epic or Legendary player */
  const [pull, setPull] = useState<{ id: number; rarity: Rarity; player: Player; slot: Slot } | null>(null);
  /** a card held down: the inspect view */
  const [inspect, setInspect] = useState<{ p: Player; slot: Slot } | null>(null);
  const pressT = useRef<number | null>(null);
  const pressed = useRef(false);
  const unpress = () => {
    if (pressT.current) clearTimeout(pressT.current);
    pressT.current = null;
  };
  useEffect(() => unpress, []);
  /** the reels landed on a team with a Legendary player */
  const [spot, setSpot] = useState(0);
  const timers = useRef<number[]>([]);
  const usedSeen = useRef(0);
  const burstId = useRef(0);
  const courtRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y0: number; t0: number; dy: number; id: number; active: boolean } | null>(null);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), []);

  useLayoutEffect(() => {
    const el = courtRef.current;
    if (!el) return;
    const read = () => setCourtH(el.clientHeight);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const openDrawer = () => setDrawer(true);

  const blind = mode === 'blind';
  const boostersOn = mode === 'classic' || mode === 'blind';
  const cell = currentCell(s);
  const level = levelInfo(props.xp).level;
  const filled = filledCount(s.lineup);
  const complete = isDraftComplete(s);

  // a booster was spent inside the reducer: take it from the inventory
  useEffect(() => {
    if (s.boostersUsed.length > usedSeen.current) {
      const b = s.boostersUsed[s.boostersUsed.length - 1];
      usedSeen.current = s.boostersUsed.length;
      props.onBooster(b, -1);
    }
  }, [s.boostersUsed]);

  // after the user's pick(s): end the cell, or let the bot answer in 1v1
  useEffect(() => {
    if (!s.cellId || !s.youDone) return;
    if (mode === '1v1' && !s.botDone) {
      if (online) return; // the other player answers over the network (effect below)
      setBotBusy(true);
      const cellId = s.cellId;
      later(() => {
        const st = sRef.current;
        const mine = Object.values(st.lineup)
          .filter(Boolean)
          .map((p) => (p as Player).id);
        const pick = botChoose(st, cellId, mine, Math.random);
        if (pick) {
          dispatch({ type: 'bot', playerId: pick.player.id, slot: pick.slot, cellId: pick.cellId });
          props.onToast(botLine(pick, cellId, 'AI took '));
          sfx.select();
        }
        dispatch({ type: 'endCell' });
        setBotBusy(false);
      }, 850);
      return;
    }
    if (s.botDone) later(() => dispatch({ type: 'endCell' }), 250);
  }, [s.youDone, s.botDone, s.cellId]);

  // all five placed: a short celebration on the court
  const [wave, setWave] = useState(false);
  useEffect(() => {
    if (!complete) return;
    setWave(true);
    sfx.seriesWin();
    const t = window.setTimeout(() => setWave(false), 1400);
    return () => clearTimeout(t);
  }, [complete]);

  /** Place a player; in head to head, also tell the other phone. */
  const placePick = (playerId: string, slot: Slot) => {
    const st = sRef.current;
    const base = currentCell(st)?.players.find((x) => x.id === playerId);
    const placed = base ? effectivePlayer(st, base) : null;
    const rar = placed ? rarityOf(placed) : 'common';
    // Blind hides rarity until the season is played: no pull to give it away
    if (!blind && placed && (rar === 'legendary' || rar === 'epic')) {
      const id = Date.now();
      setPull({ id, rarity: rar, player: placed, slot });
      later(() => setPull((x) => (x && x.id === id ? null : x)), rar === 'legendary' ? 2500 : 1800);
      if (rar === 'legendary') {
        sfx.title();
        vibrate([30, 40, 30, 40, 60]);
      } else sfx.seriesWin();
    }
    dispatch({ type: 'place', playerId, slot });
    if (online && st.cellId) online.onPick({ r: st.cellsDone, cell: st.cellId, id: playerId, slot });
  };

  // ---------- head to head ----------
  const autoSpun = useRef(-1);
  const autoAfterLand = useRef(false);
  const takeoverSaid = useRef(false);
  const aiRound = useRef(-1);
  const myTurn = !!online && !!s.cellId && !spinning && !s.youDone && (s.botDone || !botPicksFirst(s));
  const theirTurn = !!online && !!s.cellId && !spinning && !s.botDone && !isDraftComplete(s) && (botPicksFirst(s) || s.youDone);
  const [clock, setClock] = useState(SHOT_CLOCK);

  // each round's reels spin by themselves: both phones land on the same team-decade
  useEffect(() => {
    if (!online || online.halted || s.cellId || isDraftComplete(s) || spinning || autoSpun.current === s.cellsDone) return;
    autoSpun.current = s.cellsDone;
    later(() => spin('spin'), s.cellsDone === 0 ? 900 : 650);
  }, [s.cellId, s.cellsDone, spinning]);

  // the other player's pick for this round: apply it when it's their turn
  useEffect(() => {
    if (!online || online.halted || !s.cellId || spinning || s.botDone || isDraftComplete(s)) return;
    if (!botPicksFirst(s) && !s.youDone) return;
    const r = s.cellsDone;
    const roundCell = s.order![r];
    const pick = online.oppPicks.find((x) => x.r === r);
    const wasFirst = botPicksFirst(s);
    if (pick) {
      const a = { type: 'bot' as const, playerId: pick.id, slot: pick.slot, cellId: pick.cell };
      let next = s;
      try {
        // the other phone can't take a player you hold, or draft from another round's team-decade
        const mine = Object.values(s.lineup).some((x) => x && x.id === pick.id);
        const otherRound = pick.cell !== roundCell && s.order!.slice(0, ROUNDS).includes(pick.cell);
        if (!mine && !otherRound) next = draftReducer(s, a);
      } catch {
        next = s;
      }
      if (next !== s) {
        dispatch(a);
        const placed = SLOTS.map((k) => next.botLineup[k]).find((x) => x && x.id === pick.id)!;
        const slot = SLOTS.find((k) => next.botLineup[k] === placed)!;
        props.onToast(botLine({ slot, player: placed, cellId: pick.cell }, roundCell, online.oppName + ' took ', online.oppName));
        sfx.select();
        if (wasFirst) later(openDrawer, 300);
        return;
      }
    }
    if ((!online.oppGone && !pick) || aiRound.current === r) return;
    aiRound.current = r;
    // they're gone (or sent a pick that can't be placed): the AI picks for them
    if (!takeoverSaid.current) {
      takeoverSaid.current = true;
      online.onTakeover();
      props.onToast(online.oppName + ' lost connection. The AI is finishing their draft.');
    }
    const mine = Object.values(s.lineup)
      .filter(Boolean)
      .map((p) => (p as Player).id);
    const ai = botChoose(s, roundCell, wasFirst ? [] : mine, Math.random);
    setBotBusy(true);
    later(() => {
      // their real pick may have arrived in the meantime: then it stands
      if (ai && !sRef.current.botDone) {
        dispatch({ type: 'bot', playerId: ai.player.id, slot: ai.slot, cellId: ai.cellId });
        props.onToast(botLine(ai, roundCell, 'AI for ' + online.oppName + ': ', 'the AI'));
        sfx.select();
      } else if (s.youDone) dispatch({ type: 'endCell' });
      setBotBusy(false);
      if (wasFirst) later(openDrawer, 300);
    }, 700);
  }, [online?.oppPicks, online?.oppGone, s.cellId, s.youDone, s.botDone, spinning]);

  // tell the other phone where your players stand after a swap
  useEffect(() => {
    if (!online) return;
    const l: Partial<Record<Slot, string>> = {};
    for (const k of SLOTS) if (s.lineup[k]) l[k] = s.lineup[k]!.id;
    online.onLineup(l);
  }, [s.lineup]);

  // time's up: your choice if you made one, otherwise the pick that helps your team most
  const autoPick = () => {
    const st = sRef.current;
    if (!st.cellId || st.youDone || online?.halted) return;
    const chosen = selected ? currentCell(st)?.players.find((p) => p.id === selected) : null;
    const slots = chosen ? eligibleSlots(st, chosen) : [];
    if (chosen && slots.length && !whyUnavailable(st, chosen)) {
      placePick(chosen.id, slots[0]);
      burst(slots[0], chosen.c2);
      props.onToast('Time! ' + chosen.name + ' goes to ' + slots[0] + '.');
    } else {
      const best = bestPickFor(st, st.cellId, st.taken);
      if (!best) {
        autoAfterLand.current = true;
        spin('nofit');
        return;
      }
      placePick(best.player.id, best.slot);
      burst(best.slot, best.player.c2);
      props.onToast('Time! You got ' + best.player.name + ' at ' + best.slot + '.');
    }
    sfx.place();
    setSelected(null);
    setDrawer(false);
  };
  const autoPickRef = useRef(autoPick);
  autoPickRef.current = autoPick;

  // the shot clock: yours, or a countdown while the other player picks
  const turnKey = online ? s.cellsDone + ':' + s.cellId + ':' + (myTurn ? 'me' : theirTurn ? 'them' : '-') : '';
  useEffect(() => {
    if (!online || (!myTurn && !theirTurn)) return;
    const t0 = Date.now();
    let lastTick = -1;
    setClock(SHOT_CLOCK);
    const t = window.setInterval(() => {
      const left = Math.max(0, SHOT_CLOCK - Math.floor((Date.now() - t0) / 1000));
      setClock(left);
      if (myTurn && left <= 5 && left > 0 && left !== lastTick) {
        lastTick = left;
        sfx.tick();
      }
      if (left === 0) {
        clearInterval(t);
        if (myTurn) autoPickRef.current();
      }
    }, 200);
    return () => clearInterval(t);
  }, [turnKey]);

  const spin = (kind: SpinKind) => {
    const st = sRef.current;
    if (spinning) return;
    const cur = currentCell(st);
    if (kind === 'team' || kind === 'era') {
      if (!cur || st.youDone || (mode === '1v1' && st.taken.length)) {
        props.onToast(cur ? 'Respins only work before anyone picks this round.' : 'Spin first, then you can respin.');
        sfx.nope();
        return;
      }
      const free = kind === 'team' ? st.freeTeam : st.freeEra;
      if (free <= 0) {
        if (!props.onSpend(RESPIN_PRICE)) {
          props.onToast('A respin costs ' + RESPIN_PRICE + ' coins. You can earn more by playing.');
          sfx.nope();
          return;
        }
        props.onToast('Respin bought: −' + RESPIN_PRICE + ' coins.');
        dispatch({ type: 'respin', kind, paid: true });
      } else dispatch({ type: 'respin', kind, paid: false });
    }
    let nx = nextCell(st, kind, Math.random);
    if (online && kind === 'nofit') {
      // your own redraw, from your half of the match order (never a round cell)
      const own = redrawCell(st, st.order!, online.host);
      if (own) nx = { cellId: own, ptr: st.ptr };
    }
    const target = CELL_BY_ID[nx.cellId];
    const spinTeam = kind !== 'era' || !cur || cur.abbr !== target.abbr;
    const spinEra = kind !== 'team' || !cur || cur.era !== target.era;
    const total = spinEra ? (spinTeam ? ERA_MS : TEAM_MS) : TEAM_MS;
    setSpinning(true);
    setDrawer(false);
    setSelected(null);
    setSwapFrom(null);
    sfx.spinStart();
    // ticks slow down like a real reel
    let t = 60;
    let gap = 38;
    while (t < total - 160) {
      later(() => sfx.tick(), t);
      t += gap;
      gap *= 1.1;
    }
    const from = (r: ReelState) => r.items[Math.max(0, r.items.length - 2)];
    if (spinTeam) setTeam((r) => ({ items: strip(from(r), target.abbr, TEAM_ABBRS, 24), key: r.key + 1, moving: true, landed: r.landed }));
    if (spinEra) setEra((r) => ({ items: strip(from(r), target.era, ERAS, 20), key: r.key + 1, moving: true, landed: r.landed }));
    if (spinTeam)
      later(() => {
        setTeam((r) => ({ ...r, moving: false, landed: r.landed + 1 }));
        sfx.stop();
      }, TEAM_MS);
    later(() => {
      if (spinEra) {
        setEra((r) => ({ ...r, moving: false, landed: r.landed + 1 }));
        sfx.stop();
      }
      if (!blind && bestRarity(target.players) === 'legendary') {
        setSpot(Date.now());
        later(() => sfx.coin(), 120);
      }
      // after a no-fit respin the bot keeps the pick it already made this round
      const landing = { type: 'land' as const, cellId: nx.cellId, ptr: nx.ptr, keepBot: kind === 'nofit' };
      dispatch(landing);
      setSpinning(false);
      const after = draftReducer(sRef.current, landing);
      if (online) {
        // open the list when it's your pick; otherwise wait for the other player
        if (!botPicksFirst(after)) later(openDrawer, OPEN_DELAY);
        if (autoAfterLand.current) {
          autoAfterLand.current = false;
          later(() => autoPickRef.current(), 450);
        }
      } else if (botPicksFirst(after)) {
        setBotBusy(true);
        later(() => {
          const pick = botChoose(sRef.current, nx.cellId, [], Math.random);
          if (pick) {
            dispatch({ type: 'bot', playerId: pick.player.id, slot: pick.slot, cellId: pick.cellId });
            props.onToast(botLine(pick, nx.cellId, 'AI picks first this round: '));
            sfx.select();
          }
          setBotBusy(false);
          later(openDrawer, 250);
        }, 700);
      } else later(openDrawer, OPEN_DELAY);
      if (coach === 0) setCoach(1);
    }, total);
  };

  const selectedBase = cell && selected ? (cell.players.find((p) => p.id === selected) ?? null) : null;
  const selectedP = selectedBase ? effectivePlayer(s, selectedBase) : null;
  const targets = selectedP ? eligibleSlots(s, selectedP) : [];

  const notYourTurn = () => {
    if (!online || myTurn) return false;
    props.onToast(online.oppName + ' picks first this round.');
    sfx.nope();
    return true;
  };

  const pickRow = (p: Player) => {
    if (s.youDone || botBusy || notYourTurn()) return;
    if (s.armed === 'prime') {
      const up = primeVersion(p);
      if (!up) {
        props.onToast(p.name + ' has no better team-decade line to prime.');
        sfx.nope();
        return;
      }
      if (whyUnavailable(s, p) === 'taken' || whyUnavailable(s, p) === 'dup') {
        props.onToast(p.name + " isn't available.");
        return;
      }
      dispatch({ type: 'prime', playerId: p.id });
      sfx.levelUp();
      props.onToast(p.name + ' primed: now his ' + up.primedFrom!.abbr + ' ' + up.primedFrom!.era + ' line.');
      const why = whyUnavailable({ ...s, armed: null }, up);
      if (why === null) {
        setSelected(p.id);
        setDrawer(false);
      }
      return;
    }
    const why = whyUnavailable(s, effectivePlayer(s, p));
    if (why) {
      props.onToast(
        p.name +
          ': ' +
          (why === 'taken' ? 'taken by ' + (online ? online.oppName : 'the AI') + '.' : why === 'dup' ? 'already on your team.' : s.armed === 'trade' ? "can't replace anyone on your team." : isDefender(p) ? 'your ' + p.pos[0] + ' spot is filled.' : 'no open spot for his positions.')
      );
      sfx.nope();
      return;
    }
    sfx.select();
    setSelected(p.id);
    setSwapFrom(null);
    setDrawer(false);
    if (coach === 1) setCoach(2);
  };

  const burst = (slot: Slot, color: string) => {
    const id = ++burstId.current;
    setBursts((b) => [...b, { id, slot, color }]);
    later(() => setBursts((b) => b.filter((x) => x.id !== id)), 900);
  };

  const tapSlot = (k: Slot) => {
    if (selectedP) {
      if (!targets.includes(k)) {
        props.onToast(s.lineup[k] && s.armed !== 'trade' ? k + ' is taken. Tap a glowing spot.' : selectedP.name + " can't play " + k + '.');
        sfx.nope();
        return;
      }
      const replaced = s.armed === 'trade' ? s.lineup[k] : null;
      const stillDouble = s.armed === 'double' && s.picksLeft === 2 && filled < ROUNDS - 1;
      placePick(selectedP.id, k);
      sfx.place();
      burst(k, selectedP.c2);
      setSelected(null);
      if (replaced) props.onToast('Traded ' + replaced.name + ' for ' + selectedP.name + '.');
      if (stillDouble) {
        later(openDrawer, 520);
        props.onToast('Double Pick: choose one more from this team.');
      }
      if (coach === 2) {
        setCoach(-1);
        props.onCoachDone();
      }
      return;
    }
    const here = s.lineup[k];
    if (swapFrom) {
      if (swapFrom === k) {
        setSwapFrom(null);
        return;
      }
      if (canMove(s.lineup, swapFrom, k)) {
        const mover = s.lineup[swapFrom]!;
        dispatch({ type: 'move', from: swapFrom, to: k });
        sfx.place();
        props.onToast(here ? 'Swapped ' + cardName(mover) + ' and ' + cardName(here) + '.' : cardName(mover) + ' moved to ' + k + '.');
      } else {
        props.onToast("Those two can't swap spots.");
        sfx.nope();
      }
      setSwapFrom(null);
      return;
    }
    if (here) {
      setSwapFrom(k);
      sfx.select();
      props.onToast('Tap a spot to move ' + cardName(here) + ', or tap him again to cancel.');
      return;
    }
    if (cell && !s.youDone) {
      if (!notYourTurn()) openDrawer();
      return;
    }
    props.onToast(online ? 'The next team-decade is on its way.' : 'Spin to get a team and a decade.');
  };

  const tapBooster = (b: Booster) => {
    if (!boostersOn) return;
    if (level < BOOSTER_UNLOCK_LEVEL[b]) {
      props.onToast(BOOSTER_NAMES[b] + ' unlocks at level ' + BOOSTER_UNLOCK_LEVEL[b] + '.');
      sfx.nope();
      return;
    }
    if (s.boostersUsed.includes(b)) {
      props.onToast('One ' + BOOSTER_NAMES[b] + ' per draft.');
      return;
    }
    if (s.armed === b) {
      dispatch({ type: 'arm', booster: null });
      setSelected(null);
      return;
    }
    if (!cell || s.youDone || spinning) {
      props.onToast('Spin first, then use ' + BOOSTER_NAMES[b] + ' on that team.');
      return;
    }
    if (b === 'double' && ROUNDS - filled < 2) {
      props.onToast('Double Pick needs two open spots.');
      return;
    }
    if (b === 'trade' && filled === 0) {
      props.onToast('Trade needs someone on your team to swap out.');
      return;
    }
    if (props.inventory[b] <= 0) {
      setBuy(b);
      return;
    }
    if (s.armed === 'double') dispatch({ type: 'arm', booster: null });
    dispatch({ type: 'arm', booster: b });
    setSelected(null);
    openDrawer();
    sfx.click();
  };

  // drag the drawer's header down to close it
  const onGripDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { y0: frameY(e, layout), t0: performance.now(), dy: 0, id: e.pointerId, active: false };
  };
  const onGripMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = drawerRef.current;
    if (!d || !el || e.pointerId !== d.id) return;
    d.dy = Math.max(0, frameY(e, layout) - d.y0);
    if (!d.active && d.dy > 6) {
      d.active = true;
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    }
    if (d.active) {
      el.style.transition = 'none';
      el.style.transform = 'translateY(' + d.dy + 'px)';
    }
  };
  const onGripUp = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = drawerRef.current;
    drag.current = null;
    if (!d || !el || !d.active) return;
    e.preventDefault();
    el.style.transition = '';
    el.style.transform = '';
    const v = d.dy / Math.max(1, performance.now() - d.t0);
    if (d.dy > 90 || (d.dy > 24 && v > 0.45)) setDrawer(false);
  };

  const rating = rateTeam(SLOTS.map((k) => s.lineup[k]));
  const rows = useMemo(() => {
    if (!cell) return [];
    const list = cell.players.slice();
    if (blind) list.sort((a, b) => a.name.localeCompare(b.name));
    else list.sort((a, b) => sortValue(b, sortKey) - sortValue(a, sortKey));
    return list;
  }, [cell, blind, sortKey]);

  // rows are built when the reels land, before the drawer opens, so opening only slides
  // finished content; the stagger replays from CSS each time the drawer opens
  const rowEls = useMemo(
    () =>
      cell
        ? rows.map((base, i) => {
            const p = effectivePlayer(s, base);
            const why = whyUnavailable(s, p);
            const up = s.armed === 'prime' ? primeVersion(base) : null;
            const show = up ?? p;
            const tag =
              why === 'taken'
                ? 'TAKEN BY ' + (online ? online.oppName.toUpperCase() : 'THE AI')
                : why === 'dup'
                  ? 'ALREADY ON YOUR TEAM'
                  : why === 'nofit'
                    ? s.armed === 'trade'
                      ? "CAN'T REPLACE ANYONE"
                      : 'NO OPEN SPOT'
                    : p.primedFrom
                      ? 'PRIMED: ' + p.primedFrom.abbr + ' ' + p.primedFrom.era
                      : up
                        ? 'PRIME: ' + up.primedFrom!.abbr + ' ' + up.primedFrom!.era
                        : '';
            const off = !!why || (s.armed === 'prime' && !up);
            const rar = blind ? 'common' : rarityOf(show);
            const cols = statCols(show);
            return (
              <button
                key={base.id}
                className={'row r-' + rar + (off ? ' off' : '') + (selected === base.id ? ' sel' : '') + (up && !why ? ' primeable' : '')}
                style={{ animationDelay: Math.min(i, 9) * 26 + 'ms' }}
                aria-disabled={off}
                onClick={() => pickRow(base)}
              >
                <span className="who">
                  <b>
                    {p.name}
                    {rar !== 'common' && <i className={'rar ' + rar}>{RARITY_NAMES[rar].toUpperCase()}</i>}
                  </b>
                  <span>
                    {roleLabel(p)} · {NFL && p.est ? '~' : ''}
                    {p.g} G{p.seasons > 1 ? ' · ' + p.seasons + ' seasons' : ''}
                    {!NFL && p.est && !blind ? ' · est.' : ''}
                  </span>
                  {tag && <em>{tag}</em>}
                </span>
                <span className={'stats' + (NFL ? ' n' + cols.length + (isDefender(p) ? ' def' : '') : '')}>
                  {cols.map((c) => (
                    <span key={c.key}>
                      <i>{c.label}</i>
                      <b className={blind ? '' : up ? 'up' : hotFor(sortKey, c, p) ? 'hot' : ''}>{blind ? '?' : c.text}</b>
                    </span>
                  ))}
                </span>
              </button>
            );
          })
        : null,
    [cell, rows, s, selected, sortKey, blind, botBusy, coach]
  );

  const primeHints =
    boostersOn && props.hints && cell && !s.youDone && level >= BOOSTER_UNLOCK_LEVEL.prime && !s.boostersUsed.includes('prime') && s.armed !== 'prime'
      ? cell.players.some((p) => {
          const up = primeVersion(p);
          return up && up.val - p.val >= 5 && whyUnavailable(s, up) === null;
        })
      : false;

  // bottom action
  const noFit = noOneFits(s);
  let action = { label: 'SPIN', cls: 'big shine', off: false, run: () => spin('spin') };
  if (online && !cell && !complete && !spinning) action = { label: 'NEXT ROUND…', cls: 'big busy', off: true, run: () => {} };
  else if (spinning) action = { label: 'SPINNING…', cls: 'big busy', off: true, run: () => {} };
  else if (complete) action = { label: mode === '1v1' ? 'SEE THE MATCHUP' : 'PLAY THE SEASON', cls: 'big gold shine', off: false, run: () => props.onComplete(s) };
  else if (botBusy) action = { label: online ? 'AI IS PICKING FOR ' + online.oppName.toUpperCase() + '…' : 'AI IS PICKING…', cls: 'big busy', off: true, run: () => {} };
  else if (theirTurn) action = { label: online!.oppName.toUpperCase() + ' IS PICKING…', cls: 'big busy', off: true, run: () => {} };
  else if (cell && !s.youDone) {
    if (noFit) action = { label: 'NO ONE FITS · FREE RESPIN', cls: 'big small', off: false, run: () => spin('nofit') };
    else if (selectedP) action = { label: 'TAP A GLOWING SPOT', cls: 'big', off: true, run: () => props.onToast('Tap one of the glowing spots on the ' + FLOOR + '.') };
    else action = { label: drawer ? 'PICK A PLAYER' : 'SHOW PLAYERS', cls: 'big ghost', off: false, run: openDrawer };
  } else if (cell && s.youDone) action = { label: 'NEXT ROUND…', cls: 'big busy', off: true, run: () => {} };

  const respinOff = spinning || !cell || s.youDone || botBusy || (mode === '1v1' && s.taken.length > 0);
  const roundNo = Math.min(ROUNDS, filled + 1);

  const armedText: Record<Booster, string> = {
    double: 'DOUBLE PICK: choose ' + s.picksLeft + ' more from this team',
    trade: 'TRADE: pick a player, then tap the teammate he replaces',
    prime: 'PRIME: tap a player with a crown to upgrade him',
  };

  const tray = (
    <div className="tray">
      {BOOSTERS.map((b) => {
        const locked = level < BOOSTER_UNLOCK_LEVEL[b];
        const used = s.boostersUsed.includes(b);
        return (
          <button
            key={b}
            className={'boost' + (locked ? ' locked' : '') + (s.armed === b ? ' armed' : '') + (used ? ' used' : '')}
            onClick={() => tapBooster(b)}
            aria-pressed={s.armed === b}
            aria-label={BOOSTER_NAMES[b] + (locked ? ', unlocks at level ' + BOOSTER_UNLOCK_LEVEL[b] : ', you have ' + props.inventory[b])}
          >
            {locked ? <Lock size={13} /> : b === 'prime' ? <Crown size={13} /> : null}
            <span>{b === 'double' ? 'DOUBLE' : BOOSTER_NAMES[b].toUpperCase()}</span>
            {locked ? <span>LV{BOOSTER_UNLOCK_LEVEL[b]}</span> : <em>{props.inventory[b]}</em>}
          </button>
        );
      })}
    </div>
  );

  const banner = (inDrawer: boolean) =>
    s.armed ? (
      <div className={'armed-banner' + (inDrawer ? ' in-drawer' : '')} role="status" key={s.armed}>
        <span>{armedText[s.armed]}</span>
        <button onClick={() => dispatch({ type: 'arm', booster: null })}>CANCEL</button>
      </div>
    ) : null;

  const ch = NFL ? FIELD_CH : courtH < 250 ? 96 : 104;
  const lay = courtLayout(courtH, ch);
  const ys = lay.y;
  const xs = lay.x;
  const cards = COURT_ORDER.map((k) => ({ k, p: s.lineup[k] })).filter((x) => x.p) as { k: Slot; p: Player }[];
  const cellReady = !!cell && !spinning;

  return (
    <div className="screen draft">
      <div className="draft-head">
        <button className="icon-btn" onClick={() => (filled || online ? setLeaving(true) : props.onExit())} aria-label="Leave draft">
          <Back size={18} />
        </button>
        <div className="round">
          <span>
            ROUND {roundNo} / {ROUNDS} · {online ? 'VS ' + online.oppName.toUpperCase() : MODE_NAMES[mode]}
          </span>
          <div className={'segs' + (ROUNDS > 6 ? ' many' : '')}>
            {SLOTS.map((_, i) => (
              <i key={i} className={i < filled ? 'on' : ''} />
            ))}
          </div>
        </div>
        <CoinChip coins={props.coins} />
      </div>

      <div className="reels">
        {spot > 0 && (
          <span className="spotted" key={spot} aria-live="polite">
            LEGEND IN THIS TEAM
          </span>
        )}
        <Reel label="TEAM" caption={cellReady ? cell!.name : null} reel={team} ms={TEAM_MS} tint={cellReady ? cell!.c1 : null} />
        <Reel label="DECADE" caption={cellReady ? seasonLabel(cell!.from) + ' to ' + seasonLabel(cell!.to) : null} era reel={era} ms={ERA_MS} tint={cellReady ? '#F5B83D' : null} />
      </div>
      <div className="respins" hidden={!!online}>
        <button className={'respin' + (s.freeTeam ? ' free' : '')} aria-disabled={respinOff} onClick={() => spin('team')} aria-label="Respin team">
          <Refresh size={15} /> TEAM · {s.freeTeam ? 'FREE' : RESPIN_PRICE}
        </button>
        <button className={'respin era' + (s.freeEra ? ' free' : '')} aria-disabled={respinOff} onClick={() => spin('era')} aria-label="Respin decade">
          <Refresh size={15} /> DECADE · {s.freeEra ? 'FREE' : RESPIN_PRICE}
        </button>
      </div>

      {s.armed ? (
        banner(false)
      ) : blind ? (
        <div className="cats blind-note">BLIND MODE · STATS HIDDEN · +50% REWARDS</div>
      ) : (
        <div className="cats" aria-label="Team so far">
          {rating.ratios.map((x, i) => (
            <div className="cat" key={i}>
              <div>
                <span>{BAR_LABELS[i]}</span>
                <b className={'num' + (x >= 1 ? ' full' : '')}>
                  <CountUp value={Math.round(x * 100)} ms={500} />%
                </b>
              </div>
              <span className="bar">
                <i style={{ width: Math.min(100, Math.round(x * 100)) + '%' }} className={x >= 1 ? 'full' : ''} />
              </span>
            </div>
          ))}
        </div>
      )}

      <div className={'court' + (wave ? ' wave' : '')} ref={courtRef}>
        {NFL ? <FieldLines h={courtH} los={lay.los} first={lay.first} /> : <CourtLines h={courtH} ys={ys} ch={ch} />}
        {COURT_ORDER.map((k) => {
          const glow = !!selectedP && targets.includes(k) && !s.lineup[k];
          const moverOk = !!swapFrom && swapFrom !== k && !s.lineup[k] && canMove(s.lineup, swapFrom, k);
          return (
            <button
              key={k}
              className={'slot-empty' + (glow || moverOk ? ' glow' : '') + (s.lineup[k] ? ' filled' : '')}
              style={{ left: xs[k], top: ys[k], height: ch, ...(lay.k < 1 ? { scale: String(lay.k) } : {}) }}
              onClick={() => tapSlot(k)}
              aria-label={k + ': empty' + (glow ? ', tap to place' : '')}
              aria-hidden={!!s.lineup[k]}
              tabIndex={s.lineup[k] ? -1 : 0}
            >
              <span className="key">{k}</span>
              <span className="plus" aria-hidden="true">
                +
              </span>
            </button>
          );
        })}
        {cards.map(({ k, p }, i) => {
          const glow = !!selectedP && targets.includes(k);
          const moverOk = !!swapFrom && swapFrom !== k && canMove(s.lineup, swapFrom, k);
          const cls = ['pcard', 'rar-' + (blind ? 'common' : rarityOf(p))];
          if (swapFrom === k) cls.push('picked');
          if (moverOk) cls.push('target');
          if (glow) cls.push('trade');
          return (
            <button
              key={p.id}
              className={cls.join(' ')}
              style={{ translate: xs[k] + 'px ' + ys[k] + 'px', height: ch, ...(lay.k < 1 ? { scale: String(lay.k) } : {}), '--c1': p.c1, '--c2': p.c2, '--i': i } as React.CSSProperties}
              onPointerDown={() => {
                unpress();
                // a press whose release never reached the card (the sheet covered it) is over
                pressed.current = false;
                pressT.current = window.setTimeout(() => {
                  pressed.current = true;
                  vibrate(15);
                  sfx.whoosh();
                  setInspect({ p, slot: k });
                }, 460);
              }}
              onPointerUp={unpress}
              onPointerLeave={unpress}
              onPointerCancel={unpress}
              onContextMenu={(e) => e.preventDefault()}
              onClick={() => {
                // a long press opened the card: the tap that ends it isn't a move
                if (pressed.current) {
                  pressed.current = false;
                  return;
                }
                tapSlot(k);
              }}
              aria-label={k + ': ' + p.name + '. Tap to move.'}
            >
              {p.primedFrom && (
                <span className="crown">
                  <Crown size={12} />
                </span>
              )}
              <span className="pcard-in">
                <TradingCard p={p} slot={k} blind={blind} />
              </span>
            </button>
          );
        })}
        {bursts.map((b) => (
          <span key={b.id} className="burst" style={{ left: xs[b.slot] + CARD_W / 2, top: ys[b.slot] + ch / 2, '--bc': b.color } as React.CSSProperties} aria-hidden="true">
            <i className="ring" />
            <Sparks color={b.color} />
          </span>
        ))}
      </div>

      {/* spare height (tall screens) goes here, keeping the tray attached to the button */}
      <div className="spacer" />
      {boostersOn && tray}
      {primeHints && <div className="prime-hint">Good moment for a Prime: someone here has a much better decade elsewhere.</div>}
      {online && (myTurn || theirTurn) && (
        <div className={'shotclock' + (myTurn ? ' mine' : ' theirs') + (myTurn && clock <= 5 ? ' hurry' : '')} role="timer" aria-label={(myTurn ? 'Your pick: ' : online.oppName + ' is picking: ') + clock + ' seconds'}>
          <span>{myTurn ? 'YOUR PICK' : online.oppName.toUpperCase() + ' IS PICKING'}</span>
          <span className="track">
            <i style={{ transform: 'scaleX(' + clock / SHOT_CLOCK + ')' }} />
          </span>
          <b className="num">{clock}</b>
        </div>
      )}
      {mode === '1v1' && (
        <div className={'botstrip' + (online ? ' live' : '') + (ROUNDS > 6 ? ' many' : '')} aria-label={online ? online.oppName + "'s lineup" : 'AI lineup'}>
          <span>{online ? online.oppName.toUpperCase() + (online.oppGone ? ' · AI' : '') : 'AI · ' + botLevel.toUpperCase()}</span>
          {SLOTS.map((k) => {
            const p = s.botLineup[k];
            return (
              <span key={k + (p ? p.id : '')} className={'botchip' + (p ? ' on' : '')} style={p ? { background: p.c1, borderColor: p.c2 } : undefined} title={p ? p.name : k}>
                {p ? initials(p.name) : k}
              </span>
            );
          })}
        </div>
      )}

      <div className="actionbar">
        <button className={action.cls} aria-disabled={action.off} onClick={action.run}>
          <Fit text={action.label} />
        </button>
      </div>

      <div className={'drawer' + (drawer && cell ? ' open' : '')} ref={drawerRef} aria-hidden={!(drawer && cell)} {...(drawer && cell ? {} : { inert: '' })}>
        {cell && (
          <>
            <div className="drawer-head" onPointerDown={onGripDown} onPointerMove={onGripMove} onPointerUp={onGripUp} onPointerCancel={onGripUp}>
              <span className="grip" aria-hidden="true" />
              <span className="teamstripe" style={{ background: 'linear-gradient(180deg,' + cell.c1 + ',' + cell.c2 + ')' }} aria-hidden="true" />
              <div className="drawer-title">
                <span className="disp">
                  {cell.abbr} · <span className="era-case">{cell.era}</span>
                </span>
                <small>
                  {cell.name} · {seasonLabel(cell.from)} to {seasonLabel(cell.to)}
                </small>
              </div>
              <button className="icon-btn" onClick={() => setDrawer(false)} aria-label="Hide players" style={{ color: 'var(--gold)' }}>
                <Down size={18} />
              </button>
            </div>
            {banner(true)}
            {!blind && (
              <div className="sorts" role="group" aria-label="Sort players">
                {SORTS.map(([key, label]) => (
                  <button key={key} className={'chip' + (sortKey === key ? ' on' : '')} aria-pressed={sortKey === key} onClick={() => setSortKey(key)}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <div className="rows" key={cell.id + ':' + sortKey}>
              {rowEls}
            </div>
            {boostersOn && <div className="drawer-tray">{tray}</div>}
          </>
        )}
      </div>

      {inspect && (
        <CardSheet
          p={inspect.p}
          slot={inspect.slot}
          blind={blind}
          onClose={() => {
            pressed.current = false;
            setInspect(null);
          }}
        />
      )}

      {pull && (
        <div className={'pull ' + pull.rarity} key={pull.id} aria-live="assertive">
          <span className="pull-rays" aria-hidden="true" />
          <b className="disp">{RARITY_NAMES[pull.rarity].toUpperCase()}!</b>
          <span className="pull-card" aria-label={pull.player.name}>
            <span className="flip">
              <span className="back" aria-hidden="true">
                <i className="disp">PS</i>
              </span>
              <span className="front">
                <span className="bigcard s2">
                  <TradingCard p={pull.player} slot={pull.slot} tilt={false} />
                </span>
              </span>
            </span>
          </span>
        </div>
      )}

      {coach >= 0 && !spinning && ((coach === 0 && !cell && filled === 0) || (coach === 1 && drawer && cell) || (coach === 2 && selectedP)) && (
        <div className={'coach c' + coach + (coach === 0 && boostersOn ? ' above-tray' : '')} key={coach}>
          <span>
            {coach === 0 ? 'Tap SPIN to roll a random team and decade.' : coach === 1 ? 'Pick any player. Faded players don’t fit an open spot.' : 'Now tap a glowing spot on the ' + FLOOR + ' to place him.'}
          </span>
          <button
            onClick={() => {
              setCoach(-1);
              props.onCoachDone();
            }}
          >
            SKIP TIPS
          </button>
        </div>
      )}

      {buy && (
        <Confirm
          title={'Buy ' + BOOSTER_NAMES[buy] + '?'}
          body={'You have none left. Buy one for ' + BOOSTER_PRICES[buy] + ' coins (you have ' + props.coins + ').'}
          yes={'BUY · ' + BOOSTER_PRICES[buy]}
          no="NOT NOW"
          tone="gold"
          onNo={() => setBuy(null)}
          onYes={() => {
            const b = buy;
            setBuy(null);
            if (!props.onSpend(BOOSTER_PRICES[b])) {
              props.onToast('Not enough coins yet. Play a few games to earn more.');
              sfx.nope();
              return;
            }
            sfx.coin();
            props.onBooster(b, 1);
            if (s.armed === 'double') dispatch({ type: 'arm', booster: null });
            dispatch({ type: 'arm', booster: b });
            setSelected(null);
            openDrawer();
          }}
        />
      )}
      {leaving && (
        <Confirm
          title={online ? 'Leave the match?' : 'Leave this draft?'}
          body={online ? 'Leaving counts as a loss on your head-to-head record.' : 'Your solo draft is saved. Continue it from Home whenever you’re ready.'}
          yes="LEAVE"
          no="KEEP DRAFTING"
          onNo={() => setLeaving(false)}
          onYes={() => {
            setLeaving(false);
            const st = sRef.current;
            props.onExit(isDraftComplete(st) ? st : undefined);
          }}
        />
      )}
    </div>
  );
}
