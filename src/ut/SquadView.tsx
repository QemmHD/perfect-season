// The squad builder: the court (or the field, offense and defense) with a card on every spot, the
// chemistry links between neighbours, the team overall, and auto-build. Tap a spot to pick a card
// for it: the ones that can play there, best first, with what each does to the chemistry.
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pickFor, SPORT } from '../engine/sport';
import { sfx } from '../lib/sound';
import { Sheet } from '../ui/common';
import { UtCard } from './CardArt';
import { playerChem } from './chem-pips';
import { IconWand } from './icons';
import { type Pool, seasonText } from './pool';
import { autoBuild, CHEM_BONUS, canPlay, FORMATIONS, type Formation, FULL_LINK, type Lineup, rateSquad, type SlotDef, slotsFor, type SquadRating } from './squad';
import type { ClubCard } from './UltimateTeam';

function linkClass(score: number, open: boolean): string {
  if (open) return 'open';
  return score >= FULL_LINK ? 'full' : score >= 3 ? 'mid' : score > 0 ? 'weak' : 'none';
}

/** The court or the field (or soccer's pitch): its lines, drawn under the cards. */
function Surface({ nba, unit }: { nba: boolean; unit: string }) {
  if (SPORT === 'soccer')
    return (
      <svg className="ut-surface ut-field ut-pitch-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
          <rect key={i} x="0" y={i * 10} width="100" height="10" className={i % 2 ? 'turf b' : 'turf'} />
        ))}
        <rect x="1.5" y="1" width="97" height="98" className="ln" fill="none" />
        <path d="M1.5 1 H98.5" className="ln" />
        <path d="M38 1 A12 9 0 0 0 62 1" className="ln" fill="none" />
        <rect x="24" y="82" width="52" height="17" className="ln" fill="none" />
        <rect x="38" y="93" width="24" height="6" className="ln" fill="none" />
        <path d="M40 82 A10 6 0 0 1 60 82" className="ln" fill="none" />
      </svg>
    );
  if (nba)
    return (
      <svg className="ut-surface ut-court" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <rect x="1" y="1" width="98" height="98" rx="2" className="ln" />
        <rect x="34" y="1" width="32" height="38" className="paint" />
        <path d="M34 39 A16 12 0 0 0 66 39" className="ln" />
        <path d="M6 1 V22 A44 50 0 0 0 94 22 V1" className="ln" />
        <path d="M44 6 H56 M50 6 V8" className="rim" />
        <circle cx="50" cy="10" r="2.6" className="rim" />
        <path d="M38 99 A12 9 0 0 1 62 99" className="ln" />
      </svg>
    );
  return (
    <svg className={'ut-surface ut-field ' + unit} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <rect key={i} x="0" y={i * 10} width="100" height="10" className={i % 2 ? 'turf b' : 'turf'} />
      ))}
      {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((y) => (
        <path key={y} d={'M0 ' + y + ' H100'} className="ln" />
      ))}
      <path d={unit === 'off' ? 'M0 31 H100' : 'M0 93 H100'} className="los" />
    </svg>
  );
}

