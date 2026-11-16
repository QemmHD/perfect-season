// Where the HUD leaves the court free (plan §4.3; nba-3). Reads the V2 A.5 tokens
// (controls-geometry.css) as real pixels from the live element, so the cameras frame the play inside
// the action-safe box the score bug, the Heat bar, the toast line and the controls leave, on every
// phone and either way up. Custom properties can't be read as numbers directly (they're unresolved
// calc()/clamp() text), so a hidden probe positioned by them is measured instead.

export interface Geometry {
  /** the action-safe box: the controlled player and the target stay between these rows (px from the element's top) */
  safeTop: number;
  safeBottom: number;
  /** the toast line's bottom edge, and the top of the right-thumb cluster's reserved area */
  toastBottom: number;
  controlTop: number;
  /** the lowest edge of the HUD across the top (the Heat bar; sideways the toast line under it) */
  hudBottom: number;
  /** sideways (the `.land` geometry) */
  land: boolean;
}

interface Probes {
  safe: HTMLElement;
  ctl: HTMLElement;
  heat: HTMLElement;
}
const probes = new WeakMap<Element, Probes>();

function probeFor(el: Element): Probes {
  let p = probes.get(el);
  if (p && p.safe.parentNode === el) return p;
  const make = (css: string) => {
    const d = document.createElement('div');
    d.setAttribute('aria-hidden', 'true');
    d.dataset.psGeoProbe = '1';
    d.style.cssText = 'position:absolute;left:0;width:1px;visibility:hidden;pointer-events:none;' + css;
    el.appendChild(d);
    return d;
  };
  p = {
    safe: make('top:calc(var(--sat, 0px) + var(--safe-t, 56px));bottom:var(--safe-b, 240px);'),
    // the cluster's highest slot (D): its bottom gap and its size
    ctl: make('bottom:calc(var(--sab, 0px) + var(--ctl-d-b, 142px));height:var(--ctl-d-d, 48px);'),
    // the Heat bar's slot under the score bug
    heat: make('top:calc(var(--sat, 0px) + var(--heat-t, 49px));height:var(--heat-h, 6px);'),
  };
  probes.set(el, p);
  return p;
}

/** The geometry of a `.ps-geo` match root, in CSS px from its top edge. */
export function readGeometry(el: Element): Geometry {
  const root = el.getBoundingClientRect();
  const p = probeFor(el);
  const s = p.safe.getBoundingClientRect();
  const c = p.ctl.getBoundingClientRect();
  const toast = el.querySelector('.ps-toast-slot')?.getBoundingClientRect();
  const land = el.classList.contains('land');
  const heat = p.heat.getBoundingClientRect().bottom - root.top;
  return {
    safeTop: Math.round(s.top - root.top),
    safeBottom: Math.round(s.bottom - root.top),
    toastBottom: Math.round((toast ? toast.bottom : c.top) - root.top),
    controlTop: Math.round(c.top - root.top),
    // sideways the toast line sits under the bug, so it's part of the top HUD
    hudBottom: Math.round(land && toast ? Math.max(heat, toast.bottom - root.top) : heat),
    land,
  };
}

/** Two rects (x, y, w, h) intersect, with `pad` px of clearance. */
export function intersects(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad = 0): boolean {
  return a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;
}
