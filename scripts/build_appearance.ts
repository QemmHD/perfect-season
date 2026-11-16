// The appearance data pipeline (studio overhaul players-3). Source files with names, citations and
// reviews (src/data/appearance/source/<sport>.looks.json, never imported by the app) are built into
// the compact per-sport files the game loads (src/data/appearance/<sport>.json).
//
//   npx vite-node scripts/build_appearance.ts --build            source → compact files
//   npx vite-node scripts/build_appearance.ts --check            exit 1 if a compact file is out of date
//   npx vite-node scripts/build_appearance.ts --candidates nba [40]
//        who to curate next, by what players see most: GOAT and Legend tiers, top overall, the
//        starter pack's gold-slot odds, edition count, the newest season's top golds by position, and
//        the first-run list
//   npx vite-node scripts/build_appearance.ts --first-run [--write]
//        the first-run list (src/data/appearance/first-run.json) derived from today's code
//   npx vite-node scripts/build_appearance.ts --find nba "iverson"   pid, seasons and teams
//   npx vite-node scripts/build_appearance.ts --photos nba <pid…> [--out DIR]
//        public Wikimedia Commons photos (via Wikidata's image property) into .cache/looks-photos and a
//        contact sheet beside the 10 skin swatches, to pick a skin tone by eye and cite the file. A
//        generic User-Agent, no personal data; every request is a public read
//   npx vite-node scripts/build_appearance.ts --soccer-feet <players.csv[.gz]>
//        the preferred foot from the Transfermarkt dataset (transfermarkt-datasets, CC0) into the
//        soccer source file
//
// Guardrails (appearance.ts): only whitelisted keys, no race/ethnicity/nationality, skin only with a
// cited photo (`skinSrc`), every row cited (`src`) and reviewed.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { type AppearanceFile, checkKeys, encodeAppearance, FIELDS, type LookEra, type LookFields, SKIN_TONES, type Sport } from '../src/game/pixel/appearance';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const DATA = join(ROOT, 'src/data/appearance');
const SPORTS: Sport[] = ['nba', 'nfl', 'soccer'];

export interface SourceRow {
  pid: string;
  name: string;
  /** where the look comes from (public appearance in that era; a reference or a description) */
  src: string;
  /** the public photo (Wikimedia Commons file) the skin tone was picked from */
  skinSrc?: string;
  /** who checked the row and when */
  reviewed: string;
  look: Partial<LookFields>;
  eras?: LookEra[];
}
export interface SourceFile {
  sport: Sport;
  note?: string;
  players: SourceRow[];
  feet?: { source: string; L: string[]; B: string[]; U: string[] };
}

const ROW_KEYS = ['pid', 'name', 'src', 'skinSrc', 'reviewed', 'look', 'eras'];

export function readSource(sport: Sport): SourceFile {
  return JSON.parse(readFileSync(join(DATA, 'source', sport + '.looks.json'), 'utf8'));
}

/** Validate a source file and build its compact form (throws on any problem). */
export function compile(src: SourceFile): AppearanceFile {
  const players: Record<string, string> = {};
  for (const r of src.players) {
    for (const k of Object.keys(r)) if (!ROW_KEYS.includes(k)) throw new Error(`${src.sport} ${r.pid}: no row field "${k}"`);
    if (!r.pid || !r.name || !r.src || !r.reviewed) throw new Error(`${src.sport} ${r.pid}: pid, name, src and reviewed are required`);
    checkKeys(r.look);
    if (players[r.pid]) throw new Error(`${src.sport} ${r.pid}: listed twice`);
    const skins = [r.look.skin, ...(r.eras ?? []).map((e) => e.skin)].filter((s) => s !== undefined);
    if (skins.length && !r.skinSrc) throw new Error(`${src.sport} ${r.pid}: a skin tone needs the photo it was picked from (skinSrc)`);
    for (const e of r.eras ?? []) {
      checkKeys(e, ['from', 'to']);
      if (!(e.from <= e.to)) throw new Error(`${src.sport} ${r.pid}: era ${e.from}-${e.to}`);
    }
    players[r.pid] = encodeAppearance(r.look, r.eras ?? []);
  }
  const out: AppearanceFile = {
    v: 1,
    sport: src.sport,
    fields: FIELDS.map(([k]) => k),
    players: Object.fromEntries(Object.entries(players).sort(([a], [b]) => (a < b ? -1 : 1))),
  };
  if (src.feet) out.feet = { L: [...src.feet.L].sort(), B: [...src.feet.B].sort(), U: [...src.feet.U].sort() };
  return out;
}

export const compactText = (f: AppearanceFile) => JSON.stringify(f) + '\n';

