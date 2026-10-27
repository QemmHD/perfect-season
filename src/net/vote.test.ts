import { NFL } from '../engine/sport';
import { type Ballot, type Decision, GRACE_MS, NO_VOTE, RESEND_MS, resolveVotes, tossFor, VOTE_MS, VoteMachine, type VoteWire, voteWireOf, WAIT_MS } from './vote';

const BALLOTS: Ballot[] = ['play', 'sim', 'none'];

describe('the vote rule', () => {
  it('same vote wins, nobody voting is PLAY, anything else is the coin', () => {
    for (const seed of ['m1', 'm2', 'abc', 'xyz9']) {
      const toss = tossFor(seed);
      expect(resolveVotes('play', 'play', seed)).toEqual({ outcome: 'play', how: 'same', toss });
      expect(resolveVotes('sim', 'sim', seed)).toEqual({ outcome: 'sim', how: 'same', toss });
      expect(resolveVotes('none', 'none', seed)).toEqual({ outcome: 'play', how: 'none', toss });
      for (const [a, b] of [['play', 'sim'], ['play', 'none'], ['sim', 'none']] as [Ballot, Ballot][]) {
        expect(resolveVotes(a, b, seed)).toEqual({ outcome: toss, how: 'split', toss });
        // both phones see the same pair the other way round
        expect(resolveVotes(b, a, seed)).toEqual(resolveVotes(a, b, seed));
      }
    }
  });

  it('throws the coin from the match, not the phone: the same side every time, both sides across matches', () => {
    expect(tossFor('match-1')).toBe(tossFor('match-1'));
    const sides = Array.from({ length: 400 }, (_, i) => tossFor('m' + i));
    const heads = sides.filter((s) => s === 'play').length;
    expect(heads).toBeGreaterThan(150);
    expect(heads).toBeLessThan(250);
  });

  it('checks a vote off the wire', () => {
    expect(voteWireOf({})).toEqual(NO_VOTE);
    expect(voteWireOf({ vote: 'play', voteAt: 12345.6, voteSaw: 'sim' })).toEqual({ vote: 'play', at: 12345, saw: 'sim' });
    expect(voteWireOf({ vote: 'none', voteAt: null, voteSaw: 'lost' })).toEqual({ vote: 'none', at: null, saw: 'lost' });
    expect(voteWireOf({ vote: 'dunk', voteAt: 5, voteSaw: 'play' })).toEqual(NO_VOTE);
    expect(voteWireOf({ vote: 'sim', voteAt: -1, voteSaw: 'maybe' })).toEqual({ vote: 'sim', at: null, saw: null });
    expect(voteWireOf({ vote: 'sim', voteAt: Infinity, voteSaw: 7 })).toEqual({ vote: 'sim', at: null, saw: null });
    expect(voteWireOf({ vote: { play: true }, voteAt: '10' })).toEqual(NO_VOTE);
    expect(voteWireOf({ vote: 'toString' })).toEqual(NO_VOTE);
  });
});

// ---------- two phones over a lossy match channel ----------

const TICK = 50;
const LATENCY = 150;
/** the match channel's own beat */
const BEAT = 3000;
/** the result stays on screen (and the vote state keeps going out every second) this long after the decision */
const SHOW = 2500;
/** the match channel calls the other phone gone after this much silence */
const GONE = 20000;

interface PhoneSpec {
  /** when it reaches the vote screen; null: never */
  enter: number | null;
  /** votes, in ms after entering */
  votes?: [number, Ballot][];
}

/** Which of a direction's messages get lost: by their number and the time they're sent. */
type Loss = (n: number, t: number) => boolean;

interface Sim {
  a: PhoneSpec;
  b: PhoneSpec;
  ab?: Loss;
  ba?: Loss;
  seed?: string;
}

interface Phone {
  spec: PhoneSpec;
  m: VoteMachine | null;
  decidedAt: number | null;
  last: string;
  lastSent: number;
  sent: number;
  seq: number;
  /** the other phone's latest state, as delivered (by seq) */
  heard: { seq: number; w: VoteWire } | null;
  lastHeard: number;
  inbox: { at: number; seq: number; w: VoteWire }[];
}

