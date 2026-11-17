// The nba appearance data's own chunk (studio overhaul players-3 fix): loaded through this module so the
// build names its chunk `looks-nba-<hash>.js`, which the readiness probe (scripts/qa/players-readiness.mjs)
// can tell apart from the draft dataset's `nba-<hash>.js`. The data is nba.json, built from source/.
import type { AppearanceFile } from '../../game/pixel/appearance';
import file from './nba.json';

export default file as unknown as AppearanceFile;
