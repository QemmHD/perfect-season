// The football HUD's rules (Claude, studio overhaul nfl-3; audit V-3 and V-4, Game Design V2 §C.3
// and §C.5 rule 6). Pure: no DOM, no React, no clock of its own (callers pass the time), so
// hud.test.ts drives it directly.
//
// - One toast line carries everything the screen says: hints, results ("+7 YDS · TACKLED BY
//   SMITH", "FIRST DOWN"), the ability pop and the momentum line. Toasts queue by priority: a
//   higher or equal one replaces what's showing, a lower one waits its turn (and is dropped if it
//   goes stale while waiting). A hint belongs to the moment it was given: it's cleared the moment
//   the play moves on (the old hints stayed up 4.2 s into the next play call).
// - At most one ability pop a play: the first ability that changed the play. The engine's seeded
//   roll (which abilities are "in the zone") is untouched; this only decides what's shown.
// - The score bug's model: its label, the down and distance under it, and the drive pips.
import type { DriveEnd, Game } from './drive';

export type Tone = 'good' | 'bad' | 'big' | 'plain' | 'green' | 'ability';

/** Priorities, low to high. */
export const PRIO = { hint: 1, ability: 2, momentum: 2, result: 3, big: 4 } as const;

/** What a toast lives for: the moment of play it was posted in ('phase'), until the next play is lined up ('play'), or its time alone. */
export type Scope = 'phase' | 'play' | 'time';

export interface ToastIn {
  text: string;
  /** a second part after a dot on the same line ("TACKLED BY SMITH") */
  sub?: string;
  tone?: Tone;
  prio?: number;
  /** how long it shows once it's up (ms) */
  ms?: number;
  /** a toast with the same key replaces the one before it (showing or waiting) */
  key?: string;
  scope?: Scope;
}

export interface Toast extends Required<Omit<ToastIn, 'sub' | 'key'>> {
  id: number;
  sub?: string;
  key?: string;
  /** the moment it was posted in (for 'phase' scope) */
  phase: string;
  /** when it was posted and, once showing, when it goes */
  at: number;
  until: number;
}

/** How long a waiting toast stays worth showing (ms after it was posted). */
export const STALE_MS = 2500;

/**
 * The toast line's queue. `push` posts, `clear(phase)` moves the play on (dropping hints from the
 * moment before and, at a new play, what belonged to the last one), `current(now)` says what shows.
 */
export class ToastQueue {
  private showing: Toast | null = null;
  private waiting: Toast[] = [];
  private next = 1;
  phase = '';

  push(t: ToastIn, now: number): Toast {
    const toast: Toast = {
      id: this.next++,
      text: t.text,
      sub: t.sub,
      tone: t.tone ?? 'plain',
      prio: t.prio ?? PRIO.result,
      ms: t.ms ?? 1400,
      key: t.key,
      scope: t.scope ?? 'time',
      phase: this.phase,
      at: now,
      until: now + (t.ms ?? 1400)
    };
    if (toast.key) this.waiting = this.waiting.filter((w) => w.key !== toast.key);
    const cur = this.current(now);
    if (!cur || toast.prio >= cur.prio || (toast.key && cur.key === toast.key)) {
      // what it replaces waits with the time it had left, unless it's being replaced by its own key
      // or was a moment's hint
      const own = cur && toast.key !== undefined && cur.key === toast.key;
      if (cur && !own && cur.until - now > 400 && cur.scope !== 'phase') this.waiting.push({ ...cur, at: now, ms: cur.until - now });
      this.showing = toast;
    } else this.waiting.push(toast);
    return toast;
  }

  /** What shows at `now`: the showing toast while it lasts, else the best of the waiting ones. */
  current(now: number): Toast | null {
    if (this.showing && now < this.showing.until) return this.showing;
    this.showing = null;
    this.waiting = this.waiting.filter((w) => now - w.at < STALE_MS);
    if (!this.waiting.length) return null;
    let best = 0;
    for (let i = 1; i < this.waiting.length; i++) if (this.waiting[i].prio > this.waiting[best].prio) best = i;
    const [t] = this.waiting.splice(best, 1);
    this.showing = { ...t, until: now + t.ms };
    return this.showing;
  }

  /**
   * The play moved on to `phase`. Hints from earlier moments go at once; at a new play (`newPlay`)
   * whatever belonged to the last play goes too.
   */
  clear(phase: string, newPlay = false) {
    if (phase === this.phase && !newPlay) return;
    this.phase = phase;
    const keep = (t: Toast) => t.scope === 'time' || (t.scope === 'play' && !newPlay);
    if (this.showing && !keep(this.showing)) this.showing = null;
    this.waiting = this.waiting.filter(keep);
  }

  /** Drop everything (the game's over, a replay starts). */
  reset() {
    this.showing = null;
    this.waiting = [];
  }
}

/**
 * The one-pop rule (V-4): of the `ability:<id>:<body>` events a play reports, only the first shows.
 * Returns the event to pop, or null; `shown` is the play's memory (cleared for each new play).
 */
export function abilityToPop(events: readonly string[], shown: { done: boolean }): { id: string; body: number } | null {
  for (const e of events) {
    if (!e.startsWith('ability:')) continue;
    if (shown.done) return null;
    shown.done = true;
    const [, id, body] = e.split(':');
    return { id, body: Number(body) };
  }
  return null;
}

/** The ability names as the toast says them (packs' C13: "Truck Stick" shows as Bulldozer; ids unchanged). */
export const ABILITY_TEXT: Record<string, string> = {
  cannon: 'CANNON',
  surgeon: 'SURGEON',
  scrambler: 'SCRAMBLER',
  'truck-stick': 'BULLDOZER',
  'juke-box': 'JUKE BOX',
  'deep-threat': 'DEEP THREAT',
  'sure-hands': 'SURE HANDS',
  'red-zone': 'RED ZONE',
  'pocket-wall': 'PASS PRO',
  'road-grader': 'ROAD GRADER',
  'edge-threat': 'EDGE THREAT',
  'run-stopper': 'RUN STOPPER',
  enforcer: 'ENFORCER',
  shutdown: 'SHUTDOWN',
  ballhawk: 'BALLHAWK',
  'big-leg': 'BIG LEG'
};

/** A drive pip's look in the bug's progress line, by how the drive ended. */
export function pipOf(end: DriveEnd | undefined): 'td' | 'fg' | 'lost' | 'none' | 'open' {
  if (!end) return 'open';
  if (end === 'TD') return 'td';
  if (end === 'FG') return 'fg';
  if (end === 'INT' || end === 'FUM' || end === 'SAF') return 'lost';
  return 'none';
}

export interface BugModel {
  /** 'DRIVE 2 OF 4', 'LAST DRIVE', 'FINAL' */
  label: string;
  /** the down and distance, under the label */
  sub: string;
  /** 0-1: how far up the field the current drive has come (the live pip's fill) */
  progress: number;
  pips: ReturnType<typeof pipOf>[];
}

/** The bug's words and pips for a game. `down` is the down-and-distance text (drive.ts downText); the spot lives in the tray's header. */
export function bugModel(g: Game, down: string): BugModel {
  const pips = Array.from({ length: g.drives }, (_, i) => pipOf(g.ends[i]));
  if (g.over) return { label: 'FINAL', sub: '', progress: 1, pips };
  const last = g.drive === g.drives - 1;
  return {
    label: last && g.clock !== null ? 'LAST DRIVE' : 'DRIVE ' + (g.drive + 1) + ' OF ' + g.drives,
    sub: down,
    progress: Math.max(0, Math.min(1, g.ballOn / 100)),
    pips
  };
}
