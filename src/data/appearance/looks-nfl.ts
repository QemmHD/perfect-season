// The nfl appearance data's own chunk (studio overhaul players-3 fix): loaded through this module so the
// build names its chunk `looks-nfl-<hash>.js`, which the readiness probe (scripts/qa/players-readiness.mjs)
// can tell apart from the draft dataset's `nfl-<hash>.js`. The data is nfl.json, built from source/.
import type { AppearanceFile } from '../../game/pixel/appearance';
import file from './nfl.json';

export default file as unknown as AppearanceFile;
