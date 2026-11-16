// Readable text on the court (nba-3, NBA-22; Claude 2026-11-16): every name in the card data prints
// whole in the pixel font, no two men on a court share a tag, and the chips never overlap.
import { describe, expect, it } from 'vitest';
import { hashString, rng } from '../../engine/rng';
import { chipWidth, CHIP_H, F35, foldName, glyphMisses, layoutLabels, uniqueTags } from './labels';
import { tagOf } from './ratings';
import cardsText from '../../data/cards-nba.json?raw';

const cards = JSON.parse(cardsText) as { players: unknown[][] };
const names = [...new Set(cards.players.map((r) => r[1]).filter((n): n is string => typeof n === 'string'))];

describe('the pixel font and names (NBA-22)', () => {
  it('folds every name in cards-nba.json to letters it has: 0 glyph misses (nba-1: 122 names with holes)', () => {
    expect(names.length).toBeGreaterThan(3000);
    const bad = names.filter((n) => glyphMisses(n).length > 0 || [...n.toUpperCase().normalize('NFD')].some((c) => /\p{L}/u.test(c) && !foldName(c)));
    expect(bad).toEqual([]);
    // and the tags the court prints too
    expect(names.filter((n) => glyphMisses(tagOf(n)).length > 0)).toEqual([]);
  });

  it('spells the accented and whole letters out', () => {
    expect(foldName('Nikola Jokić')).toBe('NIKOLA JOKIC');
    expect(foldName('Luka Dončić')).toBe('LUKA DONCIC');
    expect(foldName('Dražen Petrović')).toBe('DRAZEN PETROVIC');
    expect(foldName('Šarūnas Marčiulionis')).toBe('SARUNAS MARCIULIONIS');
    expect(foldName('Ørjan Łukasz Đorđe Weiß Æon Œil')).toBe('ORJAN LUKASZ DORDE WEISS AEON OEIL');
    expect(foldName('Hedo Türkoğlu')).toBe('HEDO TURKOGLU');
    expect(foldName("D'Angelo O’Neal")).toBe("D'ANGELO O'NEAL");
  });

  it('has the V2 punctuation: & / : + \' ( ) ,', () => {
    for (const c of "&/:+'(),") expect(F35[c], c).toMatch(/^[01]{15}$/);
    expect(foldName('SCREEN & ROLL')).toBe('SCREEN & ROLL');
    expect(foldName('3/4 · 2:00 +12 (OT), GO')).toBe('3/4 · 2:00 +12 (OT), GO');
  });
});

describe('on-court tags', () => {
  it('a shared surname gets the first initial, then two letters, then a number', () => {
    const men = [
      { name: 'Joe Johnson', tag: 'JOHNSON' },
      { name: 'Magic Johnson', tag: 'JOHNSON' },
      { name: 'Larry Bird', tag: 'BIRD' },
    ];
    expect(uniqueTags(men)).toEqual(['J.JOHNSON', 'M.JOHNSON', 'BIRD']);
    expect(uniqueTags([{ name: 'Jalen Green', tag: 'GREEN' }, { name: 'Jeff Green', tag: 'GREEN' }])).toEqual(['JA.GREEN', 'JE.GREEN']);
    expect(uniqueTags([{ name: 'A B', tag: 'B' }, { name: 'A B', tag: 'B' }])).toEqual(['A.B 1', 'A.B 2']);
  });

  it('0 duplicate tags across 1,000 random squads paired on 500 courts (nba-1: 76 of 500 courts)', () => {
    const r = rng(hashString('tags'));
    let dupCourts = 0;
    let before = 0;
    for (let c = 0; c < 500; c++) {
      const ten = Array.from({ length: 10 }, () => {
        const name = names[Math.floor(r() * names.length)];
        return { name, tag: tagOf(name) };
      });
      if (new Set(ten.map((m) => foldName(m.tag))).size < 10) before++;
      const tags = uniqueTags(ten);
      if (new Set(tags).size < 10) dupCourts++;
    }
    expect(dupCourts).toBe(0);
    // and the draw really brings collisions to resolve (same surnames, and folded names that meet)
    expect(before).toBeGreaterThan(10);
  });
});

describe('chip layout', () => {
  it('0 overlaps in 1,000 frames of clustered chips; the top priority always placed where it asked', () => {
    const r = rng(hashString('chips'));
    for (let f = 0; f < 1000; f++) {
      const W = 393;
      const H = 852;
      const reqs = Array.from({ length: 2 + Math.floor(r() * 6) }, (_, i) => ({
        text: ['CURRY', '41%', 'OPEN', 'J.JOHNSON 37%', 'CATCH & SHOOT', 'SCREEN'][i % 6],
        x: 120 + r() * 150,
        y: 200 + r() * 120,
        pri: Math.floor(r() * 7),
        color: '#fff',
      }));
      const placed = layoutLabels(reqs, W, H);
      for (let i = 0; i < placed.length; i++) {
        const a = placed[i];
        expect(a.bw).toBe(chipWidth(a.text));
        expect(a.bh).toBe(CHIP_H);
        for (let j = i + 1; j < placed.length; j++) {
          const b = placed[j];
          const hit = a.bx < b.bx + b.bw && b.bx < a.bx + a.bw && a.by < b.by + b.bh && b.by < a.by + a.bh;
          expect(hit).toBe(false);
        }
      }
      const top = [...reqs].sort((a, b) => b.pri - a.pri)[0];
      expect(placed.some((q) => q.text === top.text && q.by === Math.round(top.y))).toBe(true);
    }
  });

  it('chips are 7 art pixels tall (14 px at z 2)', () => {
    expect(CHIP_H).toBe(14);
  });
});
