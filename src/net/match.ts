// Head-to-head over Nostr: who's online, the matchmaking queue (or a private room), and the
// live channel two players draft through.
import { DATA_V } from '../engine/version';
import type { Slot } from '../engine/types';
import { displayName } from '../lib/names';
import { type Event, KIND_APP, KIND_HANDSHAKE, KIND_MATCH, KIND_PRESENCE, KIND_QUEUE, myPubkey, NET_ON, NS_SUFFIX, pool, query, sign, tagValue } from './nostr';

/** Bump when the draft rules change, so only players on the same rules get paired. */
const DRAFT_RULES = 1;
/** Same player data, scoring and draft rules: required for both phones to score a match the same way. */
export const NET_V = 'ps1-' + DATA_V + '-' + DRAFT_RULES + NS_SUFFIX;
const ONLINE_TAG = 'ps1-online' + NS_SUFFIX;
const STORE_NS = 'perfect-season/v1' + NS_SUFFIX + '/match/';

const now = () => Math.floor(Date.now() / 1000);

function parse(e: Event): Record<string, unknown> | null {
  try {
    const c = JSON.parse(e.content);
    return c && typeof c === 'object' ? c : null;
  } catch {
    return null;
  }
}

// ---------- who's online ----------

export interface OnlineCount {
  online: number;
  searching: number;
}

type Status = 'menu' | 'queue' | 'match';

let presenceStarted = false;
let myStatus: Status = 'menu';
let myName = '';
const seenOnline = new Map<string, number>();
const seenSearching = new Map<string, number>();
const countListeners = new Set<(c: OnlineCount) => void>();

function counts(): OnlineCount {
  const t = Date.now();
  let online = 1;
  let searching = myStatus === 'queue' ? 1 : 0;
  const me = myPubkey();
  for (const [k, at] of seenOnline) if (k !== me && t - at < 75000) online++;
  for (const [k, at] of seenSearching) if (k !== me && t - at < 8000) searching++;
  return { online, searching };
}

function emitCounts(): void {
  const c = counts();
  countListeners.forEach((f) => f(c));
}

function beat(): void {
  if (!myName || document.visibilityState !== 'visible') return;
  void pool.publish(sign(KIND_PRESENCE, [['t', ONLINE_TAG]], JSON.stringify({ name: myName, st: myStatus })));
}

/** Announce this player every 25s while the app is open, and count everyone else. */
export function startPresence(name: string): void {
  myName = name;
  if (!NET_ON || presenceStarted) {
    beat();
    return;
  }
  presenceStarted = true;
  pool.subscribe([{ kinds: [KIND_PRESENCE], '#t': [ONLINE_TAG], since: now() - 90 }], (e) => {
    seenOnline.set(e.pubkey, Date.now());
    emitCounts();
  });
  pool.subscribe([{ kinds: [KIND_QUEUE], '#t': ['ps1-queue-' + NET_V], since: now() - 10 }], (e) => {
    seenSearching.set(e.pubkey, Date.now());
    seenOnline.set(e.pubkey, Date.now());
    emitCounts();
  });
  beat();
  window.setInterval(beat, 25000);
  window.setInterval(emitCounts, 5000);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && beat());
}

export function setPresence(st: Status): void {
  if (myStatus === st) return;
  myStatus = st;
  beat();
  emitCounts();
}

export function onCounts(fn: (c: OnlineCount) => void): () => void {
  countListeners.add(fn);
  fn(counts());
  return () => countListeners.delete(fn);
}

// ---------- matchmaking ----------

export interface Opponent {
  pubkey: string;
  name: string;
  level: number;
}

export interface Found {
  matchId: string;
  seed: string;
  /** the host picks first in rounds 1, 3 and 5 */
  host: boolean;
  opp: Opponent;
}

type MMState = { kind: 'idle' } | { kind: 'inviting'; to: string; matchId: string; seed: string; until: number } | { kind: 'accepted'; from: string; matchId: string; seed: string; until: number } | { kind: 'done' };

const randId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** A short code for a private match, without look-alike characters. */
export function newRoomCode(): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

export function cleanRoomCode(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4);
}

/**
 * Looks for an opponent in the public queue, or in a private room when `room` is set.
 * Pairing is a three-step handshake (invite → accept → go). When two players invite each
 * other at once, the one with the larger key accepts the other's invite.
 */
