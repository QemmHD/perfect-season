// players-3: the curated appearance data. Every row names a real card player, sits inside his card
// seasons, is cited and reviewed, takes skin only from a cited photo; the built files are in step with
// their sources and small; and every first-run player is curated (V2 C.1.4: "the 12 players shown in
// each sport's first-run flow and starter pack must be Tier A").
import { appearanceFor, type Sport, useAppearanceFile } from './appearance';
import { loadCards } from '../../ut/cards';
import FIRST_RUN from '../../data/appearance/first-run.json';
import NBA from '../../data/appearance/nba.json';
import NFL from '../../data/appearance/nfl.json';
import SOCCER from '../../data/appearance/soccer.json';
import type { AppearanceFile } from './appearance';

// node-only modules, loaded untyped (the app's type check has no node types): the build script itself
// and zlib
interface Row {
  pid: string;
  name: string;
  src: string;
  skinSrc?: string;
  reviewed: string;
  look: { skin?: number; hair?: string; hairTone?: string; facial?: string };
  eras?: { from: number; to: number; skin?: number }[];
}
interface Script {
  readSource(s: Sport): { players: Row[] };
  compile(src: unknown): AppearanceFile;
  compactText(f: AppearanceFile): string;
}
const script = (): Promise<Script> => import(/* @vite-ignore */ '../../../scripts/' + 'build_appearance.ts');
const gzipSize = async (text: string): Promise<number> => (await import(/* @vite-ignore */ 'node:' + 'zlib')).gzipSync(text).length;
let S: Script;
beforeAll(async () => {
  S = await script();
});

const SPORTS: Sport[] = ['nba', 'nfl', 'soccer'];

/** The Tier A minimum a first-run row must carry (a bald or buzzed head needs no hair colour). */
const missing = (look: Row['look']): string[] => {
  const out: string[] = [];
  if (!look.hair) out.push('hair');
  if (!look.hairTone && look.hair !== 'bald') out.push('hairTone');
  if (!look.facial) out.push('facial');
  return out;
};
/**
 * First-run rows still short of the minimum, with the reason (the team doc lists them too). Derek
 * Stingley: every public photo found (Wikidata's and a Commons search) shows him helmeted, so his hair
 * and facial hair stay unknown; his row is empty and reports as the defaults, not as curated.
 */
const SHORTFALL: Record<Sport, string[]> = { nba: [], nfl: ['00-0037237'], soccer: [] };
const BUILT: Record<Sport, AppearanceFile> = { nba: NBA as AppearanceFile, nfl: NFL as AppearanceFile, soccer: SOCCER as AppearanceFile };
const BUILT_TEXT = (s: Sport) => JSON.stringify(BUILT[s]) + '\n';

