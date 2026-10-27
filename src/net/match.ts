// Head-to-head over Nostr: who's online, the matchmaking queue (or a private room), and the
// live channel two players draft through.
import { NFL, SPORT, type SportId } from '../engine/sport';
import { DATA_V } from '../engine/version';
import type { Slot } from '../engine/types';
import { displayName } from '../lib/names';
import { teamOf } from '../data/teams';
import { type Ballot, type Seen, voteWireOf } from './vote';
import { type Event, KIND_APP, KIND_HANDSHAKE, KIND_MATCH, KIND_PRESENCE, KIND_QUEUE, myPubkey, NET_ON, NS_SUFFIX, pool, query, sign, tagValue } from './nostr';

/** Bump when the draft rules change, so only players on the same rules get paired. 2: the
    match is played out (the arcade game), and each side's score goes over the match channel.
    3: a sim-or-play vote before the game, favorite teams for the uniforms, basketball v2, and
       football drafts eight: a DL, a LB and a DB in place of a team defense. */
const DRAFT_RULES = 3;
/** Same player data, scoring and draft rules: required for both phones to score a match the same way. */
export const NET_V = 'ps1-' + DATA_V + '-' + DRAFT_RULES + NS_SUFFIX;
/** Everyone with the app open, whichever sport: the online count is the whole app's. */
const ONLINE_TAG = 'ps1-online' + NS_SUFFIX;
const STORE_NS = (NFL ? 'perfect-season/nfl/v1' : 'perfect-season/v1') + NS_SUFFIX + '/match/';

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
  /** of those, in this sport: the players a match can be with */
  here: number;
  searching: number;
}

type Status = 'menu' | 'queue' | 'match';

/** Each open app says it's here this often; after three missed beats it no longer counts. */
const BEAT_MS = 10000;
const ONLINE_MS = 32000;
/** Searchers announce themselves every 2 seconds. */
const QUEUE_MS = 6000;

let presenceStarted = false;
let myStatus: Status = 'menu';
let myName = '';
let lastBeat = 0;
/** when a hello last actually reached a relay */
let lastHello = 0;
let answer: number | null = null;
let lastEmitted = '';
const seenOnline = new Map<string, number>();
const seenHere = new Map<string, number>();
const seenSearching = new Map<string, number>();
const countListeners = new Set<(c: OnlineCount) => void>();

function counts(): OnlineCount {
  const t = Date.now();
  const me = myPubkey();
  let online = 1;
  let here = 1;
  let searching = myStatus === 'queue' ? 1 : 0;
  for (const [k, at] of seenOnline) {
    if (t - at > ONLINE_MS) seenOnline.delete(k);
    else if (k !== me) online++;
  }
  for (const [k, at] of seenHere) {
    if (t - at > ONLINE_MS) seenHere.delete(k);
    else if (k !== me) here++;
  }
  for (const [k, at] of seenSearching) {
    if (t - at > QUEUE_MS) seenSearching.delete(k);
    else if (k !== me) searching++;
  }
  return { online, here, searching };
}

/** Tell the screens, when a number changed (checked every second). */
function emitCounts(force = false): void {
  const c = counts();
  const key = c.online + ':' + c.here + ':' + c.searching;
  if (!force && key === lastEmitted) return;
  lastEmitted = key;
  countListeners.forEach((f) => f(c));
}

/** "I'm here." With hello, everyone else answers right away, so a fresh count is right in a second or two. */
function beat(hello = false): void {
  if (!myName || document.visibilityState !== 'visible') return;
  lastBeat = Date.now();
  // a hello sent with no relay connected reached no one: it goes again when one connects
  if (hello && pool.connected() > 0) lastHello = lastBeat;
  const c = { name: myName, st: myStatus, sp: SPORT };
  void pool.publish(sign(KIND_PRESENCE, [['t', ONLINE_TAG]], JSON.stringify(hello ? { ...c, hello: true } : c)));
}

/** Leaving (app to the background, or closed): others stop counting us at once. */
function goodbye(): void {
  if (!myName) return;
  void pool.publish(sign(KIND_PRESENCE, [['t', ONLINE_TAG]], JSON.stringify({ name: myName, st: 'off' })));
}

