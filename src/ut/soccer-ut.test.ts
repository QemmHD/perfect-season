// Claude 2026-11-01: Ultimate Team soccer (PS_SPORT=soccer): the lazily loaded soccer cards, their
// overall and six-stat faces, formations, chemistry by club and league, packs and the Store, Squad
// Battles, Standouts, the match's elevens. Skipped in the other sports.
import { SOCCER } from '../engine/sport';
import { cardSquad, agreedShootout, draftFace } from '../game/soccer2/arcade';
import { elevenOf } from '../game/soccer2/ratings';
import { ladderFor } from './battles';
import { cardStatLine } from './card-stats';
import { getPool, type Pool } from './pool';
import { openPack, packDefs, positionChoices, quickSellValue, storeOrder } from './packs';
import { rateCard } from './rate';
import { autoBuild, chemistry, FORMATIONS, linkScore, positionMix, rateSquad, refitSquad, setSoccerFormation, slotsFor, SOCCER_FORMATIONS, startersComplete } from './squad';
import { standoutProgram } from './standouts';
import { pitchCardsOf, squadFromWire, squadToWire, teamsOf, type SquadCards } from './teams';
import { eventsFor } from './events';
import { schedule } from './calendar';
import { sbcsFor } from './sbc';
import type { RatedCard } from './types';

const LOAD_MS = 120_000;

