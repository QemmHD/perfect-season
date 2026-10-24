import React, { useEffect, useState } from 'react';
import type { Mode } from '../engine/types';
import { type Board, type BoardRow, cachedBoard, fetchBoard, nameProblem, type PostResult, rankLine, saveName } from '../lib/leaderboard';
import type { Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import { lastName, Sheet, shortEra } from './common';
import { Ranks as RanksIcon, Trophy } from './icons';

/** Pick or change the name shown on the global leaderboard. Sits at the top so the keyboard never covers it. */
export function NameSheet({ profile, onSaved, onClose }: { profile: Profile; onSaved: (name: string) => void; onClose: () => void }) {
  const [name, setName] = useState(profile.name ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (close: (after?: () => void) => void) => {
    if (busy) return;
    const problem = nameProblem(name);
    if (problem) {
      setErr(problem);
      sfx.nope();
      return;
    }
    setBusy(true);
    try {
      const res = await saveName(profile.device, name);
      if (!res.ok) {
        setErr(res.message ?? 'Pick a different name.');
        setBusy(false);
        sfx.nope();
        return;
      }
    } catch {
      // offline: keep the name here; it goes up with the next result
    }
    sfx.click();
    close(() => onSaved(name.trim()));
  };
  return (
    <Sheet label="Leaderboard name" kind="top" onClose={onClose}>
      {(close) => (
        <form
          className="nameform"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(close);
          }}
        >
          <h2 className="disp">{profile.name ? 'Change your name' : 'Join the leaderboard'}</h2>
          <p>{profile.name ? 'Your results everywhere on the board switch to the new name.' : 'Your Classic, Blind and Daily results go up against everyone else’s. Pick the name they’ll see.'}</p>
          <input
            className={'namefield' + (err ? ' bad' : '')}
            value={name}
            onChange={(e) => {
              setName(e.target.value.slice(0, 16));
              setErr(null);
            }}
            maxLength={16}
            placeholder="Your name"
            aria-label="Leaderboard name"
            aria-invalid={!!err}
            autoComplete="nickname"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            autoFocus
          />
          {err ? (
            <p className="note err" role="alert">
              {err}
            </p>
          ) : (
            <p className="note">2–16 letters or numbers. No account or email needed.</p>
          )}
          <div className="btnrow">
            <button type="button" className="btn" onClick={() => close()}>
              CANCEL
            </button>
            <button type="submit" className={'btn primary' + (busy ? ' busy' : '')} aria-disabled={busy}>
              {busy ? 'SAVING…' : 'SAVE'}
            </button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

export type LbStatus = { kind: 'join' } | { kind: 'sending' } | { kind: 'queued' } | { kind: 'done'; res: PostResult };

/** The leaderboard line on the Results screen. It rises in once with the rest of the
    results; later changes (posting → rank) swap the content in place. */
export function LbLine({ lb, mode, onJoin }: { lb: LbStatus; mode: Mode; onJoin: () => void }) {
  let body: React.ReactNode;
  if (lb.kind === 'join')
    body = (
      <button className="lbjoin" onClick={onJoin} key="join">
        <RanksIcon size={18} />
        <span>Put this on the global leaderboard</span>
      </button>
    );
  else {
    let text = '';
    let tone = '';
    if (lb.kind === 'sending') text = 'Posting to the leaderboard…';
    else if (lb.kind === 'queued') text = 'Saved. It goes on the leaderboard when you’re back online.';
    else if (lb.res.ok) {
      text = rankLine(lb.res, mode);
      tone = lb.res.rank && lb.res.rank <= 3 ? ' gold' : ' teal';
    } else text = lb.res.message ?? 'This one can’t go on the leaderboard.';
    body = (
      <div className={'lbstatus' + tone} role="status" key={text}>
        {tone === ' gold' ? <Trophy size={16} color="#F5B83D" /> : <RanksIcon size={16} />}
        <span>{text}</span>
      </div>
    );
  }
  return (
    <div className="lbslot rise-in" style={{ animationDelay: '1100ms' }}>
      {body}
    </div>
  );
}

type Pick = 'daily' | 'classic' | 'blind';
/** Remember the board the player last looked at, for this session. */
const last: { pick: Pick; span: 'week' | 'all' } = { pick: 'daily', span: 'week' };

function outcome(r: BoardRow): string {
  if (r.perfect) return 'Perfect Season';
  if (r.title) return 'Champions';
  if (r.series) return 'Won ' + r.series + ' playoff round' + (r.series > 1 ? 's' : '');
  return r.wins >= 50 ? 'Out in the first round' : 'Missed the playoffs';
}

export function GlobalBoard({ profile, dailyKey, dailyNo, onName }: { profile: Profile; dailyKey: string; dailyNo: number; onName: () => void }) {
  const [pick, setPick] = useState<Pick>(last.pick);
  const [span, setSpan] = useState<'week' | 'all'>(last.span);
  const mode: Mode = pick === 'daily' ? 'daily' : pick;
  const board: Board = pick === 'daily' ? 'daily' : span;
  const [rows, setRows] = useState<BoardRow[] | undefined>(() => cachedBoard(board, mode, dailyKey));
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [open, setOpen] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = profile.posted[0] ?? '';
  useEffect(() => {
    last.pick = pick;
    last.span = span;
    let live = true;
    setRows(cachedBoard(board, mode, dailyKey));
    setState('loading');
    setOpen(null);
    fetchBoard(board, mode, dailyKey, profile.device)
      .then((r) => {
        if (!live) return;
        setRows(r);
        setState('ok');
      })
      .catch(() => live && setState('error'));
    return () => {
      live = false;
    };
  }, [board, mode, dailyKey, refresh, tick]);

  const choose = (p: Pick) => {
    if (p === pick) return;
    sfx.click();
    setPick(p);
  };
  // the server sends the top 50, plus your own row at the end when you're further down
  const top = rows ? rows.slice(0, 50) : [];
  const meBelow = rows && rows.length > 50 ? rows[50] : null;

  const row = (r: BoardRow, i: number) => (
    <button key={r.rank + ':' + r.name + ':' + i} className={'lbrow rise-in' + (r.me ? ' me' : '') + (open === i ? ' open' : '')} style={{ animationDelay: Math.min(i, 10) * 30 + 'ms' }} aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
      <span className={'lbrank disp num' + (r.rank <= 3 ? ' m' + r.rank : '')}>{r.rank}</span>
      <span className="lbmain">
        <strong>
          {r.name}
          {r.me && <i className="you">YOU</i>}
        </strong>
        <small>{outcome(r)}</small>
      </span>
      <b className={'disp num' + (r.perfect ? ' perfect' : r.title ? ' title' : '')}>
        {r.wins}–{82 - r.wins}
      </b>
      {open === i && (
        <span className="lbline">
          {r.lineup.map((p) => (
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
        {profile.name ? (
          <>
            <span>
              Playing as <b>{profile.name}</b>
            </span>
            <button className="chip" onClick={onName}>
              EDIT NAME
            </button>
          </>
        ) : (
          <>
            <span>Pick a name to get on the board.</span>
            <button className="chip on" onClick={onName}>
              JOIN
            </button>
          </>
        )}
      </div>
      <div className="chiprow">
        {(
          [
            ['daily', 'DAILY #' + dailyNo],
            ['classic', 'CLASSIC'],
            ['blind', 'BLIND'],
          ] as [Pick, string][]
        ).map(([k, label]) => (
          <button key={k} className={'chip' + (pick === k ? ' on' : '')} aria-pressed={pick === k} onClick={() => choose(k)}>
            {label}
          </button>
        ))}
        {pick !== 'daily' && (
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
                {s === 'week' ? 'WEEK' : 'ALL TIME'}
              </button>
            ))}
          </span>
        )}
      </div>
      <div className="list lblist" key={board + mode}>
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
          <div className="empty">{pick === 'daily' ? 'No one has played Daily #' + dailyNo + ' yet. Be the first.' : 'No ' + (pick === 'blind' ? 'Blind' : 'Classic') + ' results ' + (span === 'week' ? 'this week' : '') + ' yet. Be the first.'}</div>
        ) : (
          <>
            {top.map(row)}
            {meBelow && (
              <>
                <div className="lbgap" aria-hidden="true">
                  ···
                </div>
                {row(meBelow, 50)}
              </>
            )}
          </>
        )}
      </div>
      <p className="note">
        {state === 'error' && rows ? 'Offline: showing the last copy. ' : ''}
        Each player’s best {pick === 'daily' ? 'result' : 'season'}, ranked by wins, then playoff rounds, then team rating.
        {pick === 'daily' ? ' Only your first Daily run counts.' : ''}
      </p>
    </>
  );
}
