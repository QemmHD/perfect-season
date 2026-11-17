// players-3: the appearance record (appearance.ts) against V2 C.1.4 and the plan's acceptance: the
// option lists and hexes, the key whitelist, neutral skin for the uncurated, the seeded defaults'
// diversity and gear priors, era resolution, the compact code and every id form.
import {
  ACCENT,
  APPEARANCE_KEYS,
  appearanceFor,
  checkKeys,
  decodeAppearance,
  defaultAppearance,
  encodeAppearance,
  encodeFields,
  ERA_BUCKETS,
  FACIAL,
  HAIR,
  HAIR_TONE,
  HAIR_TONES,
  lodFacial,
  lodHair,
  NATURAL_TONES,
  NEUTRAL_SKIN,
  refOf,
  SKIN_TONES,
  skinRamp,
  skinTone,
  type Sport,
  useAppearanceFile,
} from './appearance';
import { DEFAULT_SKIN } from './body';
import { cardLook, matchLook } from './looks';
import NBA from '../../data/appearance/nba.json';
import NFL from '../../data/appearance/nfl.json';
import type { AppearanceFile } from './appearance';
import type { CardLine } from '../../ut/types';

const SPORTS: Sport[] = ['nba', 'nfl', 'soccer'];
const pids = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i.toString(36)}x${(i * 7919).toString(36)}`);

describe('V2 C.1.4 option lists and palettes', () => {
  it('has 18 hair silhouettes, 15 hair colours and at least 8 facial hair options', () => {
    expect(HAIR).toHaveLength(18);
    expect(HAIR_TONE).toHaveLength(15);
    expect(FACIAL.length).toBeGreaterThanOrEqual(8);
    for (const f of ['none', 'goatee', 'full', 'long', 'mustache']) expect(FACIAL).toContain(f);
    expect(new Set(HAIR).size).toBe(18);
  });

  it('uses V2’s hair hexes and the 10 Monk skin bases', () => {
    expect(HAIR_TONES).toEqual({
      black: '#1d1612',
      'dark-brown': '#3b2a20',
      brown: '#6a4a32',
      'light-brown': '#8f6a48',
      auburn: '#8a3f22',
      ginger: '#b5562a',
      blond: '#d6b36a',
      platinum: '#ece6d2',
      grey: '#9b9b9b',
      red: '#c8343c',
      blue: '#3a6fd8',
      green: '#3fae5a',
      pink: '#e070b0',
      purple: '#7a4ac8',
    });
    expect(SKIN_TONES).toEqual(['#f6ede4', '#f3e7db', '#f7ead0', '#eadaba', '#d7bd96', '#a07e56', '#825c43', '#604134', '#3a312a', '#292420']);
  });

  it('raises skin saturation 8–15% in game and ramps each tone (shadow < base < light)', () => {
    const sat = (h: string) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
      const mx = Math.max(r, g, b),
        mn = Math.min(r, g, b),
        l = (mx + mn) / 2;
      return mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn);
    };
    const lum = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    // 12% in floating point; the darkest tones' 8-bit hexes round it a little either way
    const ks = SKIN_TONES.map((base, i) => sat(skinTone(i)) / sat(base));
    const mean = ks.reduce((a, b) => a + b, 0) / ks.length;
    expect(mean).toBeGreaterThanOrEqual(1.08);
    expect(mean).toBeLessThanOrEqual(1.15);
    for (const k of ks) {
      expect(k).toBeGreaterThan(1.05);
      expect(k).toBeLessThan(1.25);
    }
    SKIN_TONES.forEach((_base, i) => {
      const [shadow, mid, light, outline, rim] = skinRamp(i);
      expect(lum(shadow)).toBeLessThan(lum(mid));
      expect(lum(mid)).toBeLessThan(lum(light));
      expect(outline).toBe('#14121c');
      expect(rim).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
});

describe('guardrails', () => {
  it('whitelists keys: race, ethnicity, nationality and the like are rejected', () => {
    for (const bad of ['race', 'ethnicity', 'nation', 'nationality', 'country', 'birthplace', 'origin', 'tattoo', 'logo'])
      expect(() => checkKeys({ hair: 'short', [bad]: 'x' })).toThrow(/no field/);
    expect(APPEARANCE_KEYS.some((k) => /race|ethnic|nation|country|birth/i.test(k))).toBe(false);
    expect(() => encodeFields({ hair: 'short', nation: 'x' } as never)).toThrow();
    expect(() => checkKeys({ hair: 'short', hairTone: 'black', skin: 3 })).not.toThrow();
  });

  it('gives every uncurated player the neutral skin, unchanged from before', () => {
    expect(NEUTRAL_SKIN).toBe('#a8714f');
    expect(NEUTRAL_SKIN).toBe(DEFAULT_SKIN);
    for (const sport of SPORTS)
      for (const pid of pids(200, sport + 'u')) {
        const a = appearanceFor(sport, pid, 2005);
        expect(a.skin).toBeUndefined();
        expect(a.src).toBe('default');
      }
    const look = matchLook('nba', { pid: 'nobody00', season: 2001 }, { jersey: '#123456', trim: '#fff', shorts: '#123456', socks: '#fff', shoes: '#000' }, { num: 3, ht: 78, wt: 210 });
    expect(look.skin).toBe(NEUTRAL_SKIN);
  });
});

describe('seeded defaults', () => {
  it('are the same for the same player every time (a snapshot of 30)', () => {
    const codes = pids(30, 's').map((pid, i) => encodeFields(defaultAppearance(SPORTS[i % 3], pid, 1975 + i * 1.6, ['PG', 'QB', 'ST'][i % 3])));
    expect(codes).toEqual(pids(30, 's').map((pid, i) => encodeFields(defaultAppearance(SPORTS[i % 3], pid, 1975 + i * 1.6, ['PG', 'QB', 'ST'][i % 3]))));
    expect(codes.join(' ')).toMatchSnapshot();
  });

  it.each(SPORTS.flatMap((s) => ERA_BUCKETS[s].map((e) => [s, e] as const)))('%s %i: diverse, no style above 40%, nothing signature', (sport, era) => {
    const n = 2000;
    const counts = new Map<string, number>();
    for (const pid of pids(n, sport + era)) {
      const a = defaultAppearance(sport, pid, era + 4, ['PG', 'QB', 'ST'][SPORTS.indexOf(sport)]);
      counts.set(a.hair, (counts.get(a.hair) ?? 0) + 1);
      expect(a.eyes).not.toBe('goggles');
      expect(a.head).toBe('none');
      expect(NATURAL_TONES).toContain(a.hairTone);
      expect(['blond', 'platinum', 'red', 'blue', 'green', 'pink', 'purple', 'team']).not.toContain(a.hairTone);
      expect(a.hand).toBe('R');
      expect(['band-bound', 'ponytail', 'bun', 'mohawk']).not.toContain(a.hair);
    }
    expect(Math.max(...counts.values()) / n).toBeLessThanOrEqual(0.4);
    expect(counts.size).toBeGreaterThanOrEqual(5);
  });

  it('follows the gear priors within ±3 points', () => {
    const share = (sport: Sport, season: number, pos: string, test: (a: ReturnType<typeof defaultAppearance>) => boolean) => {
      const list = pids(2000, `${sport}${pos}${season}g`).map((pid) => defaultAppearance(sport, pid, season, pos));
      return list.filter(test).length / list.length;
    };
    const near = (x: number, p: number) => expect(Math.abs(x - p)).toBeLessThanOrEqual(0.03);
    near(share('nba', 2015, 'SG', (a) => a.armR === 'sleeve'), 0.12);
    near(share('nba', 1995, 'SG', (a) => a.armR === 'sleeve'), 0);
    near(share('nba', 2015, 'C', (a) => a.legL === 'kneesleeve' || a.legR === 'kneesleeve'), 0.1);
    near(share('nba', 1975, 'SF', (a) => a.socks === 'high'), 0.5);
    near(share('nba', 2015, 'SF', (a) => a.socks === 'high'), 0.15);
    near(share('nfl', 2015, 'WR', (a) => a.eyes === 'visor-clear'), 0.25);
    near(share('nfl', 2015, 'OT', (a) => a.eyes === 'visor-clear'), 0);
    near(share('nfl', 2015, 'RB', (a) => !!a.towel), 0.3);
    near(share('nfl', 2015, 'WR', (a) => !!a.gloves), 0.9);
    near(share('nfl', 2015, 'OG', (a) => a.armL === 'long' && a.armR === 'long'), 0.15);
    near(share('nfl', 2015, 'LB', (a) => a.helmetHair !== 'none'), 0.13);
    near(share('soccer', 2018, 'CM', (a) => a.armL === 'long'), 0.15);
    near(share('soccer', 2018, 'CM', (a) => a.socks === 'low'), 0.08);
    near(share('soccer', 2018, 'GK', (a) => !!a.gloves), 1);
    near(share('nba', 1985, 'PG', (a) => a.shoe === 'white'), 0.8);
    near(share('nba', 2015, 'PG', (a) => a.shoe === 'neon'), 0.15);
    near(share('nba', 2015, 'PG', (a) => a.hairTone === 'black' || a.hairTone === 'dark-brown'), 0.85);
    near(share('soccer', 2018, 'W', (a) => a.facial === 'none'), 0.6);
  });
});

describe('level of detail', () => {
  it('collapses hair to four silhouettes below 24 art px', () => {
    for (const h of HAIR) {
      expect(lodHair(h, 24)).toBe(h);
      expect(['none', 'cap', 'tall', 'long']).toContain(lodHair(h, 23));
    }
    expect(lodHair('bald', 20)).toBe('none');
    expect(lodHair('hightop', 20)).toBe('tall');
    expect(lodHair('ponytail', 16)).toBe('long');
    expect(new Set(HAIR.map((h) => lodHair(h, 16))).size).toBe(4);
  });

  it('drops facial hair below 20 art px except a full beard', () => {
    for (const f of FACIAL) expect(lodFacial(f, 20)).toBe(f);
    expect(lodFacial('full', 19)).toBe('full');
    expect(lodFacial('long', 19)).toBe('full');
    for (const f of FACIAL.filter((x) => x !== 'full' && x !== 'long')) expect(lodFacial(f, 19)).toBe('none');
  });
});

describe('the compact code', () => {
  it('round-trips every field and era', () => {
    const base = { skin: 9, hair: 'afro-big', hairTone: 'team', facial: 'chinstrap', head: 'wrap', headC: 'gold', eyes: 'visor-tint', armL: 'tape', armR: 'shooter', armC: 'neon', legL: 'tights', legR: 'calf', legC: 'tone', socks: 'over-knee', shoe: 'team2', gloves: 'black', towel: true, mouthguard: false, neckRoll: true, helmetHair: 'curly', build: 'heavy', hand: 'L', foot: 'B' } as const;
    const eras = [
      { from: 1990, to: 1995, hair: 'bald' as const, towel: false },
      { from: 1996, to: 1999, skin: 0, eyes: 'goggles' as const },
    ];
    const s = encodeAppearance(base, eras);
    expect(decodeAppearance(s)).toEqual({ base, eras });
    expect(encodeFields({})).toBe('');
    expect(encodeFields({ hair: 'short' })).toBe('.2');
    expect(ACCENT.length).toBeLessThanOrEqual(36);
  });
});

describe('ids', () => {
  it('reads every id form', () => {
    // a draft cell without his seasons, of a player the data has no cell spans for: the middle of the
    // decade, and no span (a whole-decade span would let no era ever cover him)
    expect(refOf('nba', 'CHI-1990:nobody99')).toEqual({ pid: 'nobody99', season: 1995 });
    expect(refOf('nba', 'CHI-1990:jordami01', { from: 1991, to: 1993 })).toEqual({ pid: 'jordami01', season: 1992, span: [1991, 1993] });
    expect(refOf('nfl', 'ARI-1970:00-0000335')).toMatchObject({ pid: '00-0000335' });
    expect(refOf('nba', 'nba:season:1996:jordami01:CHI')).toEqual({ pid: 'jordami01', season: 1996 });
    expect(refOf('nba', 'nba:goat:1989:jordami01:CHI')).toEqual({ pid: 'jordami01', season: 1989 });
    expect(refOf('nfl', 'nfl:legend:2007:00-0019596:NE')).toEqual({ pid: '00-0019596', season: 2007 });
    expect(refOf('nba', 'nba:standout:2026-W44F:2024:curryst01:GSW')).toEqual({ pid: 'curryst01', season: 2024 });
    expect(refOf('nba', 'nba:live:hot.f:2016:curryst01:GSW')).toEqual({ pid: 'curryst01', season: 2016 });
    expect(refOf('nba', 'nba:landmark:2016:curryst01:GSW')).toEqual({ pid: 'curryst01', season: 2016 });
    expect(refOf('nba', 'holo~nba:season:2016:curryst01:GSW')).toEqual({ pid: 'curryst01', season: 2016 });
    expect(refOf('nba', 'evo~e1+e2~nba:season:2016:curryst01:GSW')).toEqual({ pid: 'curryst01', season: 2016 });
    expect(refOf('nba', 'evo~e1~holo~nba:season:2016:curryst01:GSW')).toEqual({ pid: 'curryst01', season: 2016 });
    expect(refOf('soccer', '108830:2019:BAR')).toEqual({ pid: '108830', season: 2019 });
    expect(refOf('soccer', 'soccer:season:2015:28003:BAR')).toEqual({ pid: '28003', season: 2015 });
    for (const stand of ['reserve:PG', 'depth:WR:abc', 'squad-3']) expect(refOf('nba', stand)).toBeNull();
    expect(refOf('soccer', 'squad-3')).toBeNull();
    expect(refOf('nfl', 'depth:WR:seed')).toBeNull();
  });
});

describe('curated looks and eras', () => {
  beforeAll(() => {
    useAppearanceFile(NBA as AppearanceFile);
    useAppearanceFile(NFL as AppearanceFile);
  });

  it('resolves a draft cell id without his seasons from the built cell spans (the match passes no ctx)', () => {
    const look = (sport: 'nba' | 'nfl', id: string) => {
      const r = refOf(sport, id)!;
      return appearanceFor(sport, r.pid, r.season, { span: r.span });
    };
    expect(refOf('nba', 'CHI-1980:jordami01')).toEqual({ pid: 'jordami01', season: 1987, span: [1985, 1989] });
    // Jordan's hair in his first Chicago years, bald from 1990
    expect(look('nba', 'CHI-1980:jordami01')).toMatchObject({ hair: 'short', hairTone: 'black' });
    expect(look('nba', 'CHI-1990:jordami01').hair).toBe('bald');
    // Shaq's Orlando fade, bald with the Lakers
    expect(look('nba', 'ORL-1990:onealsh01')).toMatchObject({ hair: 'fade', facial: 'none' });
    expect(look('nba', 'LAL-1990:onealsh01').hair).toBe('bald');
    // Iverson short-haired, no headband or sleeve in his first Philadelphia seasons; cornrows later
    expect(look('nba', 'PHI-1990:iversal01')).toMatchObject({ hair: 'short', head: 'none', armR: 'none' });
    expect(look('nba', 'PHI-2000:iversal01')).toMatchObject({ hair: 'cornrows', head: 'band' });
    // Rodman from the id alone
    expect(look('nba', 'SAS-1990:rodmade01').hairTone).toBe('platinum');
    expect(look('nba', 'CHI-1990:rodmade01').hairTone).toBe('red');
    expect(look('nba', 'DET-1990:rodmade01').hairTone).toBe('black');
    // the caller's own seasons still win
    expect(refOf('nba', 'CHI-1980:jordami01', { from: 1985, to: 1986 })).toEqual({ pid: 'jordami01', season: 1986, span: [1985, 1986] });
  });

  it('resolves Rodman per draft cell: natural in Detroit, dyed in San Antonio and Chicago', () => {
    const tone = (id: string, from: number, to: number) => {
      const r = refOf('nba', id, { from, to })!;
      return appearanceFor('nba', r.pid, r.season, { span: r.span }).hairTone;
    };
    expect(tone('DET-1980:rodmade01', 1987, 1989)).toBe('black');
    expect(tone('DET-1990:rodmade01', 1990, 1993)).toBe('black');
    expect(tone('SAS-1990:rodmade01', 1994, 1995)).toBe('platinum');
    expect(tone('CHI-1990:rodmade01', 1996, 1998)).toBe('red');
    expect(tone('LAL-1990:rodmade01', 1999, 1999)).toBe('black');
    // a cell whose span straddles an era keeps the base look
    expect(tone('SAS-1990:rodmade01', 1993, 1995)).toBe('black');
  });

  it('draws the owner-named looks from the record', () => {
    expect(appearanceFor('nba', 'onealsh01', 2000).hair).toBe('bald');
    expect(appearanceFor('nba', 'onealsh01', 1994).hair).not.toBe('bald');
    const ai = appearanceFor('nba', 'iversal01', 2001);
    expect([ai.hair, ai.head, ai.armR]).toEqual(['cornrows', 'band', 'shooter']);
    expect(appearanceFor('nba', 'abdulka01', 1985).eyes).toBe('goggles');
    expect(appearanceFor('nfl', '00-0019596', 2007).src).toBe('curated');
  });

  it('shows a curated hair out of the back of a helmet unless the record says otherwise', () => {
    const f = (players: Record<string, string>) => ({ ...(NFL as AppearanceFile), players });
    useAppearanceFile(f({ locs: encodeAppearance({ hair: 'locs-long' }), bald: encodeAppearance({ hair: 'bald' }), set: encodeAppearance({ hair: 'flow', helmetHair: 'none' }) }));
    expect(appearanceFor('nfl', 'locs', 2015).helmetHair).toBe('locs');
    expect(appearanceFor('nfl', 'bald', 2015).helmetHair).toBe('none');
    expect(appearanceFor('nfl', 'set', 2015).helmetHair).toBe('none');
    useAppearanceFile(NFL as AppearanceFile);
  });

  it('turns a record into the legacy look today’s raster draws', () => {
    const kit = { jersey: '#552583', trim: '#fdb927', shorts: '#552583', socks: '#fff', shoes: '#000' };
    const shaq = matchLook('nba', refOf('nba', 'nba:legend:2000:onealsh01:LAL'), kit, { num: 34, ht: 85, wt: 325 });
    expect(shaq.hair).toBe(3);
    expect(shaq.skin).not.toBe(NEUTRAL_SKIN);
    expect(shaq.app.src).toBe('curated');
    const ai = matchLook('nba', refOf('nba', 'nba:season:2001:iversal01:PHI'), kit, { num: 3, ht: 72, wt: 165, cosmetic: { shoes: '#e8b83a', ring: '#f6b93b' } });
    expect(ai.hair).toBe(4);
    expect(ai.beard).toBe(true);
    expect(ai.shoes).toBe('#e8b83a');
    expect(ai.ring).toBe('#f6b93b');
    const line = { id: 'nba:season:2001:iversal01:PHI', sport: 'nba', kind: 'season', pid: 'iversal01', name: 'Allen Iverson', season: 2001, fr: 'PHI', abbr: 'PHI', teamName: '76ers', c1: '#006bb6', c2: '#ed174c', pos: ['PG'], ht: 72, wt: 165, num: 3 } as unknown as CardLine;
    const card = cardLook(line);
    expect([card.hair, card.skin, card.ht, card.wt]).toEqual([ai.hair, ai.skin, 72, 165]);
    expect(card.app).toEqual(ai.app);
  });
});
