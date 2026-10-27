// The sim-or-play vote before a head to head, and how two phones that can lose messages still
// come out of it with the same answer.
//
// The rule: both vote the same, that's it. Different votes, or one of them doesn't vote, and a
// coin toss decides. Neither votes: PLAY. The coin is never thrown on a phone: it's read off the
// match (a hash of its id), so both phones get the same side without telling each other anything.
//
// The protocol. Each phone's vote state rides in its MatchState, which the match channel sends on
// every change and again every few seconds, so a lost message only delays things:
//   1. here:      on the vote screen a phone sends `vote` ('none' until it picks): it's there.
//   2. countdown: 10 seconds, started once both are there (or after 25 s of waiting for the other,
//                 or at once if it's gone). The vote can change all the way through.
//   3. lock:      when the countdown ends, or as soon as the other phone's lock shows up (both
//                 countdowns end together), the vote is final: `voteAt` is set.
//   4. echo:      a phone that has the other's final vote sends it back (`voteSaw`).
//   5. decide:    locked, holding the other's final vote, and seeing its own final vote echoed
//                 back: both phones now hold the same two final votes, so both apply the rule to
//                 the same inputs and agree.
//   6. fallback:  8 seconds after its lock without step 5, or as soon as the other phone's echo
//                 says 'lost', a phone goes with the coin, and echoes 'lost' so the other follows.
//
// Why they agree:
//   - A phone that never got my final vote can never echo it, so it can never reach step 5: my
//     fallback to the coin matches what it does (it falls back too, or follows my 'lost'). That
//     covers a vote lost on the way, a link dead in one direction, and a phone that never shows up.
//   - A phone that reaches step 5 has sent its echo, which the other phone needs for its own
//     step 5; it's sent again every second while the vote screen is up (then every 3 seconds), so
//     it arrives well inside the other's 8 seconds unless the link dies for all of them.
//   - What's left is the "two generals" problem, which no protocol over a lossy link escapes: if a
//     link dies in the one network hop between the two echoes, one phone has decided by the votes
//     and the other falls back to the coin. Locks happen together (step 3), so that window is one
//     hop wide, and it only matters when the votes agree on the side the coin didn't land on.
import { hashString, rng } from '../engine/rng';

export type Choice = 'play' | 'sim';
/** a phone's vote: its pick, or 'none' (on the vote screen, no pick yet; final: didn't vote) */
export type Ballot = Choice | 'none';
/** the other phone's final vote as this one took it, or 'lost': it gave up waiting and went with the coin */
export type Seen = Ballot | 'lost';

/** One phone's vote, as it goes over the wire. */
export interface VoteWire {
  /** null: not on the vote screen yet */
  vote: Ballot | null;
  /** set (the phone's clock, ms) once its countdown ended: from then on `vote` is final */
  at: number | null;
  /** the echo: the other phone's final vote as this one took it */
  saw: Seen | null;
}

export const NO_VOTE: VoteWire = { vote: null, at: null, saw: null };

/** the countdown */
export const VOTE_MS = 10000;
/** after its lock, how long a phone waits for the round trip before going with the coin */
export const GRACE_MS = 8000;
/** how long to wait for the other phone to reach the vote before counting down anyway */
export const WAIT_MS = 25000;
/** the least of the countdown a phone gets before the other's lock ends it (one that arrives late) */
export const MIN_VOTE_MS = 3000;
/** while the vote screen is up, the vote state goes out again this often (the match channel's own beat is 3 s) */
export const RESEND_MS = 1000;

const BALLOTS = ['play', 'sim', 'none'] as const;
const SEEN = ['play', 'sim', 'none', 'lost'] as const;

function oneOf<T extends string>(x: unknown, list: readonly T[]): T | null {
  return typeof x === 'string' && (list as readonly string[]).includes(x) ? (x as T) : null;
}

/** A vote state from the wire, checked (the fields of a MatchState). */
export function voteWireOf(c: { vote?: unknown; voteAt?: unknown; voteSaw?: unknown }): VoteWire {
  const vote = oneOf(c.vote, BALLOTS);
  const at = typeof c.voteAt === 'number' && Number.isFinite(c.voteAt) && c.voteAt >= 0 ? Math.floor(c.voteAt) : null;
  // a lock without a vote, or an echo from a phone that isn't voting, is nothing
  return { vote, at: vote ? at : null, saw: vote ? oneOf(c.voteSaw, SEEN) : null };
}