/** A source file as written: one player row per line, so a review reads (and diffs) by player. */
export function sourceText(src: SourceFile): string {
  const { players, feet, ...head } = src;
  const lines = Object.entries(head).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)},`);
  lines.push(' "players": [', players.map((r) => '  ' + JSON.stringify(r)).join(',\n'), ' ]' + (feet ? ',' : ''));
  if (feet) lines.push(' "feet": ' + JSON.stringify(feet));
  return '{\n' + lines.join('\n') + '\n}\n';
}
const outPath = (sport: Sport) => join(DATA, sport + '.json');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

async function cards(sport: Sport) {
  const { loadCards } = await import('../src/ut/cards');
  return (await loadCards(sport)).lines;
}

// ---------- the first-run list ----------

/**
 * The players a new player meets in the first five minutes, derived from today's code: the starter
 * pack's gold slot (packs.ts `starterCards` draws one gold at a position from the squad's mix; the
 * plan asks packs to feature it from this list, §6.8) and the stars Home and the Hub headline, which
 * are the newest season's top golds. So: the newest season's highest-rated gold base cards, this many
 * at each position.
 */
export const FIRST_RUN_RULE: Record<Sport, Record<string, number>> = {
  nba: { PG: 3, SG: 3, SF: 3, PF: 3, C: 3 },
  nfl: { QB: 2, RB: 2, WR: 2, TE: 1, DE: 1, DT: 1, LB: 1, CB: 1, S: 1 },
  soccer: { GK: 2, CB: 2, FB: 2, DM: 2, CM: 2, AM: 2, W: 2, ST: 2 },
};

async function ratedPool(sport: Sport) {
  const { loadCards } = await import('../src/ut/cards');
  const { buildPool } = await import('../src/ut/pool');
  const { lines, byId } = await loadCards(sport);
  return buildPool(sport, lines, byId);
}

async function firstRun(sport: Sport): Promise<{ pid: string; name: string; pos: string; ovr: number }[]> {
  const pool = await ratedPool(sport);
  const season = Math.max(...pool.lines.filter((l) => l.kind === 'season').map((l) => l.season));
  const golds = [...pool.base.values()].filter((rc) => rc.line.kind === 'season' && rc.line.season === season && rc.tier === 'gold').sort((a, b) => b.ovr - a.ovr || (a.line.pid < b.line.pid ? -1 : 1));
  const out: { pid: string; name: string; pos: string; ovr: number }[] = [];
  for (const [pos, n] of Object.entries(FIRST_RUN_RULE[sport]))
    for (const rc of golds.filter((g) => g.line.pos[0] === pos && !out.some((o) => o.pid === g.line.pid)).slice(0, n)) out.push({ pid: rc.line.pid, name: rc.line.name, pos, ovr: rc.ovr });
  return out;
}

// ---------- modes ----------

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--build') || argv.includes('--check')) {
    let stale = 0;
    for (const sport of SPORTS) {
      const text = compactText(compile(readSource(sport)));
      const have = existsSync(outPath(sport)) ? readFileSync(outPath(sport), 'utf8') : '';
      if (argv.includes('--build')) {
        if (have !== text) writeFileSync(outPath(sport), text);
        console.log(`${sport}: ${Object.keys(JSON.parse(text).players).length} curated, ${text.length} bytes${have === text ? ' (unchanged)' : ''}`);
      } else if (have !== text) {
        console.error(`${sport}: src/data/appearance/${sport}.json is out of date: run --build`);
        stale++;
      }
    }
    if (stale) process.exit(1);
    return;
  }
  if (argv.includes('--first-run')) {
    const list: Record<string, string[]> = {};
    for (const sport of SPORTS) {
      const fr = await firstRun(sport);
      list[sport] = fr.map((f) => f.pid);
      console.log(sport, fr.map((f) => `${f.pos} ${f.name} (${f.pid}) ${f.ovr}`).join('\n  '));
    }
    if (argv.includes('--write')) writeFileSync(join(DATA, 'first-run.json'), JSON.stringify(list) + '\n');
    return;
  }
  const cand = arg('--candidates');
  if (cand) {
    const sport = cand as Sport;
    const n = Number(argv[argv.indexOf('--candidates') + 2]) || 40;
    const pool = await ratedPool(sport);
    const curated = new Set(readSource(sport).players.map((p) => p.pid));
    const { TIER_CUTS } = await import('../src/ut/rate');
    const { positionMix } = await import('../src/ut/squad');
    // the starter pack's gold slot: a position from the squad's mix, then a gold there, each point
    // above the floor rarer (packs.ts weighted)
    const STEP = { nba: 1.6, nfl: 2.2, soccer: 1.6 }[sport];
    const mix = positionMix(sport);
    const tot = Object.values(mix).reduce((a, b) => a + b, 0);
    const odds = new Map<string, number>();
    for (const [pos, w] of Object.entries(mix)) {
      const list = pool.buckets.gold[pos] ?? [];
      const ws = list.map((rc) => Math.pow(0.8, Math.max(0, rc.ovr - TIER_CUTS[sport].gold) * STEP));
      const s = ws.reduce((a, b) => a + b, 0);
      list.forEach((rc, i) => odds.set(rc.line.pid, (odds.get(rc.line.pid) ?? 0) + ((w / tot) * ws[i]) / s));
    }
    const best = new Map<string, { name: string; ovr: number; tier: string; editions: number }>();
    for (const rc of pool.base.values()) {
      const b = best.get(rc.line.pid) ?? { name: rc.line.name, ovr: 0, tier: rc.tier, editions: 0 };
      b.editions++;
      if (rc.ovr > b.ovr) Object.assign(b, { ovr: rc.ovr, tier: rc.tier });
      best.set(rc.line.pid, b);
    }
    const mark = (pid: string) => (curated.has(pid) ? '*' : ' ');
    const show = (title: string, pids: string[]) => console.log(`\n${title}\n` + pids.map((p) => `  ${mark(p)} ${best.get(p)?.name} (${p}) ${best.get(p)?.tier} ${best.get(p)?.ovr}, ${best.get(p)?.editions} editions`).join('\n'));
    const byTier = (t: string) => [...best.entries()].filter(([, b]) => b.tier === t).map(([p]) => p);
    show('GOAT', byTier('goat'));
    show('Legend', byTier('legend').slice(0, n));
    show('Top overall', [...best.entries()].sort((a, b) => b[1].ovr - a[1].ovr).slice(0, n).map(([p]) => p));
    show('Starter gold-slot odds', [...odds.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([p]) => p));
    show('Most editions', [...best.entries()].sort((a, b) => b[1].editions - a[1].editions).slice(0, n).map(([p]) => p));
    show('First-run list (newest season top golds by position)', (await firstRun(sport)).map((f) => f.pid));
    console.log(`\n* curated (${curated.size})`);
    return;
  }
  const find = arg('--find');
  if (find) {
    const sport = find as Sport;
    const q = norm(argv.slice(argv.indexOf('--find') + 2).join(' '));
    const hits = new Map<string, { name: string; seasons: number[]; teams: Set<string>; pos: Set<string>; ht: number | null; wt: number | null }>();
    for (const l of await cards(sport)) {
      if (l.kind !== 'season' || !norm(l.name).includes(q)) continue;
      const h = hits.get(l.pid) ?? { name: l.name, seasons: [], teams: new Set(), pos: new Set(), ht: l.ht, wt: l.wt };
      h.seasons.push(l.season);
      h.teams.add(l.abbr);
      h.pos.add(l.pos[0]);
      hits.set(l.pid, h);
    }
    for (const [pid, h] of hits) console.log(`${pid}  ${h.name}  ${Math.min(...h.seasons)}–${Math.max(...h.seasons)}  ${[...h.teams].join(' ')}  ${[...h.pos].join('/')}  ht ${h.ht} wt ${h.wt}`);
    return;
  }
  const photos = arg('--photos');
  if (photos) return void (await contactSheet(photos as Sport, argv.slice(argv.indexOf('--photos') + 2).filter((a) => !a.startsWith('--') && a !== arg('--out'))));
  const feet = arg('--soccer-feet');
  if (feet) return soccerFeet(feet);
  console.log(readFileSync(new URL(import.meta.url).pathname, 'utf8').split('\n').slice(0, 25).join('\n'));
}

// ---------- photos ----------

const UA = 'PerfectSeasonBuild/1.0 (appearance contact sheets)';
const SPORT_QID: Record<Sport, string[]> = { nba: ['Q5372', 'Q3665646'], nfl: ['Q41323', 'Q19204627'], soccer: ['Q2736', 'Q937857'] };

async function get(url: string, tries = 5): Promise<Response> {
  for (let i = 0; ; i++) {
    const r = await fetch(url, { headers: { 'user-agent': UA } });
    if (r.status !== 429 || i >= tries) return r;
    await new Promise((ok) => setTimeout(ok, 2000 * 2 ** i));
  }
}

/** The Wikidata item for a player: the first search hit whose sport or occupation is his sport's. */
async function wikidataItem(sport: Sport, name: string): Promise<{ qid: string; image?: string } | null> {
  const page = await (await get('https://www.wikidata.org/w/index.php?title=Special:Search&ns0=1&search=' + encodeURIComponent(name))).text();
  const qids = [...new Set([...page.matchAll(/\/wiki\/(Q\d+)"/g)].map((m) => m[1]))].slice(0, 6);
  for (const qid of qids) {
    const j = await (await get(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`)).json();
    const claims = j.entities?.[qid]?.claims ?? {};
    const ids = (p: string): string[] => (claims[p] ?? []).map((c: { mainsnak?: { datavalue?: { value?: { id?: string } } } }) => c.mainsnak?.datavalue?.value?.id ?? '');
    if (![...ids('P641'), ...ids('P106')].some((q) => SPORT_QID[sport].includes(q))) continue;
    const image = claims.P18?.[0]?.mainsnak?.datavalue?.value as string | undefined;
    return { qid, image };
  }
  return null;
}

