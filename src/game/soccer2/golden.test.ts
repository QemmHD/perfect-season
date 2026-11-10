// The soccer golden hash (Claude 2026-11-10, studio overhaul soccer-1): a fingerprint of how the
// engine plays, so a change that moves attack outcomes or the simulations both phones compute can't
// land unnoticed. It hashes
//  - 60 seeded autopilot attacks (six scenarios × both mirrors × five seeds): the end, its time, the
//    ball and every body at the whistle, and again after 3 s of post-whistle settle();
//  - 20 aiProgress matches (the AI's attacks as the Arcade scoreboard and Ultimate Team sims use them);
//  - 50 agreed shootouts (the penalties both phones settle a level online match with).
// Presentation work must keep it green. A task that changes outcomes on purpose re-bases it here,
// with its reason in REBASES and in docs/studio-overhaul/soccer.md, and says "Protocol bump needed".
import { describe, expect, it } from 'vitest';
import { agreedShootout, aiProgress } from './arcade';
import { autoplayAttack } from './autopilot';
import { setupAttack, settle } from './engine';
import { squadFor } from './squads.test-util';
import type { Attack, Scenario, Squad } from './types';

/**
 * Re-bases, newest last (each one's reason; the commit that did it is in the team doc):
 *  1. soccer-1 step A (2026-11-10): created on the untouched engine (main acdf3e2).
 */
const GOLDEN = {
  attacks: '0f8f55a4585cb3',
  matches: '0b2cfdb283c412',
  shootouts: '13ebc2208d1307',
};

/** cyrb53: a 53-bit string hash, as hex */
function hash(s: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}
/** numbers to 4 places: the same engine gives the same digits on every machine */
const n4 = (x: number) => (Object.is(x, -0) ? 0 : x).toFixed(4);
/** the ball and every body (where, how high, what he's doing) */
const stateOf = (a: Attack) => [n4(a.t), n4(a.ball.x), n4(a.ball.y), n4(a.ball.h), String(a.ball.owner), a.bodies.map((b) => n4(b.x) + ',' + n4(b.y) + ',' + n4(b.h) + ',' + b.act).join(';')].join('|');

const SIDES: Squad[] = ['gold-a', 'gold-b', 'gold-c', 'gold-d'].map((k, i) => squadFor(k, 66 + i * 7));
const SCENARIOS: Scenario[] = ['build', 'counter', 'wide', 'corner', 'freekick', 'penalty'];

/** One attack's fingerprint: its end and the whistle state, then 3 s of settle() after it. */
function attackPrint(sc: Scenario, side: number, s: number): string {
  const a = setupAttack(sc, SIDES[s % 4], SIDES[(s + 1) % 4], 'golden:' + sc + ':' + s, { side, defIQ: [-0.5, 0, 1][s % 3] });
  autoplayAttack(a, [0.45, 0.68, 0.88][s % 3], 'golden-pilot:' + s);
  const at = a.end ? a.end.kind + ':' + a.end.text + ':' + n4(a.end.t) : 'none';
  const whistle = stateOf(a);
  for (let i = 0; i < 180; i++) settle(a, 1 / 60);
  return [sc, side, s, at, n4(a.used), whistle, stateOf(a)].join('#');
}

describe('soccer golden hash', () => {
  it('60 seeded autopilot attacks: the whistle and 3 s after it', () => {
    const prints: string[] = [];
    for (const sc of SCENARIOS) for (const side of [1, -1]) for (let s = 0; s < 5; s++) prints.push(attackPrint(sc, side, s));
    expect(prints).toHaveLength(60);
    expect(hash(prints.join('\n'))).toBe(GOLDEN.attacks);
  });
  it('20 aiProgress matches', () => {
    const prints: string[] = [];
    for (let i = 0; i < 20; i++) {
      const p = aiProgress(SIDES[i % 4], SIDES[(i + 2) % 4], 'golden-match:' + i, [0.45, 0.6, 0.68, 0.88][i % 4], [-0.5, 0, 1][i % 3]);
      prints.push([p.score, p.drive, p.done, p.plays, p.ends.join('')].join(':'));
    }
    expect(hash(prints.join('\n'))).toBe(GOLDEN.matches);
  });
  it('50 agreed shootouts', () => {
    const prints: string[] = [];
    for (let i = 0; i < 50; i++) {
      const so = agreedShootout(SIDES[i % 4], SIDES[(i + 1) % 4], 'golden-pens:' + i, i % 2 === 0);
      prints.push([so.first, so.us, so.them, so.winner, so.scored.map((k) => (k ? 1 : 0)).join('')].join(':'));
    }
    expect(hash(prints.join('\n'))).toBe(GOLDEN.shootouts);
  });
});
