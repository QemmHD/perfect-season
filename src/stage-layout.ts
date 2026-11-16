// Codex (OpenAI), 2026-11-07: browser-agnostic viewport/frame geometry, never inferred from a device's advertised screen height.
export const DESIGN_W = 390;
export type Fit = 'compact' | 'tight' | 'normal' | 'roomy';
export type Rot = 0 | 90 | -90;
export type Insets = [number, number, number, number];
export interface Layout {
  k: number;
  h: number;
  /** the raw top safe-area inset (status bar / Dynamic Island), frame px */
  sat: number;
  sab: number;
  /** Claude (studio overhaul, shell-2): clearance below `sat` that iOS blurs and dims under the status bar, frame px; 0 rotated or framed */
  edge: number;
  /** the height between the raw insets (h - sat - sab), frame px; the size classes read this, so the edge never flips one */
  room: number;
  /** the height left for screens below `sat + edge` and above `sab` (room - edge), frame px */
  content: number;
  fit: Fit;
  framed: boolean;
  rot: Rot;
}
export interface ViewportBox { w:number; h:number; x:number; y:number; }
export interface StageBox extends Layout { transform:string; }
export interface ViewportInput {
  width:number;
  height:number;
  visual?: {width:number;height:number;offsetLeft:number;offsetTop:number;scale:number} | null;
}
const positive=(n:number,fallback:number)=>Number.isFinite(n)&&n>0?n:fallback;
const inset=(n:number)=>Number.isFinite(n)?Math.max(0,n):0;
/** The visual viewport is the actually visible browser area; browser chrome and keyboards can shrink it.
 * At browser zoom >1, keep normal layout coordinates and let the browser perform the zoom once.
 */
export function visibleViewport(input:ViewportInput):ViewportBox {
 const w=positive(input.width,390),h=positive(input.height,844),v=input.visual;
 if(v&&Number.isFinite(v.scale)&&Math.abs(v.scale-1)<0.01&&v.width>0&&v.height>0&&Number.isFinite(v.width)&&Number.isFinite(v.height))
  return {w:v.width,h:v.height,x:inset(v.offsetLeft),y:inset(v.offsetTop)};
 return {w,h,x:0,y:0};
}
/** Claude (studio overhaul, shell-2, 2026-11-16): iOS 26 blurs and dims a band below the status bar that
 * reaches past the reported safe-area inset (audit-ut-ui C1: 22 pt on Dynamic Island phones, about 19 on a
 * 47-pt notch, about 8 under a plain 20-pt status bar). Screens keep their content below inset + edge.
 * Screen pt in, screen pt out. scripts/qa/edge-lib.mjs `edgeOf` mirrors this; both are tested on the same table.
 */
export const EDGE_MAX = 22;
export function topEdge(insetTop:number):number {
 return Number.isFinite(insetTop)?Math.min(EDGE_MAX,Math.round(Math.max(0,insetTop)*0.4)):0;
}
export function fitFor(content:number):Fit {
 return content<650?'compact':content<730?'tight':content<800?'normal':'roomy';
}
/** An upright phone can become wider than its visible height when the keyboard opens.
 * A known portrait orientation must win over this aspect ratio, otherwise typing rotates the app.
 */
export function portraitRotation(width:number,height:number,coarse:boolean,angle?:number):Rot {
 if(!coarse||width<=height||height>=520)return 0;
 if(Number.isFinite(angle)) {
  const a=((angle!%360)+360)%360;
  return a===270?90:a===90?-90:0;
 }
 return -90;
}
/** Phones always fill the visible width. Short content scrolls inside screens; it never shrinks the whole app.
 * `sat` stays the raw inset; the edge below it is reported separately (`edge`; 0 when rotated, because iOS hides
 * the status bar in landscape, and on framed desktop/tablet layouts, which have no status bar over them).
 */
export function stageBox(viewport:ViewportBox,insets:Insets,rot:Rot=0):StageBox {
 const VW=positive(viewport.w,390),VH=positive(viewport.h,844),W=rot?VH:VW,H=rot?VW:VH;
 const [vt,vr,vb,vl]=insets.map(inset);
 const [top,bottom]=rot===-90?[vl,vr]:rot===90?[vr,vl]:[vt,vb];
 let k:number,h:number,x:number,y:number,sat=0,sab=0,edge=0,framed=false;
 if(W<=600) {
  k=W/DESIGN_W;h=H/k;x=0;y=0;
  sat=Math.min(top,H)/k;sab=Math.min(bottom,Math.max(0,H-top))/k;
  edge=rot?0:topEdge(top)/k;
 } else {
  const m=Math.min(24,H/10,W/10),availableW=Math.max(1,W-2*m),availableH=Math.max(1,H-2*m);
  framed=true;k=Math.min(1.2,availableW/DESIGN_W,availableH/600);h=Math.min(844,availableH/k);
  x=(W-DESIGN_W*k)/2;y=(H-h*k)/2;
 }
 const place='translate('+x+'px,'+y+'px) scale('+k+')';
 const transform=rot===-90?'translate(0px,'+VH+'px) rotate(-90deg) '+place:rot===90?'translate('+VW+'px,0px) rotate(90deg) '+place:place;
 const room=Math.max(0,h-sat-sab),content=Math.max(0,room-edge);
 // the size class reads the room between the raw insets, so adding the edge never changes a phone's class
 return {k,h,sat,sab,edge,room,content,fit:fitFor(room),framed,rot,transform};
}
