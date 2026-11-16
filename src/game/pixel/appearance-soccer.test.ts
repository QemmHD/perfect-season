// players-3, soccer: a weight from height and position (soccer cards carry none), one build for the
// match and the card, and the preferred foot from the data.
import { appearanceFor, buildOf, useAppearanceFile, weightFor, type AppearanceFile } from './appearance';
import { cardLook, matchLook } from './looks';
import { loadCards } from '../../ut/cards';
import { rateSoccerLine } from '../soccer2/ratings';
import SOCCER from '../../data/appearance/soccer.json';
import type { CardLine } from '../../ut/types';

beforeAll(() => useAppearanceFile(SOCCER as AppearanceFile));

describe('soccer build', () => {
  it('weighs by position at a given height (BMI GK 23.5, CB 23.6, FB 22.3, CM 22.6, W 22.0, ST 23.2)', () => {
    const at = (pos: string) => weightFor('soccer', 72, null, pos);
    // weights are whole pounds: one pound is 0.14 BMI at this height
    const bmi = (pos: string) => (at(pos) * 703) / (72 * 72);
    const near = (pos: string, want: number) => expect(Math.abs(bmi(pos) - want)).toBeLessThanOrEqual(0.14);
    near('GK', 23.5);
    near('CB', 23.6);
    near('FB', 22.3);
    near('DM', 22.6);
    near('CM', 22.6);
    near('AM', 22.0);
    near('W', 22.0);
    near('ST', 23.2);
    expect(at('CB')).toBeGreaterThan(at('W'));
    // a weight on record wins
    expect(weightFor('soccer', 72, 180, 'W')).toBe(180);
  });

  it('gives Messi the same weight in the match as on his card', async () => {
    const { lines } = await loadCards('soccer');
    const line = lines.find((l) => l.pid === '28003' && l.kind === 'season')!;
    const card = cardLook(line as CardLine);
    // the match body: the soccer engine's own player from the same line
    const p = rateSoccerLine({ pid: line.pid, name: line.name, pos: line.pos.join('/'), ovr: 90, face: [90, 90, 90, 90, 40, 70], ht: line.ht, num: line.num, season: line.season, fr: line.fr, abbr: line.abbr, teamName: line.teamName, c1: line.c1, c2: line.c2 });
    const kit = { jersey: '#a50044', trim: '#004d98', shorts: '#004d98', socks: '#a50044', shoes: '#111' };
    const match = matchLook('soccer', { pid: line.pid, season: line.season }, kit, { num: p.num, ht: p.ht, pos: p.pos });
    expect(match.wt).toBe(card.wt);
    expect(match.ht).toBeCloseTo(card.ht, 6);
    expect(buildOf('soccer', { ht: line.ht, pos: line.pos[0] }).wt).toBe(card.wt);
  }, 120000);

  it('fills a missing height the way the match does (181 cm, clamped to 155–205)', () => {
    expect(buildOf('soccer', { ht: null, pos: 'CM' }).htIn).toBeCloseTo(181 / 2.54, 6);
    expect(buildOf('soccer', { ht: 150, pos: 'CM' }).htIn).toBeCloseTo(155 / 2.54, 6);
  });
});

describe('soccer feet', () => {
  it('decodes the preferred foot: left, both, right by default, unknown when not recorded', () => {
    const f = SOCCER as AppearanceFile;
    expect(f.feet!.L.length).toBeGreaterThan(1000);
    expect(appearanceFor('soccer', f.feet!.L[0], 2020).foot).toBe('L');
    expect(appearanceFor('soccer', f.feet!.B[0], 2020).foot).toBe('B');
    expect(appearanceFor('soccer', f.feet!.U[0], 2020).foot).toBeUndefined();
    expect(appearanceFor('soccer', '132098', 2020).foot).toBe('R');
    // curated left-footers
    expect(appearanceFor('soccer', '28003', 2020).foot).toBe('L');
    expect(appearanceFor('soccer', '418560', 2024).foot).toBe('L');
  });

  it('records a foot for at least 85% of the players with cards', async () => {
    const { lines } = await loadCards('soccer');
    const pids = new Set(lines.map((l) => l.pid));
    const unknown = new Set((SOCCER as AppearanceFile).feet!.U);
    const recorded = [...pids].filter((p) => !unknown.has(p)).length;
    expect(recorded / pids.size).toBeGreaterThanOrEqual(0.85);
  }, 120000);

  it('gives a keeper gloves and long sleeves in the match and on the card', async () => {
    const { lines } = await loadCards('soccer');
    const gk = lines.find((l) => l.pos[0] === 'GK' && l.kind === 'season')!;
    const card = cardLook(gk as CardLine);
    expect(card.gloves).toBeDefined();
    expect(card.sleeves).toBe('long');
    const m = matchLook('soccer', { pid: gk.pid, season: gk.season }, { jersey: '#b6f23a', trim: '#16161c', shorts: '#b6f23a', socks: '#b6f23a', shoes: '#111', gloves: '#f2f2ee' }, { num: 1, ht: gk.ht, pos: 'GK', gk: true });
    expect(m.gloves).toBe('#f2f2ee');
    expect(m.sleeves).toBe('long');
  }, 120000);
});
