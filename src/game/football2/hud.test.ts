// Claude (studio overhaul nfl-3): the football HUD's rules (hud.ts): the toast line's priorities,
// its clearing as the play moves on, the one-pop rule, and the score bug's model. The ability roll
// itself (the engine's seeded "in the zone" coin) is measured over thousands of real plays: it still
// fires on about half the eligible chances, and the screen now shows at most one pop a play.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { chooseCall, decide, fourthDown, pilot } from './autopilot';
import { afterPlay, kick, newGame, punt, startPlay } from './drive';
import { ABILITY_ON, snap, step } from './engine';
import { ABILITY_TEXT, abilityToPop, bugModel, PRIO, STALE_MS, ToastQueue } from './hud';
import { fixtureTeams } from './sim-kit';

describe('the toast line (hud.ts ToastQueue)', () => {
  it('shows one toast at a time: a higher or equal priority replaces it, a lower one waits its turn', () => {
    const q = new ToastQueue();
    q.push({ text: 'Pick a play', prio: PRIO.hint, ms: 4000, scope: 'time' }, 0);
    // (it had 3.9 s left when it was replaced; it comes back with that)
    expect(q.current(10)?.text).toBe('Pick a play');
    q.push({ text: 'FIRST DOWN', prio: PRIO.result, ms: 1000 }, 100);
    expect(q.current(110)?.text).toBe('FIRST DOWN');
    // a lower one waits while the result shows
    q.push({ text: 'BULLDOZER', prio: PRIO.ability, ms: 800 }, 200);
    expect(q.current(300)?.text).toBe('FIRST DOWN');
    // the result runs out: the best of the waiting ones comes up (the ability outranks the hint)
    expect(q.current(1150)?.text).toBe('BULLDOZER');
    expect(q.current(1960)?.text).toBe('Pick a play');
  });

  it('drops a waiting toast that went stale, and lets a newer one with the same key replace it', () => {
    const q = new ToastQueue();
    q.push({ text: 'TOUCHDOWN', prio: PRIO.big, ms: STALE_MS + 1000 }, 0);
    q.push({ text: 'a stale hint', prio: PRIO.hint, ms: 500 }, 10);
    expect(q.current(STALE_MS + 1100)).toBeNull();
    q.push({ text: 'hint one', prio: PRIO.hint, key: 'hint' }, 5000);
    q.push({ text: 'hint two', prio: PRIO.hint, key: 'hint' }, 5100);
    expect(q.current(5200)?.text).toBe('hint two');
  });

  it('clears a hint the moment the play moves on, and the last play at a new play', () => {
    const q = new ToastQueue();
    q.clear('pocket');
    q.push({ text: 'Tap a name or drag back to throw', prio: PRIO.hint, ms: 4200, scope: 'phase' }, 0);
    expect(q.current(100)?.text).toMatch(/Tap a name/);
    // the throw: the pocket's hint goes at once, not 4.2 s later (audit P-4)
    q.clear('air');
    expect(q.current(150)).toBeNull();
    // a result stays through the whistle, then goes with its play when the next one lines up
    q.push({ text: '+7 YDS', sub: 'TACKLED BY SMITH', prio: PRIO.result, ms: 1100, scope: 'play' }, 200);
    q.clear('dead');
    expect(q.current(300)?.text).toBe('+7 YDS');
    q.clear('pre', true);
    expect(q.current(400)).toBeNull();
    // something timed alone (the next drive's banner) survives a new play
    q.push({ text: 'DRIVE 2 OF 4', prio: PRIO.result, ms: 1100, scope: 'time' }, 500);
    q.clear('pre', true);
    expect(q.current(600)?.text).toBe('DRIVE 2 OF 4');
  });

  it('never stacks: whatever is pushed, one toast is current', () => {
    const q = new ToastQueue();
    const r = rng(hashString('toasts'));
    for (let i = 0; i < 500; i++) {
      q.push({ text: 't' + i, prio: 1 + Math.floor(r() * 4), ms: 200 + r() * 1500, scope: r() < 0.3 ? 'phase' : 'time' }, i * 50);
      if (r() < 0.2) q.clear('p' + i, r() < 0.3);
      const c = q.current(i * 50 + 10);
      // a single object or nothing
      expect(c === null || typeof c.text === 'string').toBe(true);
    }
  });
});

