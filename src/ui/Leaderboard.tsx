import React, { useEffect, useState } from 'react';
import { nameProblem, randomName } from '../lib/names';
import type { Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { type BoardKind, type BoardRow, cachedBoard, fetchBoard, type Span } from '../net/leaderboard';
import { lastName, Sheet, shortEra } from './common';
import { Ranks as RanksIcon, Refresh, Trophy } from './icons';

/** The name field with a dice button for a random name, shared by the welcome screen and the name sheet. */
export function NameField({ value, onChange, error, autoFocus }: { value: string; onChange: (v: string) => void; error: string | null; autoFocus?: boolean }) {
  return (
    <div className="namefield-wrap">
      <input
        className={'namefield' + (error ? ' bad' : '')}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 16))}
        maxLength={16}
        placeholder="Your name"
        aria-label="Your player name"
        aria-invalid={!!error}
        autoComplete="nickname"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="dice"
        aria-label="Random name"
        onClick={() => {
          sfx.select();
          onChange(randomName());
        }}
      >
        <Refresh size={18} />
      </button>
    </div>
  );
}

/** Change the name shown on the leaderboard and to head-to-head opponents. */
export function NameSheet({ profile, onSaved, onClose }: { profile: Profile; onSaved: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(profile.name ?? randomName());
  const [err, setErr] = useState<string | null>(null);
  const submit = (close: (after?: () => void) => void) => {
    const problem = nameProblem(name);
    if (problem) {
      setErr(problem);
      sfx.nope();
      return;
    }
    sfx.click();
    close(() => onSaved(name.trim()));
  };
  return (
    <Sheet label="Your name" kind="top" onClose={onClose}>
      {(close) => (
        <form
          className="nameform"
          onSubmit={(e) => {
            e.preventDefault();
            submit(close);
          }}
        >
          <h2 className="disp">Your name</h2>
          <p>Shown on the leaderboards and to the players you face. Your results on the boards switch to the new name.</p>
          <NameField
            value={name}
            onChange={(v) => {
              setName(v);
              setErr(null);
            }}
            error={err}
            autoFocus
          />
          {err ? (
            <p className="note err" role="alert">
              {err}
            </p>
          ) : (
            <p className="note">2–16 letters or numbers. Names and results are public.</p>
          )}
          <div className="btnrow">
            <button type="button" className="btn" onClick={() => close()}>
              CANCEL
            </button>
            <button type="submit" className="btn primary">
              SAVE
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

export type LbStatus = { kind: 'sending' } | { kind: 'queued' } | { kind: 'ranked'; rank: number; of: number; label: string } | { kind: 'note'; text: string };

/** The leaderboard line on the Results screen. It rises in once; later changes swap the content in place. */
export function LbLine({ lb }: { lb: LbStatus }) {
  let text = '';
  let tone = '';
  if (lb.kind === 'sending') text = 'Posting to the global leaderboard…';
  else if (lb.kind === 'queued') text = 'Saved. It goes on the leaderboard when you’re back online.';
  else if (lb.kind === 'ranked') {
    text = '#' + lb.rank + ' of ' + lb.of + ' · ' + lb.label;
    tone = lb.rank <= 3 ? ' gold' : ' teal';
  } else text = lb.text;
  return (
    <div className="lbslot rise-in" style={{ animationDelay: '1100ms' }}>
      <div className={'lbstatus' + tone} role="status" key={text}>
        {tone === ' gold' ? <Trophy size={16} color="#F5B83D" /> : <RanksIcon size={16} />}
        <span>{text}</span>
      </div>
    </div>
  );
}

/** Remember the board the player last looked at, for this session. */
const last: { kind: BoardKind; span: Span } = { kind: 'daily', span: 'week' };

function outcome(r: BoardRow): string {
  if (r.h2h) return r.h2h.w + ' W · ' + r.h2h.l + ' L' + (r.h2h.streak >= 2 ? ' · ' + r.h2h.streak + ' in a row' : '');
  const x = r.run!;
  if (x.perfect) return 'Perfect Season';
  if (x.title) return 'Champions';
  if (x.series) return 'Won ' + x.series + ' playoff round' + (x.series > 1 ? 's' : '');
  return x.wins >= 50 ? 'Out in the first round' : 'Missed the playoffs';
}

const KINDS: [BoardKind, string][] = [
  ['daily', 'DAILY'],
  ['classic', 'CLASSIC'],
  ['blind', 'BLIND'],
  ['h2h', 'HEAD TO HEAD'],
];

export function GlobalBoard({ profile, dailyKey, dailyNo, onName }: { profile: Profile; dailyKey: string; dailyNo: number; onName: () => void }) {
  const [kind, setKind] = useState<BoardKind>(last.kind);
  const [span, setSpan] = useState<Span>(last.span);
  const [rows, setRows] = useState<BoardRow[] | undefined>(() => cachedBoard(kind, span, dailyKey));
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [open, setOpen] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  // after one of your entries goes up, look again
  const refresh = Object.keys(profile.lb.entries).length + ':' + profile.lb.dirty.length + ':' + profile.name;
  useEffect(() => {
    last.kind = kind;
    last.span = span;
    let live = true;
    setRows(cachedBoard(kind, span, dailyKey));
    setState('loading');
    setOpen(null);
    fetchBoard(kind, span, dailyKey)
      .then((r) => {
        if (!live) return;
        setRows(r);
        setState('ok');
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
  }, [kind, span, dailyKey, refresh, tick]);

  const top = rows ? rows.slice(0, 100) : [];
  const meBelow = rows ? rows.slice(100).find((r) => r.me) : undefined;
  const names = new Map<string, number>();
  for (const r of top) names.set(r.name, (names.get(r.name) ?? 0) + 1);

  const row = (r: BoardRow, i: number) => (
    <button key={r.pubkey} className={'lbrow rise-in' + (r.me ? ' me' : '') + (open === i ? ' open' : '')} style={{ animationDelay: Math.min(i, 10) * 30 + 'ms' }} aria-expanded={open === i} onClick={() => r.run && setOpen(open === i ? null : i)}>
      <span className={'lbrank disp num' + (r.rank <= 3 ? ' m' + r.rank : '')}>{r.rank}</span>
      <span className="lbmain">
        <strong>
          {r.name}
          {(names.get(r.name) ?? 0) > 1 && <em className="tag">#{r.pubkey.slice(0, 4)}</em>}
          {r.me && <i className="you">YOU</i>}
        </strong>
        <small>{outcome(r)}</small>
      </span>
      <b className={'disp num' + (r.run?.perfect ? ' perfect' : r.run?.title ? ' title' : '')}>{r.h2h ? r.h2h.w + '–' + r.h2h.l : r.run!.wins + '–' + (82 - r.run!.wins)}</b>
      {open === i && r.run && (
        <span className="lbline">
          {r.run.lineup.map((p) => (
            <span key={p.slot}>
              <i>{p.slot}</i>
              {lastName(p.name)}
              {p.primed ? ' ★' : ''} <em>{p.abbr + ' ' + shortEra(p.era)}</em>
            </span>
          ))}
        </span>
      )}
    </button>
  );

  return (
    <>
      <div className="namebar">
        <span>
          Playing as <b>{profile.name ?? 'Player'}</b>
        </span>
        <button className="chip" onClick={onName}>
          EDIT NAME
        </button>
      </div>
      <div className="chiprow boardpick">
        {KINDS.map(([k, label]) => (
          <button
            key={k}
            className={'chip' + (kind === k ? ' on' : '')}
            aria-pressed={kind === k}
            onClick={() => {
              if (k === kind) return;
              sfx.click();
              setKind(k);
            }}
          >
            {k === 'daily' ? 'DAILY #' + dailyNo : label}
          </button>
        ))}
      </div>
      {kind !== 'daily' && (
        <span className="spantoggle" role="group" aria-label="Time span">
          {(['week', 'all'] as const).map((s) => (
            <button
              key={s}
              aria-pressed={span === s}
              className={span === s ? 'on' : ''}
              onClick={() => {
                if (span === s) return;
                sfx.click();
                setSpan(s);
              }}
            >
              {s === 'week' ? 'THIS WEEK' : 'ALL TIME'}
            </button>
          ))}
        </span>
      )}
      <div className="list lblist" key={kind + span}>
        {rows === undefined && state === 'loading' ? (
          [0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="lbrow skel" style={{ animationDelay: i * 80 + 'ms' }} />)
        ) : rows === undefined ? (
          <div className="empty">
            Can’t reach the leaderboard right now.
            <button className="chip on retry" onClick={() => setTick((t) => t + 1)}>
              TRY AGAIN
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">
            {kind === 'daily'
              ? 'No one has played Daily #' + dailyNo + ' yet. Be the first.'
              : kind === 'h2h'
                ? 'No head-to-head results on the board yet. Play a match against a real player to be first.'
                : 'No ' + (kind === 'blind' ? 'Blind' : 'Classic') + ' results ' + (span === 'week' ? 'this week ' : '') + 'yet. Be the first.'}
          </div>
        ) : (
          <>
            {top.map(row)}
            {meBelow && (
              <>
                <div className="lbgap" aria-hidden="true">
                  ···
                </div>
                {row(meBelow, 100)}
              </>
            )}
          </>
        )}
      </div>
      <p className="note">
        {state === 'error' && rows ? 'Offline: showing the last copy. ' : ''}
        {kind === 'h2h'
          ? 'Matches against real players: most wins, then win rate.'
          : 'Each player’s best ' + (kind === 'daily' ? 'result' : 'season') + ', ranked by wins, then playoff rounds, then team rating. Every lineup is checked against the player data.' + (kind === 'daily' ? ' Only your first Daily run counts.' : '')}
      </p>
    </>
  );
}
