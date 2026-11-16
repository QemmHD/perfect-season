// Claude (studio overhaul, shell-5, 2026-11-16): the keyboard reveal's pure parts. Its effect in a real
// browser is measured by scripts/qa/edge-walk.mjs (states.keyboardWelcome / keyboardSearch / keyboardDanger).
import { describe, expect, it } from 'vitest';
import { inBand } from './keyboard';

describe('keyboard reveal', () => {
  it('leaves a field alone while it is inside the visible band', () => {
    expect(inBand({ top: 120, bottom: 170 }, { top: 0, bottom: 310 })).toBe(true);
  });
  it('acts when the keyboard has pushed the field below the band, or it sits under the top edge', () => {
    expect(inBand({ top: 287, bottom: 339 }, { top: 0, bottom: 310 })).toBe(false);
    expect(inBand({ top: 2, bottom: 40 }, { top: 0, bottom: 310 })).toBe(false);
  });
  it('follows a panned visual viewport (offsetTop)', () => {
    expect(inBand({ top: 420, bottom: 470 }, { top: 300, bottom: 610 })).toBe(true);
  });
});
