// The game's network: public Nostr relays (an open protocol for signed, public messages).
// No accounts or servers of our own: each phone has its own key, signs everything it sends,
// and talks to several relays at once, so one relay being down changes nothing.
//
//  - kind 30078 (app data, replaceable): leaderboard entries, one per player per board
//  - kinds 25890-25893 (ephemeral, relayed live and never stored): who's online, the
//    head-to-head queue, match handshakes and match moves
import { finalizeEvent, generateSecretKey, getPublicKey, verifyEvent, type Event } from 'nostr-tools/pure';

export type { Event };

export const KIND_APP = 30078;
export const KIND_PRESENCE = 25890;
export const KIND_QUEUE = 25891;
export const KIND_HANDSHAKE = 25892;
export const KIND_MATCH = 25893;

const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://nostr.mom', 'wss://relay.snort.social'];

/** The web build talks to relays; the claude.ai artifact can't open sockets, so it stays offline. */
export const NET_ON = import.meta.env.MODE !== 'artifact' && typeof WebSocket !== 'undefined';

/** Relays to use. `?relay=ws://…` (repeatable) swaps them out, for tests. */
function relayUrls(): string[] {
  try {
    const q = new URLSearchParams(location.search).getAll('relay').filter((u) => /^wss?:\/\//.test(u));
    if (q.length) return q;
  } catch {
    // no location (tests)
  }
  return DEFAULT_RELAYS;
}

/** `?ns=name` puts boards, queue and presence in a separate namespace, so tests on the real relays never touch the real game. */
export const NS_SUFFIX = (() => {
  try {
    const n = new URLSearchParams(location.search).get('ns');
    return n && /^[a-z0-9]{1,16}$/.test(n) ? '-' + n : '';
  } catch {
    return '';
  }
})();

// ---------- identity ----------

const KEY_STORE = 'perfect-season:key:v1';
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => new Uint8Array(h.match(/.{2}/g)!.map((x) => parseInt(x, 16)));

let secret: Uint8Array | null = null;
let pubkey = '';

function loadKey(): void {
  if (secret) return;
  try {
    const saved = localStorage.getItem(KEY_STORE);
    if (saved && /^[0-9a-f]{64}$/.test(saved)) secret = unhex(saved);
  } catch {
    // storage blocked: a key for this session only
  }
  if (!secret) {
    secret = generateSecretKey();
    try {
      localStorage.setItem(KEY_STORE, hex(secret));
    } catch {
      // ignore
    }
  }
  pubkey = getPublicKey(secret);
}

/** This phone's public key: its player id on every board and in every match. */
export function myPubkey(): string {
  loadKey();
  return pubkey;
}

export function sign(kind: number, tags: string[][], content: string): Event {
  loadKey();
  return finalizeEvent({ kind, created_at: Math.floor(Date.now() / 1000), tags, content }, secret!);
}

// ---------- relays ----------

type Filter = { kinds?: number[]; authors?: string[]; since?: number; until?: number; limit?: number; ids?: string[] } & { [tag: `#${string}`]: string[] };

interface Sub {
  filters: Filter[];
  onEvent: (e: Event, relay: string) => void;
  onEose?: () => void;
  seen: Set<string>;
  eose: Set<string>;
  eoseDone: boolean;
  eoseTimer: number | null;
}

interface Pending {
  resolve: (ok: number) => void;
  ok: number;
  answered: Set<string>;
  timer: number;
}

const verified = new Set<string>();
function trusted(e: Event): boolean {
  if (verified.has(e.id)) return true;
  let ok = false;
  try {
    ok = verifyEvent(e);
  } catch {
    ok = false;
  }
  if (ok) {
    verified.add(e.id);
    if (verified.size > 5000) verified.clear();
  }
  return ok;
}

class Relay {
  ws: WebSocket | null = null;
  open = false;
  /** 'down' after a failed or dropped connection, until a retry opens it again */
  state: 'idle' | 'connecting' | 'open' | 'down' = 'idle';
  /** last time anything arrived on this socket */
  lastSeen = 0;
  private tries = 0;
  private retry: number | null = null;
  constructor(
    readonly url: string,
    private readonly pool: Pool
  ) {}

  connect(): void {
    if (this.ws || !NET_ON) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.ws = ws;
    this.state = 'connecting';
    ws.onopen = () => {
      this.open = true;
      this.state = 'open';
      this.tries = 0;
      this.lastSeen = Date.now();
      this.pool.relayOpened(this);
    };
    ws.onmessage = (m) => {
      this.lastSeen = Date.now();
      this.pool.message(this, m.data);
    };
    ws.onclose = () => this.dropped();
    ws.onerror = () => {
      // onclose follows
    };
  }

  private dropped(): void {
    const was = this.ws;
    this.ws = null;
    this.open = false;
    this.state = 'down';
    if (was) {
      was.onopen = was.onmessage = was.onclose = was.onerror = null;
    }
    this.pool.relayClosed(this);
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (this.retry !== null) return;
    const wait = Math.min(30000, 1000 * 2 ** Math.min(this.tries++, 5));
    this.retry = window.setTimeout(() => {
      this.retry = null;
      this.connect();
    }, wait);
  }

  /** Reconnect now (the app came back to the front); a socket iOS froze may look open but be dead. */
  wake(): void {
    if (this.retry !== null) {
      clearTimeout(this.retry);
      this.retry = null;
    }
    this.tries = 0;
    if (!this.ws) this.connect();
  }

  kill(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.dropped();
    }
  }

  send(msg: unknown[]): void {
    if (this.open && this.ws) {
      try {
        this.ws.send(JSON.stringify(msg));
      } catch {
        // dropped; resent on reconnect
      }
    }
  }
}

