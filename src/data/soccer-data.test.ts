// Soccer data (P1, not wired into the app yet): src/data/soccer.json (scripts/build_soccer_data.py)
// and src/data/cards-soccer.json (scripts/build_soccer_cards.py). Nothing here reads SPORT, so the
// test is the same under either PS_SPORT; see docs/SOCCER-DATA.md for the model it checks.
/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
// as text, so neither tsc nor the bundler types or bundles the large files as modules
import cardsText from './cards-soccer.json?raw';
import draftText from './soccer.json?raw';

const FILES: Record<string, string> = { 'cards-soccer.json': cardsText, 'soccer.json': draftText };
const read = (name: string) => JSON.parse(FILES[name]);
const POSITIONS = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'];
const HEX = /^#[0-9A-F]{6}$/i;
const tier = (ovr: number) => (ovr >= 75 ? 'gold' : ovr >= 65 ? 'silver' : 'bronze');

interface SoccerCards {
  sport: string;
  n: number;
  groups: [string, string[], string[]][];
  faceKeys: Record<string, string[]>;
  players: [string, string, number | null, null][];
  teams: [string, string, string, string, string][];
  honors: string[];
  cols: Record<string, unknown[]> & { player: number[]; season: number[]; team: number[]; pos: string[]; group: number[]; ovr: number[]; face: number[][]; est: number[]; honors: number[][] };
  stats: Record<string, Record<string, (number | null)[]>>;
  rk: Record<string, Record<string, (number | null)[]>>;
  promos: [number, number, string, number, number[]][];
  legends: [number, number, string, number, number[]][];
}

interface Line {
  id: string;
  name: string;
  pid: string;
  fr: string;
  season: number;
  pos: string[];
  ovr: number;
  face: Record<string, number>;
  est: boolean;
  honors: string[];
  stats: Record<string, number | null>;
  lg: number | null;
}

const cards = read('cards-soccer.json') as SoccerCards;
const lines: Line[] = (() => {
  const seen: Record<string, number> = {};
  const out: Line[] = [];
  for (let i = 0; i < cards.n; i++) {
    const [grp, statKeys] = cards.groups[cards.cols.group[i]];
    const j = (seen[grp] = (seen[grp] ?? -1) + 1);
    const [pid, name] = cards.players[cards.cols.player[i]];
    const fr = cards.teams[cards.cols.team[i]][0];
    const keys = cards.faceKeys[grp];
    const stats: Record<string, number | null> = {};
    for (const k of statKeys) stats[k] = cards.stats[grp][k][j];
    out.push({
      id: `soccer:season:${cards.cols.season[i]}:${pid}:${fr}`,
      name,
      pid,
      fr,
      season: cards.cols.season[i],
      pos: cards.cols.pos[i].split('/'),
      ovr: cards.cols.ovr[i],
      face: Object.fromEntries(keys.map((k, x) => [k, cards.cols.face[i][x]])),
      est: cards.cols.est[i] === 1,
      honors: cards.cols.honors[i].map((h) => cards.honors[h]),
      stats,
      lg: cards.cols.lg[i] as number | null,
    });
  }
  return out;
})();
const seasons = lines.filter((l) => !l.est);

function line(name: string, season: number, fr: string): Line {
  const found = seasons.filter((l) => l.name === name && l.season === season && l.fr === fr);
  expect(found, `${name} ${season} ${fr}`).toHaveLength(1);
  return found[0];
}

