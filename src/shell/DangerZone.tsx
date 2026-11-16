// Claude (studio overhaul, shell-4, 2026-11-16): Settings → Advanced → Erase all progress (audit M8).
// It used to be one confirm away. Now an erase takes at least three deliberate actions before the
// last tap: open Advanced, type ERASE, and tick an acknowledgement worded by the cloud save's live
// state. The panel shows the real amounts that go and what stays. KEEP MY PROGRESS is the primary
// action. Nothing here writes storage or sends a request; ERASE EVERYTHING calls the unchanged
// reset handler (App.tsx).
import React, { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { SPORT, SPORT_LABEL } from '../engine/sport';
import { cloudStatus, subscribeCloud } from '../lib/cloud-save';
import type { Profile } from '../lib/profile';
import { canErase, cloudLine, ERASE_WORD, eraseSummary } from './danger';
import './danger-zone.css';

const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many: string) => fmt(n) + ' ' + (n === 1 ? one : many);

export function DangerZone({ profile, onErase }: { profile: Profile; onErase: () => void }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  return (
    <section className={'danger' + (open ? ' open' : '')}>
      <button className="danger-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
        <span>ADVANCED</span>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && <ErasePanel id={panelId} profile={profile} onKeep={() => setOpen(false)} onErase={onErase} />}
    </section>
  );
}

function ErasePanel({ id, profile, onKeep, onErase }: { id: string; profile: Profile; onKeep: () => void; onErase: () => void }) {
  const [typed, setTyped] = useState('');
  const [ack, setAck] = useState(false);
  const status = useSyncExternalStore(subscribeCloud, cloudStatus);
  const cloud = cloudLine(status, Date.now());
  // the amounts as the panel opened: they can't change while Settings is up
  const sum = useMemo(() => eraseSummary(profile, SPORT), []);
  const keep = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLDivElement>(null);
  const word = canErase(typed);
  const ready = word && ack;
  useEffect(() => {
    keep.current?.focus({ preventScroll: true });
    keep.current?.scrollIntoView({ block: 'nearest' });
  }, []);
  // the keyboard shrinks the screen: keep the word, the tick and both buttons in view
  const showConfirm = () => window.setTimeout(() => confirm.current?.scrollIntoView({ block: 'end' }), 250);
  return (
    <div className="danger-panel" id={id}>
      <div className="danger-head">
        <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
          <path d="M11 2.5 20.5 19h-19z" />
          <path d="M11 8.5v5M11 16.2v.3" />
        </svg>
        <h3 className="disp">ERASE ALL PROGRESS</h3>
      </div>
      <p className="danger-lead">This can’t be undone. It erases:</p>
      <ul className="danger-loses">
        <li>
          <b className="num">{fmt(sum.coins)}</b> coins · Level <b className="num">{sum.level}</b> (<span className="num">{fmt(sum.xp)}</span> XP)
          {sum.boosters > 0 && <> · {plural(sum.boosters, 'booster', 'boosters')}</>}
        </li>
        {sum.sports.map((s) => (
          <li key={s.sport}>
            <span className="danger-sport">{SPORT_LABEL[s.sport]}</span> <b className="num">{fmt(s.cards)}</b> {s.cards === 1 ? 'card' : 'cards'} · {plural(s.runs, 'draft run', 'draft runs')}
          </li>
        ))}
      </ul>
      <p className="danger-also">With them go each sport’s Ultimate Team club and progress, the Gauntlet, missions, the binder and any unfinished draft.</p>
      <p className="danger-keeps">
        <b>Stays:</b> your name, your leaderboard entries, your head-to-head record and your daily streak.
      </p>
      <p className={'danger-cloud' + (cloud.on ? ' on' : '')} role="status">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 17a4 4 0 0 1-.5-7.97 6.5 6.5 0 0 1 12.5-.8A4.5 4.5 0 0 1 18 17z" />
        </svg>
        <span>{cloud.text}</span>
      </p>
      <div className="danger-confirm" ref={confirm}>
        <label className="danger-type">
          <span>
            Type <b>{ERASE_WORD}</b> to confirm
          </span>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onFocus={showConfirm}
            className={word ? 'ok' : ''}
            autoCapitalize="characters"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label={'Type ' + ERASE_WORD + ' to confirm'}
            maxLength={12}
          />
        </label>
        <label className="danger-tick">
          <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          <span className="danger-box" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 16 16">
              <path d="m3.5 8.5 3 3 6-7" />
            </svg>
          </span>
          <span>{cloud.tick}</span>
        </label>
        <div className="danger-actions">
          <button ref={keep} className="btn primary" onClick={onKeep}>
            KEEP MY PROGRESS
          </button>
          <button className="btn danger" aria-disabled={!ready} onClick={() => ready && onErase()}>
            ERASE EVERYTHING
          </button>
        </div>
      </div>
    </div>
  );
}
