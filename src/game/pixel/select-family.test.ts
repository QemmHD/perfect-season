// players-2: acts the selection code doesn't animate yet are drawn as their family's stand-in (the
// cross-team action contract, docs/studio-overhaul/players.md 4.1). Every V2 act reserved in the
// contract must resolve to an act the sport animates, and a moving body never stands still.
import { familyOf, NBA_STANDINS, NFL_STANDINS, SOCCER_STANDINS, standIn, type StandIns } from './select-family';
import { KNOWN_ACTS as NBA_KNOWN } from './select-nba';
import { KNOWN_ACTS as NFL_KNOWN } from './select-nfl';
import { KNOWN_ACTS as SOCCER_KNOWN } from './select-soccer';

const V2 = {
  nba: 'pumpfake steal ft lob euro board ankle charge foul switch boxout inbound',
  nfl: 'snap drop handoff sack slide throwaway dive truck wrap bighit swat pick pile hold catch:stride catch:high catch:toe',
  soccer: 'touch shot:power shot:finesse shot:chip shot:driven header volley trick:stepover trick:roulette trick:dragback trick:feint tackle:stand tackle:slide contain jockey shield onetwo keeper:set keeper:dive keeper:parry keeper:catch keeper:rush keeper:getup throwin corner goalkick',
};
const SPORTS: [keyof typeof V2, ReadonlySet<string>, StandIns][] = [
  ['nba', NBA_KNOWN, NBA_STANDINS],
  ['nfl', NFL_KNOWN, NFL_STANDINS],
  ['soccer', SOCCER_KNOWN, SOCCER_STANDINS],
];

describe('the family fallback for unknown acts', () => {
  it.each(SPORTS)('%s: every reserved V2 act resolves to an act the sport animates', (sport, known, s) => {
    for (const act of V2[sport].split(' ')) {
      for (const moving of [false, true]) {
        const got = standIn(act, known, s, moving);
        expect(known.has(got), `${sport} ${act} -> ${got}`).toBe(true);
        // never the stand pose while covering ground
        if (moving) expect(got, `${sport} ${act} while moving`).not.toBe(s.family.hold);
      }
    }
  });

  it.each(SPORTS)('%s: known acts are left alone, and every stand-in is itself known', (_sport, known, s) => {
    for (const act of known) expect(standIn(act, known, s, true)).toBe(act);
    for (const a of Object.values(s.family)) expect(known.has(a)).toBe(true);
    for (const a of Object.values(s.alias)) expect(known.has(a)).toBe(true);
  });

  it('maps by family, then by either part of a kind:variant name', () => {
    expect(familyOf('pumpfake')).toBe('shot');
    expect(familyOf('onetwo')).toBe('pass');
    expect(familyOf('goalkick')).toBe('kick');
    expect(familyOf('bighit')).toBe('contact');
    expect(familyOf('pile')).toBe('ground');
    expect(familyOf('trick:stepover')).toBe('move');
    expect(familyOf('shot:chip')).toBe('shot');
    expect(familyOf('zzz')).toBe('hold');
    // the contract's examples
    expect(standIn('board', NBA_KNOWN, NBA_STANDINS, false)).toBe('rebound');
    expect(standIn('switch', NBA_KNOWN, NBA_STANDINS, true)).toBe('run');
    expect(standIn('ankle', NBA_KNOWN, NBA_STANDINS, false)).toBe('fall');
    expect(standIn('pumpfake', NBA_KNOWN, NBA_STANDINS, false)).toBe('shoot');
    expect(standIn('keeper:dive', SOCCER_KNOWN, SOCCER_STANDINS, true)).toBe('dive');
    expect(standIn('keeper:catch', SOCCER_KNOWN, SOCCER_STANDINS, false)).toBe('catch');
    expect(standIn('tackle:slide', SOCCER_KNOWN, SOCCER_STANDINS, true)).toBe('tackle');
    expect(standIn('sack', NFL_KNOWN, NFL_STANDINS, true)).toBe('tackle');
    // unclassified: moving runs, standing holds the set pose
    expect(standIn('zzz', NFL_KNOWN, NFL_STANDINS, true)).toBe('run');
    expect(standIn('zzz', NFL_KNOWN, NFL_STANDINS, false)).toBe('stance');
    // a hold-family alias never freezes a moving body
    expect(standIn('snap', NFL_KNOWN, NFL_STANDINS, true)).toBe('run');
  });
});

describe('the stand-in reaches the drawing', () => {
  it('NBA: an unknown act on a moving body draws a stride, standing it draws the set pose', async () => {
    const body = (act: string, vx: number) => ({ p: { ht: 78, wt: 215, id: 'p1', num: 1, ddk: 60, vrt: 60, str: 60, spd: 80 }, act, actAt: 0, vx, vz: 0, h: 0, idx: 0, face: 0 }) as never;
    const look = { sport: 'nba', ht: 78, wt: 215 } as never;
    const memo = () => ({ gait: { t: 0, frac: 0 }, last: null });
    // before the clips arrive the hand-keyed poses answer: 'rn' a stride, 'id' idle. select-nba.ts
    // starts loading them as it is evaluated (players-3), so a fresh copy with that load held back
    vi.resetModules();
    vi.doMock('./ready', () => ({ preloadPixels: () => undefined }));
    const held = await import('./select-nba');
    expect(held.animOf(body('zzz', 12), 1, false, look, memo(), null).key.slice(0, 2)).toBe('rn');
    expect(held.animOf(body('zzz', 0), 1, false, look, memo(), null).key.slice(0, 2)).toBe('id');
    expect(held.animOf(body('board', 0), 0.3, false, look, memo(), null).key.slice(0, 2)).toBe('co');
    vi.doUnmock('./ready');
    vi.resetModules();
    // and once they're in, the recorded strides
    const { animOf } = await import('./select-nba');
    await (await import('./ready')).pixelReady('nba');
    expect(['jog', 'run', 'sprint']).toContain(animOf(body('zzz', 12), 1, false, look, memo(), null).clip);
    expect(['jog', 'run', 'sprint']).not.toContain(animOf(body('zzz', 0), 1, false, look, memo(), null).clip);
  });
});