class Pool {
  relays: Relay[] = [];
  private subs = new Map<string, Sub>();
  private pending = new Map<string, Pending>();
  private outbox: Event[] = [];
  private n = 0;
  private started = false;
  private listeners = new Set<() => void>();

  start(): void {
    if (this.started || !NET_ON) return;
    this.started = true;
    this.relays = relayUrls().map((u) => new Relay(u, this));
    this.relays.forEach((r) => r.connect());
    window.setInterval(() => this.check(), 5000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.wake();
    });
    window.addEventListener('online', () => this.wake());
  }

  /** Back in front: reconnect anything closed, and replace sockets that stopped answering
      (iOS can freeze a socket in the background without closing it). */
  wake(): void {
    const at = Date.now();
    for (const r of this.relays) {
      if (r.open && r.ws) {
        r.send(['REQ', 'ping', { ids: ['0'.repeat(64)] }]);
        r.send(['CLOSE', 'ping']);
        window.setTimeout(() => {
          if (r.open && r.lastSeen < at) {
            r.kill();
            r.wake();
          }
        }, 4000);
      } else r.wake();
    }
  }

  connected(): number {
    return this.relays.filter((r) => r.open).length;
  }

  /** Every 5s while in front: ping each open relay, and replace one that stayed silent for 25s
      (a network switch can leave a socket that looks open but delivers nothing). */
  private check(): void {
    if (document.visibilityState !== 'visible') return;
    const t = Date.now();
    for (const r of this.relays) {
      if (!r.open || !r.ws) continue;
      if (t - r.lastSeen > 25000) {
        r.kill();
        r.wake();
        continue;
      }
      r.send(['REQ', 'ping', { ids: ['0'.repeat(64)] }]);
      r.send(['CLOSE', 'ping']);
    }
  }

  /** Some relay answered in the last 12 seconds. When none has, silence from the other player
      says more about our own connection than about them. */
  healthy(): boolean {
    const t = Date.now();
    return this.relays.some((r) => r.open && t - r.lastSeen < 12000);
  }

  /** Relays that are open or still connecting: the ones worth waiting for. */
  private alive(): number {
    return this.relays.filter((r) => r.state === 'open' || r.state === 'connecting').length;
  }

  onStatus(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  relayOpened(r: Relay): void {
    for (const [id, s] of this.subs) r.send(['REQ', id, ...s.filters]);
    // events published while nothing was connected
    for (const e of this.outbox) r.send(['EVENT', e]);
    this.listeners.forEach((f) => f());
  }

  relayClosed(r: Relay): void {
    for (const s of this.subs.values()) {
      s.eose.delete(r.url);
      if (s.eose.size >= Math.max(1, this.alive())) this.finishEose(s);
    }
    for (const id of Array.from(this.pending.keys())) {
      const p = this.pending.get(id)!;
      if (p.answered.size >= this.alive()) this.settle(id);
    }
    this.listeners.forEach((f) => f());
  }

  message(r: Relay, data: unknown): void {
    let m: unknown[];
    try {
      m = JSON.parse(String(data));
    } catch {
      return;
    }
    if (!Array.isArray(m)) return;
    if (m[0] === 'EVENT') {
      const s = this.subs.get(m[1] as string);
      const e = m[2] as Event;
      if (!s || !e || typeof e.id !== 'string' || s.seen.has(e.id)) return;
      if (!trusted(e)) return;
      // long-lived subscriptions (presence, the queue) would otherwise grow forever
      if (s.seen.size > 3000) s.seen.clear();
      s.seen.add(e.id);
      s.onEvent(e, r.url);
    } else if (m[0] === 'EOSE') {
      const s = this.subs.get(m[1] as string);
      if (!s) return;
      s.eose.add(r.url);
      if (s.eose.size >= Math.max(1, this.alive())) this.finishEose(s);
    } else if (m[0] === 'OK') {
      const p = this.pending.get(m[1] as string);
      if (!p || p.answered.has(r.url)) return;
      p.answered.add(r.url);
      if (m[2] === true) p.ok++;
      // resolve on the first relay that took it; the others keep going in the background
      if (p.ok > 0 || p.answered.size >= this.alive()) this.settle(m[1] as string);
    }
  }

  private finishEose(s: Sub): void {
    if (s.eoseDone) return;
    s.eoseDone = true;
    if (s.eoseTimer !== null) clearTimeout(s.eoseTimer);
    s.onEose?.();
  }

  private settle(id: string): void {
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    clearTimeout(p.timer);
    if (p.ok > 0) this.outbox = this.outbox.filter((e) => e.id !== id);
    p.resolve(p.ok);
  }

  /**
   * Send an event to every relay. Resolves with how many accepted it (0 = none in time).
   * Stored events also wait in an outbox and go out again when a relay reconnects.
   */
  publish(e: Event, waitMs = 6000): Promise<number> {
    this.start();
    const ephemeral = e.kind >= 20000 && e.kind < 30000;
    if (!ephemeral) {
      this.outbox = this.outbox.filter((x) => !(x.kind === e.kind && x.tags.find((t) => t[0] === 'd')?.[1] === e.tags.find((t) => t[0] === 'd')?.[1])).concat([e]);
    }
    this.relays.forEach((r) => r.send(['EVENT', e]));
    if (ephemeral) return Promise.resolve(this.connected());
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => this.settle(e.id), waitMs);
      this.pending.set(e.id, { resolve, ok: 0, answered: new Set(), timer });
    });
  }

  /** Subscribe on every relay. onEose fires once: when all connected relays sent their stored events, or after eoseMs. */
  subscribe(filters: Filter[], onEvent: (e: Event, relay: string) => void, onEose?: () => void, eoseMs = 4500): { close: () => void } {
    this.start();
    const id = 'ps' + ++this.n;
    const s: Sub = { filters, onEvent, onEose, seen: new Set(), eose: new Set(), eoseDone: false, eoseTimer: null };
    s.eoseTimer = window.setTimeout(() => this.finishEose(s), eoseMs);
    this.subs.set(id, s);
    this.relays.forEach((r) => r.send(['REQ', id, ...filters]));
    return {
      close: () => {
        if (!this.subs.has(id)) return;
        if (s.eoseTimer !== null) clearTimeout(s.eoseTimer);
        this.subs.delete(id);
        this.relays.forEach((r) => r.send(['CLOSE', id]));
      },
    };
  }

  /** For tests: drop every socket, as if the phone lost its connection. */
  killAll(): void {
    this.relays.forEach((r) => r.kill());
  }
}

export const pool = new Pool();

/** Fetch stored events once: resolves after every connected relay has answered (or the timeout). */
export function query(filters: Filter[], timeoutMs = 4500): Promise<Event[]> {
  return new Promise((resolve) => {
    const out: Event[] = [];
    const sub = pool.subscribe(
      filters,
      (e) => out.push(e),
      () => {
        sub.close();
        resolve(out);
      },
      timeoutMs
    );
  });
}

export function tagValue(e: Event, name: string): string | undefined {
  return e.tags.find((t) => t[0] === name)?.[1];
}

// expose a test hook in dev builds and when a test relay is set
try {
  if (!import.meta.env.PROD || new URLSearchParams(location.search).has('relay')) (window as unknown as { __psNet: unknown }).__psNet = { pool, myPubkey };
} catch {
  // no window (tests)
}
