// Claude (studio overhaul, shell-6): the arena curtain's rules (curtain.ts), its tips, and static
// guards: the curtain lives in App only (0 edits to the match screens), it never listens on the arena,
// and it renders readable, logo-free content.
/// <reference types="vite/client" />
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ARENA_TIPS, arenaTip } from './arena-tips';
import { ArenaCurtain } from './ArenaCurtain';
import { CAP_MS, crestLetters, curtainPhase, kitColor, SETTLE_FRAMES, SHOW_AFTER_MS, type CurtainInput } from './curtain';

const at = (o: Partial<CurtainInput>): CurtainInput => ({ elapsed: 0, drawn: false, motion: false, settled: 0, handover: false, ...o });
// node's fs, read at run time (the app's tsconfig has no node types; CSS through Vite would come back empty)
const fs = (await import('node:fs' as string)) as { readFileSync(p: URL, enc: 'utf8'): string };
const src = (p: string): string => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

describe('curtainPhase', () => {
  it('covers the arena from its first frame, with no words before 150 ms', () => {
    expect(curtainPhase(at({ elapsed: 0 }), false)).toBe('cover');
    expect(curtainPhase(at({ elapsed: SHOW_AFTER_MS - 1, drawn: true }), false)).toBe('cover');
    // drawn but the motion clips not in yet: still covered (fallback poses never show)
    expect(curtainPhase(at({ elapsed: 100, drawn: true, motion: false, settled: 0 }), false)).toBe('cover');
  });
  it('an arena ready within 150 ms never shows the title card: the backdrop just goes', () => {
    expect(curtainPhase(at({ elapsed: 90, drawn: true, motion: true, settled: SETTLE_FRAMES }), false)).toBe('off');
    // ready means 2 settled frames after drawn + motion
    expect(curtainPhase(at({ elapsed: 90, drawn: true, motion: true, settled: SETTLE_FRAMES - 1 }), false)).toBe('cover');
  });
  it('shows the title card from 150 ms while the arena is not ready, then fades it', () => {
    expect(curtainPhase(at({ elapsed: SHOW_AFTER_MS }), false)).toBe('card');
    expect(curtainPhase(at({ elapsed: 900, drawn: true }), true)).toBe('card');
    expect(curtainPhase(at({ elapsed: 900, drawn: true, motion: true, settled: SETTLE_FRAMES }), true)).toBe('lifting');
  });
  it('a drawn arena waiting only on its clips keeps the backdrop 150 ms more (no flash of a title card)', () => {
    expect(curtainPhase(at({ elapsed: 320, drawn: true, drawnMs: 0 }), false)).toBe('cover');
    expect(curtainPhase(at({ elapsed: 420, drawn: true, drawnMs: 100 }), false)).toBe('cover');
    expect(curtainPhase(at({ elapsed: 470, drawn: true, drawnMs: SHOW_AFTER_MS }), false)).toBe('card');
    expect(curtainPhase(at({ elapsed: 360, drawn: true, drawnMs: 40, motion: true, settled: SETTLE_FRAMES }), false)).toBe('off');
  });
  it('never holds a match past the 2.5 s cap, ready or not', () => {
    expect(curtainPhase(at({ elapsed: CAP_MS }), true)).toBe('lifting');
    expect(curtainPhase(at({ elapsed: CAP_MS - 1 }), true)).toBe('card');
  });
  it('a curtain already up (the match files downloading) hands over with no gap and no delay', () => {
    expect(curtainPhase(at({ elapsed: 0, handover: true }), false)).toBe('card');
    expect(curtainPhase(at({ elapsed: 40, handover: true, drawn: true, motion: true, settled: 2 }), false)).toBe('lifting');
  });
});

describe('crests and colours', () => {
  it('letters from the abbreviation, else the initials', () => {
    expect(crestLetters({ name: 'You', abbr: 'YOU' })).toBe('YOU');
    expect(crestLetters({ name: 'AI Legend' })).toBe('AL');
    expect(crestLetters({ name: 'Boston Celtics Green' })).toBe('BCG');
    expect(crestLetters({ name: 'Mavericks' })).toBe('MAV');
    expect(crestLetters({ name: '  ' })).toBe('?');
  });
  it('only hex kit colours reach the inline SVG', () => {
    expect(kitColor('#1D428A', '#000')).toBe('#1D428A');
    expect(kitColor('#fff', '#000')).toBe('#fff');
    expect(kitColor('red; background:url(x)', '#000')).toBe('#000');
    expect(kitColor(undefined, '#123')).toBe('#123');
  });
});