export function SquadView(props: {
  pool: Pool;
  club: ClubCard[];
  lineup: Lineup;
  squad: Record<string, string>;
  rating: SquadRating;
  onSlot: (slot: string, uid: string | null) => void;
  onSquad: (squad: Record<string, string>) => void;
  onInspect: (uid: string) => void;
  onToast: (t: string) => void;
  management?: React.ReactNode;
  /** soccer (Claude 2026-11-01): the formation, and changing it */
  formation?: Formation;
  onFormation?: (f: Formation) => void;
}) {
  const soccer = SPORT === 'soccer';
  const { lineup, rating, squad } = props;
  const nba = SPORT === 'nba';
  const [unit, setUnit] = useState<'off' | 'def'>('off');
  const [pick, setPick] = useState<SlotDef | null>(null);
  const slots = slotsFor(SPORT);
  const onPitch = slots.filter((s) => (nba || soccer ? s.unit === 'start' : s.unit === unit));
  const bench = nba ? slots.filter((s) => s.unit === 'bench') : [];
  const byUid = useMemo(() => new Map(props.club.map((c) => [c.uid, c])), [props.club]);
  const pos = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);

  // the cards' size follows the room the pitch has
  const pitch = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 358, h: 360 });
  useLayoutEffect(() => {
    const el = pitch.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  // soccer's eleven are on one pitch, in up to five lines
  const cw = Math.floor(nba ? Math.min(box.w * 0.22, (box.h * 0.36) / 1.4, 84) : soccer ? Math.min(box.w * 0.16, (box.h * 0.19) / 1.4, 58) : Math.min(box.w * 0.165, (box.h * 0.235) / 1.4, 64));

  // Claude: per-player chemistry pips (display only)
  const pips = useMemo(() => playerChem(SPORT, props.lineup), [props.lineup]);
  const links = rating.links.filter((l) => pos.get(l.a)?.unit === onPitch[0]?.unit && pos.get(l.b)?.unit === onPitch[0]?.unit);
  const auto = () => {
    sfx.select();
    const next = autoBuild(SPORT, props.club.map((c) => ({ uid: c.uid, rc: c.rc })));
    props.onSquad(next);
    const r = rateSquad(SPORT, Object.fromEntries(Object.entries(next).map(([s, u]) => [s, byUid.get(u)?.rc])));
    props.onToast('Best squad: ' + r.ovr + ' overall, ' + r.chem + ' chemistry' + (r.complete ? '.' : '. Some spots have nobody who can play them yet.'));
  };

  /** a spot on the pitch, in px: its place, kept inside the edges (the card and its tag) */
  const place = (s: SlotDef, w: number): React.CSSProperties => {
    const h = w * 1.4 + 10;
    const x = Math.max(w / 2 + 2, Math.min(box.w - w / 2 - 2, (s.x / 100) * box.w));
    const y = Math.max(h / 2 + 2, Math.min(box.h - h / 2 - 2, (s.y / 100) * box.h));
    return { left: x, top: y };
  };
  /** the same, in % of the pitch, for the chemistry lines */
  const at = (s: SlotDef) => {
    const p = place(s, cw);
    return { x: (100 * (p.left as number)) / Math.max(1, box.w), y: (100 * (p.top as number)) / Math.max(1, box.h) };
  };

  const token = (s: SlotDef, w: number) => {
    const c = squad[s.id] ? byUid.get(squad[s.id]) : undefined;
    return (
      <button
        key={s.id}
        className={'ut-slot' + (c ? ' filled' : '') + (s.unit === 'bench' ? ' bench' : '')}
        style={s.unit === 'bench' ? undefined : place(s, w)}
        onClick={() => (sfx.click(), setPick(s))}
        aria-label={s.id + (c ? ': ' + c.rc.line.name + ', ' + c.rc.ovr : ': empty')}
      >
        {c ? (
          <UtCard rc={c.rc} w={w} level={c.oc.level} mint={c.oc.mint} numbered />
        ) : (
          <span className="ut-slot-empty" style={{ width: w, height: Math.round(w * 1.4) }}>
            <b>+</b>
            <i>{s.pos ?? 'ANY'}</i>
          </span>
        )}
        <i className="ut-slot-tag">
          {s.id}
          {c && s.weight > 0 && pips[s.id] !== undefined && (
            <span className={'ut-pips p' + pips[s.id]} aria-label={pips[s.id] + ' of 3 chemistry'}>
              <i />
              <i />
              <i />
            </span>
          )}
        </i>
      </button>
    );
  };

  return (
    <div className={'ut-squad' + (nba ? ' nba' : soccer ? ' soccer' : ' nfl')}>
      <div className="ut-squad-head">
        <span className="ut-sq-big">
          <b className="disp num">{rating.filled ? rating.ovr : '—'}</b>
          <i>OVR</i>
        </span>
        <button
          className="ut-chem"
          onClick={() =>
            props.onToast(
              soccer
                ? 'Chemistry: every line links two neighbours. Same club +4, same league +2, same season +1; six points makes a full link. Full chemistry adds ' + CHEM_BONUS + ' to the team overall.'
                : 'Chemistry: every line links two neighbours. Same franchise +3, same decade +2, same season +4; six points makes a full link. Full chemistry adds ' + CHEM_BONUS + ' to the team overall.'
            )
          }
        >
          <span className="ut-chem-top">
            <i>CHEMISTRY</i>
            <b className="num">{rating.chem}</b>
          </span>
          <span className="bar ut-chembar">
            <i style={{ width: rating.chem + '%' }} className={rating.chem >= 70 ? 'full' : ''} />
          </span>
          <small>+{((CHEM_BONUS * rating.chem) / 100).toFixed(1)} OVR from chemistry · how?</small>
        </button>
        <button className="icon-btn pill-btn ut-auto" onClick={auto}>
          <IconWand size={16} /> AUTO
        </button>
      </div>
      {props.management && <div className="hq-squad-toolbar"><span className="eyebrow">Matchday squad · 3 saved lineups</span>{props.management}</div>}
      {soccer && props.onFormation && (
        <span className="seg ut-unit ut-formations" role="group" aria-label="Formation">
          {FORMATIONS.map((f) => (
            <button key={f} className={props.formation === f ? 'on' : ''} aria-pressed={props.formation === f} onClick={() => (sfx.click(), props.onFormation!(f))}>
              {f}
            </button>
          ))}
        </span>
      )}
      {!nba && !soccer && (
        <span className="seg ut-unit" role="group" aria-label="Unit">
          {(['off', 'def'] as const).map((u) => (
            <button key={u} className={unit === u ? 'on' : ''} aria-pressed={unit === u} onClick={() => (sfx.click(), setUnit(u))}>
              {u === 'off' ? 'OFFENSE + K' : 'DEFENSE'}
            </button>
          ))}
        </span>
      )}
      <div className="ut-pitch" ref={pitch}>
        <Surface nba={nba} unit={unit} />
        <svg className="ut-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {links.map((l) => {
            const a = at(pos.get(l.a)!);
            const b = at(pos.get(l.b)!);
            const open = !lineup[l.a] || !lineup[l.b];
            return <line key={l.a + l.b} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={'ut-link ' + linkClass(l.score, open)} />;
          })}
        </svg>
        {onPitch.map((s) => token(s, cw))}
      </div>
      {nba && (
        <div className="ut-bench">
          <span className="eyebrow">Bench · subs in when a starter tires</span>
          <div className="ut-bench-row">{bench.map((s) => token(s, 58))}</div>
        </div>
      )}
      {pick && (
        <Picker
          slot={pick}
          club={props.club}
          lineup={lineup}
          squad={squad}
          onPick={(uid) => {
            sfx.place();
            props.onSlot(pick.id, uid);
            setPick(null);
          }}
          onInspect={props.onInspect}
          onClose={() => setPick(null)}
        />
      )}
    </div>
  );
}

