// Claude 2026-11-01: coverage floor and integrity of the same-season game-rating references
// (docs/RATINGS-AUDIT.md, "Expanded game-rating references").
import { beforeAll, describe, expect, it } from 'vitest';
import { SPORT } from '../engine/sport';
import { seasonReference, type SeasonReferences } from './cards';

const sport = SPORT === 'nfl' ? 'nfl' : 'nba';
type CardsJson = { players: [string, string, number | null, number | null][]; cols: { player: number[]; season: number[] } };
let refs: SeasonReferences;
let keys: string[] = [];
beforeAll(async () => {
  refs = (await import(`../data/season-references-${sport}.json`)).default as SeasonReferences;
  const cards = (await import(`../data/cards-${sport}.json`)).default as CardsJson;
  keys = cards.cols.player.map((p, i) => `${cards.players[p][0]}:${cards.cols.season[i]}`);
}, 60000);

describe(`same-season game-rating references (${sport})`, () => {
  it('cover at least the measured share of season cards', () => {
    const covered = (ks: string[]) => ks.filter((k) => seasonReference(refs, k.slice(0, k.lastIndexOf(':')), +k.slice(k.lastIndexOf(':') + 1))).length / ks.length;
    const modern = keys.filter((k) => +k.slice(k.lastIndexOf(':') + 1) >= (sport === 'nba' ? 1999 : 2000));
    // measured 2026-11-01: NBA 54.5% all / 95.8% 1999+; NFL 63.3% all / 99.0% 2000+ (no public game data before)
    expect(covered(keys)).toBeGreaterThanOrEqual(sport === 'nba' ? 0.53 : 0.62);
    expect(covered(modern)).toBeGreaterThanOrEqual(sport === 'nba' ? 0.94 : 0.97);
  });

  it('keep one source per card, valid snapshots and in-range values, original rows first', () => {
    const cardKeys = new Set(keys);
    const seen = new Set(Object.keys(refs.rows));
    for (const set of refs.sets ?? []) {
      expect(['final', 'next', 'preseason', 'retro']).toContain(set.kind);
      expect(set.source).toMatch(/^https:\/\//);
      for (const [k, row] of Object.entries(set.rows)) {
        expect(seen.has(k), k).toBe(false);
        seen.add(k);
        expect(cardKeys.has(k), k).toBe(true);
        expect(typeof row[0] === 'number' && set.snapshots[row[0] as number]).toBeTruthy();
        expect(row.length).toBeLessThanOrEqual(refs.columns.length + 2);
        for (const v of row.slice(1)) if (v !== null) expect(v as number).toBeGreaterThanOrEqual(1), expect(v as number).toBeLessThanOrEqual(99);
      }
    }
    const [k, row] = Object.entries(refs.rows)[0];
    const pid = k.slice(0, k.lastIndexOf(':'));
    expect(seasonReference(refs, pid, +k.slice(k.lastIndexOf(':') + 1))?.ovr).toBe(row[1]);
    expect(seasonReference(refs, pid, 1800)).toBeUndefined();
  });
});
