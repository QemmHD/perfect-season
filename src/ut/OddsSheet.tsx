// Claude (packs-4, 2026-11-16): the odds sheet (packs-plan §5 packs-4 item 3; owner decision 4, "clear
// odds sheets"). Loaded lazily (odds-lazy.tsx) and computed only when opened, from odds.ts: the one source
// of published numbers. It opens from every Store tile, the Preview Pack, waiting packs and picks, program
// packs, the buy confirm, SBC rewards, pick sheets and (through the exported lazy sheet) ut's Scout Drop
// screen and any random MINUTES, league or Rookie Week reward.
//
// Layout: the header (what it is), a scrolling body ("chance of at least one" by overall, then by edition,
// the featured card and holo; the notes; PER CARD), and a footer that never scrolls ("Each pack is
// independent. Updated …" and CLOSE). Every number is a computed chance, written by fmtPct.
import React, { useMemo, useState } from 'react';
import { Sheet } from '../ui/common';
import type { DropIndex } from './drop-tables';
import { dropSheet, type DropSheet, fmtPct, oddsFor, type OddsRow, type OddsTable, oneIn, pickTable, rewardOdds } from './odds';
import './odds-sheet.css';
import type { Pool } from './pool';
import type { Reward } from './sbc';
import type { UtSport } from './types';

/** What a sheet shows: a pack by its kind, a pick by its kind, a random reward, or a Scout Drop. */
export type OddsSource = { type: 'pack'; kind: string } | { type: 'pick'; kind: string } | { type: 'reward'; reward: Reward } | { type: 'drop'; index: DropIndex };

export interface OddsSheetProps {
  /** the card pool (not needed for a Scout Drop) */
  pool?: Pool | null;
  sport: UtSport;
  source: OddsSource;
  /** the instant the odds are for (default now): a program pack's boost and released cards, the week's Standouts */
  at?: number;
  onClose: () => void;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "16 Nov 2026" */
export const dateText = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return d + ' ' + MONTHS[m - 1] + ' ' + y;
};

const left = (ms: number) => {
  const m = Math.max(1, Math.ceil(ms / 60000));
  return m >= 1440 ? Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm';
};

/** One "at least one" row: its name, a bar as long as the chance, the chance (and "1 in N" under 1%). */
function Row({ r, tone }: { r: OddsRow; tone?: string }) {
  const one = oneIn(r.p);
  return (
    <div className={'ps-odds-row' + (tone ? ' ' + tone : '')} role="row">
      <span className="ps-odds-label" role="rowheader">
        {r.label}
      </span>
      <span className="ps-odds-bar" aria-hidden="true">
        <i
          style={{
            width: Math.max(r.p > 0 ? 1.5 : 0, Math.min(100, r.p * 100)) + '%',
          }}
        />
      </span>
      <b className="ps-odds-pct num" role="cell">
        {fmtPct(r.p)}
        {one && <small>{one}</small>}
      </b>
    </div>
  );
}

function Group({ title, rows, tone }: { title: string; rows: OddsRow[]; tone?: (r: OddsRow) => string | undefined }) {
  if (!rows.length) return null;
  return (
    <div className="ps-odds-group" role="table" aria-label={title}>
      <span className="ps-odds-sub" role="presentation">
        {title}
      </span>
      {rows.map((r) => (
        <Row key={r.key} r={r} tone={tone?.(r)} />
      ))}
    </div>
  );
}

/** The tier rows' colour (the tier chip palette). */
const toneOf = (r: OddsRow) => (r.key.startsWith('t-') ? 'tone-' + r.key.slice(2) : r.key === 'holo' ? 'tone-holo' : r.key === 'featured' ? 'tone-featured' : undefined);

