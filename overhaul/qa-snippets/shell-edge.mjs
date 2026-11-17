// Claude (studio overhaul, shell-1, 2026-11-10): the shell team's QA snippet. It lets any branch see
// the final iPhone top-edge geometry in Chromium before the shell team's fix (Fix A) is merged.
// Self-contained on purpose (no imports), so other teams can import it straight from the shared
// copy at <overhaul scratchpad>/qa-snippets/shell-edge.mjs. Keep the two copies identical.
//
//   import { applyShellEdge, rawEnvRules } from '…/shell-edge.mjs';
//   const context = await browser.newContext({ viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true });
//   await applyShellEdge(context, { insets: [59, 0, 34, 0] });   // before the first page.goto
//
// What it does, in every page of the context:
//  - window.__psInsets = insets, which the stage already reads instead of env() (src/stage.tsx);
//  - <html> gets --ps-inset-top/right/bottom/left and --ps-edge (screen px), the variables Fix A adds;
//  - the stage gets --sat = (inset + edge) / k frame px (k = width / 390), the value Fix A gives it,
//    and .arcade-full (the portaled match screen, which reads env() and so sees 0 in Chromium) gets
//    --sat = inset + edge and --sab/--sal/--sar = the raw insets, in screen px. Both are !important,
//    so they win over the stage's inline style; once Fix A is merged they equal what the app sets.
// It cannot move rules that read env(safe-area-inset-*) directly: rawEnvRules(page) lists them.
// Landscape and the framed (wider than 600 px) layout keep the app's own values.

/** Clearance below the status bar, pt: mirrors topEdge in src/stage-layout.ts (Fix A) and edgeOf in edge-lib.mjs. */
export const edgeOf = (insetTop) => Math.min(22, Math.round(Math.max(0, insetTop) * 0.4));

/**
 * The init script (exported for its unit test). Self-contained: Playwright serializes it.
 * `env` stands in for the page's globals in the test.
 */
export function shellEdgeInit({ insets, designW = 390 }, env) {
  const w = env ?? window;
  const doc = w.document;
  const [t, r, b, l] = insets;
  const edge = Math.min(22, Math.round(Math.max(0, t) * 0.4));
  w.__psInsets = insets;
  w.__psShellEdge = { insets, edge };
  const css = () => {
    const portrait = w.innerWidth <= w.innerHeight && w.innerWidth <= 600;
    const k = w.innerWidth / designW;
    const root = doc.documentElement.style;
    root.setProperty('--ps-inset-top', (portrait ? t : 0) + 'px');
    root.setProperty('--ps-inset-right', (portrait ? r : 0) + 'px');
    root.setProperty('--ps-inset-bottom', (portrait ? b : 0) + 'px');
    root.setProperty('--ps-inset-left', (portrait ? l : 0) + 'px');
    root.setProperty('--ps-edge', (portrait ? edge : 0) + 'px');
    if (!portrait) return '';
    const sat = Math.round(((t + edge) / k) * 1000) / 1000;
    return `.stage{--sat:${sat}px!important}.arcade-full{--sat:${t + edge}px!important;--sab:${b}px!important;--sal:${l}px!important;--sar:${r}px!important}`;
  };
  const apply = () => {
    let s = doc.getElementById('__ps-shell-edge');
    if (!s) {
      s = doc.createElement('style');
      s.id = '__ps-shell-edge';
      (doc.head || doc.documentElement).append(s);
    }
    s.textContent = css();
  };
  if (doc.documentElement) apply();
  else doc.addEventListener('readystatechange', apply, { once: true });
  w.addEventListener('resize', apply);
  w.addEventListener('orientationchange', apply);
  return w.__psShellEdge;
}

/** Install the snippet on a Playwright context (call before the first navigation). */
export async function applyShellEdge(context, { insets = [59, 0, 34, 0] } = {}) {
  if (!Array.isArray(insets) || insets.length !== 4) throw Error('applyShellEdge: insets must be [top, right, bottom, left] in pt');
  await context.addInitScript(shellEdgeInit, { insets, designW: 390 });
  return { insets, edge: edgeOf(insets[0]) };
}

/**
 * Rules in the page's stylesheets that read env(safe-area-inset-*) themselves, outside the stage
 * and .arcade-full variables the snippet replaces. On a phone they sit at the raw inset, inside the
 * blurred band; in Chromium they resolve to 0. Each should read
 * var(--ps-inset-top, env(safe-area-inset-top, 0px)) (+ var(--ps-edge, 0px) for anything with text).
 */
export const rawEnvRules = (page) =>
  page.evaluate(() => {
    const out = [];
    const walk = (rules, sheet) => {
      for (const rule of rules) {
        if (rule.cssRules && !rule.selectorText) walk(rule.cssRules, sheet);
        if (!rule.style || !rule.selectorText) continue;
        if (/^\.arcade-full$/.test(rule.selectorText.trim())) continue;
        for (const prop of rule.style) {
          const v = rule.style.getPropertyValue(prop);
          if (!/env\(\s*safe-area-inset-/.test(v) || /var\(\s*--ps-inset-/.test(v)) continue;
          out.push({ selector: rule.selectorText, prop, value: v.trim(), sheet: (sheet.href || 'inline').replace(/^.*\//, '').replace(/\?.*$/, '') });
        }
      }
    };
    for (const sheet of document.styleSheets) {
      try {
        walk(sheet.cssRules, sheet);
      } catch {
        // a cross-origin stylesheet (fonts) cannot be read
      }
    }
    return out;
  });
