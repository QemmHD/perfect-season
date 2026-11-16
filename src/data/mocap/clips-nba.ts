// The motion-capture clips the NBA court plays, in one bundle (studio overhaul players-3): a match loads
// them in one or two requests (with the clips every sport shares) instead of one file each, before its
// first frame (pixel/ready.ts). Mirrored clips (`_l`, `_m`) are made from these at load. Keep this list
// in step with `BUNDLED` in pixel/mocap.ts (readiness.test.ts checks both).
import type { ClipFile } from '../../game/pixel/mocap';
import backpedal from './backpedal.json';
import celebrate from './celebrate.json';
import fall_back from './fall_back.json';
import getup from './getup.json';
import jog from './jog.json';
import jumpshot from './jumpshot.json';
import layup from './layup.json';
import ready from './ready.json';
import run from './run.json';
import shuffle from './shuffle.json';
import slip from './slip.json';
import sprint from './sprint.json';
import stumble from './stumble.json';

const clips: Record<string, ClipFile> = { backpedal, celebrate, fall_back, getup, jog, jumpshot, layup, ready, run, shuffle, slip, sprint, stumble };
export default clips;