function simulate(sim: Sim, until = 120000): { a: Decision | null; b: Decision | null; at: [number | null, number | null] } {
  const seed = sim.seed ?? 'match-xyz';
  const phones: Phone[] = [sim.a, sim.b].map((spec) => ({ spec, m: null, decidedAt: null, last: '', lastSent: -1e9, sent: 0, seq: 0, heard: null, lastHeard: 0, inbox: [] }));
  const loss = [sim.ab ?? (() => false), sim.ba ?? (() => false)];
  const send = (from: number, t: number) => {
    const p = phones[from];
    const w = p.m ? p.m.wire() : NO_VOTE;
    p.seq++;
    p.lastSent = t;
    p.last = JSON.stringify(w);
    if (!loss[from](p.sent++, t)) phones[1 - from].inbox.push({ at: t + LATENCY, seq: p.seq, w });
  };
  for (let t = 0; t <= until; t += TICK) {
    for (let i = 0; i < 2; i++) {
      const p = phones[i];
      // arrive on the vote screen, with whatever the other phone sent already
      if (!p.m && p.spec.enter !== null && t >= p.spec.enter) {
        p.m = new VoteMachine(seed, t);
        if (p.heard) p.m.receive(p.heard.w, t);
      }
      // deliveries (the match channel drops anything older than what it has)
      const due = p.inbox.filter((x) => x.at <= t);
      p.inbox = p.inbox.filter((x) => x.at > t);
      for (const x of due) {
        if (p.heard && x.seq <= p.heard.seq) continue;
        p.heard = { seq: x.seq, w: x.w };
        p.lastHeard = t;
        p.m?.receive(x.w, t);
      }
      if (p.m) {
        for (const [ms, b] of p.spec.votes ?? []) if (t - p.spec.enter! >= ms && t - p.spec.enter! < ms + TICK) p.m.choose(b);
        p.m.tick(t, t - p.lastHeard > GONE);
        if (p.m.decision && p.decidedAt === null) p.decidedAt = t;
      }
      // what goes out: every change, every second while the vote screen is up, the beat otherwise
      const now = JSON.stringify(p.m ? p.m.wire() : NO_VOTE);
      const onScreen = !!p.m && (p.decidedAt === null || t - p.decidedAt < SHOW);
      if (now !== p.last || t - p.lastSent >= (onScreen ? RESEND_MS : BEAT)) send(i, t);
    }
    if (phones.every((p) => p.decidedAt !== null && t - p.decidedAt > 15000)) break;
  }
  return { a: phones[0].m?.decision ?? null, b: phones[1].m?.decision ?? null, at: [phones[0].decidedAt, phones[1].decidedAt] };
}

const vote = (b: Ballot, at = 2000): [number, Ballot][] => (b === 'none' ? [] : [[at, b]]);
const dead: Loss = () => true;
const firstN =
  (n: number): Loss =>
  (i) =>
    i < n;
const between =
  (t1: number, t2: number): Loss =>
  (_, t) =>
    t >= t1 && t < t2;
/** a seeded pattern that loses at most `max` messages in a row */
function burst(seed: number, p: number, max: number): Loss {
  let x = seed;
  let run = 0;
  const out: boolean[] = [];
  return (i) => {
    while (out.length <= i) {
      x = (x * 1103515245 + 12345) % 2147483648;
      const lose = run < max && x / 2147483648 < p;
      run = lose ? run + 1 : 0;
      out.push(lose);
    }
    return out[i];
  };
}