async function contactSheet(sport: Sport, pids: string[]) {
  const names = new Map((await cards(sport)).map((l) => [l.pid, l.name]));
  const dir = join(ROOT, '.cache/looks-photos', sport);
  mkdirSync(dir, { recursive: true });
  const indexPath = join(dir, 'index.json');
  const index: Record<string, { name: string; qid?: string; file?: string }> = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : {};
  for (const pid of pids) {
    const name = names.get(pid);
    if (!name) {
      console.error(`${pid}: not in cards-${sport}.json`);
      continue;
    }
    if (index[pid]?.file && existsSync(join(dir, pid + '.jpg'))) continue;
    const item = await wikidataItem(sport, name);
    index[pid] = { name, qid: item?.qid, file: item?.image };
    if (item?.image) {
      const r = await get('https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(item.image) + '?width=240');
      if (r.ok) writeFileSync(join(dir, pid + '.jpg'), Buffer.from(await r.arrayBuffer()));
      else index[pid].file = undefined;
    }
    console.log(`${pid} ${name}: ${item?.qid ?? 'no item'} ${index[pid].file ? 'File:' + index[pid].file : 'no photo'}`);
    writeFileSync(indexPath, JSON.stringify(index, null, 1));
  }
  const shown = pids.filter((p) => index[p]?.file && existsSync(join(dir, p + '.jpg')));
  if (!shown.length) return console.error('no photos to show');
  const swatches = SKIN_TONES.map((h, i) => `<div class=sw style="background:${h}">${i}</div>`).join('');
  const cells = shown.map((p) => `<figure><img src="file://${join(dir, p + '.jpg')}"><figcaption>${index[p].name}<br>${p}</figcaption><div class=row>${swatches}</div></figure>`).join('');
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#777;font:12px sans-serif;display:flex;flex-wrap:wrap;width:1280px}figure{margin:6px;width:300px}img{width:300px;height:300px;object-fit:contain;background:#555}figcaption{color:#fff}.row{display:flex}.sw{width:30px;height:24px;font-size:10px;text-align:center;line-height:24px;color:#888}</style>${cells}`;
  const out = arg('--out') ?? join(ROOT, '.cache/looks-photos');
  const htmlPath = join(dir, 'sheet.html');
  writeFileSync(htmlPath, html);
  // Playwright is installed for the QA scripts, outside this package: Node's own resolver finds it
  const { chromium } = createRequire(import.meta.url)('playwright');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  // local files only: the photos were fetched above
  await page.route('**/*', (r) => (r.request().url().startsWith('file:') ? r.continue() : r.abort()));
  await page.goto('file://' + htmlPath);
  mkdirSync(out, { recursive: true });
  const png = join(out, `looks-src-${sport}-${shown.length}.png`);
  await page.screenshot({ path: png, fullPage: true });
  await browser.close();
  console.log('contact sheet:', png);
}

// ---------- soccer feet ----------

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (c !== '\r') cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows;
}

