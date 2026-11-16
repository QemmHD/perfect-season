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

  it('stays within 2 KB gzipped, with no raster images, noise or backdrop-filter', () => {
    expect(gzipSync(plates).length).toBeLessThanOrEqual(2048);
    const code = plates.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/url\(/);
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
    expect(rule(plates, 'html:has(.ut-top) .status-plate')).toMatch(/background-color:\s*var\(--plate-top-ut\)/);
    expect(rule(plates, '.screen > .ut-top::before')).toMatch(/var\(--plate-top-ut\) 0, var\(--plate-top-ut\) var\(--inset-top/);
    expect(rule(plates, 'html:has(.shell-top, .topbar) .status-plate')).toMatch(/background-color:\s*var\(--plate-top\)/);
    // UT follows the main rule at the same specificity (and wins); the open sheet's rule comes last too
    const at = (sel) => plates.indexOf(sel + ' .status-plate');
    expect(at('html:has(.shell-top, .topbar)')).toBeLessThan(at('html:has(.ut-top)'));
    expect(at('html:has(.ut-top)')).toBeLessThan(at('html:has(' + OVERLAYS + ')'));
  });

  it('is transparent by default, so screens without a header keep their own top (no flat strip)', () => {
    // the :has() browsers' base; the header rules after it make it opaque only over a header plate
    expect(plates).toMatch(/@supports selector\(:has\(a\)\) \{\s*html \.status-plate \{\s*background-color: transparent;\s*\}\s*\}/);
    const at = (sel) => plates.indexOf(sel + ' .status-plate');
    expect(plates.indexOf('@supports selector(:has(a))')).toBeLessThan(at('html:has(.shell-top, .topbar)'));
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