/** The coin, from the match: the same side on both phones. Heads is PLAY. */
export function tossFor(seed: string): Choice {
  return rng(hashString('vote:' + seed))() < 0.5 ? 'play' : 'sim';
}

/** same: both voted it · none: nobody voted · split: different votes (or one didn't vote) · lost: a phone couldn't hear the other */
export type How = 'same' | 'none' | 'split' | 'lost';

export interface Decision {
  outcome: Choice;
  how: How;
  /** the coin's side for this match (shown when it decided) */
  toss: Choice;
}

/** The rule, for two final votes. Symmetric: both phones get the same answer from the same two votes. */
export function resolveVotes(a: Ballot, b: Ballot, seed: string): Decision {
  const toss = tossFor(seed);
  if (a === b) return a === 'none' ? { outcome: 'play', how: 'none', toss } : { outcome: a, how: 'same', toss };
  return { outcome: toss, how: 'split', toss };
}

/** The coin decided it (and was flipped on screen). */
export const byToss = (d: Decision) => d.how === 'split' || d.how === 'lost';

/**
 * One phone's side of the vote, driven by the clock (`now`, ms): call `receive` with the other
 * phone's state whenever it changes, `tick` often, and send `wire()` whenever it changes.
 */
export class VoteMachine {
  /** this phone's vote */
  mine: Ballot = 'none';
  /** the other phone's state, as last heard */
  rival: VoteWire | null = null;
  /** when the countdown ends; null while waiting for the other phone to get here */
  deadline: number | null = null;
  /** when the countdown started */
  started: number | null = null;
  lockedAt: number | null = null;
  /** the other phone's final vote, once heard */
  theirFinal: Ballot | null = null;
  decision: Decision | null = null;
  private saw: Seen | null = null;
  private readonly since: number;

  constructor(
    readonly seed: string,
    now: number
  ) {
    this.since = now;
  }

  /** Vote (or take it back with 'none'). Only until the lock. */
  choose(b: Ballot): boolean {
    if (this.lockedAt !== null || this.decision) return false;
    this.mine = b;
    return true;
  }

  receive(w: VoteWire | null, now: number): void {
    if (!w) return;
    this.rival = w;
    // once decided, nothing changes: in particular the echo stays what the decision was made on
    if (this.decision) return;
    if (w.vote !== null && w.at !== null && this.theirFinal === null) {
      this.theirFinal = w.vote;
      this.saw = w.vote;
    }
    this.tick(now);
  }

  tick(now: number, rivalGone = false): void {
    if (this.decision) return;
    const r = this.rival;
    // the other phone gave up on hearing us and went with the coin: so does this one, whatever the votes
    if (r?.saw === 'lost') return this.fallback(now);
    if (this.deadline === null && (r?.vote != null || rivalGone || now - this.since >= WAIT_MS)) {
      this.started = now;
      this.deadline = now + VOTE_MS;
    }
    // the other phone has locked: lock too, so both countdowns end together (one that just
    // arrived still gets a few seconds to vote)
    if (this.lockedAt === null && this.deadline !== null && this.theirFinal !== null) this.deadline = Math.min(this.deadline, Math.max(now, this.started! + MIN_VOTE_MS));
    if (this.lockedAt === null) {
      if (this.deadline === null || now < this.deadline) return;
      this.lockedAt = now;
    }
    // step 5: both phones hold both final votes
    if (this.theirFinal !== null && r?.saw === this.mine) {
      this.decision = resolveVotes(this.mine, this.theirFinal, this.seed);
      return;
    }
    if (now - this.lockedAt >= GRACE_MS) this.fallback(now);
  }

  private fallback(now: number): void {
    this.lockedAt ??= now;
    this.saw = 'lost';
    this.decision = { outcome: tossFor(this.seed), how: 'lost', toss: tossFor(this.seed) };
  }

  /** This phone's vote state, to send. */
  wire(): VoteWire {
    return { vote: this.mine, at: this.lockedAt, saw: this.saw };
  }

  /** Seconds left on the countdown (null while waiting for the other phone). */
  left(now: number): number | null {
    if (this.deadline === null) return null;
    if (this.lockedAt !== null) return 0;
    return Math.max(0, Math.ceil((this.deadline - now) / 1000));
  }
}