/** Count everyone with the app open and everyone searching, live, and say we're here every 10 seconds. */
export function startPresence(name: string): void {
  myName = name;
  if (!NET_ON || presenceStarted) {
    beat();
    return;
  }
  presenceStarted = true;
  const me = myPubkey();
  pool.subscribe([{ kinds: [KIND_PRESENCE], '#t': [ONLINE_TAG], since: now() - 30 }], (e) => {
    if (e.pubkey === me) return;
    const c = parse(e) ?? {};
    if (c.st === 'off') {
      seenOnline.delete(e.pubkey);
      seenHere.delete(e.pubkey);
      seenSearching.delete(e.pubkey);
      emitCounts();
      return;
    }
    seenOnline.set(e.pubkey, Date.now());
    // apps from before football don't say their sport: basketball
    if ((c.sp ?? 'nba') === SPORT) seenHere.set(e.pubkey, Date.now());
    else seenHere.delete(e.pubkey);
    if (c.st !== 'queue') seenSearching.delete(e.pubkey);
    // someone just opened the app: answer soon, spread out so not everyone answers at once
    if (c.hello === true && answer === null && Date.now() - lastBeat > 3000) {
      answer = window.setTimeout(() => {
        answer = null;
        beat();
      }, 300 + Math.random() * 1500);
    }
    emitCounts();
  });
  pool.subscribe([{ kinds: [KIND_QUEUE], '#t': ['ps1-queue-' + NET_V], since: now() - 10 }], (e) => {
    if (e.pubkey === me) return;
    seenSearching.set(e.pubkey, Date.now());
    seenOnline.set(e.pubkey, Date.now());
    seenHere.set(e.pubkey, Date.now());
    emitCounts();
  });
  // the first hello can go out before any relay is connected: say it again once one is
  let connected = 0;
  pool.onStatus(() => {
    const n = pool.connected();
    if (n > connected && Date.now() - lastHello > 1500) beat(true);
    connected = n;
  });
  beat(true);
  window.setInterval(() => beat(), BEAT_MS);
  window.setInterval(() => emitCounts(), 1000);
  document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? beat(true) : goodbye()));
  window.addEventListener('pagehide', goodbye);
}

export function setPresence(st: Status): void {
  if (myStatus === st) return;
  myStatus = st;
  beat();
  emitCounts(true);
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
  /** Ultimate Team: their squad's overall */
  ovr?: number;
}

/**
 * Ultimate Team head to head pairs squads within this many points of overall: 3 at first, 2 wider
 * every 10 seconds of searching, 10 at most.
 */
export function squadWindow(searchingMs: number): number {
  return Math.min(10, 3 + 2 * Math.floor(Math.max(0, searchingMs) / 10000));
}

/** Two squads close enough to pair, for a search this long. */
export function squadsFit(mine: number, theirs: number | undefined, searchingMs: number): boolean {
  return typeof theirs === 'number' && Number.isFinite(theirs) && Math.abs(mine - theirs) <= squadWindow(searchingMs);
}

export interface Found {
  matchId: string;
  seed: string;
  /** the host picks first in the odd rounds: 1, 3 and 5 */
  host: boolean;
  opp: Opponent;
}

/** A friend in your room on the other sport (switch to theirs), or on an older or newer app (update). */
export interface RoomMismatch {
  name: string;
  sport: SportId;
  sameSport: boolean;
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
  /** a room's lobby, the same whatever sport or version: it tells a friend on the wrong one */
  private lobby: string | null;

  private since = Date.now();

  /**
   * `queue` is a queue of its own (Ultimate Team's, which never pairs with the draft's); with
   * `ovr` (a squad's overall) only squads within squadWindow() pair.
   */
  constructor(
    private readonly info: { name: string; level: number; room?: string; queue?: string; ovr?: number },
    private readonly onFound: (f: Found) => void,
    private readonly onSeen?: (n: number) => void,
    private readonly onMismatch?: (m: RoomMismatch) => void
  ) {
    this.tag = info.room ? 'ps1-room-' + NET_V + '-' + info.room : 'ps1-queue-' + NET_V + (info.queue ? '-' + info.queue : '');
    this.lobby = info.room ? 'ps1-lobby-' + info.room + NS_SUFFIX : null;
  }