describe.each(SPORTS)('%s appearance data', (sport) => {
  const src = () => S.readSource(sport);

  it('is in step with its source (scripts/build_appearance.ts --build)', () => {
    expect(BUILT_TEXT(sport)).toBe(S.compactText(S.compile(src())));
  });

  it('is at most 20 KB gzipped', async () => {
    expect(await gzipSize(BUILT_TEXT(sport))).toBeLessThanOrEqual(20 * 1024);
  });

  it('cites and reviews every row, and every skin tone has the photo it was picked from', () => {
    for (const r of src().players) {
      expect(r.src.length, r.pid).toBeGreaterThan(10);
      expect(r.reviewed.length, r.pid).toBeGreaterThan(5);
      const skins = [r.look.skin, ...(r.eras ?? []).map((e) => e.skin)].filter((s) => s !== undefined);
      if (skins.length) expect(r.skinSrc, r.pid).toMatch(/^Commons File:.+\.(jpe?g|png)$/i);
    }
  });

  it('names real card players, with eras inside their card seasons', async () => {
    const { lines } = await loadCards(sport);
    const seasons = new Map<string, { name: string; min: number; max: number }>();
    for (const l of lines) {
      const s = seasons.get(l.pid) ?? { name: l.name, min: l.season, max: l.season };
      s.min = Math.min(s.min, l.season);
      s.max = Math.max(s.max, l.season);
      seasons.set(l.pid, s);
    }
    for (const r of src().players) {
      const s = seasons.get(r.pid);
      expect(s, r.pid).toBeDefined();
      expect(s!.name, r.pid).toBe(r.name);
      for (const e of r.eras ?? []) {
        expect(e.from, r.pid).toBeGreaterThanOrEqual(s!.min);
        expect(e.to, r.pid).toBeLessThanOrEqual(s!.max);
      }
    }
    for (const pid of (FIRST_RUN as Record<Sport, string[]>)[sport]) expect(seasons.has(pid), pid).toBe(true);
  }, 120000);

  it('curates every first-run player to the Tier A minimum (hair, hair colour, facial hair), and reports the shortfall', () => {
    const list = (FIRST_RUN as Record<Sport, string[]>)[sport];
    expect(list.length).toBeGreaterThanOrEqual(12);
    const rows = new Map(src().players.map((p) => [p.pid, p]));
    expect(list.filter((p) => !rows.has(p))).toEqual([]);
    // the shortfall is exactly the listed rows, each named in the team doc with the reason; no more
    const short = list.filter((p) => missing(rows.get(p)!.look).length);
    expect(short, short.map((p) => `${p}: ${missing(rows.get(p)!.look).join(', ')}`).join('; ')).toEqual(SHORTFALL[sport]);
    expect(short.length / list.length).toBeLessThanOrEqual(1 / 12);
    useAppearanceFile(BUILT[sport]);
    for (const pid of list) expect(appearanceFor(sport, pid, 2025).src, pid).toBe(rows.get(pid)!.look && Object.keys(rows.get(pid)!.look).length ? 'curated' : 'default');
  });
});

describe('the seeds', () => {
  it('include the owner-named examples and the mockup archetypes', () => {
    const has = (s: Sport, pids: string[]) => {
      const set = new Set(S.readSource(s).players.map((p) => p.pid));
      expect(pids.filter((p) => !set.has(p))).toEqual([]);
    };
    // Shaq, Iverson, Kareem, Rodman; Curry, LeBron, Jokić
    has('nba', ['onealsh01', 'iversal01', 'abdulka01', 'rodmade01', 'curryst01', 'jamesle01', 'jokicni01']);
    // Brady; Mahomes, Henry
    has('nfl', ['00-0019596', '00-0033873', '00-0032764']);
    // Haaland, Mbappé; Messi, Ronaldinho
    has('soccer', ['418560', '342229', '28003', '3373']);
  });

  it('give the mockup archetypes their hair (and its colour) and facial hair', () => {
    const rows = (s: Sport) => new Map(S.readSource(s).players.map((p) => [p.pid, p]));
    const check = (s: Sport, pids: string[], allow: string[] = []) => {
      const r = rows(s);
      for (const pid of pids) expect(missing(r.get(pid)!.look).filter((m) => !allow.includes(m)), pid).toEqual([]);
    };
    // Curry, LeBron, Jokić; Mahomes, Henry; Messi; Ronaldinho, whose facial hair varied by season (left
    // to the default rather than guessed)
    check('nba', ['curryst01', 'jamesle01', 'jokicni01']);
    check('nfl', ['00-0033873', '00-0032764']);
    check('soccer', ['28003']);
    check('soccer', ['3373'], ['facial']);
  });

  it('get the owner-named looks right', () => {
    for (const s of SPORTS) useAppearanceFile(BUILT[s]);
    const haaland = appearanceFor('soccer', '418560', 2024);
    expect(haaland.hairTone).toBe('blond');
    expect(['flow', 'ponytail', 'locs-long', 'braids']).toContain(haaland.hair);
    const mbappe = appearanceFor('soccer', '342229', 2024);
    expect(['buzz', 'short']).toContain(mbappe.hair);
    expect(mbappe.facial).toBe('none');
    expect(appearanceFor('nba', 'rodmade01', 1997).hairTone).toBe('red');
  });
});