describe('soccer cards file', () => {
  it('has one value per line in every column, stat and rank', () => {
    expect(cards.sport).toBe('soccer');
    expect(cards.n).toBeGreaterThan(25000);
    for (const [k, col] of Object.entries(cards.cols)) expect(col.length, k).toBe(cards.n);
    const perGroup = cards.groups.map((_, g) => cards.cols.group.filter((x) => x === g).length);
    cards.groups.forEach(([grp, statKeys, rkKeys], g) => {
      for (const k of statKeys) expect(cards.stats[grp][k].length, `${grp} ${k}`).toBe(perGroup[g]);
      for (const k of rkKeys) expect(cards.rk[grp][k].length, `${grp} rk ${k}`).toBe(perGroup[g]);
    });
  });

  it('ids are unique, fields well formed, ratings in range', () => {
    const ids = new Set(lines.map((l) => l.id));
    expect(ids.size).toBe(lines.length);
    const bad: string[] = [];
    for (const l of lines) {
      if (!/^[A-Za-z0-9._-]+$/.test(l.pid) || !l.name) bad.push(l.id + ' pid/name');
      if (!l.pos.length || !l.pos.every((p) => POSITIONS.includes(p))) bad.push(l.id + ' pos ' + l.pos.join('/'));
      if (!l.est && (l.season < 2013 || l.season > 2026)) bad.push(l.id + ' season');
      if (!l.est && (l.ovr < 45 || l.ovr > 93)) bad.push(l.id + ' ovr ' + l.ovr);
      if (Object.keys(l.face).length !== 6 || !Object.values(l.face).every((v) => Number.isInteger(v) && v >= 25 && v <= 99)) bad.push(l.id + ' face');
      if (l.pos[0] === 'GK' ? !('DIV' in l.face) : !('PAC' in l.face)) bad.push(l.id + ' face keys');
    }
    for (const [fr, abbr, name, c1, c2] of cards.teams) if (!fr || !abbr || !name || !HEX.test(c1) || !HEX.test(c2)) bad.push('team ' + fr);
    for (const [g, rk] of Object.entries(cards.rk)) for (const [k, col] of Object.entries(rk)) for (const v of col) if (v !== null && !(v >= 0 && v <= 1000)) bad.push(`rk ${g}.${k} ${v}`);
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it('tiers are spread like a card game: about a fifth bronze, half silver, a quarter gold', () => {
    const share = (t: string) => seasons.filter((l) => tier(l.ovr) === t).length / seasons.length;
    expect(share('bronze')).toBeGreaterThan(0.15);
    expect(share('bronze')).toBeLessThan(0.3);
    expect(share('gold')).toBeGreaterThan(0.2);
    expect(share('gold')).toBeLessThan(0.35);
    for (const pos of POSITIONS) {
      const xs = seasons.filter((l) => l.pos[0] === pos);
      expect(xs.length, pos).toBeGreaterThan(1000);
      expect(xs.filter((l) => tier(l.ovr) === 'gold').length / xs.length, pos).toBeGreaterThan(0.18);
    }
  });

  it('famous seasons are top gold, with face stats that fit', () => {
    const top: [string, number, string][] = [
      ['Lionel Messi', 2015, 'BAR'], ['Cristiano Ronaldo', 2014, 'RMA'], ['Robert Lewandowski', 2020, 'FCB'], ['Erling Haaland', 2023, 'MCI'],
      ['Mohamed Salah', 2018, 'LIV'], ['Virgil van Dijk', 2019, 'LIV'], ['Kevin De Bruyne', 2020, 'MCI'], ['Luka Modrić', 2018, 'RMA'],
      ['Manuel Neuer', 2014, 'FCB'], ["N'Golo Kanté", 2017, 'CHE'], ['Kylian Mbappé', 2025, 'RMA'],
    ];
    for (const [name, season, fr] of top) {
      const l = line(name, season, fr);
      expect(l.ovr, `${name} ${season}`).toBeGreaterThanOrEqual(88);
      expect(l.ovr, `${name} ${season}`).toBeLessThanOrEqual(93);
    }
    expect(line('Lionel Messi', 2015, 'BAR').face.DRI).toBeGreaterThanOrEqual(95);
    expect(line('Kylian Mbappé', 2025, 'RMA').face.PAC).toBeGreaterThanOrEqual(95);
    expect(line('Virgil van Dijk', 2019, 'LIV').face.DEF).toBeGreaterThanOrEqual(90);
    expect(line('Erling Haaland', 2023, 'MCI').face.SHO).toBeGreaterThanOrEqual(95);
    expect(line('Kevin De Bruyne', 2020, 'MCI').face.PAS).toBeGreaterThanOrEqual(95);
    const keepers2014 = seasons.filter((l) => l.season === 2014 && l.pos[0] === 'GK').sort((a, b) => b.ovr - a.ovr);
    expect(keepers2014[0].name).toBe('Manuel Neuer');
    expect(line('Lionel Messi', 2015, 'BAR').stats.g).toBe(43);
    expect(line('Lionel Messi', 2015, 'BAR').honors).toContain('BDOR');
    expect(line('Mohamed Salah', 2018, 'LIV').honors).toContain('BOOT');
  });

  it('squad players and journeymen are silver or bronze', () => {
    expect(tier(line('Glenn Murray', 2019, 'BHA').ovr)).toBe('silver');
    expect(tier(line('Moussa Sissoko', 2019, 'TOT').ovr)).toBe('silver');
    const nl = seasons.find((l) => l.fr === 'AJA')!.lg;
    const eredivisie = seasons.filter((l) => l.lg === nl);
    expect(eredivisie.filter((l) => tier(l.ovr) === 'gold').length / eredivisie.length).toBeLessThan(0.15);
  });

  it('legends are 88-97, above their season card, with stable ids', () => {
    expect(cards.legends.length).toBeGreaterThanOrEqual(120);
    const byId = new Map(cards.legends.map(([i, boost, label, ovr]) => [`soccer:legend:${lines[i].season}:${lines[i].pid}:${lines[i].fr}`, { l: lines[i], boost, label, ovr }]));
    for (const { l, boost, label, ovr } of byId.values()) {
      expect(label).toBe('LEGEND');
      expect(ovr, l.name).toBeGreaterThanOrEqual(88);
      expect(ovr, l.name).toBeLessThanOrEqual(97);
      expect(boost, l.name).toBeGreaterThanOrEqual(2);
      expect(ovr - boost, l.name).toBe(l.ovr);
    }
    expect(byId.get('soccer:legend:1962:17121:SAN')?.ovr).toBe(97); // Pelé
    expect(byId.get('soccer:legend:2015:28003:BAR')?.ovr).toBe(97); // Messi, on his real 2014-15 season
    expect(byId.get('soccer:legend:1974:72347:FCB')?.l.name).toBe('Franz Beckenbauer');
    // a legend-only line (before 2012-13) is not a season card of its own
    expect(lines.filter((l) => l.est).every((l) => cards.legends.some(([i]) => lines[i] === l))).toBe(true);
  });
});

describe('soccer draft file', () => {
  const data = read('soccer.json') as {
    fields: string[];
    built: number;
    teams: { id: string; fr: string; abbr: string; name: string; era: string; c1: string; c2: string; from: number; to: number; players: (string | number | null)[][] }[];
    playoff: { year: string; team: string; champ: boolean; ucl: boolean; xi: unknown[][]; gp: number; w: number; d: number; l: number }[];
  };
  const f = Object.fromEntries(data.fields.map((k, i) => [k, i]));

  it('has club-decade cells shaped like the NBA/NFL files', () => {
    expect(data.built).toBe(2026);
    expect(data.teams.length).toBeGreaterThan(250);
    const ids = new Set(data.teams.map((t) => t.id));
    expect(ids.size).toBe(data.teams.length);
    const bad: string[] = [];
    for (const t of data.teams) {
      if (t.id !== `${t.fr}-${t.era.slice(0, 4)}` || !HEX.test(t.c1) || !HEX.test(t.c2) || t.from > t.to) bad.push(t.id);
      if (t.players.length < 11) bad.push(t.id + ' size');
      for (const p of t.players) {
        if (p.length !== data.fields.length) bad.push(`${t.id} ${p[0]} length`);
        if (!(p[f.pos] as string).split('/').every((x) => POSITIONS.includes(x))) bad.push(`${t.id} ${p[0]} pos`);
        const ovr = p[f.ovr] as number;
        if (!(ovr >= 45 && ovr <= 97)) bad.push(`${t.id} ${p[0]} ovr ${ovr}`);
        if (p[f.prime] !== null && !ids.has(p[f.prime] as string)) bad.push(`${t.id} ${p[0]} prime`);
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
    for (const era of ['1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s']) expect(data.teams.filter((t) => t.era === era).length, era).toBeGreaterThanOrEqual(30);
  });

  it('famous cells hold their stars', () => {
    const cell = (id: string) => data.teams.find((t) => t.id === id)!;
    const best = (id: string) => cell(id).players.slice(0, 5).map((p) => p[f.name]);
    expect(best('BAR-2010')).toContain('Lionel Messi');
    expect(best('MIL-1990')).toContain('Paolo Maldini');
    expect(best('AJA-1970')).toContain('Johan Cruyff');
    expect(best('LIV-2010')).toContain('Mohamed Salah');
    const messi = cell('BAR-2010').players.find((p) => p[f.name] === 'Lionel Messi')!;
    expect(messi[f.est]).toBe(1); // TM stats from 2012-13, legend credit for 2010-12
    const salah = cell('LIV-2010').players.find((p) => p[f.name] === 'Mohamed Salah')!;
    expect(salah[f.g] as number).toBeGreaterThan(15);
  });

  it('has great teams with a full eleven', () => {
    expect(data.playoff.length).toBeGreaterThan(60);
    for (const p of data.playoff) {
      expect(p.xi.length, p.team + p.year).toBe(11);
      expect(p.w + p.d + p.l).toBe(p.gp);
    }
    expect(data.playoff.some((p) => p.team === 'Manchester City' && p.year === '2017-18' && p.champ)).toBe(true);
  });
});