  /** a searcher this one may pair with (any, unless squads are matched by overall) */
  private fits(ovr: number | undefined): boolean {
    return this.info.ovr === undefined || squadsFit(this.info.ovr, ovr, Date.now() - this.since);
  }

  /** what this player tells the queue and the other side of a handshake about himself */
  private about(): Record<string, unknown> {
    return this.info.ovr === undefined ? { name: this.info.name, lvl: this.info.level } : { name: this.info.name, lvl: this.info.level, ovr: this.info.ovr };
  }

  start(): void {
    if (!NET_ON) return;
    this.since = Date.now();
    pool.start();
    this.subs.push(
      pool.subscribe([{ kinds: [KIND_QUEUE], '#t': [this.tag], since: now() - 10 }], (e) => this.onQueue(e)),
      pool.subscribe([{ kinds: [KIND_HANDSHAKE], '#p': [this.me], since: now() - 10 }], (e) => this.onHandshake(e))
    );
    if (this.lobby) this.subs.push(pool.subscribe([{ kinds: [KIND_QUEUE], '#t': [this.lobby], since: now() - 10 }], (e) => this.onLobby(e)));
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
    void pool.publish(sign(KIND_QUEUE, [['t', this.tag]], JSON.stringify(this.about())));
    if (this.lobby) void pool.publish(sign(KIND_QUEUE, [['t', this.lobby]], JSON.stringify({ name: this.info.name, sport: SPORT, v: NET_V })));
  }

  /** Someone in the same room code but another sport or app version: they can never pair with us as is. */
  private onLobby(e: Event): void {
    if (e.pubkey === this.me || tagValue(e, 't') !== this.lobby) return;
    const c = parse(e);
    if (!c || typeof c.v !== 'string' || c.v === NET_V) return;
    const sport: SportId | null = c.sport === 'nba' || c.sport === 'nfl' ? c.sport : null;
    if (!sport) return;
    this.onMismatch?.({ name: displayName(c.name), sport, sameSport: sport === SPORT });
  }

  private send(to: string, body: Record<string, unknown>): void {
    void pool.publish(sign(KIND_HANDSHAKE, [['p', to], ['t', this.tag]], JSON.stringify(body)));
  }

