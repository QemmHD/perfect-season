// The motion-capture clips two or more sports play, in one module (studio overhaul players-3 fix).
// Each sport's bundle (clips-<sport>.ts) imports this and adds its own clips, so the build makes
// exactly two chunks per sport: its bundle and this one. Left to itself, Rollup splits a JSON that
// several bundles import into a chunk per importer set: NFL and soccer then needed three requests
// (every sport's clips, the NFL-and-soccer clips, their own). NBA downloads the four clips here it
// doesn't play (catch, dive, fall_forward, kick; about 15 KB raw) in exchange. readiness.test.ts keeps
// this list equal to the clips in more than one `BUNDLED` list.
import type { ClipFile } from '../../game/pixel/mocap';
import backpedal from './backpedal.json';
import catchClip from './catch.json';
import celebrate from './celebrate.json';
import dive from './dive.json';
import fall_back from './fall_back.json';
import fall_forward from './fall_forward.json';
import jog from './jog.json';
import kick from './kick.json';
import ready from './ready.json';
import run from './run.json';
import shuffle from './shuffle.json';
import sprint from './sprint.json';
import walk from './walk.json';

const shared: Record<string, ClipFile> = { backpedal, catch: catchClip, celebrate, dive, fall_back, fall_forward, jog, kick, ready, run, shuffle, sprint, walk };
export default shared;
