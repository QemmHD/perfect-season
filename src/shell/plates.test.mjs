// Claude (studio overhaul, shell-3, 2026-11-16): the early-ship unit's static guarantees: the status
// plate in index.html, the plates.css import order and budget, the header-plate token contrast, the
// H1 rule's scope and the LV label size. The behaviour in a real browser is in
// scripts/qa/plates.page.test.mjs, and on the app in scripts/qa/plates.mjs. Plain JS (.mjs) because it
// reads files with node:fs, which the app's tsconfig has no types for.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

// read from disk: vitest hands CSS imports (even ?raw) back empty
const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');
const html = read('index.html');
const main = read('src/main.tsx');
const plates = read('src/shell/plates.css');
const styles = read('src/styles.css');
const nav = read('src/ut/nav.css');
const targets = read('src/shell/targets.css');

/** The declarations of the first rule whose selector list is exactly `selector`. */
function rule(css, selector) {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp('(?:^|\\n)' + esc + '\\s*\\{([^}]*)\\}'));
  if (!m) throw Error('no rule ' + selector);
  return m[1];
}
const token = (name) => {
  const m = plates.match(new RegExp(name + ':\\s*(#[0-9a-f]{6})', 'i'));
  if (!m) throw Error('no token ' + name);
  return m[1];
};
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const lum = (hex) => {
  const [r, g, b] = rgb(hex).map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
// the open sheet and the full-screen overlays the band must show through (shell.md, D4 message)
const OVERLAYS = '.scrim:not(.closing), .champ, .cast, .ut-pick-screen, .promotion, .sportfade';
// the headers the status plate matches (shell-5 adds the sub-page headers and Training Camp's bar)
const MAIN = '.shell-top, .topbar, .draft-head, .evo-top';
const UT = '.ut-top, .po-head';
const appToken = (name) => {
  const m = styles.match(new RegExp(name + ':\\s*(#[0-9a-f]{6})', 'i'));
  if (!m) throw Error('no app token ' + name);
  return m[1];
};

describe('Fix B: the status plate in index.html', () => {
  it('sits before #root, outside the scaled stage, and paints before any CSS loads', () => {
    const plate = html.indexOf('<div class="status-plate" aria-hidden="true"></div>');
    expect(plate).toBeGreaterThan(0);
    expect(plate).toBeLessThan(html.indexOf('<div id="root">'));
    // the base rule is in the inline <style> (not a style attribute, which plates.css could not override)
    const head = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    const base = rule(head.replace(/^\s+/gm, ''), '.status-plate');
    for (const part of ['position: fixed', 'top: 0', 'left: 0', 'right: 0', 'height: env(safe-area-inset-top, 0px)', 'z-index: 2', 'pointer-events: none']) expect(base).toContain(part);
    // the launch colour, so nothing new flashes between the launch image and the splash
    expect(base).toContain('background: #04121a');
  });
});

describe('plates.css', () => {
  it('is imported once, right after styles.css', () => {
    const lines = main.split('\n');
    const s = lines.findIndex((l) => l.trim() === "import './styles.css';");
    expect(s).toBeGreaterThan(-1);
    expect(lines[s + 1].trim()).toBe("import './shell/plates.css';");
    expect(main.match(/plates\.css/g)).toHaveLength(1);
  });

  // shell-5 raised the budget from 2 to 3 KB for the premium pass (the plan's figure); the only url() is
  // the inline SVG grain tile (no file, no raster)
  it('stays within 3 KB gzipped, with no raster images or backdrop-filter, and one inline SVG tile', () => {
    expect(gzipSync(plates).length).toBeLessThanOrEqual(3072);
    const code = plates.replace(/\/\*[\s\S]*?\*\//g, '');
    const urls = [...code.matchAll(/url\(("data:[^"]*"|[^)]*)\)/g)].map((m) => m[1]);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^"data:image\/svg\+xml,/);
    expect(code).not.toMatch(/backdrop-filter/);
  });

  it('publishes the header plate tokens (the shared header API, D4)', () => {
    for (const t of ['--plate-top', '--plate-bot', '--plate-line', '--plate-top-ut', '--plate-bot-ut', '--plate-line-ut']) expect(token(t)).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it('gives header text at least 4.5:1 on the plate and the hairline at least 1.25:1', () => {
    // the main TopBar's quiet text (LEVEL eyebrow, x/y XP) is --sub; the UT title's darkest gold stop
    expect(contrast(appToken('--sub'), token('--plate-bot'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(appToken('--text'), token('--plate-bot'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#c98a1d', token('--plate-bot-ut'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(appToken('--sub'), token('--plate-bot-ut'))).toBeGreaterThanOrEqual(4.5);
    expect(contrast(token('--plate-line'), token('--plate-bot'))).toBeGreaterThanOrEqual(1.25);
    expect(contrast(token('--plate-line-ut'), token('--plate-bot-ut'))).toBeGreaterThanOrEqual(1.25);
  });

  it('starts the UT plate with the colour the status plate takes on UT (no seam at the inset line)', () => {
    expect(rule(plates, '.screen > :is(.ut-top, .po-head)::before')).toMatch(/var\(--plate-top-ut\) 0, var\(--plate-top-ut\) var\(--inset-top/);
    expect(rule(plates, 'html:has(' + MAIN + ') .status-plate')).toMatch(/background-color:\s*var\(--plate-top\)/);
    expect(rule(plates, 'html:has(' + UT + ') .status-plate')).toMatch(/background-color:\s*var\(--plate-top-ut\)/);
    // UT follows the main rule at the same specificity (and wins); the open sheet's rule comes last too
    const at = (sel) => plates.indexOf(sel + ' .status-plate');
    expect(at('html:has(' + MAIN + ')')).toBeLessThan(at('html:has(' + UT + ')'));
    expect(at('html:has(' + UT + ')')).toBeLessThan(at('html:has(' + OVERLAYS + ')'));
  });

  it('is transparent by default, so screens without a header keep their own top (no flat strip)', () => {
    // the :has() browsers' base; the header rules after it make it opaque only over a header plate
    expect(plates).toMatch(/@supports selector\(:has\(a\)\) \{\s*html \.status-plate \{\s*background-color: transparent;\s*\}\s*\}/);
    const at = (sel) => plates.indexOf(sel + ' .status-plate');
    expect(plates.indexOf('@supports selector(:has(a))')).toBeLessThan(at('html:has(' + MAIN + ')'));
    // the base outside @supports (no :has(), old Safari) keeps the main plate colour, matching Home
    expect(rule(plates, 'html .status-plate')).toMatch(/background-color:\s*var\(--plate-top\)/);
  });

  it('turns transparent over the full-screen overlays drawn over a header screen, with plain-class :has() arguments', () => {
    const r = rule(plates, 'html:has(' + OVERLAYS + ') .status-plate');
    expect(r).toMatch(/background-color:\s*transparent/);
    for (const cls of ['.champ', '.cast', '.ut-pick-screen', '.promotion', '.sportfade']) expect(OVERLAYS.split(', ')).toContain(cls);
    // no combinators inside any :has() (cheaper invalidation)
    const args = [...plates.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/:has\(((?:[^()]|\([^()]*\))*)\)/g)].flatMap((m) => m[1].split(/,\s*/));
    expect(args.length).toBeGreaterThan(10);
    for (const a of args) expect(a).toMatch(/^[.a-z0-9_-]+(:not\(\.[a-z0-9_-]+\))?$/i);
  });

  it('steps aside on the immersive screens and under an open sheet, and never animates under reduced motion', () => {
    expect(rule(plates, 'html:has(.ut-open-screen, .splash, .vs-splash, .screen.reveal) .status-plate')).toMatch(/display:\s*none/);
    expect(rule(plates, 'html:has(' + OVERLAYS + ') .status-plate')).toMatch(/background-color:\s*transparent/);
    expect(plates).toMatch(/@media \(prefers-reduced-motion: reduce\) \{\s*html \.status-plate \{\s*transition: none;/);
    expect(rule(plates, 'html .status-plate')).toMatch(/height:\s*var\(--ps-inset-top, env\(safe-area-inset-top, 0px\)\)/);
  });
});

describe('H1 and L2', () => {
  it('pins the card-detail bar to the bottom edge only inside a bottom sheet', () => {
    const r = rule(nav, '.sheet.bottom .ut-detail-btns');
    expect(r).toMatch(/bottom:\s*calc\(-18px - var\(--sab, 0px\)\)/);
    expect(r).toMatch(/margin-bottom:\s*calc\(-18px - var\(--sab, 0px\)\)/);
    // the unscoped rule is unchanged, so the bar elsewhere (a future pack-grid entry) is not moved
    expect(rule(nav, '.ut-detail-btns')).toMatch(/bottom:\s*-18px;/);
  });

  it('shows the LV label at 10 px while the ring and its tap target keep their size', () => {
    expect(rule(styles, '.level-ring span')).toMatch(/font-size:\s*10px/);
    expect(rule(styles, '.level-ring')).toMatch(/width:\s*42px/);
    expect(rule(styles, '.topbar .level')).toMatch(/min-height:\s*44px/);
  });
});

// ---------- shell-5: Fix C part 2 (sub-page headers, toasts, the premium pass, the HUD scrim) and M6 ----------
describe('shell-5: sub-page headers, toasts and the premium pass', () => {
  const code = plates.replace(/\/\*[\s\S]*?\*\//g, '');
  it('gives the Draft/Search bar and the Playoffs title a plate from y = 0, and Training Camp\'s bar one of its own', () => {
    const pseudo = rule(plates, '.screen > :is(.topbar, .draft-head, .po-head)::before,\n.screen > :is(.topbar, .draft-head, .po-head)::after');
    expect(pseudo).toMatch(/inset:\s*calc\(-1 \* var\(--sat, 0px\)\) 0 0/);
    expect(pseudo).toMatch(/z-index:\s*-1/);
    // the plate takes taps like the header it belongs to (shell-3's probes at y = 2 land on the header)
    expect(pseudo).not.toMatch(/pointer-events/);
    expect(rule(plates, '.screen > :is(.topbar, .draft-head, .po-head)')).toMatch(/isolation:\s*isolate/);
    // the Playoffs title sits on the gold set, like UT
    expect(rule(plates, '.screen > :is(.ut-top, .po-head)::before')).toMatch(/--plate-bot-ut/);
    // Training Camp's bar starts below inset + edge (its screen drops the --sat padding)
    expect(rule(plates, '.evo-screen > .evo-top')).toMatch(/padding-top:\s*calc\(var\(--sat, 0px\) \+ 12px\)/);
    // the vote screen's head is centred mid-screen, so it gets no plate
    expect(code).not.toMatch(/vote-head/);
  });

  it('puts the grain tile at 3–5% in an inline SVG of at most 1 KB, on a contain:paint pseudo-element', () => {
    const tile = code.match(/--plate-noise:\s*url\("(data:image\/svg\+xml,[^"]*)"\)/)[1];
    expect(tile.length).toBeLessThanOrEqual(1024);
    const svg = decodeURIComponent(tile.slice('data:image/svg+xml,'.length));
    expect(svg).toMatch(/<feTurbulence /);
    const opacity = Number(svg.match(/<rect [^>]*opacity='([\d.]+)'/)[1]);
    expect(opacity).toBeGreaterThanOrEqual(0.03);
    expect(opacity).toBeLessThanOrEqual(0.05);
    // the colour matrix makes the grain grey with an opaque alpha, so the rect's opacity is the tile's
    expect(svg).toMatch(/values='\.33 \.33 \.33 0 0 \.33 \.33 \.33 0 0 \.33 \.33 \.33 0 0 0 0 0 0 1'/);
    const grain = rule(plates, '.shell-top::before,\n.evo-screen > .evo-top::before,\n.screen > :is(.topbar, .draft-head, .po-head)::after');
    expect(grain).toMatch(/var\(--plate-noise\)/);
    expect(grain).toMatch(/contain:\s*paint/);
    // the grain fades in below the inset line, so the flat status plate meets the plate with no seam
    expect(grain).toMatch(/mask-image:\s*linear-gradient\(transparent var\(--inset-top, 0px\), #000 calc\(var\(--inset-top, 0px\) \+ 14px\)\)/);
    expect(grain).toMatch(/var\(--plate-accent\) 50%/);
    expect(rule(plates, '.screen > :is(.ut-top, .po-head)::after')).toMatch(/var\(--plate-accent-ut\) 50%/);
  });

  it('makes toasts opaque with a hairline highlight', () => {
    const t = rule(plates, '.toast');
    const stops = t.match(/linear-gradient\(180deg, (#[0-9a-f]{6}), (#[0-9a-f]{6})\)/i);
    expect(stops).not.toBeNull();
    expect(t).toMatch(/inset 0 1px 0/);
    // white toast text stays readable on both stops
    for (const c of [stops[1], stops[2]]) expect(contrast(appToken('--text'), c)).toBeGreaterThanOrEqual(7);
  });

  it('scrims each sport\'s status-bar strip from y = 0 to the raw inset only, under nothing it can catch', () => {
    const r = rule(plates, '.arcade-full.hg2:not(.fb2, .sc2)::after,\n.arcade-full.fb2::after,\n.arcade-full.sc2::after');
    expect(r).toMatch(/top:\s*0/);
    expect(r).toMatch(/height:\s*var\(--ps-inset-top, env\(safe-area-inset-top, 0px\)\)/);
    expect(r).not.toMatch(/--sat|--ps-edge/);
    expect(r).toMatch(/pointer-events:\s*none/);
    // it fades out at the inset line, so it draws no edge of its own
    expect(r).toMatch(/rgba\(2, 8, 12, 0\)\)/);
  });
});

describe('shell-5 M6: the Draft\'s respin row and boosters get 44-pt tap areas', () => {
  const tcode = targets.replace(/\/\*[\s\S]*?\*\//g, '');
  // the respin heights per fit class (styles.css :root, .fit-tight, .fit-compact) and the gaps around
  const respinH = [...styles.matchAll(/--respin-h:\s*(\d+)px/g)].map((m) => +m[1]);
  const respinGap = [...styles.matchAll(/--respin-gap:\s*(\d+)px/g)].map((m) => +m[1]);
  it('is imported once, right after plates.css', () => {
    const lines = main.split('\n');
    const p = lines.findIndex((l) => l.trim() === "import './shell/plates.css';");
    expect(lines[p + 1].trim()).toBe("import './shell/targets.css';");
    expect(main.match(/targets\.css/g)).toHaveLength(1);
  });
  it('grows each respin to 44 tall, half up and half down, never sideways and never past the gap above', () => {
    expect(respinH).toEqual([38, 36, 34]);
    expect(rule(tcode, '.respin::before')).toMatch(/top:\s*min\(0px, calc\(\(var\(--respin-h, 38px\) - 44px\) \/ 2\)\)/);
    expect(rule(tcode, '.respin,\n.boost')).toMatch(/position:\s*relative/);
    expect(rule(tcode, '.respin::before,\n.boost::before')).toMatch(/left:\s*0;\s*right:\s*0/);
    for (const h of respinH) {
      const grow = Math.max(0, (44 - h) / 2);
      expect(h + 2 * grow).toBeGreaterThanOrEqual(44);
      // the reels end --respin-gap above the row: the smallest gap (6, compact) still clears the 5 px growth
      expect(grow).toBeLessThan(Math.min(...respinGap));
    }
  });
  it('grows the boosters 2 px (4 compact) each way inside the tray padding', () => {
    expect(rule(styles, '.boost')).toMatch(/height:\s*40px/);
    expect(rule(styles, '.fit-compact .boost')).toMatch(/height:\s*36px/);
    expect(tcode).toMatch(/\n\.boost::before \{\s*top:\s*-2px;\s*bottom:\s*-2px;\s*\}/);
    expect(rule(tcode, '.fit-compact .boost::before')).toMatch(/top:\s*-4px;\s*bottom:\s*-4px/);
    // tray padding: 8 above (.tray), 10 below (.drawer-tray)
    expect(rule(styles, '.tray')).toMatch(/padding:\s*8px 16px 0 16px/);
    expect(rule(styles, '.drawer-tray')).toMatch(/padding-bottom:\s*10px/);
    expect(40 + 4).toBeGreaterThanOrEqual(44);
    expect(36 + 8).toBeGreaterThanOrEqual(44);
  });
});