  private onQueue(e: Event): void {
    if (e.pubkey === this.me || tagValue(e, 't') !== this.tag) return;
    const c = parse(e);
    if (!c) return;
    this.searchers.set(e.pubkey, { pubkey: e.pubkey, name: displayName(c.name), level: Number.isInteger(c.lvl) ? (c.lvl as number) : 1, ovr: typeof c.ovr === 'number' ? c.ovr : undefined, seen: Date.now() });
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
    const options = this.fresh().filter((s) => (this.tried.get(s.pubkey) ?? 0) < t && this.fits(s.ovr));
    if (!options.length) return;
    // invite the player waiting longest; a small random wait keeps two players from colliding
    if (Math.random() < 0.5) return;
    const target = options.sort((a, b) => a.seen - b.seen)[0];
    const matchId = randId();
    const seed = randId();
    this.state = { kind: 'inviting', to: target.pubkey, matchId, seed, until: t + 4500 };
    this.send(target.pubkey, { type: 'invite', match: matchId, seed, ...this.about() });
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
    const ovr = typeof c.ovr === 'number' ? c.ovr : undefined;
    if (c.type === 'invite' && typeof c.seed === 'string') {
      const mutual = st.kind === 'inviting' && st.to === from;
      if ((st.kind === 'idle' || (mutual && this.me > from)) && this.fits(ovr)) {
        this.state = { kind: 'accepted', from, matchId: c.match, seed: c.seed, until: t + 6000 };
        this.searchers.set(from, { pubkey: from, name, level, ovr, seen: t });
        this.send(from, { type: 'accept', match: c.match, ...this.about() });
        this.listenForStart(from, c.match);
      } else if (!mutual) this.send(from, { type: 'decline', match: c.match });
    } else if (c.type === 'accept' && st.kind === 'inviting' && st.to === from && st.matchId === c.match) {
      this.state = { kind: 'done' };
      // say go a few times: a lost go would leave the other player waiting
      for (const ms of [0, 400, 1200]) window.setTimeout(() => this.send(from, { type: 'go', match: c.match }), ms);
      const opp = this.searchers.get(from);
      this.finish({ matchId: c.match, seed: st.seed, host: true, opp: { pubkey: from, name: opp?.name ?? name, level: opp?.level ?? level, ovr: opp?.ovr ?? ovr } });
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
    this.finish({ matchId, seed: st.seed, host: false, opp: { pubkey: from, name: opp.name, level: opp.level, ovr: opp.ovr } });
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
  /** round, from 0 */
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
  /** the game after the draft: this player's score so far, drives done, and how each ended */
  arcade?: ArcadeState | null;
  /** this player's phone gave up on the other one in the game after the draft and let the AI
   * finish their drives, from this one on (the other phone then counts its score the same way) */
  arcadeTook?: number | null;
  /** the sim-or-play vote (see vote.ts): this phone's vote, null until it reaches the vote screen */
  vote?: Ballot | null;
  /** set once this phone's countdown ended: its vote is final */
  voteAt?: number | null;
  /** the other phone's final vote as this phone took it, or 'lost' (it went with the coin) */
  voteSaw?: Seen | null;
  /** this player's favorite team in this sport: the colors his side wears */
  fav?: string | null;
  /** Ultimate Team: this player's squad ([slot, card id, level]) and its overall */
  ut?: { squad: [string, string, number][]; ovr: number } | null;
}

export interface ArcadeState {
  score: number;
  drive: number;
  done: boolean;
  ends: string[];
  /** plays run so far: shows the other phone this one is still playing, mid-drive */
  plays?: number;
}

/** An arcade state from the wire, checked: numbers in range, short strings. */
function arcadeOf(x: unknown): ArcadeState | null {
  if (!x || typeof x !== 'object') return null;
  const a = x as Record<string, unknown>;
  const n = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? Math.floor(v) : null);
  const score = n(a.score, 999);
  const drive = n(a.drive, 99);
  if (score === null || drive === null) return null;
  const ends = Array.isArray(a.ends) ? a.ends.filter((e): e is string => typeof e === 'string' && e.length <= 8).slice(0, 40) : [];
  return { score, drive, done: a.done === true, ends, plays: n(a.plays, 99999) ?? 0 };
}

/** The vote's fields from the wire, checked. */
function voteFields(c: Record<string, unknown>): Pick<MatchState, 'vote' | 'voteAt' | 'voteSaw'> {
  const w = voteWireOf(c);
  return { vote: w.vote, voteAt: w.at, voteSaw: w.saw };
}

/** A squad from the wire, checked for shape (Ultimate Team checks the cards against its pool). */
function utOf(x: unknown): MatchState['ut'] {
  if (!x || typeof x !== 'object') return null;
  const u = x as Record<string, unknown>;
  if (!Array.isArray(u.squad) || typeof u.ovr !== 'number' || !Number.isFinite(u.ovr)) return null;
  const squad = u.squad
    .filter((e): e is [string, string, number] => Array.isArray(e) && e.length === 3 && typeof e[0] === 'string' && e[0].length <= 4 && typeof e[1] === 'string' && e[1].length <= 80 && Number.isInteger(e[2]))
    .slice(0, 30);
  return { squad, ovr: u.ovr };
}

function tookOf(x: unknown): number | null {
  return typeof x === 'number' && Number.isInteger(x) && x >= 0 && x <= 99 ? x : null;
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
    // the moments a phone that's away must still learn about later: stored as well as sent
    const tookArcade = this.mine.arcadeTook != null && before.arcadeTook == null;
    const doneArcade = !!this.mine.arcade?.done && !before.arcade?.done;
    if ((this.mine.tookOver && !before.tookOver) || (this.mine.left && !before.left) || tookArcade || doneArcade) this.persist();
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
    this.theirs = {
      seq: c.seq as number,
      picks,
      lineup: (c.lineup && typeof c.lineup === 'object' ? c.lineup : {}) as MatchState['lineup'],
      left: c.left === true,
      tookOver: c.tookOver === true,
      arcade: arcadeOf(c.arcade),
      arcadeTook: tookOf(c.arcadeTook),
      ...voteFields(c),
      fav: teamOf(SPORT, c.fav)?.abbr ?? null,
      ut: utOf(c.ut),
    };
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
