// Codex (OpenAI): observations from completed engine state, never extra rolls or changes to ratings.
import type { Possession } from './hoops2/types';
import type { Play } from './football2/types';
import type { Attack } from './soccer2/types';
export interface PlayFeedback {
  title: string;
  result: string;
  facts: { label: string; value: string }[];
  next: string;
}
const LABELS: Record<string, string> = {
  three: 'Three-pointer',
  mid: 'Mid-range',
  close: 'Close shot',
  standdunk: 'Standing dunk',
  contact: 'Contact dunk',
  oop: 'Alley-oop',
  inside: 'Inside Zone',
  outside: 'Outside Zone',
  verts: 'Four Verticals',
  curls: 'Curl Flats',
  posts: 'Double Post',
  build: 'Build-up',
  counter: 'Counter-attack',
  wide: 'Wide overload',
  freekick: 'Free kick',
  fk: 'Free kick',
  pen: 'Penalty',
};
const words = (s: string) =>
  LABELS[s] ?? s.replace(/[-:]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export function releaseText(
  milliseconds: number,
  green: boolean,
  clipped = false,
): string {
  if (!Number.isFinite(milliseconds)) return 'Not recorded';
  const n = Math.round(Math.abs(milliseconds));
  if (n === 0) return green ? 'Perfect · on time' : 'On time';
  return (
    (green ? 'Perfect · ' : '') +
    n +
    (clipped && n >= 250 ? '+' : '') +
    ' ms ' +
    (milliseconds < 0 ? 'early' : 'late')
  );
}
export function basketballFeedback(p: Possession): PlayFeedback {
  const e = p.end,
    shot =
      e && !(['make', 'miss', 'block'] as string[]).includes(e.kind)
        ? null
        : p.lastShot;
  const timed =
    !!shot && ['three', 'mid', 'close', 'layup'].includes(shot.kind);
  const next = !shot
    ? e?.kind === 'clock'
      ? 'Use a screen or a quick pass before the shot clock expires.'
      : 'Keep the pass lane clear; move the ball before the double arrives.'
    : !timed
      ? shot.make
        ? 'Keep creating that lane. The finish used the player’s dunk and contact ratings.'
        : 'Create a clearer lane or pass out when the rim defender is set.'
      : shot.contest === 'heavy' || shot.contest === 'smothered'
        ? 'Create space with SCREEN, a pass or STEP BACK before the next shot.'
        : timed && !shot.greened
          ? 'Match the release to the green slice; catch-and-shoot and moving shots have different rhythms.'
          : shot.make
            ? 'Keep finding that look. The timing and space were both there.'
            : 'The timing was good. Even a clean release can miss through a contest; keep creating space.';
  return {
    title: 'Last possession',
    result: e?.text ?? (shot?.make ? 'Basket made' : 'Shot attempt'),
    facts: [
      ...(shot
        ? [
            { label: 'Shot', value: words(shot.kind) },
            {
              label: 'Release',
              value: timed
                ? releaseText(shot.off * 250, shot.greened, true)
                : 'Automatic finish',
            },
            { label: 'Coverage', value: words(shot.contest) + ' contest' },
          ]
        : []),
      {
        label: 'Ball movement',
        value: p.passes + ' ' + (p.passes === 1 ? 'pass' : 'passes'),
      },
    ],
    next,
  };
}
export function footballFeedback(
  p: Play,
  settlement?: { text: string; flag?: { kind: string; by: string } },
): PlayFeedback {
  const e = p.end,
    run = p.call === 'run';
  const gain = e ? Math.round(e.gain) : 0;
  const next = settlement?.flag
    ? 'The flag changed this play. Check the new down and distance before choosing your next call.'
    : e?.kind === 'sack'
      ? 'Get the ball out sooner or use SCRAMBLE before the rush reaches the quarterback.'
      : e?.kind === 'int'
        ? 'Check the defender in the throwing lane, not just the receiver. Touch and lob can clear underneath coverage.'
        : run && p.stamina < 0.25
          ? 'Stamina was low at the whistle. Save BURST for a clear lane; it shares energy with your skill moves.'
          : run && gain < 3
            ? 'Follow the highlighted run lane before cutting upfield. Flip the play to attack the other side.'
            : !run && !e?.caught
              ? 'Lead the receiver into space. Under pressure, choose a shorter throw or move out of the pocket.'
              : gain >= 10
                ? 'Keep exploiting that space. Use a different concept if the next coverage takes it away.'
                : 'Keep the next down manageable; mix runs with quick throws instead of forcing every play deep.';
  return {
    title: 'Last play',
    result: settlement?.flag ? settlement.text : (e?.text ?? 'Play complete'),
    facts: [
      { label: run ? 'Run' : 'Concept', value: words(run ? p.run : p.concept) },
      { label: 'Defense', value: words(p.coverage) + ' coverage' },
      {
        label: settlement?.flag ? 'Gain before flag' : 'Gain',
        value: (gain > 0 ? '+' : '') + gain + ' yd',
      },
      ...(settlement?.flag
        ? [{ label: 'Flag accepted', value: words(settlement.flag.kind) }]
        : []),
      { label: 'Energy at whistle', value: Math.round(p.stamina * 100) + '%' },
    ],
    next,
  };
}
export function soccerFeedback(a: Attack): PlayFeedback {
  const s = a.lastShot,
    e = a.end;
  const next =
    e?.kind === 'O'
      ? 'Release the pass before your runner crosses the last defender, or use a runner starting deeper.'
      : e?.kind === 'T'
        ? 'Move the ball forward earlier. A quick pass can beat a defender without spending sprint energy.'
        : e?.kind === 'B'
          ? 'A defender was close to the strike. Pass across the box or take a touch into space before shooting.'
          : s && !s.greened
            ? 'Aim with the SHOOT thumb while the stick keeps your run; release closer to the green slice.'
            : e?.kind === 'G'
              ? 'Keep creating that angle. Watch the keeper before repeating the same finish.'
              : s
                ? 'The release was well timed. Find the side the keeper leaves open rather than shooting straight at him.'
                : 'Use PASS to move away from pressure, or THRU for a runner moving into the space behind the defense.';
  return {
    title: 'Last attack',
    result: e?.text ?? 'Attack complete',
    facts: [
      { label: 'Attack', value: words(a.scenario) },
      ...(s
        ? [
            { label: 'Shot', value: words(s.kind) },
            { label: 'Release', value: releaseText(s.off * 1000, s.greened) },
            { label: 'Aim', value: s.assisted ? 'Assisted' : 'Manual' },
          ]
        : []),
      { label: 'Sprint energy', value: Math.round(a.stamina * 100) + '%' },
    ],
    next,
  };
}
