// Claude (studio overhaul, shell-4): the danger zone's facts (danger.ts). The other sports' saves are
// read raw and read-only; a missing, empty or corrupt save never throws and never counts.
import { describe, expect, it } from 'vitest';
import { SPORT, type SportId } from '../engine/sport';
import type { CloudPhase, CloudStatus } from '../lib/cloud-sync';
import { freshProfile, PROFILE_KEYS, type Profile } from '../lib/profile';
import { ago, canErase, cloudLine, eraseSummary } from './danger';

const owned = (n: number) => Array.from({ length: n }, (_, i) => ({ uid: 'u' + i, id: 'c' + i }));
function player(): Profile {
  const p = freshProfile();
  return { ...p, coins: 59672, xp: 5000, inventory: { double: 2, trade: 1, prime: 0 }, history: new Array(37).fill(null) as never, ut: { ...p.ut, owned: owned(412) as never } };
}
/** A storage getter over plain strings, recording every key it's asked for. */
function store(saves: Partial<Record<SportId, string>>) {
  const asked: string[] = [];
  const byKey = Object.fromEntries(Object.entries(saves).map(([s, v]) => [PROFILE_KEYS[s as SportId], v]));
  return { asked, read: (k: string) => (asked.push(k), byKey[k] ?? null) };
}
const others = (['nba', 'nfl', 'soccer'] as SportId[]).filter((s) => s !== SPORT);

describe('canErase', () => {
  it('takes the word in any case, with spaces around it', () => {
    expect(canErase('ERASE')).toBe(true);
    expect(canErase('erase')).toBe(true);
    expect(canErase('  Erase ')).toBe(true);
  });
  it('refuses anything else', () => {
    for (const t of ['', 'ERAS', 'ERASE!', 'E R A S E', 'ERASE ERASE', 'RESET', 'erased']) expect(canErase(t)).toBe(false);
  });
});

describe('eraseSummary', () => {
  it('reports this profile’s coins, level, XP and boosters, and its cards and runs', () => {
    const s = eraseSummary(player(), SPORT, store({}).read);
    expect(s.coins).toBe(59672);
    expect(s.xp).toBe(5000);
    expect(s.level).toBeGreaterThan(1);
    expect(s.boosters).toBe(3);
    expect(s.sports).toEqual([{ sport: SPORT, cards: 412, runs: 37 }]);
  });

  it('adds every other sport that has a save, from its raw JSON', () => {
    const [a, b] = others;
    const st = store({ [a]: JSON.stringify({ v: 1, ut: { owned: owned(230) }, history: [1, 2, 3] }), [b]: JSON.stringify({ v: 1, ut: { owned: owned(31) } }) });
    const s = eraseSummary(player(), SPORT, st.read);
    expect(s.sports).toEqual([
      { sport: SPORT, cards: 412, runs: 37 },
      { sport: a, cards: 230, runs: 3 },
      { sport: b, cards: 31, runs: 0 },
    ]);
    // only the other sports' profile keys are read; this sport's comes from the live profile
    expect(st.asked.sort()).toEqual(others.map((s) => PROFILE_KEYS[s]).sort());
  });

  it('never throws on a corrupt, odd-shaped or unreadable save, and counts it as 0', () => {
    const [a, b] = others;
    const corrupt = eraseSummary(player(), SPORT, store({ [a]: '{not json', [b]: JSON.stringify({ ut: { owned: 'many' }, history: {} }) }).read);
    expect(corrupt.sports.slice(1)).toEqual([
      { sport: a, cards: 0, runs: 0 },
      { sport: b, cards: 0, runs: 0 },
    ]);
    const nulls = eraseSummary(player(), SPORT, store({ [a]: 'null' }).read);
    expect(nulls.sports[1]).toEqual({ sport: a, cards: 0, runs: 0 });
    const blocked = eraseSummary(player(), SPORT, () => {
      throw new Error('SecurityError');
    });
    expect(blocked.sports).toEqual([{ sport: SPORT, cards: 412, runs: 37 }]);
  });

  it('copes with an old profile that has no Ultimate Team yet', () => {
    const old = { ...player(), ut: undefined } as unknown as Profile;
    expect(eraseSummary(old, SPORT, store({}).read).sports[0].cards).toBe(0);
  });
});

describe('cloudLine', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  const st = (phase: CloudPhase, updatedAt: string | null = null): CloudStatus => ({ phase, revision: 3, updatedAt, message: '' });

  it('says a saved profile’s server copy gets replaced, and when it was last saved', () => {
    const l = cloudLine(st('saved', '2026-11-16T11:56:00Z'), now);
    expect(l.on).toBe(true);
    expect(l.text).toContain('last saved 4 min ago');
    expect(l.tick).toMatch(/cloud save will be replaced/);
  });

  it('treats every live phase as "on"', () => {
    for (const phase of ['starting', 'pending', 'saving', 'restoring', 'offline', 'conflict'] as CloudPhase[]) {
      const l = cloudLine(st(phase), now);
      expect(l.on).toBe(true);
      expect(l.tick).toMatch(/replaced/);
    }
    expect(cloudLine(st('offline'), now).text).toMatch(/next time this phone connects/);
  });

  it('says there is no other copy when this phone isn’t cloud-saving', () => {
    const l = cloudLine(st('blocked'), now);
    expect(l.on).toBe(false);
    expect(l.text).toMatch(/no other copy/);
    expect(l.tick).toMatch(/no other copy/);
  });
});

describe('ago', () => {
  const now = Date.parse('2026-11-16T12:00:00Z');
  it('reads like a person', () => {
    expect(ago('2026-11-16T11:59:30Z', now)).toBe('just now');
    expect(ago('2026-11-16T09:00:00Z', now)).toBe('3 h ago');
    expect(ago('2026-11-15T11:00:00Z', now)).toBe('1 day ago');
    expect(ago('2026-11-10T11:00:00Z', now)).toBe('6 days ago');
    expect(ago(null, now)).toBe(null);
    expect(ago('garbage', now)).toBe(null);
  });
});