export class Matchmaker {
  private me = myPubkey();
  private state: MMState = { kind: 'idle' };
  private searchers = new Map<string, Opponent & { seen: number }>();
  private tried = new Map<string, number>();
  private subs: { close: () => void }[] = [];
  private loops: number[] = [];
  private stopped = false;
  private tag: string;

  constructor(
    private readonly info: { name: string; level: number; room?: string },
    private readonly onFound: (f: Found) => void,
    private readonly onSeen?: (n: number) => void
  ) {
    this.tag = info.room ? 'ps1-room-' + NET_V + '-' + info.room : 'ps1-queue-' + NET_V;
  }

  start(): void {
    if (!NET_ON) return;
    pool.start();
    this.subs.push(
      pool.subscribe([{ kinds: [KIND_QUEUE], '#t': [this.tag], since: now() - 10 }], (e) => this.onQueue(e)),
      pool.subscribe([{ kinds: [KIND_HANDSHAKE], '#p': [this.me], since: now() - 10 }], (e) => this.onHandshake(e))
    );
    this.announce();
    this.loops.push(
      window.setInterval(() => this.announce(), 2000),
      window.setInterval(() => this.tick(), 700)
    );
  }

  /** Stop searching. Safe after a match was found: the last handshake messages still go out. */
  stop(): void {
    this.stopped = true;
    this.loops.forEach((t) => clearInterval(t));
    this.loops = [];
    this.subs.forEach((s) => s.close());
    this.subs = [];
  }

  private announce(): void {
    if (this.stopped || this.state.kind === 'done') return;
    void pool.publish(sign(KIND_QUEUE, [['t', this.tag]], JSON.stringify({ name: this.info.name, lvl: this.info.level })));
  }

  private send(to: string, body: Record<string, unknown>): void {
    void pool.publish(sign(KIND_HANDSHAKE, [['p', to], ['t', this.tag]], JSON.stringify(body)));
  }

  private onQueue(e: Event): void {
    if (e.pubkey === this.me || tagValue(e, 't') !== this.tag) return;
    const c = parse(e);
    if (!c) return;
    this.searchers.set(e.pubkey, { pubkey: e.pubkey, name: displayName(c.name), level: Number.isInteger(c.lvl) ? (c.lvl as number) : 1, seen: Date.now() });
    this.onSeen?.(this.fresh().length);
  }

  private fresh(): (Opponent & { seen: number })[] {
    const t = Date.now();
    return Array.from(this.searchers.values()).filter((s) => t - s.seen < 6000);
  }

  private tick(): void {
    if (this.stopped) return;
    const t = Date.now();
    const st = this.state;
    if ((st.kind === 'inviting' || st.kind === 'accepted') && t > st.until) {
      if (st.kind === 'inviting') this.tried.set(st.to, t + 8000);
      this.state = { kind: 'idle' };
    }
    if (this.state.kind !== 'idle') return;
    const options = this.fresh().filter((s) => (this.tried.get(s.pubkey) ?? 0) < t);
    if (!options.length) return;
    // invite the player waiting longest; a small random wait keeps two players from colliding
    if (Math.random() < 0.5) return;
    const target = options.sort((a, b) => a.seen - b.seen)[0];
    const matchId = randId();
    const seed = randId();
    this.state = { kind: 'inviting', to: target.pubkey, matchId, seed, until: t + 4500 };
    this.send(target.pubkey, { type: 'invite', match: matchId, seed, name: this.info.name, lvl: this.info.level });
  }