describe('the one-pop rule (V-4)', () => {
  it('shows the first ability a play reports and nothing after it', () => {
    const shown = { done: false };
    expect(abilityToPop(['snap', 'ability:cannon:0'], shown)).toEqual({ id: 'cannon', body: 0 });
    expect(abilityToPop(['ability:sure-hands:7', 'ability:ballhawk:15'], shown)).toBeNull();
    // a new play, a new chance
    expect(abilityToPop(['ability:ballhawk:15'], { done: false })).toEqual({ id: 'ballhawk', body: 15 });
    expect(abilityToPop(['throw', 'catch'], { done: false })).toBeNull();
  });

  it('says Truck Stick as BULLDOZER (packs C13; the id is unchanged)', () => {
    expect(ABILITY_TEXT['truck-stick']).toBe('BULLDOZER');
    expect(Object.values(ABILITY_TEXT).join(' ')).not.toMatch(/HIT STICK|X-FACTOR|SUPERSTAR|IN THE ZONE/);
  });

  it('over 2,000+ plays: the seeded roll still fires on 45-55% of eligible chances, and at most one pop shows a play', () => {
    let chances = 0;
    let rolled = 0;
    let plays = 0;
    let reported = 0;
    let shown = 0;
    let multi = 0;
    for (let gi = 0; plays < 2100; gi++) {
      const t = fixtureTeams(gi % 2 ? 'elite' : 'promo');
      const g = newGame(t.off, t.def, 'abil:' + gi, 4);
      const pl = pilot(0.7, 'abil:' + gi);
      while (!g.over) {
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
        // the roll at the snap: each ability of each player on the field
        for (const b of p.bodies) {
          chances += b.p.abil.length;
          rolled += b.on?.length ?? 0;
        }
        const gate = { done: false };
        let pops = 0;
        const evs = new Set<string>();
        for (let k = 0; k < 1500 && !p.end; k++) {
          step(p, 1 / 60, decide(p, g, pl));
          for (const e of p.events) if (e.startsWith('ability:')) evs.add(e);
          if (abilityToPop(p.events, gate)) pops++;
          p.events.length = 0;
        }
        afterPlay(g, p.end!);
        plays++;
        reported += evs.size;
        if (evs.size > 1) multi++;
        if (pops) shown++;
        expect(pops).toBeLessThanOrEqual(1);
      }
    }
    expect(plays).toBeGreaterThanOrEqual(2000);
    const rate = rolled / chances;
    expect(ABILITY_ON).toBe(0.5);
    expect(rate).toBeGreaterThanOrEqual(0.45);
    expect(rate).toBeLessThanOrEqual(0.55);
    // not vacuous: these squads report more than one ability on some plays (the old noise)
    expect(multi).toBeGreaterThan(20);
    expect(reported / plays).toBeGreaterThan(shown / plays);
    expect(shown).toBeLessThanOrEqual(plays);
  });
});

describe('the score bug (bugModel)', () => {
  it('labels the drive, carries the down and distance, and one pip a drive', () => {
    const t = fixtureTeams('gold');
    const g = newGame(t.off, t.def, 'bug', 4);
    let m = bugModel(g, '1ST & 10');
    expect(m.label).toBe('DRIVE 1 OF 4');
    expect(m.sub).toBe('1ST & 10');
    expect(m.pips).toEqual(['open', 'open', 'open', 'open']);
    expect(m.progress).toBeCloseTo(g.ballOn / 100);
    g.ends.push('TD', 'INT');
    g.drive = 2;
    m = bugModel(g, '2ND & 4');
    expect(m.pips).toEqual(['td', 'lost', 'open', 'open']);
    g.ends.push('FG', 'PUNT');
    g.over = true;
    m = bugModel(g, '');
    expect(m.label).toBe('FINAL');
    expect(m.pips).toEqual(['td', 'lost', 'fg', 'none']);
  });
});
