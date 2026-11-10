// How long the football screen takes between and around plays, in seconds of real time. Football2
// waits these out, and the calibration kit's wall-clock model (sim-kit.ts) adds them up, so the
// game's measured length and the model can never drift apart. Nothing here touches a play's result.
import { HITSTOP } from '../juice';

/** From the whistle to the next play-call tray: an ordinary play, a drive that ended, a score. */
export const WHISTLE_TO_TRAY = { play: 1.35, drive: 1.9, score: 2.3 } as const;

/** Before a replay starts (after the whistle), for an ordinary highlight and for a score. */
export const REPLAY_LEAD = { play: 1.1, score: 1.5 } as const;
/** From the end of a replay to the next play-call tray. */
export const REPLAY_TAIL = 0.25;

/** A field goal: the needle stops, the ball reaches the posts and the result is in, then the tray. */
export const KICK_RESULT = 1.0;
export const KICK_TO_TRAY = 1.7;
/** A punt, from the button to the next tray. */
export const PUNT_TO_TRAY = 1.3;

/** Slow motion after a big hit or a truck (seconds of real time it lasts, and how fast play runs). */
export const SLOWMO = { bighit: 0.75, truck: 0.45 } as const;
export const SLOWMO_RATE = 0.4;
/** The hit-stop a truck holds the play still for (seconds). */
export const TRUCK_HIT_STOP = HITSTOP.truck / 1000;

/** A touchdown this long gets the longer replay, starting this many seconds of play before it. */
export const LONG_TD_REPLAY = { yards: 25, before: 2.4 } as const;

/** The autopilot's pace in the browser (tests and the lab): calling a play, and stopping the kick needle. */
export const AUTO_PICK = 0.45;
export const AUTO_KICK_AIM = 0.7;

/** A person's pace, for the session-length model: picking a play, stopping the needle, finding the stick. */
export const HUMAN_PICK = 2.5;
export const HUMAN_KICK_AIM = 1.2;
export const HUMAN_STICK_REACTION = 0.35;
