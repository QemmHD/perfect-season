// Codex (OpenAI): only fetch/parse this page's draft dataset. Sport changes already reload the page.
// The standard build has used ES2022/top-level await for soccer since Claude's third-sport release.
// The artifact build aliases this module to a static, NBA/NFL-only counterpart.
import { pick } from './sport';
const raw = await pick<() => Promise<unknown>>({
  nba: () => import('../data/nba.json').then(m => m.default),
  nfl: () => import('../data/nfl.json').then(m => m.default),
  soccer: () => Promise.resolve(null),
})();
export const NBA_RAW: unknown = pick({ nba: raw, nfl: null, soccer: null });
export const NFL_RAW: unknown = pick({ nba: null, nfl: raw, soccer: null });
