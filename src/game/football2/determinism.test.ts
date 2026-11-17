// Claude (nfl-1): the AI's football is pinned. Both phones replay the AI's drives, the sims and the
// online takeovers from the same seeds, so a change that only touches human input (the momentum
// carry) must leave every one of them identical. The hashes below were computed on the tree before
// nfl-1 (the plan commit b0277ad); a change that moves them changes how a match comes out and needs
// a protocol bump and a new pin, never a silent update.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { chooseCall, decide, fourthDown, pilot } from './autopilot';
import { afterPlay, kick, newGame, punt, startPlay } from './drive';
import { snap, step } from './engine';
import { aiDrivesOf } from './Football2';
import { depth } from './squad';
import type { Defense, Offense, Play } from './types';

function teams(level: number, seed: string): { off: Offense; def: Defense } {
  const p = (pos: string, slot: string) => depth(pos, level, seed, slot);
  return {
    off: {
      qb: p('QB', 'QB'),
      rb: p('RB', 'RB'),
      wr: [p('WR', 'X'), p('WR', 'Z'), p('WR', 'SL')],
      te: p('TE', 'TE'),
      ol: [p('OT', 'LT'), p('OG', 'LG'), p('C', 'C'), p('OG', 'RG'), p('OT', 'RT')],
      k: p('K', 'K')
    },
    def: {
      dl: [p('DE', 'LE'), p('DT', 'LDT'), p('DT', 'RDT'), p('DE', 'RE')],
      lb: [p('LB', 'WLB'), p('LB', 'MLB'), p('LB', 'SLB')],
      cb: [p('CB', 'CB1'), p('CB', 'CB2')],
      s: [p('S', 'FS'), p('S', 'SS')]
    }
  };
}

/** A running FNV-1a over everything a play leaves behind: its end, its clock and where every body finished. */
function hasher() {
  let h = 0x811c9dc5;
  const add = (s: string) => {
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  };
  const r = (x: number) => (Number.isFinite(x) ? Math.round(x * 1000) : String(x));
  return {
    play(p: Play) {
      const e = p.end!;
      add([e.kind, r(e.gain), r(e.secs), r(e.y), e.caught ? 1 : 0, e.flag ?? '', p.events.join(',')].join('|'));
      for (const b of p.bodies) add([b.slot, r(b.x), r(b.y), r(b.vx), r(b.vy)].join(','));
    },
    text: add,
    get value() {
      return h.toString(16).padStart(8, '0');
    }
  };
}

describe('the AI side is unchanged (determinism pin)', () => {
  it('plays 200 seeded AI plays, at three levels and three squad strengths, to the pinned hash', () => {
    const h = hasher();
    let plays = 0;
    for (let gi = 0; plays < 200; gi++) {
      const level = [0.3, 0.6, 0.9][gi % 3];
      const skill = [0.45, 0.68, 0.88][gi % 3];
      const { off, def } = teams(level, 'pin:' + gi);
      const g = newGame(off, def, 'pin:' + gi, 4, [-0.5, 0, 1][gi % 3]);
      const pl = pilot(skill, 'pin:' + gi);
      while (!g.over && plays < 200) {
        if (g.down === 4) {
          const d = fourthDown(g);
          if (d === 'kick') {
            kick(g, pl.rand() * 0.2);
            continue;
          }
          if (d === 'punt') {
            punt(g);
            continue;
          }
        }
        const p = startPlay(g, chooseCall(g, pl));
        snap(p);
        pl.readAt = 0;
        const evs: string[] = [];
        for (let k = 0; k < 1500 && !p.end; k++) {
          step(p, 1 / 60, decide(p, g, pl));
          evs.push(...p.events);
          p.events.length = 0;
        }
        p.events = evs;
        h.play(p);
        afterPlay(g, p.end!);
        plays++;
      }
      h.text(g.score + ':' + g.ends.join(','));
    }
    expect(plays).toBe(200);
    expect(h.value).toBe(PIN.plays);
  });

  it('gives the same aiDrivesOf results and online takeovers', () => {
    const h = hasher();
    for (let i = 0; i < 6; i++) {
      const a = teams(0.55 + 0.07 * i, 'side-a:' + i);
      const b = teams(0.62 - 0.05 * i, 'side-b:' + i);
      // a solo AI's drives, and the takeover both phones compute for a rival who went quiet
      for (const seed of ['match:' + i, 'match:' + i + ':takeover']) {
        const r = aiDrivesOf(a.off, b.def, seed, [0.45, 0.68, 0.88][i % 3], 4, [-0.5, 0, 1][i % 3]);
        h.text(JSON.stringify(r));
      }
    }
    expect(h.value).toBe(PIN.drives);
  });

  it('seeds its rng the same way (a guard for the pins themselves)', () => {
    const r = rng(hashString('pin'));
    expect([r(), r()].map((x) => x.toFixed(6))).toEqual(PIN.rng);
  });
});

// Re-pinned by nfl-4 (Protocol bump needed: NFL draft 10->11, UT 11->12): the AI's own JUKE and SPIN
// are judged on the tackler's gold ring (a PERFECT beats him), its On Fire is Heat's (no longer three
// straight completions, and no longer a quicker ball or the whole arc), and a play reports its rings.
// Before: plays 'f3099ed1', drives 'ade7aadc' (nfl-1's pin, from b0277ad).
const PIN = { plays: '9d4f17f7', drives: 'd7536bc8', rng: ['0.051221', '0.868142'] };