describe('tips', () => {
  const engines = { nba: src('game/hoops2/Hoops2.tsx'), nfl: src('game/football2/Football2.tsx'), soccer: src('game/soccer2/Soccer2.tsx') };
  it('4–6 per sport, short enough for the card, no other game’s system names', () => {
    for (const list of Object.values(ARENA_TIPS)) {
      expect(list.length).toBeGreaterThanOrEqual(4);
      expect(list.length).toBeLessThanOrEqual(6);
      for (const t of list) {
        expect(t.text.length).toBeLessThanOrEqual(90);
        expect(t.text + t.head).not.toMatch(/\b(EA|2K|FIFA|FC ?\d|Madden|MyTeam|Ultimate Team|Konami|PES|eFootball|Pro Stick|Hesi|Pro Touch)\b/i);
      }
    }
  });
  it('every control a tip names in capitals is a label the engine shows today', () => {
    for (const [sport, list] of Object.entries(ARENA_TIPS)) {
      const code = engines[sport as keyof typeof engines];
      for (const t of list)
        for (const word of t.text.match(/\b[A-Z]{3,}(?: [A-Z]{2,})?\b/g) ?? []) {
          // a label is either JSX text or a string the engine uppercases (NFL's BULLET/TOUCH/LOB, JUKE/SPIN/POWER)
          const jsx = new RegExp('(>|\\n\\s*)' + word + '(\\s*<|\\s*\\n|\\s*\\{)');
          const hit = jsx.test(code) || code.includes("'" + word.toLowerCase() + "'") || code.includes("'" + word + "'");
          expect(hit, sport + ': ' + word).toBe(true);
        }
    }
  });
  it('the tip is a render-only choice: the same seed, the same tip; seeds spread over the list', () => {
    expect(arenaTip('nba', 'arcade:7')).toEqual(arenaTip('nba', 'arcade:7'));
    const seen = new Set(Array.from({ length: 40 }, (_, i) => arenaTip('soccer', 'm' + i).head));
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe('the curtain renders', () => {
  it('the title card: title, matchup with drawn crests (no images), tip, and a status role', () => {
    const html = renderToStaticMarkup(
      React.createElement(ArenaCurtain, { phase: 'card', seed: 's', info: { us: { name: 'You', abbr: 'YOU', c1: '#19e3c9', c2: '#0b2631' }, them: { name: 'AI PRO', c1: '#9b7bff', c2: '#5b3fd1' }, mode: 'Head to Head' } })
    );
    expect(html).toContain('role="status"');
    expect(html).toMatch(/TIP-OFF|KICKOFF|KICK-OFF/);
    expect(html).toContain('ac-crest');
    expect(html).toContain('>YOU<');
    expect(html).toContain('Head to Head');
    expect(html).not.toMatch(/<img|url\(http/);
  });
  it('the backdrop alone has no words to read', () => {
    const html = renderToStaticMarkup(React.createElement(ArenaCurtain, { phase: 'cover' }));
    expect(html).not.toContain('ac-card');
    expect(html).toContain('aria-label="Loading the match"');
  });
});

describe('static guards', () => {
  it('0 curtain edits in the match screens: Arcade, Training and Moments know nothing of it', () => {
    for (const f of ['game/Arcade.tsx', 'evolution/Training.tsx', 'ut/Moments.tsx']) expect(src(f)).not.toMatch(/curtain|ArenaCurtain|setArenaInfo|shell\/curtain/i);
  });
  it('App mounts the host once and uses the curtain as the match Suspense fallback', () => {
    const app = src('App.tsx');
    expect(app.match(/<ArenaCurtainHost\b/g)?.length).toBe(1);
    expect(app).toMatch(/fallback=\{<ArenaCurtain standalone/);
  });
  it('no shell listener on the arena: the curtain code only listens on window (arena-ready, online)', () => {
    for (const f of ['shell/ArenaCurtain.tsx', 'shell/curtain.ts']) {
      const code = src(f);
      const calls = code.match(/(\w+)\.addEventListener\(/g) ?? [];
      for (const c of calls) expect(c).toBe('window.addEventListener(');
      expect(code).not.toMatch(/onPointer|onTouch|onClick/);
    }
  });
  it('curtain text is at least 10 design px', () => {
    const css = src('shell/arena-curtain.css');
    const sizes = [...css.matchAll(/font-size:\s*([\d.]+)px/g)].map((m) => +m[1]);
    expect(sizes.length).toBeGreaterThanOrEqual(6);
    for (const px of sizes) expect(px).toBeGreaterThanOrEqual(10);
  });
});
