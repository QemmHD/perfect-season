// Claude, 2026-11-16 (studio overhaul, team ut-1): the progress core stays light. A static walk of the
// runtime imports (type-only imports are erased by the compiler and skipped) from each light module
// must never reach the card pool or anything that loads it, so the main-app badge, the "Next up" strip
// and the One-More bar cost no card data on first paint.
import { describe, expect, it } from 'vitest';
import { fs, SRC } from './qa-fixtures.test-util';

const UT = new URL('ut/', SRC);
const at = (name: string) => new URL(name + '.ts', UT).href;
const FORBIDDEN_NAMES = ['pool', 'packs', 'cards', 'sbc', 'rate', 'squad', 'content-packs', 'daily-hub', 'moments', 'inbox'];
const FORBIDDEN = FORBIDDEN_NAMES.map(at);
const rel = (f: string) => f.slice(SRC.href.length);
const ROOTS = ['claimables', 'go', 'stamps', 'next-action', 'near-miss', 'packs-claimables', 'objectives', 'seen'];

function resolve(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = new URL(spec, from).href;
  for (const c of [base, base + '.ts', base + '.tsx', base + '/index.ts']) {
    const u = new URL(c);
    if (fs.existsSync(u) && fs.statSync(u).isFile()) return c;
  }
  return null;
}
/** Runtime imports and re-exports of a module (not `import type`, not `{ type A, type B }`). */
function runtimeImports(file: string): string[] {
  const src = fs.readFileSync(new URL(file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const out: string[] = [];
  for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    if (m[1]) continue;
    const names = m[2].trim();
    if (/^\{[\s\S]*\}$/.test(names)) {
      const parts = names.slice(1, -1).split(',').map((s) => s.trim()).filter(Boolean);
      if (parts.length && parts.every((s) => s.startsWith('type '))) continue;
    }
    out.push(m[3]);
  }
  for (const m of src.matchAll(/(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)) out.push(m[1]);
  return out.map((s) => resolve(file, s)).filter((x): x is string => !!x);
}
function walk(root: string): Map<string, string | null> {
  const seen = new Map<string, string | null>([[root, null]]),
    queue = [root];
  while (queue.length) {
    const f = queue.shift()!;
    if (!/\.tsx?$/.test(f)) continue;
    for (const d of runtimeImports(f))
      if (!seen.has(d)) {
        seen.set(d, f);
        queue.push(d);
      }
  }
  return seen;
}
const chain = (g: Map<string, string | null>, f: string) => {
  const out = [];
  for (let x: string | null = f; x; x = g.get(x) ?? null) out.unshift(rel(x));
  return out.join(' → ');
};

describe('the progress core never loads the card pool', () => {
  it('the walker sees the heavy path it guards against (sanity)', () => {
    const g = walk(at('progression'));
    expect([...g.keys()].some((f) => FORBIDDEN.includes(f))).toBe(false);
    const heavy = walk(at('daily-hub'));
    expect([...heavy.keys()].some((f) => f.endsWith('/ut/pool.ts'))).toBe(true);
  });
  for (const r of ROOTS)
    it(r + '.ts reaches none of ' + FORBIDDEN_NAMES.join(', '), () => {
      const g = walk(at(r));
      const bad = [...g.keys()].filter((f) => FORBIDDEN.includes(f)).map((f) => chain(g, f));
      expect(bad).toEqual([]);
    });
});