async function soccerFeet(path: string) {
  const raw = readFileSync(path);
  const rows = csvRows((path.endsWith('.gz') ? gunzipSync(raw) : raw).toString('utf8'));
  const head = rows[0];
  const id = head.indexOf('player_id');
  const ft = head.indexOf('foot');
  if (id < 0 || ft < 0) throw new Error('expected player_id and foot columns');
  const foot = new Map(rows.slice(1).map((r) => [r[id], r[ft]]));
  const pids = [...new Set((await cards('soccer')).map((l) => l.pid))];
  const L: string[] = [];
  const B: string[] = [];
  const U: string[] = [];
  for (const pid of pids) {
    const f = foot.get(pid);
    if (f === 'left') L.push(pid);
    else if (f === 'both') B.push(pid);
    else if (f !== 'right') U.push(pid);
  }
  const src = readSource('soccer');
  src.feet = { source: 'transfermarkt-datasets players.csv (CC0), column "foot"', L, B, U };
  writeFileSync(join(DATA, 'source/soccer.looks.json'), sourceText(src));
  console.log(`soccer feet: ${pids.length} players; left ${L.length}, both ${B.length}, right ${pids.length - L.length - B.length - U.length}, not recorded ${U.length} (${((100 * (pids.length - U.length)) / pids.length).toFixed(1)}% recorded)`);
}

// run as a script (vite-node); the tests import the functions above
if (!process.env.VITEST) await main();