function TableView({ t, at }: { t: OddsTable; at: number }) {
  const [perCard, setPerCard] = useState(false);
  const what = t.kind === 'pick' ? 'among the ' + t.cards + ' options' : t.kind === 'reward' ? 'in this reward' : 'in a pack';
  const editions: OddsRow[] = [...t.tiers];
  if (t.featured)
    editions.push({
      key: 'featured',
      label: 'Featured: ' + t.featured.name,
      p: t.featured.p,
    });
  if (t.holo > 0) editions.push({ key: 'holo', label: 'Holographic special', p: t.holo });
  return (
    <div className="ps-odds-body" data-sheet-noswipe>
      {t.boosted && (
        <p className="ps-odds-boost">
          <b>BOOSTED</b> program card {fmtPct(t.boosted.now)} (normally {fmtPct(t.boosted.base)}) for {left(t.boosted.until - at)}
        </p>
      )}
      <h3 className="ps-odds-h">Chance of at least one {what}</h3>
      <Group title="By overall" rows={t.bands} />
      <Group title="By edition" rows={editions} tone={toneOf} />
      {!t.bands.length && !editions.length && <p className="ps-odds-none">Nothing in it is left to chance.</p>}
      {t.notes.length > 0 && (
        <ul className="ps-odds-notes">
          {t.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {t.perSlot.length > 0 && (
        <>
          <button className="ps-odds-toggle" aria-expanded={perCard} onClick={() => setPerCard((x) => !x)}>
            <span>{t.kind === 'pick' ? 'PER OPTION' : 'PER CARD'}</span>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
              <path d={perCard ? 'M2 8 6 4l4 4' : 'M2 4l4 4 4-4'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {perCard && (
            <div className="ps-odds-slots">
              {t.perSlot.map((s, i) => (
                <div key={i} className="ps-odds-slot">
                  <b>{s.label}</b>
                  <span>
                    {s.chips.map((c) => (
                      <i key={c.key} className={'ut-tierchip t-' + (c.key.startsWith('g') || c.key === 'rare' ? 'gold' : c.key)}>
                        {c.label} {fmtPct(c.p)}
                      </i>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DropView({ d }: { d: DropSheet }) {
  return (
    <div className="ps-odds-body" data-sheet-noswipe>
      <h3 className="ps-odds-h">Each tap</h3>
      <div className="ps-odds-group" role="table" aria-label="Each tap">
        {d.steps.map((s) => (
          <Row key={s.from} r={{ key: s.from, label: cap(s.from) + ' → ' + cap(s.to), p: s.p }} tone={'tone-drop-' + s.to} />
        ))}
      </div>
      <h3 className="ps-odds-h">Where it ends</h3>
      <div className="ps-odds-group" role="table" aria-label="Final odds">
        {d.final.map((f) => (
          <div key={f.tier} className="ps-odds-final">
            <Row r={{ key: f.tier, label: f.label, p: f.p }} tone={'tone-drop-' + f.tier} />
            <small>{f.reward}</small>
          </div>
        ))}
      </div>
      <ul className="ps-odds-notes">
        {d.notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
        <li>On average a drop is worth about {Math.round(d.ev)} coins (stamps and packs at their value).</li>
      </ul>
    </div>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The odds sheet. Default export, so `React.lazy` can load it (odds-lazy.tsx). */
export default function OddsSheet({ pool, sport, source, at, onClose }: OddsSheetProps) {
  const when = useMemo(() => at ?? Date.now(), [at]);
  const view = useMemo((): { table?: OddsTable | null; drop?: DropSheet } => {
    if (source.type === 'drop') return { drop: dropSheet(sport, source.index) };
    if (!pool) return { table: null };
    if (source.type === 'pack') return { table: oddsFor(pool, source.kind, when) };
    if (source.type === 'pick') return { table: pickTable(pool, source.kind, when) };
    return { table: rewardOdds(pool, source.reward, when) };
  }, [pool, sport, source, when]);
  const title = view.drop?.title ?? view.table?.title ?? 'Odds';
  const updated = view.drop?.updated ?? view.table?.updated;
  const eyebrow = source.type === 'drop' ? 'SCOUT DROP ODDS' : source.type === 'pick' ? 'PICK ODDS' : source.type === 'reward' ? 'REWARD ODDS' : 'PACK ODDS';
  const independent =
    source.type === 'drop'
      ? 'Each drop is rolled on its own.'
      : source.type === 'pick'
        ? 'Each pick is drawn on its own.'
        : source.type === 'reward'
          ? 'Each reward is drawn on its own.'
          : 'Each pack is independent.';
  return (
    <Sheet label={title + ' odds'} kind="bottom" onClose={onClose}>
      {(close) => (
        <div className="ps-odds">
          <header className="ps-odds-head">
            <span className="eyebrow">{eyebrow}</span>
            <h2 className="disp">{title}</h2>
            {view.table && <p>{view.table.slotsText}</p>}
            {view.drop && <p>{view.drop.taps} taps, free. These are the exact chances before your first tap.</p>}
          </header>
          {view.drop ? (
            <DropView d={view.drop} />
          ) : view.table ? (
            <TableView t={view.table} at={when} />
          ) : (
            <p className="ps-odds-none">This item has no random draw to publish: what it holds is fixed.</p>
          )}
          <footer className="ps-odds-foot">
            <small>
              {independent}
              {updated ? ' Updated ' + dateText(updated) + '.' : ''}
            </small>
            <button className="btn" onClick={() => close()}>
              CLOSE
            </button>
          </footer>
        </div>
      )}
    </Sheet>
  );
}