  private onHandshake(e: Event): void {
    if (this.stopped || e.pubkey === this.me || tagValue(e, 't') !== this.tag) return;
    const c = parse(e);
    if (!c || typeof c.match !== 'string') return;
    const st = this.state;
    const from = e.pubkey;
    const t = Date.now();
    const name = displayName(c.name);
    const level = Number.isInteger(c.lvl) ? (c.lvl as number) : 1;
    if (c.type === 'invite' && typeof c.seed === 'string') {
      const mutual = st.kind === 'inviting' && st.to === from;
      if (st.kind === 'idle' || (mutual && this.me > from)) {
        this.state = { kind: 'accepted', from, matchId: c.match, seed: c.seed, until: t + 6000 };
        this.searchers.set(from, { pubkey: from, name, level, seen: t });
        this.send(from, { type: 'accept', match: c.match, name: this.info.name, lvl: this.info.level });
        this.listenForStart(from, c.match);
      } else if (!mutual) this.send(from, { type: 'decline', match: c.match });
    } else if (c.type === 'accept' && st.kind === 'inviting' && st.to === from && st.matchId === c.match) {
      this.state = { kind: 'done' };
      // say go a few times: a lost go would leave the other player waiting
      for (const ms of [0, 400, 1200]) window.setTimeout(() => this.send(from, { type: 'go', match: c.match }), ms);
      const opp = this.searchers.get(from);
      this.finish({ matchId: c.match, seed: st.seed, host: true, opp: { pubkey: from, name: opp?.name ?? name, level: opp?.level ?? level } });
    } else if (c.type === 'go' && st.kind === 'accepted' && st.from === from && st.matchId === c.match) {
      this.started(from, c.match);
    } else if (c.type === 'decline' && st.kind === 'inviting' && st.to === from && st.matchId === c.match) {
      this.tried.set(from, t + 5000);
      this.state = { kind: 'idle' };
    }
  }

  /** The host's first match message counts as "go" too, in case every "go" got lost. */
  private listenForStart(from: string, matchId: string): void {
    const sub = pool.subscribe([{ kinds: [KIND_MATCH], '#t': ['ps1-m-' + matchId], authors: [from], since: now() - 10 }], () => this.started(from, matchId));
    this.subs.push(sub);
  }

  private started(from: string, matchId: string): void {
    const st = this.state;
    if (st.kind !== 'accepted' || st.from !== from || st.matchId !== matchId) return;
    this.state = { kind: 'done' };
    const opp = this.searchers.get(from)!;
    this.finish({ matchId, seed: st.seed, host: false, opp: { pubkey: from, name: opp.name, level: opp.level } });
  }

  /** In the middle of a handshake: don't hand this player to the AI right now. */
  pending(): boolean {
    return this.state.kind === 'inviting' || this.state.kind === 'accepted';
  }

  private finish(f: Found): void {
    this.stop();
    this.onFound(f);
  }
}

// ---------- the match channel ----------

export interface OnlinePick {
  /** round, 0–4 */
  r: number;
  /** the cell he came from: the round's, or the picker's own redraw when nobody there fit */
  cell: string;
  id: string;
  slot: Slot;
}

export interface MatchState {
  seq: number;
  picks: OnlinePick[];
  lineup: Partial<Record<Slot, string>>;
  /** this player left the match on purpose */
  left: boolean;
  /** this player's phone gave up on the other one and let the AI finish their draft */
  tookOver: boolean;
}

/**
 * The live channel for one match. Each side sends its whole state on every change and
 * every 3 seconds, so a lost message never matters; 20 seconds of silence means the
 * other player is gone.
 */
export class MatchConn {
  private mine: MatchState = { seq: 0, picks: [], lineup: {}, left: false, tookOver: false };
  private theirs: MatchState = { seq: -1, picks: [], lineup: {}, left: false, tookOver: false };
  private sub: { close: () => void } | null = null;
  private timer: number | null = null;
  private lastHeard = Date.now();
  private lastTick = Date.now();
  private lastLookup = 0;
  private heardOnce = false;
  private tag: string;
  /** where each side leaves its last state, for a phone that comes back after the live channel closed */
  private stored: string;
  /** no more listening or heartbeats */
  private ended = false;
  /** closed: nothing more goes to the screen, even while the final state is still being re-sent */
  private muted = false;
  private onVisible = () => {
    if (document.visibilityState !== 'visible' || this.muted) return;
    // we were the ones in the background: give the other player a fresh chance to be heard,
    // and look up anything they left while we were gone
    this.lastHeard = Math.max(this.lastHeard, Date.now() - 5000);
    void this.lookup();
  };

  constructor(
    readonly found: Found,
    private readonly onChange: (theirs: MatchState, gone: boolean) => void
  ) {
    this.tag = 'ps1-m-' + found.matchId;
    this.stored = STORE_NS + found.matchId;
  }

