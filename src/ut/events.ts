// Implemented by Codex. See docs/CODEX-UPDATE-LOG.md for ownership, connections and validation.
import { buildSquad, type Rung } from './battles';
import { rateSquad } from './squad';
import { type Pool } from './pool';
import type { SquadWire } from './teams';
import { EVENT_IDS } from '../../supabase/functions/card-registry/contract';
import type { UtState } from './state';

export interface ThemedEvent {
  id: string;
  title: string;
  kicker: string;
  blurb: string;
  fr: string;
  decade: number;
  targets: number[];
}
export function eventsFor(pool: Pool): ThemedEvent[] {
  return pool.sport === 'nba'
    ? [
        {
          id: EVENT_IDS[0],
          title: 'Dynasty Nights',
          kicker: 'CHICAGO · THE NINETIES',
          blurb: 'Face the Bulls dynasty, then challenge GOAT Jordan in the finale.',
          fr: 'CHI',
          decade: 1990,
          targets: [75, 86, 96],
        },
        {
          id: EVENT_IDS[1],
          title: 'Beyond the Arc',
          kicker: 'GOLDEN STATE · THE REVOLUTION',
          blurb: 'Break down the Warriors and survive a GOAT Curry finale.',
          fr: 'GSW',
          decade: 2010,
          targets: [78, 88, 97],
        },
        {
          id: EVENT_IDS[2],
          title: 'The Immortals',
          kicker: 'LOS ANGELES · THE LEGACY',
          blurb: 'Three eras of Lakers greatness. GOAT Kobe awaits at the top.',
          fr: 'LAL',
          decade: 2000,
          targets: [82, 92, 99],
        },
      ]
    : [
        {
          id: EVENT_IDS[0],
          title: 'Dynasty Nights',
          kicker: 'NEW ENGLAND · THE DYNASTY',
          blurb: 'Break the Patriots dynasty. Face GOAT Brady in the finale.',
          fr: 'NE',
          decade: 2000,
          targets: [82, 90, 96],
        },
        {
          id: EVENT_IDS[1],
          title: 'Air Raid',
          kicker: 'SAN FRANCISCO · THE OFFENSE',
          blurb: 'Go drive for drive with the 49ers. GOAT Rice is the final test.',
          fr: 'SF',
          decade: 1990,
          targets: [84, 92, 97],
        },
        {
          id: EVENT_IDS[2],
          title: 'The Immortals',
          kicker: 'DALLAS · THE LEGACY',
          blurb: 'Take on the Cowboys legends, then face GOAT Emmitt Smith.',
          fr: 'DAL',
          decade: 1990,
          targets: [86, 94, 98],
        },
      ];
}
export function eventRung(pool: Pool, id: string, node: number): Rung | null {
  const event = eventsFor(pool).find((e) => e.id === id);
  if (!event || !Number.isInteger(node) || node < 0 || node > 2) return null;
  const cards = [...pool.base.values()].filter((rc) => rc.line.fr === event.fr && rc.line.kind === 'season' && Math.floor(rc.line.season / 10) * 10 === event.decade);
  let squad = buildSquad(pool, { fr: event.fr, decade: event.decade, name: event.title, cards }, event.targets[node], 'event:' + pool.sport + ':' + id + ':' + node);
  if (node === 2) {
    const bossName =
      pool.sport === 'nba'
        ? { dynasty: 'Michael Jordan', 'deep-range': 'Stephen Curry', immortals: 'Kobe Bryant' }[id]
        : { dynasty: 'Tom Brady', 'deep-range': 'Jerry Rice', immortals: 'Emmitt Smith' }[id];
    const boss = [...pool.base.values()].find((rc) => rc.tier === 'goat' && rc.line.name === bossName);
    if (boss) {
      const usedSlot = squad.find(([slot]) => boss.line.pos.includes(slot) || slot.startsWith(boss.line.pos[0]));
      if (usedSlot) squad = squad.map((entry) => (entry === usedSlot ? [entry[0], boss.line.id, 1] : entry)) as SquadWire;
    }
  }
  const lineup = Object.fromEntries(squad.map(([slot, cardId]) => [slot, pool.base.get(cardId) ?? null]));
  return {
    i: -2,
    title: event.title + ' · ' + ['Opening Night', 'Rising Stakes', 'GOAT Finale'][node],
    fr: event.fr,
    decade: event.decade,
    target: event.targets[node],
    ovr: rateSquad(pool.sport, lineup).ovr,
    squad,
    skill: [0.55, 0.74, 0.9][node],
    fav: event.fr,
    pack: null,
  };
}
export function settleEvent(ut: UtState, id: string, node: number, at: number): UtState {
  if (!EVENT_IDS.includes(id as (typeof EVENT_IDS)[number]) || !Number.isInteger(node) || node < 0 || node > 2 || (ut.events?.[id] ?? 0) !== node) return ut;
  const kind = node === 0 ? 'silver' : node === 1 ? 'premium' : 'event-spotlight:' + id;
  return { ...ut, events: { ...ut.events, [id]: node + 1 }, packs: [...ut.packs, { id: 'event:' + id + ':' + node, kind, at }] };
}
