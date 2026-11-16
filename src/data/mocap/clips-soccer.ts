// The motion-capture clips the soccer pitch plays, in one bundle (studio overhaul players-3): a match loads
// them in one or two requests (with the clips every sport shares) instead of one file each, before its
// first frame (pixel/ready.ts). Mirrored clips (`_l`, `_m`) are made from these at load. Keep this list
// in step with `BUNDLED` in pixel/mocap.ts (readiness.test.ts checks both).
import type { ClipFile } from '../../game/pixel/mocap';
import backpedal from './backpedal.json';
import catchClip from './catch.json';
import celebrate from './celebrate.json';
import dive from './dive.json';
import fall_back from './fall_back.json';
import fall_forward from './fall_forward.json';
import jog from './jog.json';
import jump from './jump.json';
import kick from './kick.json';
import ready from './ready.json';
import run from './run.json';
import shuffle from './shuffle.json';
import sprint from './sprint.json';

const clips: Record<string, ClipFile> = { backpedal, catch: catchClip, celebrate, dive, fall_back, fall_forward, jog, jump, kick, ready, run, shuffle, sprint };
export default clips;