  start(): void {
    if (!NET_ON) return;
    this.sub = pool.subscribe([{ kinds: [KIND_MATCH], '#t': [this.tag], authors: [this.found.opp.pubkey], since: now() - 60 }], (e) => this.onEvent(e));
    this.send();
    this.timer = window.setInterval(() => {
      const t = Date.now();
      // a long gap between ticks means this phone was frozen, and no relay answering means our
      // own connection is down: either way the silence isn't theirs
      if (t - this.lastTick > 7000 || !pool.healthy()) this.lastHeard = Math.max(this.lastHeard, t - 5000);
      this.lastTick = t;
      this.send();
      if (t - this.lastHeard > 12000 && t - this.lastLookup > 10000) void this.lookup();
      this.report();
    }, 3000);
    document.addEventListener('visibilitychange', this.onVisible);
  }

  gone(): boolean {
    return this.theirs.left || Date.now() - this.lastHeard > 20000;
  }

  /** Heard from the other player at least once (no forfeit wins against someone who never arrived). */
  heard(): boolean {
    return this.heardOnce;
  }

  update(fn: (s: MatchState) => MatchState): void {
    if (this.ended || this.muted) return;
    const before = this.mine;
    this.mine = { ...fn(this.mine), seq: this.mine.seq + 1 };
    this.send();
    if ((this.mine.tookOver && !before.tookOver) || (this.mine.left && !before.left)) this.persist();
  }

  private report(): void {
    if (!this.muted) this.onChange(this.theirs, this.gone());
  }

  private send(): void {
    void pool.publish(sign(KIND_MATCH, [['t', this.tag], ['p', this.found.opp.pubkey]], JSON.stringify(this.mine)));
  }

  /** Leave our state where a phone that comes back later can find it (relays drop it after a day). */
  private persist(): void {
    void pool.publish(sign(KIND_APP, [['d', this.stored], ['expiration', String(now() + 86400)]], JSON.stringify(this.mine)));
  }

  /** Look for the other player's stored state: their final picks, or that they took over for us. */
  private async lookup(): Promise<void> {
    this.lastLookup = Date.now();
    const found = await query([{ kinds: [KIND_APP], authors: [this.found.opp.pubkey], '#d': [this.stored] }], 4000);
    for (const e of found) if (tagValue(e, 'd') === this.stored) this.take(e, false);
  }

  private onEvent(e: Event): void {
    if (tagValue(e, 't') !== this.tag) return;
    this.take(e, true);
  }

  private take(e: Event, live: boolean): void {
    if (this.ended || this.muted || e.pubkey !== this.found.opp.pubkey) return;
    const c = parse(e);
    if (!c || !Number.isInteger(c.seq) || !Array.isArray(c.picks)) return;
    if (live) {
      this.lastHeard = Date.now();
      this.heardOnce = true;
    }
    if ((c.seq as number) <= this.theirs.seq) {
      this.report();
      return;
    }
    const picks = (c.picks as OnlinePick[]).filter((p) => p && Number.isInteger(p.r) && typeof p.cell === 'string' && typeof p.id === 'string' && typeof p.slot === 'string');
    this.theirs = { seq: c.seq as number, picks, lineup: (c.lineup && typeof c.lineup === 'object' ? c.lineup : {}) as MatchState['lineup'], left: c.left === true, tookOver: c.tookOver === true };
    this.report();
  }

  /**
   * Leaving mid-match tells the other player (three times, in case one is lost). After a
   * finished draft, `lingerMs` keeps sending our final state a while, and it's also stored, so
   * the other phone gets our last pick even if it was away. Either way the screen hears nothing
   * more from this match.
   */
  close(leaving: boolean, lingerMs = 0): void {
    if (this.ended || this.muted) return;
    this.muted = true;
    document.removeEventListener('visibilitychange', this.onVisible);
    if (leaving) {
      this.mine = { ...this.mine, left: true, seq: this.mine.seq + 1 };
      for (const ms of [0, 600, 1500]) window.setTimeout(() => this.send(), ms);
    }
    if (leaving || lingerMs > 0) this.persist();
    const end = () => {
      this.ended = true;
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      this.sub?.close();
    };
    if (lingerMs > 0 && !leaving) {
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = window.setInterval(() => this.send(), 2500);
      window.setTimeout(end, lingerMs);
    } else end();
  }
}
