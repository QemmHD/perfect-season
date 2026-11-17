// Claude 2026-11-01: soccer is the third sport. A two-way branch on the sport (`NFL ? a : b`,
// `sport === 'nba' ? a : b`, `if (!NFL)`) silently gives soccer basketball's or football's
// behaviour, so files on soccer's code paths must branch with `pick({ nba, nfl, soccer })` (or
// `pickFor(sport, ...)`), which needs all three answers. This test reads the sources and fails on a
// two-way branch outside the sport-specific engines.
/// <reference types="vite/client" />
const SOURCES = import.meta.glob<string>(['../**/*.ts', '../**/*.tsx', '!../**/*.test.ts', '!../**/*.test-util.ts'], { query: '?raw', import: 'default', eager: true });

/** basketball's and football's own engines: soccer never runs them */
const SKIP_DIRS = ['game/hoops/', 'game/hoops2/', 'game/football/', 'game/football2/', 'game/pixel/'];
const SKIP_FILES = [
  'ut/nfl-combine.ts',
  'ut/nfl-identity.ts',
  'engine/sport.ts',
  // hidden in soccer (Play leaves them out, docs/SOCCER.md): Club Season and Moments
  'ut/league.ts',
  'ut/league-state.ts',
  'ut/league-form.ts',
  'ut/league-match.ts',
  'ut/LeagueSeason.tsx',
  'ut/moments.ts',
  'ut/Moments.tsx',
];

const PATTERNS: [RegExp, string][] = [
  [/\b(?:IS_)?NFL\s*\?/, 'NFL ? a : b'],
  [/!\s*(?:IS_)?NFL\b(?!_)/, '!NFL'],
  [/\b(?:IS_)?NFL\s*&&/, 'NFL && ...'],
  [/(?:&&|\|\|)\s*!?\s*(?:IS_)?NFL\b(?!_)/, '... && NFL'],
  [/\bif\s*\(\s*(?:IS_)?NFL\s*\)/, 'if (NFL)'],
  [/[=!]==\s*'(?:nba|nfl)'\s*\?/, "sport === 'nba' ? a : b"],
  [/[=!]==\s*"(?:nba|nfl)"\s*\?/, 'sport === "nba" ? a : b'],
];

/** The hits in one file's source (comments left out, the patterns over the whole text, so a ternary
 * split over lines, `NFL\n  ? a\n  : b`, is caught too). */
export function branchHits(name: string, source: string): string[] {
  const lines = source.split('\n').map((line) => (/^\s*(\*|\/\*)/.test(line) ? '' : line.replace(/\/\/.*$/, '')));
  const code = lines.join('\n');
  const hits: string[] = [];
  for (const [re, what] of PATTERNS) {
    const g = new RegExp(re.source, 'g');
    for (let m = g.exec(code); m; m = g.exec(code)) {
      const at = code.slice(0, m.index).split('\n').length;
      hits.push(name + ':' + at + '  ' + what + '  ' + lines[at - 1].trim().slice(0, 120));
    }
  }
  return hits;
}

describe('sport branches', () => {
  it('catches the two-way branches it is for', () => {
    expect(branchHits('x.ts', "const a = NFL ? 1 : 2;\nif (!NFL) x();\nconst b = sport === 'nba' ? 3 : 4;\nconst c = NFL\n  ? 5\n  : 6;")).toHaveLength(4);
    expect(branchHits('y.ts', "const a = pick({ nba: 1, nfl: 2, soccer: 3 });\n// NFL ? in a comment\nconst NFL_KEYS = 1;")).toEqual([]);
  });
  it('names all three sports (no two-way NFL/NBA branch on a soccer code path)', () => {
    // keys are relative to this file: '../ut/x.ts', or './x.ts' here in engine/
    const files = Object.keys(SOURCES).map((k) => [k.replace(/^\.\.\//, '').replace(/^\.\//, 'engine/'), k] as const);
    expect(files.length).toBeGreaterThan(200);
    const hits: string[] = [];
    for (const [f, key] of files) {
      if (SKIP_DIRS.some((d) => f.startsWith(d)) || SKIP_FILES.includes(f)) continue;
      hits.push(...branchHits(f, String(SOURCES[key])));
    }
    expect(hits).toEqual([]);
  });
});
