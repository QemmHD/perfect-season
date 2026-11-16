// Claude (studio overhaul, shell-1, 2026-11-10): the shell QA snippet's init script, on a stand-in page.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shellEdgeInit } from './edge-snippet.mjs';

function fakePage(w, h) {
  const listeners = {};
  const styles = {};
  const els = {};
  const document = {
    documentElement: { style: { setProperty: (k, v) => (styles[k] = v) } },
    head: { append: (e) => (els[e.id] = e) },
    getElementById: (id) => els[id] ?? null,
    createElement: () => ({ id: '', textContent: '' }),
    addEventListener() {},
  };
  const win = { innerWidth: w, innerHeight: h, document, addEventListener: (t, f) => (listeners[t] = f) };
  return { win, styles, css: () => els['__ps-shell-edge']?.textContent ?? null, resize: (nw, nh) => ((win.innerWidth = nw), (win.innerHeight = nh), listeners.resize()) };
}

describe('shellEdgeInit', () => {
  it('gives the stage and the match screen the Fix A top edge at 393×852 (59/34)', () => {
    const p = fakePage(393, 852);
    expect(shellEdgeInit({ insets: [59, 0, 34, 0], designW: 390 }, p.win)).toEqual({ insets: [59, 0, 34, 0], edge: 22 });
    expect(p.win.__psInsets).toEqual([59, 0, 34, 0]);
    expect(p.styles).toEqual({ '--ps-inset-top': '59px', '--ps-inset-right': '0px', '--ps-inset-bottom': '34px', '--ps-inset-left': '0px', '--ps-edge': '22px' });
    // 81 pt = 81 / (393 / 390) frame px
    expect(p.css()).toBe('.stage{--sat:80.382px!important}.arcade-full{--sat:81px!important;--sab:34px!important;--sal:0px!important;--sar:0px!important}');
  });

  it('follows resizes and leaves landscape and the framed layout alone', () => {
    const p = fakePage(390, 844);
    shellEdgeInit({ insets: [47, 0, 34, 0], designW: 390 }, p.win);
    expect(p.css()).toContain('.stage{--sat:66px!important}');
    p.resize(844, 390);
    expect(p.css()).toBe('');
    expect(p.styles['--ps-edge']).toBe('0px');
    p.resize(320, 568);
    expect(p.css()).toContain('.arcade-full{--sat:66px!important');
  });

  it('has an identical shared copy for the other teams when the scratchpad holds one', () => {
    const shared = process.env.PS_QA_SNIPPET;
    if (!shared || !fs.existsSync(shared)) return;
    expect(fs.readFileSync(shared, 'utf8')).toBe(fs.readFileSync(new URL('./edge-snippet.mjs', import.meta.url), 'utf8'));
  });
});