/** Pick a card for a spot: everyone who can play it, best first, and what he does to the chemistry. */
function Picker(props: { slot: SlotDef; club: ClubCard[]; lineup: Lineup; squad: Record<string, string>; onPick: (uid: string | null) => void; onInspect: (uid: string) => void; onClose: () => void }) {
  const { slot, lineup, squad } = props;
  const here = squad[slot.id];
  const base = rateSquad(SPORT, lineup);
  const pidsElsewhere = new Map<string, string>();
  for (const [s, u] of Object.entries(squad)) {
    if (s === slot.id) continue;
    const c = props.club.find((x) => x.uid === u);
    if (c) pidsElsewhere.set(c.rc.line.pid, u);
  }
  const options = useMemo(
    () =>
      props.club
        .filter((c) => canPlay(slot, c.rc) && c.uid !== here)
        // the same player twice: only by moving that very card
        .filter((c) => !pidsElsewhere.has(c.rc.line.pid) || pidsElsewhere.get(c.rc.line.pid) === c.uid)
        .map((c) => {
          const next = { ...lineup, [slot.id]: c.rc };
          if (c.slot) next[c.slot] = here ? props.club.find((x) => x.uid === here)?.rc : null;
          const r = rateSquad(SPORT, next);
          return { c, d: r.raw - base.raw, chem: r.chem - base.chem };
        })
        .sort((a, b) => b.c.rc.ovr - a.c.rc.ovr || b.d - a.d)
        .slice(0, 80),
    [slot, props.club, lineup]
  );
  const cur = here ? props.club.find((c) => c.uid === here) : undefined;
  return (
    <Sheet label={'Pick for ' + slot.id} kind="bottom" onClose={props.onClose}>
      {(close) => (
        <div className="ut-picker">
          <div className="ut-picker-head">
            <h2 className="disp">{slot.pos ? slot.id + (slot.id !== slot.pos ? ' · ' + slot.pos : '') : 'Bench · ' + slot.id}</h2>
            {cur && (
              <span className="ut-picker-cur">
                <button className="chip" onClick={() => close(() => props.onInspect(cur.uid))}>
                  DETAILS
                </button>
                <button className="chip" onClick={() => close(() => props.onPick(null))}>
                  REMOVE
                </button>
              </span>
            )}
          </div>
          {options.length ? (
            <div className="ut-picker-list">
              {options.map(({ c, d, chem }) => (
                <button key={c.uid} className="ut-pickrow" onClick={() => close(() => props.onPick(c.uid))}>
                  <UtCard rc={c.rc} w={44} level={c.oc.level} mint={c.oc.mint} numbered />
                  <span className="ut-pickrow-txt">
                    <b>{c.rc.line.name}</b>
                    <small>
                      {c.rc.line.pos.join('/')} · {seasonText(c.rc.line)} {c.rc.line.abbr}
                      {c.slot ? ' · in squad at ' + c.slot : ''}
                    </small>
                  </span>
                  <span className="ut-pickrow-nums">
                    <b className="num">{c.rc.ovr}</b>
                    {slot.weight > 0 && <i className={'num ' + (chem > 0 ? 'up' : chem < 0 ? 'down' : '')}>{(chem > 0 ? '+' : '') + chem + ' chem'}</i>}
                    {slot.weight > 0 && Math.abs(d) >= 0.05 && <small className={'num ' + (d > 0 ? 'up' : 'down')}>{(d > 0 ? '+' : '') + d.toFixed(1) + ' team'}</small>}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">No cards that can play {slot.pos ?? 'here'} yet. {slot.pos ? 'A ' + pickFor(SPORT, { nba: 'Position', nfl: 'Unit', soccer: 'Position' }) + ' Pack in the Store gets three or more.' : ''}</div>
          )}
        </div>
      )}
    </Sheet>
  );
}
