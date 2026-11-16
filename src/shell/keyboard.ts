// Claude (studio overhaul, shell-5, 2026-11-16): the keyboard must not hide the field being typed in.
// The stage follows the visual viewport (stage.tsx), so when the iPhone keyboard opens the whole frame
// shrinks to the part above it, and a field low on its screen (Welcome's name, Search's friend code)
// ends up below the new bottom edge. After the frame has re-laid out, this scrolls the focused field
// back into view inside its own scrolling column, together with the rest of its form row when that
// fits (JOIN beside the code). It moves only that column's scrollTop: never the document, the stage or
// #root. It does nothing while the field is already visible, so focusing a visible field moves nothing,
// and nothing on a screen whose field has no scrolling column.

import './keyboard.css';

const FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea, select';

/** The visible band, top and bottom, in client px (the visual viewport, or the window without one). */
function visibleBand(): { top: number; bottom: number } {
  const vv = window.visualViewport;
  return vv ? { top: vv.offsetTop, bottom: vv.offsetTop + vv.height } : { top: 0, bottom: window.innerHeight };
}

/** Is the box inside the visible band, with a small margin? */
export function inBand(r: { top: number; bottom: number }, band: { top: number; bottom: number }, margin = 8): boolean {
  return r.top >= band.top + margin && r.bottom <= band.bottom - margin;
}

/** The element to bring into view: the field's form row when it fits the band, else the field. */
export function revealTarget(field: HTMLElement, bandHeight: number): HTMLElement {
  const row = field.parentElement?.closest('.joinrow, .namefield-wrap, label') as HTMLElement | null;
  if (row && row.getBoundingClientRect().height <= bandHeight * 0.6) return row;
  return field;
}

/** The nearest ancestor the player can scroll (overflow-y auto or scroll, with something to scroll). */
export function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let n = el.parentElement; n && !n.classList.contains('stage'); n = n.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(n).overflowY) && n.scrollHeight > n.clientHeight + 1) return n;
  }
  return null;
}

/** Brings the focused field into view when the visible area shrinks under it. Returns a stop function. */
export function watchKeyboard(): () => void {
  let raf = 0;
  const reveal = () => {
    const el = document.activeElement;
    if (!(el instanceof HTMLElement) || !el.matches(FIELD) || !el.closest('.stage')) return;
    const band = visibleBand();
    if (inBand(el.getBoundingClientRect(), band)) return;
    const target = revealTarget(el, band.bottom - band.top);
    const scroller = scrollerOf(target);
    if (!scroller) return;
    // centre the target in the part of its column that is visible (scrollIntoView would also scroll the
    // stage and #root, which clip with overflow: hidden and must never move)
    const r = target.getBoundingClientRect(),
      c = scroller.getBoundingClientRect();
    const top = Math.max(c.top, band.top),
      bottom = Math.min(c.bottom, band.bottom);
    // client px → the column's own px (the stage is scaled to the phone)
    const k = c.height / (scroller.offsetHeight || c.height || 1);
    scroller.scrollTop += ((r.top + r.bottom) / 2 - (top + bottom) / 2) / k;
  };
  // the stage applies its new size a frame or more later (and remeasures at 100 and 350 ms, stage.tsx);
  // look again after each, doing nothing once the field is in view
  const timers: number[] = [];
  const later = () => {
    cancelAnimationFrame(raf);
    timers.splice(0).forEach(clearTimeout);
    raf = requestAnimationFrame(() => (raf = requestAnimationFrame(reveal)));
    for (const ms of [140, 420]) timers.push(window.setTimeout(reveal, ms));
  };
  window.visualViewport?.addEventListener('resize', later);
  document.addEventListener('focusin', later);
  return () => {
    cancelAnimationFrame(raf);
    timers.splice(0).forEach(clearTimeout);
    window.visualViewport?.removeEventListener('resize', later);
    document.removeEventListener('focusin', later);
  };
}
