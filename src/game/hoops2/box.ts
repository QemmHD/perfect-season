// The box score, built from the engine's own events (Claude 2026-11-10). It only reads a
// possession: it never changes state or draws from `p.rand`, so a game plays the same with it or
// without it. One tracker follows both teams: on each possession one side attacks (bodies 0-4) and
// the other defends (bodies 5-9), so defensive rebounds, steals, blocks and fouls go to the five
// defending. Lines are keyed by player id, so a substitute or an Icon's clutch copy keeps one line.
//
// Use: `begin(p, side)` when a possession starts; `onStep(p)` after every step (and after any input
// that can end the play between steps, such as a stripped crossover), before the caller clears
// `p.events`; `onEnd(p)` once when it's over.
import type { Possession } from './types';

export type BoxSide = 'us' | 'them';

export interface BoxLine {
  id: string;
  name: string;
  tag: string;
  pts: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  /** PURE (green) releases */
  pure: number;
}

export type BoxStat = Exclude<keyof BoxLine, 'id' | 'name' | 'tag'>;
export const BOX_STATS: BoxStat[] = ['pts', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pure'];

/** A team's totals: the players' lines summed, plus what no one player owns. */
export interface BoxTeam extends Record<BoxStat, number> {
  /** possessions on offense */
  poss: number;
  /** a loose ball the defense ended up with off a miss, with no one man's rebound */
  teamReb: number;
  /** a turnover with no one man to charge it to */
  teamTov: number;
}

/** An assist: the catch, then the attempt within this long and at most this many moves. */
export const ASSIST_WINDOW = 2.5;
export const ASSIST_MOVES = 1;

interface Attempt {
  who: number;
  points: number;
  assist: number | null;
}

const blank = (id: string, name: string, tag: string): BoxLine => ({ id, name, tag, pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0, pure: 0 });

export class BoxTracker {
  private readonly books: Record<BoxSide, Map<string, BoxLine>> = { us: new Map(), them: new Map() };
  private readonly extra: Record<BoxSide, { poss: number; teamReb: number; teamTov: number }> = {
    us: { poss: 0, teamReb: 0, teamTov: 0 },
    them: { poss: 0, teamReb: 0, teamTov: 0 },
  };
  private p: Possession | null = null;
  private off: BoxSide = 'us';
  private ended = true;
  /** the ball handler as of the last look (who threw a pass seen in this batch of events) */
  private lastHandler: number | null = null;
  /** a pass in the air: from whom, to whom */
  private passFrom: number | null = null;
  private passTo: number | null = null;
  /** the last catch off a pass, and the moves he has made since */
  private caught: { who: number; from: number; t: number; moveAt: number; moves: number } | null = null;
  private attempt: Attempt | null = null;
  /** a defender's rebound was seen this possession */
  private rebounded = false;

  /** A possession starts with `offense` attacking. */
  begin(p: Possession, offense: BoxSide = 'us'): void {
    this.p = p;
    this.off = offense;
    this.ended = false;
    this.lastHandler = p.handler;
    this.passFrom = this.passTo = null;
    this.caught = null;
    this.attempt = null;
    this.rebounded = false;
    for (const b of p.bodies) this.line(b.idx);
  }

  /**
   * Read the events since the last look. `handlerBefore` is who had the ball before this batch
   * (the tracker remembers it itself when it's left out).
   */
  onStep(p: Possession, handlerBefore?: number | null): void {
    if (p !== this.p || this.ended) return;
    const before = handlerBefore !== undefined ? handlerBefore : this.lastHandler;
    for (const e of p.events) {
      const [k, a, , pts] = e.split(':');
      const i = Number(a);
      if (e === 'pass' || e === 'lob') {
        this.passFrom = before;
        this.passTo = p.ball && (p.ball.kind === 'pass' || p.ball.kind === 'lob') ? p.ball.who : null;
        this.caught = null;
      } else if (e === 'catch' || e === 'oop-catch') {
        const who = this.passTo ?? p.handler;
        if (who !== null && this.passFrom !== null) this.caught = { who, from: this.passFrom, t: p.t, moveAt: p.bodies[who].lastMoveAt ?? -9, moves: 0 };
        this.passFrom = this.passTo = null;
      } else if (k === 'fga') {
        const c = this.caught;
        const assist = c && c.who === i && p.t - c.t <= ASSIST_WINDOW + 1e-9 && c.moves <= ASSIST_MOVES ? c.from : null;
        this.attempt = { who: i, points: Number(pts), assist };
        this.caught = null;
        const l = this.line(i);
        l.fga++;
        if (pts === '3') l.tpa++;
        if (p.lastShot?.greened) l.pure++;
      } else if (e === 'ft:make' || e === 'ft:miss') {
        if (this.attempt) {
          const l = this.line(this.attempt.who);
          l.fta++;
          if (e === 'ft:make') l.ftm++;
        }
      } else if (k === 'orb') {
        this.line(i).orb++;
        this.caught = null;
      } else if (k === 'drb') {
        this.line(i).drb++;
        this.rebounded = true;
      } else if (k === 'stl' || k === 'int') this.line(i).stl++;
      else if (k === 'blocked') this.line(i).blk++;
      else if (k === 'foul') this.line(i).pf++;
    }
    // moves after the catch (a crossover, a step-back, a spin) count against the assist
    const c = this.caught;
    if (c) {
      const m = p.bodies[c.who].lastMoveAt;
      if (m !== undefined && m > c.t && m !== c.moveAt) {
        c.moveAt = m;
        c.moves++;
      }
    }
    if (p.handler !== null) this.lastHandler = p.handler;
  }

  /** Book how the possession ended (once). */
  onEnd(p: Possession): void {
    if (p !== this.p || this.ended || !p.end) return;
    this.ended = true;
    const e = p.end;
    const side = this.extra[this.off];
    side.poss++;
    if (e.kind === 'make') {
      const a = this.attempt;
      const shooter = a?.who ?? e.who;
      const l = this.line(shooter);
      l.pts += e.points;
      l.fgm++;
      if (a?.points === 3) l.tpm++;
      if (a && a.assist !== null) this.line(a.assist).ast++;
    } else if (e.kind === 'miss') {
      if (!this.rebounded) this.extra[this.other()].teamReb++;
    } else {
      // a turnover: a pass picked off or thrown away is the passer's; a strip, a backcourt or the
      // shot clock the handler's
      const passer = this.passFrom;
      const who = (e.kind === 'int' || e.kind === 'out') && passer !== null ? passer : e.who >= 0 && e.who < 5 ? e.who : this.lastHandler;
      if (who !== null && who >= 0 && who < 5) this.line(who).tov++;
      else side.teamTov++;
    }
  }

  /** Each player's line for a side, starters first, in the order they appeared. */
  lines(side: BoxSide): BoxLine[] {
    return [...this.books[side].values()].map((l) => ({ ...l }));
  }

  /** A side's totals. */
  team(side: BoxSide): BoxTeam {
    const t = { ...this.extra[side] } as BoxTeam;
    for (const k of BOX_STATS) t[k] = 0;
    for (const l of this.books[side].values()) for (const k of BOX_STATS) t[k] += l[k];
    return t;
  }

  private other(): BoxSide {
    return this.off === 'us' ? 'them' : 'us';
  }

  /** The line of body `idx` in the current possession (offense 0-4, defense 5-9). */
  private line(idx: number): BoxLine {
    const p = this.p!;
    const b = p.bodies[idx];
    const side = idx < 5 ? this.off : this.other();
    const book = this.books[side];
    let l = book.get(b.p.id);
    if (!l) book.set(b.p.id, (l = blank(b.p.id, b.p.name, b.p.tag)));
    return l;
  }
}
