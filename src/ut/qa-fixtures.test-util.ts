// Claude, 2026-11-16 (studio overhaul, team ut-1): file access for tests (the project has no Node
// typings, so node:fs is imported dynamically, as labels.test.ts does) and the UT QA fixtures
// (scripts/qa/fixtures/ut/<sport>-<name>.json: localStorage profile keys built by the app itself).
interface Fs {
  readFileSync(p: URL, enc: 'utf8'): string;
  readdirSync(p: URL): string[];
  existsSync(p: URL): boolean;
  statSync(p: URL): { isFile(): boolean };
}
export const fs = (await import(/* @vite-ignore */ 'node:' + 'fs')) as Fs;
/** src/ */
export const SRC = new URL('../', import.meta.url);
const FIXTURES = new URL('../../scripts/qa/fixtures/ut/', import.meta.url);

export interface QaFixture {
  name: string;
  sport: string;
  about: string;
  at: string;
  day: string;
  week: string;
  /** the inbox the app showed when it built the fixture ("(packs)" and "(picks)" are not claimable) */
  inbox: string[];
  storage: Record<string, unknown>;
}
/** Every UT QA fixture of one sport, by name order. */
export function qaFixtures(sport: string): QaFixture[] {
  return fs
    .readdirSync(FIXTURES)
    .filter((f) => f.startsWith(sport + '-') && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(new URL(f, FIXTURES), 'utf8')) as QaFixture);
}
