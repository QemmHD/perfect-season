// Claude, 2026-11-01 (wave 2): Streamlined SBCs on the SBC tab. Each stream shows its saved
// progress; its sheet lists every card that can go in (duplicates first, cheapest Item Score first,
// never locked favourites or squad players) with a one-tap "all duplicates" fill.
import React, { useMemo, useState } from 'react';
import { Sheet } from '../ui/common';
import { UtCard } from './CardArt';
import { itemScore } from './item-score';
import { packName } from './packs';
import type { Pool } from './pool';
import { STREAMS, streamCandidates, streamProgress, streamTarget, type StreamDef } from './streamlined';
import type { UtState } from './state';
import type { ClubCard } from './UltimateTeam';

const fmt = (n: number) => n.toLocaleString('en-US');

export function StreamlinedSection(props: { pool: Pool; ut: UtState; club: ClubCard[]; onSubmit: (id: string, uids: string[]) => void }) {
  const [open, setOpen] = useState<StreamDef | null>(null);
  return (
    <div className="ut-sbc-group ut-streams">
      <span className="eyebrow">Streamlined · any cards, duplicates welcome</span>
      {STREAMS.map((s) => {
        const target = streamTarget(props.pool, s.id);
        const have = streamProgress(props.ut, s.id);
        return (
          <button key={s.id} className="ut-stream" onClick={() => setOpen(s)}>
            <span className="ut-stream-top">
              <b className="disp">{s.title}</b>
              <i className="num">
                {fmt(have)} / {fmt(target)}
              </i>
            </span>
            <span className="bar">
              <i style={{ width: Math.min(100, (100 * have) / target) + '%' }} />
            </span>
            <small>
              {s.blurb} Reward: {packName(props.pool.sport, s.pack)}. Repeatable; progress is saved.
            </small>
          </button>
        );
      })}
      {open && <StreamSheet def={open} {...props} onClose={() => setOpen(null)} />}
    </div>
  );
}

function StreamSheet({ def, pool, ut, club, onSubmit, onClose }: { def: StreamDef; pool: Pool; ut: UtState; club: ClubCard[]; onSubmit: (id: string, uids: string[]) => void; onClose: () => void }) {
  const cands = useMemo(() => {
    const list = streamCandidates(ut, pool.sport, club);
    // duplicates (Duplicate Storage) first
    return list.slice().sort((a, b) => Number(!!b.storage) - Number(!!a.storage));
  }, [ut, club, pool.sport]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const target = streamTarget(pool, def.id);
  const have = streamProgress(ut, def.id);
  const adding = cands.filter((c) => picked.has(c.uid)).reduce((a, c) => a + itemScore(c.rc), 0);
  const toggle = (uid: string) => setPicked((p) => (p.has(uid) ? new Set([...p].filter((x) => x !== uid)) : new Set([...p, uid])));
  const dupes = cands.filter((c) => c.storage);
  const total = have + adding;
  return (
    <Sheet label={def.title} kind="bottom" onClose={onClose}>
      {(close) => (
        <div className="ut-stream-sheet">
          <h2 className="disp">{def.title}</h2>
          <p>
            Reward: {packName(pool.sport, def.pack)} for every {fmt(target)} points. Saved progress {fmt(have)}.
          </p>
          <div className="ut-stream-meter">
            <span className="bar thick">
              <i style={{ width: Math.min(100, (100 * have) / target) + '%' }} />
              <i className="add" style={{ left: Math.min(100, (100 * have) / target) + '%', width: Math.max(0, Math.min(100, (100 * total) / target) - Math.min(100, (100 * have) / target)) + '%' }} />
            </span>
            <b className="num">
              {fmt(total)} / {fmt(target)}
              {total >= target ? ' · ' + Math.floor(total / target) + '× reward' : ''}
            </b>
          </div>
          <div className="ut-stream-tools">
            <button className="btn" disabled={!dupes.length} onClick={() => setPicked(new Set(dupes.map((c) => c.uid)))}>
              ALL DUPLICATES ({dupes.length})
            </button>
            <button className="btn" disabled={!picked.size} onClick={() => setPicked(new Set())}>
              CLEAR
            </button>
          </div>
          <div className="ut-stream-grid" data-sheet-noswipe>
            {cands.slice(0, 160).map((c) => (
              <button key={c.uid} className={'ut-stream-card' + (picked.has(c.uid) ? ' on' : '')} onClick={() => toggle(c.uid)} aria-pressed={picked.has(c.uid)} aria-label={c.rc.line.name + ', ' + itemScore(c.rc) + ' points'}>
                <UtCard rc={c.rc} w={52} level={c.oc.level} />
                <i className="num">{fmt(itemScore(c.rc))}</i>
                {c.storage && <em>DUPE</em>}
              </button>
            ))}
            {!cands.length && <p className="note">No cards can go in: locked favourites and players in your squad are kept out.</p>}
          </div>
          <button className="btn gold" disabled={!picked.size} onClick={() => close(() => (onClose(), onSubmit(def.id, [...picked])))}>
            ADD {picked.size} {picked.size === 1 ? 'CARD' : 'CARDS'} · +{fmt(adding)}
          </button>
          <small className="note">Cards you add leave your club. Locked favourites are never listed.</small>
        </div>
      )}
    </Sheet>
  );
}
