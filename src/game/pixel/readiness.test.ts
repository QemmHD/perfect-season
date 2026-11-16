// players-3: a match's players are ready before its first frame. Each sport's clips come in one
// bundle and its looks in one small file; `pixelReady` loads both, the renderers' `drawGate` holds
// the first frame for them (never for long), and none of it is in the first-paint bundle.
import { BUNDLED, clipsFor, getClip, LOOSE_CLIPS, CLIPS as META } from './mocap';
import { appearanceLoaded } from './appearance';
import { importGraph } from './render-only.helpers';
import INDEX from '../../data/mocap/index.json';
import type { SportId } from '../../engine/sport';

const SELECT = import.meta.glob<string>('./select-*.ts', { query: '?raw', import: 'default', eager: true });
const SPORTS: SportId[] = ['nba', 'nfl', 'soccer'];

describe('pixelReady', () => {
  it.each(SPORTS)('%s: loads the clips and the looks', async (sport) => {
    const { pixelReady, isPixelReady } = await import('./ready');
    expect(await pixelReady(sport)).toBe(true);
    expect(isPixelReady(sport)).toBe(true);
    expect(appearanceLoaded(sport)).toBe(true);
    for (const name of clipsFor(sport)) expect(getClip(name), name).toBeDefined();
  });

  it.each(SPORTS)('%s: the bundle covers every clip select-%s.ts can play', async (sport) => {
    const sel = await import(`./select-${sport}.ts`);
    const src = SELECT[`./select-${sport}.ts`];
    // its CLIPS list and every clip it names at a call site (a mirrored pick plays either twin)
    const named = new Set<string>(sel.CLIPS);
    for (const m of src.matchAll(/(?:clipMeta|has|getClip)\('([a-z_]+)'\)|clip(?: =|:) '([a-z_]+)'/g)) named.add(m[1] ?? m[2]);
    for (const m of src.matchAll(/mirrorOf\(b, '([a-z_]+)'\)/g)) named.add(m[1]).add(META[m[1]].mirror!);
    expect(named.size).toBeGreaterThan(8);
    expect([...named].filter((n) => !(n in META))).toEqual([]);
    expect([...named].filter((n) => !clipsFor(sport).includes(n))).toEqual([]);
  });
});

describe('the clip bundles', () => {
  it.each(SPORTS)('%s: the bundle file holds exactly the clips mocap.ts says', async (sport) => {
    const mod = await import(`../../data/mocap/clips-${sport}.ts`);
    expect(Object.keys(mod.default).sort()).toEqual([...BUNDLED[sport]].sort());
  });

  it('keeps every other clip in its own file, and no bundled clip there too', () => {
    const all = Object.keys(INDEX.clips).sort();
    const bundled = new Set(SPORTS.flatMap((s) => BUNDLED[s]));
    expect([...LOOSE_CLIPS].sort()).toEqual(all.filter((c) => !bundled.has(c)));
    expect([...bundled].filter((c) => !all.includes(c))).toEqual([]);
  });
});

describe('drawGate', () => {
  it('holds the first frame while loading, never past GATE_MS, and opens once ready', async () => {
    vi.resetModules();
    const ready = await import('./ready');
    expect(ready.GATE_MS).toBeLessThanOrEqual(1500);
    expect(ready.drawGate('nfl', 1000)).toBe(false);
    expect(ready.drawGate('nfl', 1000 + ready.GATE_MS - 1)).toBe(false);
    expect(ready.drawGate('nfl', 1000 + ready.GATE_MS)).toBe(true);
    vi.resetModules();
    const fresh = await import('./ready');
    expect(fresh.drawGate('nba', 0)).toBe(false);
    await fresh.pixelReady('nba');
    expect(fresh.drawGate('nba', 1)).toBe(true);
  });
});

describe('first paint stays light', () => {
  it('no main-bundle file imports the appearance code or data (except first-run.json)', async () => {
    const graph = await importGraph(['main.tsx']);
    expect(graph.size).toBeGreaterThan(50);
    const bad = [...graph]
      .filter(([f]) => /^game\/pixel\/(appearance|looks|ready)\.ts$|^data\/appearance\/(?!first-run\.json$)|^data\/mocap\/clips-/.test(f))
      .map(([f, by]) => `${f} (from ${by})`);
    expect(bad).toEqual([]);
  });
});
