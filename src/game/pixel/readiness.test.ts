// players-3: a match's players are ready before play starts. Each sport's clips come in two chunks
// (its bundle and clips-shared) and its looks in one small file; `pixelReady` loads both, the sport
// screens hold game time for them (`holdPlay`, never for long) while the renderers draw every frame,
// a failed load is tried again (`wantPixels`), and none of it is in the first-paint bundle.
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

  it('puts every clip two sports play in clips-shared, and each bundle imports only its own clips besides', async () => {
    // a JSON two bundles import would be split by Rollup into a chunk per importer set (NFL and soccer
    // needed three requests); with clips-shared each sport needs two: its bundle and the shared chunk
    const count = new Map<string, number>();
    for (const s of SPORTS) for (const c of BUNDLED[s]) count.set(c, (count.get(c) ?? 0) + 1);
    const multi = [...count].filter(([, n]) => n > 1).map(([c]) => c).sort();
    const shared = await import('../../data/mocap/clips-shared');
    expect(Object.keys(shared.default).sort()).toEqual(multi);
    const raw = import.meta.glob<string>('../../data/mocap/clips-*.ts', { query: '?raw', import: 'default', eager: true });
    for (const s of SPORTS) {
      const own = [...raw[`../../data/mocap/clips-${s}.ts`].matchAll(/from '\.\/([a-z_]+)\.json'/g)].map((m) => m[1]);
      expect(own.filter((c) => count.get(c) !== 1), s).toEqual([]);
    }
  });
});

describe('holdPlay and wantPixels', () => {
  // a load we hold back (the review's slow first launch) or fail (offline), on a fresh module copy
  const withLoads = async (clips: () => Promise<string[]>) => {
    vi.resetModules();
    vi.doMock('./mocap', async (orig) => ({ ...(await orig<typeof import('./mocap')>()), preloadClips: vi.fn(clips) }));
    const ready = await import('./ready');
    const mocap = await import('./mocap');
    vi.doUnmock('./mocap');
    return { ready, preload: mocap.preloadClips as unknown as ReturnType<typeof vi.fn> };
  };

  it('holds play while the first load is on its way, never past GATE_MS, and lets go once it is in', async () => {
    let arrive!: (v: string[]) => void;
    const { ready } = await withLoads(() => new Promise<string[]>((ok) => (arrive = ok)));
    expect(ready.GATE_MS).toBeLessThanOrEqual(1500);
    expect(ready.holdPlay('nfl', 1000)).toBe(true);
    expect(ready.holdPlay('nfl', 1000 + ready.GATE_MS - 1)).toBe(true);
    expect(ready.holdPlay('nfl', 1000 + ready.GATE_MS)).toBe(false);
    // a fresh copy: the load arrives inside the gate
    const again = await withLoads(() => new Promise<string[]>((ok) => (arrive = ok)));
    expect(again.ready.holdPlay('nba', 0)).toBe(true);
    arrive([]);
    await again.ready.pixelReady('nba');
    expect(again.ready.isPixelReady('nba')).toBe(true);
    expect(again.ready.holdPlay('nba', 1)).toBe(false);
  });

  it('a held gate stops game time: the sport loops add no steps while holdPlay is true', async () => {
    // the screens' rule (Hoops2/Football2/Soccer2): acc grows with real time, then holdPlay zeroes it,
    // and only whole DT steps advance p.t
    const { ready } = await withLoads(() => new Promise<string[]>(() => undefined));
    const DT = 1 / 60;
    let acc = 0;
    let t = 0;
    for (let now = 0; now < ready.GATE_MS - 20; now += 16.7) {
      acc += 0.0167;
      if (ready.holdPlay('soccer', now)) acc = 0;
      while (acc >= DT) {
        acc -= DT;
        t += DT;
      }
    }
    expect(t).toBe(0);
    // past the gate the clock runs
    for (let now = ready.GATE_MS; now < ready.GATE_MS + 500; now += 16.7) {
      acc += 0.0167;
      if (ready.holdPlay('soccer', now)) acc = 0;
      while (acc >= DT) {
        acc -= DT;
        t += DT;
      }
    }
    expect(t).toBeGreaterThan(0.4);
  });

  it('lets play run at once after a failed load, and tries the load again every RETRY_MS until it is in', async () => {
    let fail = true;
    const { ready, preload } = await withLoads(() => (fail ? Promise.reject(new Error('offline')) : Promise.resolve([])));
    expect(ready.holdPlay('nfl', 0)).toBe(true);
    expect(preload).toHaveBeenCalledTimes(1);
    // the load on its way (memoised): it settles false
    expect(await ready.pixelReady('nfl')).toBe(false);
    expect(preload).toHaveBeenCalledTimes(1);
    expect(ready.isPixelReady('nfl')).toBe(false);
    // failed: no hold, and no retry inside RETRY_MS
    expect(ready.holdPlay('nfl', 10)).toBe(false);
    ready.wantPixels('nfl', ready.RETRY_MS - 1);
    expect(preload).toHaveBeenCalledTimes(1);
    fail = false;
    ready.wantPixels('nfl', ready.RETRY_MS);
    expect(preload).toHaveBeenCalledTimes(2);
    expect(await ready.pixelReady('nfl')).toBe(true);
    expect(preload).toHaveBeenCalledTimes(2);
    expect(ready.isPixelReady('nfl')).toBe(true);
    // in: wantPixels is free from now on
    ready.wantPixels('nfl', 10 * ready.RETRY_MS);
    expect(preload).toHaveBeenCalledTimes(2);
  });

  it('the renderers draw every frame (no early return on the gate) and the screens hold game time', () => {
    const src = import.meta.glob<string>(['../hoops2/render.ts', '../football2/render.ts', '../soccer2/render.ts', '../hoops2/Hoops2.tsx', '../football2/Football2.tsx', '../soccer2/Soccer2.tsx'], { query: '?raw', import: 'default', eager: true });
    for (const [file, text] of Object.entries(src)) {
      if (file.endsWith('render.ts')) {
        expect(text, file).not.toMatch(/drawGate|if \(!\w+\([^)]*\)\) return;\s*\n\s*ctx\.setTransform/);
        expect(text, file).toMatch(/draw\(ctx[^]*?wantPixels\('(nba|nfl|soccer)'\);\s*\n\s*ctx\.setTransform/);
      } else expect(text, file).toMatch(/if \((holdPlay\('(nba|nfl)', now\)|held)\) acc = 0;/);
    }
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