describe('the vote between two phones', () => {
  it('decides by the rule when every message gets through, both phones the same, in about 11 seconds', () => {
    for (const seed of ['m-1', 'm-2', 'm-3', 'm-4']) {
      for (const a of BALLOTS)
        for (const b of BALLOTS)
          for (const offset of [0, 400, 1500, 6000]) {
            const r = simulate({ seed, a: { enter: 0, votes: vote(a) }, b: { enter: offset, votes: vote(b, 2500) } });
            const want = resolveVotes(a, b, seed);
            expect(r.a, a + '/' + b + ' +' + offset).toEqual(want);
            expect(r.b).toEqual(want);
            expect(Math.max(r.at[0]!, r.at[1]!)).toBeLessThan(offset + VOTE_MS + 1500);
          }
    }
  });

  it('lets each change his vote until the countdown ends, the last one counting', () => {
    const flips: [number, Ballot][] = [
      [800, 'play'],
      [3000, 'sim'],
      [6000, 'none'],
      [9600, 'play'],
    ];
    const r = simulate({ seed: 'flip', a: { enter: 0, votes: flips }, b: { enter: 300, votes: [[1000, 'sim'], [9500, 'play']] } });
    expect(r.a).toEqual(resolveVotes('play', 'play', 'flip'));
    expect(r.b).toEqual(r.a);
    // a vote after the lock doesn't count
    const late = simulate({ seed: 'flip', a: { enter: 0, votes: [[1000, 'play'], [VOTE_MS + 300, 'sim']] }, b: { enter: 0, votes: [[1000, 'play']] } });
    expect(late.a?.outcome).toBe('play');
    expect(late.b?.outcome).toBe('play');
  });

  it('agrees in every combination of votes when messages are lost', () => {
    const patterns: [string, Partial<Sim>][] = [
      ['first 3 lost each way', { ab: firstN(3), ba: firstN(3) }],
      ['first 8 lost one way', { ab: firstN(8) }],
      ['every other lost', { ab: (i) => i % 2 === 0, ba: (i) => i % 2 === 1 }],
      ['two of three lost', { ab: (i) => i % 3 !== 2, ba: (i) => i % 3 !== 0 }],
      ['A never heard', { ab: dead }],
      ['B never heard', { ba: dead }],
      ['nothing gets through', { ab: dead, ba: dead }],
      ['a blackout over the lock', { ab: between(8000, 14000), ba: between(8000, 14000) }],
      ['a long blackout over the lock', { ab: between(9000, 30000), ba: between(9000, 30000) }],
      ['B drops out at the lock', { ba: between(9500, 1e9) }],
      ['A drops out at the lock', { ab: between(9500, 1e9) }],
      ...[1, 2, 3, 4, 5, 6].map((s): [string, Partial<Sim>] => ['bursts of up to 2, seed ' + s, { ab: burst(s, 0.45, 2), ba: burst(s * 7 + 1, 0.45, 2) }]),
    ];
    for (const [name, loss] of patterns)
      for (const a of BALLOTS)
        for (const b of BALLOTS)
          for (const offset of [0, 1200, 7000]) {
            const r = simulate({ seed: 'loss-' + name, a: { enter: 0, votes: vote(a, 3000) }, b: { enter: offset, votes: vote(b, 1500) }, ...loss });
            expect(r.a, name + ' ' + a + '/' + b + ' +' + offset).not.toBeNull();
            expect(r.b, name + ' ' + a + '/' + b + ' +' + offset).toEqual(r.a);
          }
  });

  it('goes with the coin on both phones when one of them never hears the other’s vote', () => {
    for (const a of BALLOTS)
      for (const b of BALLOTS) {
        const r = simulate({ seed: 'deaf', a: { enter: 0, votes: vote(a) }, b: { enter: 0, votes: vote(b) }, ba: dead });
        expect(r.a).toEqual({ outcome: tossFor('deaf'), how: 'lost', toss: tossFor('deaf') });
        expect(r.b).toEqual(r.a);
      }
  });

  it('waits for a rival who is still on the draft screen, and lets him vote when he gets there', () => {
    // B arrives 18 s later: A's countdown only starts then, so B's vote counts
    const r = simulate({ seed: 'slow', a: { enter: 0, votes: vote('sim', 500) }, b: { enter: 18000, votes: vote('sim', 1000) } });
    expect(r.a).toEqual(resolveVotes('sim', 'sim', 'slow'));
    expect(r.b).toEqual(r.a);
    // one who never arrives: the countdown runs anyway, then the coin
    const gone = simulate({ seed: 'slow', a: { enter: 0, votes: vote('sim', 500) }, b: { enter: null } });
    expect(gone.a?.how).toBe('lost');
    expect(gone.at[0]).toBeLessThanOrEqual(WAIT_MS + VOTE_MS + GRACE_MS + TICK);
    // one who arrives after the other gave up: follows the coin at once
    const late = simulate({ seed: 'slow', a: { enter: 0, votes: vote('sim', 500) }, b: { enter: 60000, votes: vote('sim', 500) } });
    expect(late.a?.how).toBe('lost');
    expect(late.b).toEqual(late.a);
    expect(late.at[1]! - 60000).toBeLessThan(1000);
  });

  // the vote doesn't depend on the sport: the long sweep runs in the basketball pass only
  it.skipIf(NFL)('can only disagree when the link dies in the one hop between the two echoes', () => {
    // the "two generals" window: sweep the moment a link dies (both ways, then each way alone)
    // across the whole vote and measure how long the stretch of bad moments is
    for (const [a, b] of [['play', 'play'], ['sim', 'sim'], ['none', 'none']] as [Ballot, Ballot][])
      for (const offset of [0, 1500])
        for (const which of ['both', 'ab', 'ba'] as const) {
          let bad = 0;
          for (let cut = 0; cut < 22000; cut += TICK) {
            const c = between(cut, 1e9);
            const r = simulate({ seed: 'cut', a: { enter: 0, votes: vote(a) }, b: { enter: offset, votes: vote(b) }, ab: which !== 'ba' ? c : undefined, ba: which !== 'ab' ? c : undefined }, 60000);
            expect(r.a).not.toBeNull();
            expect(r.b).not.toBeNull();
            if (r.a!.outcome !== r.b!.outcome) bad += TICK;
          }
          expect(bad, a + '/' + b + ' +' + offset + ' cut ' + which).toBeLessThanOrEqual(2 * LATENCY + 2 * TICK);
        }
  });
});
