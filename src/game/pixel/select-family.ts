// The safe fallback for acts the selection code doesn't know yet (studio overhaul players-2, the
// cross-team action contract in docs/studio-overhaul/players.md section 4.1). Game Design V2 has the
// sport teams adding acts (`pumpfake`, `sack`, `keeper:dive`, `tackle:slide`, ...) while players
// animates them task by task. Until a dedicated animation lands, an unknown act is drawn as the act
// of the same family that the sport already animates, so a body never freezes in a stand pose while
// it moves and never shows an action of the wrong kind. Render only.
//
// Resolution order: the act itself; the part before a ':' (`tackle:slide` -> `tackle`); the part
// after it (`keeper:catch` -> `catch`); the sport's direct aliases (`board` -> `rebound`); then the
// family (shot-like, pass-like, kick-like, contact-like, ground, locomotion) mapped to the sport's act
// for that family. Anything unclassified is locomotion while the body moves and the sport's set pose
// while it stands.

export type Family = 'shot' | 'pass' | 'kick' | 'contact' | 'ground' | 'move' | 'hold';

const FAMILY: Record<string, Family> = {};
const put = (f: Family, names: string) => names.split(' ').forEach((n) => (FAMILY[n] = f));
put('shot', 'shoot shot shooting pumpfake ft freethrow euro volley header layup dunk chip finesse power driven bicycle');
put('pass', 'pass lob onetwo throwin handoff inbound throwaway throw alley pitch toss');
put('kick', 'kick corner goalkick punt freekick penalty clear cross_kick');
put('contact', 'contact charge foul boxout wrap bighit sack swat steal block truck stiff hold ankle bump tackle hit shove poke');
put('ground', 'down fall pile slide dive getup lie sprawl');
put('move', 'run switch contain jockey shield drop backpedal cut trick stepover roulette dragback feint dribble rush jog sprint shuffle chase recover');

/** The family an act belongs to (by its name, or by either part of a `kind:variant` name). */
export function familyOf(act: string): Family {
  if (FAMILY[act]) return FAMILY[act];
  const [base, sub] = act.split(':');
  return FAMILY[base] ?? (sub !== undefined ? FAMILY[sub] : undefined) ?? 'hold';
}

export interface StandIns {
  /** the sport's act drawn for each family */
  family: Record<Family, string>;
  /** acts named in the V2 contract that have a closer twin than their family's */
  alias: Record<string, string>;
}

/** NBA: `board` is a rebound, `switch` a run, `ankle` a fall (the slip), per the action contract. */
export const NBA_STANDINS: StandIns = {
  family: { shot: 'shoot', pass: 'pass', kick: 'pass', contact: 'stumble', ground: 'fall', move: 'run', hold: 'idle' },
  alias: { board: 'rebound', switch: 'run', ankle: 'fall', ft: 'shoot', steal: 'contest', foul: 'contest', boxout: 'defend', charge: 'fall', inbound: 'pass', euro: 'layup', lob: 'pass' },
};

/** NFL: the tackler's acts dive, the QB's drop runs, a handoff is the QB on the move. */
export const NFL_STANDINS: StandIns = {
  family: { shot: 'throw', pass: 'throw', kick: 'kick', contact: 'block', ground: 'down', move: 'run', hold: 'stance' },
  alias: { sack: 'tackle', wrap: 'tackle', bighit: 'tackle', dive: 'tackle', pile: 'down', slide: 'down', snap: 'stance', hold: 'stance', drop: 'run', handoff: 'run', swat: 'block', pick: 'catch' },
};

/** Soccer: every strike is a kick, a keeper's save is a dive, a standing tackle the slide. */
export const SOCCER_STANDINS: StandIns = {
  family: { shot: 'kick', pass: 'kick', kick: 'kick', contact: 'tackle', ground: 'down', move: 'run', hold: 'idle' },
  alias: { parry: 'dive', save: 'dive', rush: 'run', getup: 'down', touch: 'run', contain: 'run', jockey: 'run', shield: 'run', throwin: 'set', corner: 'kick', goalkick: 'kick', volley: 'kick', set: 'set' },
};

/**
 * The known act to draw for `act`. `known` is what the sport's selection handles; `moving` whether
 * the body is covering ground (then a stand pose is never the answer).
 */
export function standIn(act: string, known: ReadonlySet<string>, s: StandIns, moving: boolean): string {
  if (known.has(act)) return act;
  const [base, sub] = act.split(':');
  const direct = [base, sub, s.alias[act], s.alias[base], sub !== undefined ? s.alias[sub] : undefined];
  for (const a of direct) if (a !== undefined && known.has(a) && !(moving && a === s.family.hold)) return a;
  const f = familyOf(act);
  if (f === 'move' || (f === 'hold' && moving)) return s.family.move;
  return s.family[f];
}
