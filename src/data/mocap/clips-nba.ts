// The motion-capture clips the NBA court plays, in one bundle (studio overhaul players-3): a match loads
// them in two requests (this bundle and clips-shared.ts, the clips other sports play too) instead of one
// file each, before play starts (pixel/ready.ts). Mirrored clips (`_l`, `_m`) are made from these at
// load. Keep this list in step with `BUNDLED` in pixel/mocap.ts (readiness.test.ts checks both).
import type { ClipFile } from '../../game/pixel/mocap';
import shared from './clips-shared';
import getup from './getup.json';
import jumpshot from './jumpshot.json';
import layup from './layup.json';
import slip from './slip.json';
import stumble from './stumble.json';

const { backpedal, celebrate, fall_back, jog, ready, run, shuffle, sprint, walk } = shared;
const clips: Record<string, ClipFile> = { backpedal, celebrate, fall_back, getup, jog, jumpshot, layup, ready, run, shuffle, slip, sprint, stumble, walk };
export default clips;
