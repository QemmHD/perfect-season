// The motion-capture clips the soccer pitch plays, in one bundle (studio overhaul players-3): a match
// loads them in two requests (this bundle and clips-shared.ts, the clips other sports play too) instead
// of one file each, before play starts (pixel/ready.ts). Mirrored clips (`_l`, `_m`) are made from these
// at load. Keep this list in step with `BUNDLED` in pixel/mocap.ts (readiness.test.ts checks both).
import type { ClipFile } from '../../game/pixel/mocap';
import shared from './clips-shared';
import jump from './jump.json';

const { backpedal, celebrate, dive, fall_back, fall_forward, jog, kick, ready, run, shuffle, sprint } = shared;
const clips: Record<string, ClipFile> = { backpedal, catch: shared.catch, celebrate, dive, fall_back, fall_forward, jog, jump, kick, ready, run, shuffle, sprint };
export default clips;