describe.runIf(SOCCER)('Ultimate Team soccer', () => {
  let pool: Pool;
  beforeAll(async () => {
    pool = await getPool();
  }, LOAD_MS);
  const card = (name: string, season: number, kind = 'season') => [...pool.base.values()].find((rc) => rc.line.name === name && rc.line.season === season && rc.line.kind === kind)!;

  it('rates every card from its own overall and face, FC-style tiers', () => {
    expect(pool.sport).toBe('soccer');
    expect(pool.lines.length).toBeGreaterThan(29000);
    const tiers: Record<string, number> = {};
    for (const rc of pool.base.values()) {
      tiers[rc.tier] = (tiers[rc.tier] ?? 0) + 1;
      expect(rc.face).toHaveLength(6);
      if (rc.line.kind === 'season') {
        expect(rc.ovr).toBe(rc.line.fixedOvr);
        expect(rc.tier).toBe(rc.ovr >= 75 ? 'gold' : rc.ovr >= 65 ? 'silver' : 'bronze');
      }
      for (const [, , v] of rc.face!) expect(v).toBeGreaterThanOrEqual(1);
    }
    expect(tiers.spotlight ?? 0).toBe(0);
    expect(tiers.goat ?? 0).toBe(0);
    expect(tiers.legend).toBeGreaterThan(100);
    const messi = card('Lionel Messi', 2015);
    expect(messi.ovr).toBe(93);
    expect(messi.face!.map(([c]) => c)).toEqual(['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']);
    expect(messi.line.league).toBe('LaLiga');
    const neuer = card('Manuel Neuer', 2014);
    expect(neuer.face!.map(([c]) => c)).toEqual(['DIV', 'HAN', 'KIC', 'REF', 'SPD', 'POS']);
    // levels lift the face and, at 3 and 5, the overall
    const l5 = rateCard(messi.line, 5);
    expect(l5.ovr).toBe(messi.ovr + 2);
    expect(l5.attrs.DRI).toBe(Math.min(99, messi.attrs.DRI + 4));
    // a promo is its own edition, with its own overall
    const promo = [...pool.base.values()].find((rc) => rc.line.kind === 'promo')!;
    expect(promo.tier).toBe('promo');
    expect(promo.ovr).toBe(promo.line.fixedOvr);
    expect(cardStatLine(messi.line).map(([k]) => k)).toContain('GOALS');
  });

  it('four formations of eleven; a squad keeps its players when the formation changes', () => {
    expect(FORMATIONS).toEqual(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2']);
    for (const f of FORMATIONS) {
      expect(SOCCER_FORMATIONS[f]).toHaveLength(11);
      expect(SOCCER_FORMATIONS[f].filter((s) => s.pos === 'GK')).toHaveLength(1);
      expect(new Set(SOCCER_FORMATIONS[f].map((s) => s.id)).size).toBe(11);
    }
    setSoccerFormation('4-4-2');
    expect(slotsFor('soccer').map((s) => s.id)).toContain('LST');
    setSoccerFormation('nonsense');
    expect(slotsFor('soccer').map((s) => s.id)).toContain('CDM');
    const club = [...pool.base.values()].filter((rc) => rc.line.kind === 'season' && rc.line.fr === 'BAR' && rc.line.season >= 2014 && rc.line.season <= 2016).map((rc, i) => ({ uid: 'c' + i, rc }));
    const sq = autoBuild('soccer', club);
    expect(Object.keys(sq)).toHaveLength(11);
    const lineup = Object.fromEntries(Object.entries(sq).map(([s, u]) => [s, club.find((c) => c.uid === u)!.rc]));
    expect(startersComplete('soccer', lineup)).toBe(true);
    const r = rateSquad('soccer', lineup);
    expect(r.chem).toBeGreaterThan(80);
    const posOf = (uid: string) => club.find((c) => c.uid === uid)?.rc.line.pos;
    const moved = refitSquad(sq, '4-2-3-1', posOf);
    expect(moved.GK).toBe(sq.GK);
    expect(moved.LCB).toBe(sq.LCB);
    for (const [slot, uid] of Object.entries(moved)) expect(posOf(uid)).toContain(SOCCER_FORMATIONS['4-2-3-1'].find((s) => s.id === slot)!.pos);
    expect(positionMix('soccer').GK).toBe(1);
  });

  it('chemistry links clubmates fully, a league halfway', () => {
    const a = card('Lionel Messi', 2015);
    const b = card('Neymar', 2015);
    const c = [...pool.base.values()].find((rc) => rc.line.kind === 'season' && rc.line.fr === 'RMA' && rc.line.season === 2015)!;
    const d = [...pool.base.values()].find((rc) => rc.line.kind === 'season' && rc.line.league === 'Premier League' && rc.line.season === 2010 + 5)!;
    expect(linkScore(a, b)).toBeGreaterThanOrEqual(6);
    expect(linkScore(a, c)).toBe(3);
    expect(linkScore(a, d)).toBe(1);
    expect(chemistry('soccer', {}).chem).toBe(0);
  });

  it('packs fill a soccer squad, the Store has no Spotlight, quick-sell follows the tiers', () => {
    const starter = openPack(pool, 'starter', 'seed');
    expect(starter.length).toBe(15);
    expect(starter.some((c) => c.line.pos[0] === 'GK')).toBe(true);
    expect(storeOrder('soccer')).not.toContain('spotlight');
    expect(positionChoices('soccer').map((c) => c.key)).toEqual(['GK', 'DEF', 'MID', 'ATT']);
    const defs = packDefs('soccer');
    for (const k of ['bronze', 'silver', 'gold', 'premium'] as const) {
      const p = openPack(pool, k, 'p:' + k);
      expect(p.length).toBe(defs[k].slots.length);
      expect(new Set(p.map((c) => c.line.id)).size).toBe(p.length);
    }
    const gk = openPack(pool, 'position:GK', 'g');
    expect(gk.every((c) => c.line.pos.includes('GK'))).toBe(true);
    const value = (rc: RatedCard) => quickSellValue(rc);
    expect(value(card('Lionel Messi', 2015))).toBeGreaterThan(value(starter.find((c) => c.tier === 'bronze')!));
  });

  it('Squad Battles, Standouts and SBCs work on soccer cards; no Live Calendar or Legends Events', () => {
    expect(schedule()).toBeNull();
    expect(eventsFor(pool)).toEqual([]);
    const ladder = ladderFor(pool, '2026-W44', 0, 'pro');
    expect(ladder).toHaveLength(8);
    for (const r of ladder) expect(Object.keys(squadFromWire(pool, r.squad))).toHaveLength(11);
    const so = standoutProgram(pool, '2026-W44');
    expect(so.cards.length).toBe(11);
    expect(so.cards.every((c) => c.tier === 'standout' && c.line.id.startsWith('soccer:standout:'))).toBe(true);
    expect(pool.byId.get(so.cards[0].line.id)).toBeTruthy();
    expect(sbcsFor(pool, '2026-11-01').length).toBeGreaterThan(0);
  });

  it('a squad on the wire and in the match: the same eleven on both phones', () => {
    const club = [...pool.base.values()].filter((rc) => rc.line.kind === 'season' && rc.line.fr === 'LIV' && rc.line.season === 2019).map((rc, i) => ({ uid: 'l' + i, rc }));
    setSoccerFormation('4-3-3');
    const squad = autoBuild('soccer', club);
    const sq: SquadCards = Object.fromEntries(Object.entries(squad).map(([s, u]) => [s, { line: club.find((c) => c.uid === u)!.rc.line, level: 1 }]));
    // the other phone is in another formation: any formation's slot reads
    setSoccerFormation('3-5-2');
    const back = squadFromWire(pool, squadToWire(sq));
    expect(Object.keys(back).sort()).toEqual(Object.keys(sq).sort());
    setSoccerFormation('4-3-3');
    const t = teamsOf('soccer', sq, sq, 'seed');
    expect(t.soccerCards!.us).toHaveLength(11);
    const eleven = cardSquad(pitchCardsOf(sq), { name: 'L', abbr: 'LIV', c1: '#c00', c2: '#fff' });
    expect(elevenOf(eleven)).toHaveLength(11);
    expect(eleven.gk.keeper).toBe(true);
    // both phones agree on a level match's shootout (each sees it from its own side)
    const other = cardSquad(pitchCardsOf(sq), { name: 'L2', abbr: 'LIV', c1: '#c00', c2: '#fff' });
    const host = agreedShootout(eleven, other, 'm1', true);
    const guest = agreedShootout(other, eleven, 'm1', false);
    expect(guest.scored).toEqual(host.scored);
    expect([guest.us, guest.them]).toEqual([host.them, host.us]);
    expect(guest.winner).toBe(host.winner === 'us' ? 'them' : 'us');
    expect(draftFace('ST', 90).every((v) => v >= 25 && v <= 99)).toBe(true);
  });
}, LOAD_MS);
