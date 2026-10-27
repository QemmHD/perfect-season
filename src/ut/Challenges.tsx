// Squad Building Challenges: today's three and this week's two. Put cards in, watch each
// requirement tick as you go, and trade them in for the reward.
import React, { useEffect, useMemo, useState } from 'react';
import { SPORT } from '../engine/sport';
import { sfx } from '../lib/sound';
import { Confirm, Sheet } from '../ui/common';
import { UtCard } from './CardArt';
import { IconCheck, IconWand, IconX } from './icons';
import { packName, quickSellValue } from './packs';
import { type Pool, seasonText } from './pool';
import { autoFill, cardFits, checkSbc, type Req, rewardText, type Sbc } from './sbc';
import type { ClubCard } from './UltimateTeam';

/** Time left until midnight Eastern, or until the end of the week (Sunday night). */
function timeLeft(week: boolean): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0';
    const mins = 1440 - (Number(get('hour')) * 60 + Number(get('minute')));
    const day = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
    if (week) {
      const days = 6 - Math.max(0, day);
      return days > 0 ? days + 'd ' + Math.floor(mins / 60) + 'h' : Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm';
    }
    return Math.floor(mins / 60) + 'h ' + String(mins % 60).padStart(2, '0') + 'm';
  } catch {
    return '';
  }
}

function SbcCard({ s, done, onOpen }: { s: Sbc; done: boolean; onOpen: () => void }) {
  return (
    <button className={'ut-sbc' + (done ? ' done' : '') + (s.kind === 'weekly' ? ' weekly' : s.kind === 'upgrade' ? ' upgrade' : '')} onClick={onOpen} disabled={done}>
      <span className="ut-sbc-top">
        <b className="disp">{s.title}</b>
        {done ? (
          <i className="ut-sbc-done">
            <IconCheck size={14} /> DONE
          </i>
        ) : (
          <i className="ut-sbc-size">
            {s.size} cards{s.left ? ' · ' + s.left + ' left today' : ''}
          </i>
        )}
      </span>
      <small>{s.blurb}</small>
      <span className="ut-sbc-reqs">
        {s.reqs.map((r, i) => (
          <i key={i}>{reqLabel(r)}</i>
        ))}
      </span>
      <span className="ut-sbc-reward">
        <i className="eyebrow">Reward</i> {rewardText(s.reward, SPORT, packName)}
      </span>
    </button>
  );
}

const reqLabel = (r: Req) => {
  switch (r.k) {
    case 'minOvr':
      return 'All ' + r.ovr + '+';
    case 'teamOvr':
      return 'Team ' + r.ovr + '+';
    case 'tier':
      return r.n + '× ' + r.tier + '+';
    case 'sameFr':
      return r.n + ' same team';
    case 'fr':
      return r.n + '× ' + r.name;
    case 'decade':
      return r.n + '× ' + r.decade + 's';
    case 'sameDecade':
      return r.n + ' same decade';
    case 'positions':
      return r.pos.join(' ');
  }
};

export function Challenges(props: { pool: Pool; sbcs: Sbc[]; done: Record<string, number>; club: ClubCard[]; day: string; onSubmit: (s: Sbc, uids: string[]) => void; onToast: (t: string) => void }) {
  const [open, setOpen] = useState<Sbc | null>(null);
  const [left, setLeft] = useState(() => [timeLeft(false), timeLeft(true)]);
  useEffect(() => {
    const t = window.setInterval(() => setLeft([timeLeft(false), timeLeft(true)]), 30000);
    return () => clearInterval(t);
  }, []);
  const daily = props.sbcs.filter((s) => s.kind === 'daily');
  const weekly = props.sbcs.filter((s) => s.kind === 'weekly');
  const upgrades = props.sbcs.filter((s) => s.kind === 'upgrade');
  return (
    <div className="page ut-sbcs">
      <p className="lead ut-sbc-lead">Trade in cards that meet the requirements. Everyone gets the same challenges.</p>
      <div className="ut-sbc-group">
        <span className="eyebrow">Daily{left[0] ? ' · new in ' + left[0] : ''}</span>
        {daily.map((s) => (
          <SbcCard key={s.id} s={s} done={!!props.done[s.id]} onOpen={() => (sfx.click(), setOpen(s))} />
        ))}
      </div>
      <div className="ut-sbc-group">
        <span className="eyebrow">This week{left[1] ? ' · ends in ' + left[1] : ''}</span>
        {weekly.map((s) => (
          <SbcCard key={s.id} s={s} done={!!props.done[s.id]} onOpen={() => (sfx.click(), setOpen(s))} />
        ))}
      </div>
      {upgrades.length > 0 && (
        <div className="ut-sbc-group">
          <span className="eyebrow">Upgrades · twice a day each</span>
          {upgrades.map((s) => (
            <SbcCard key={s.id} s={s} done={!!props.done[s.id]} onOpen={() => (sfx.click(), setOpen(s))} />
          ))}
        </div>
      )}
      {open && <SbcSheet s={open} club={props.club} onClose={() => setOpen(null)} onSubmit={(uids) => (setOpen(null), props.onSubmit(open, uids))} onToast={props.onToast} />}
    </div>
  );
}

function SbcSheet({ s, club, onClose, onSubmit, onToast }: { s: Sbc; club: ClubCard[]; onClose: () => void; onSubmit: (uids: string[]) => void; onToast: (t: string) => void }) {
  const [picked, setPicked] = useState<(string | null)[]>(() => Array.from({ length: s.size }, () => null));
  const [slotAt, setSlotAt] = useState<number | null>(null);
  const [confirm, setConfirm] = useState(false);
  const byUid = useMemo(() => new Map(club.map((c) => [c.uid, c])), [club]);
  const cards = picked.map((u) => (u ? byUid.get(u) : undefined)).filter((c): c is ClubCard => !!c);
  const check = checkSbc(s, cards.map((c) => c.rc));
  const fromSquad = cards.filter((c) => c.slot).length;
  const fill = () => {
    const got = autoFill(s, club);
    if (!got) {
      sfx.nope();
      onToast('Your club doesn’t have cards that meet all of this yet.');
      return;
    }
    sfx.select();
    setPicked(got);
  };
  return (
    <>
      <Sheet label={s.title} kind="bottom" onClose={onClose}>
        {(close) => (
          <div className="ut-sbcsheet">
            <div className="ut-sbcsheet-head">
              <span className="eyebrow">{s.kind === 'daily' ? 'Daily challenge' : s.kind === 'weekly' ? 'Weekly challenge' : 'Upgrade · ' + (s.left ?? 1) + ' left today'}</span>
              <h2 className="disp">{s.title}</h2>
              <small>Reward: {rewardText(s.reward, SPORT, packName)}</small>
            </div>
            <div className="ut-reqs">
              {check.reqs.map((r, i) => (
                <span key={i} className={'ut-req' + (r.ok ? ' ok' : '')}>
                  {r.ok ? <IconCheck size={15} /> : <IconX size={15} />}
                  <span>{r.text}</span>
                  <b className="num">{r.have}</b>
                </span>
              ))}
              <span className={'ut-req' + (check.full ? ' ok' : '')}>
                {check.full ? <IconCheck size={15} /> : <IconX size={15} />}
                <span>{s.size} different players</span>
                <b className="num">
                  {cards.length}/{s.size}
                </b>
              </span>
            </div>
            <div className="ut-sbc-slots" style={{ gridTemplateColumns: 'repeat(' + Math.min(s.size, 4) + ', 72px)' }}>
              {picked.map((u, i) => {
                const c = u ? byUid.get(u) : undefined;
                return (
                  <button key={i} className="ut-sbc-slot" onClick={() => (sfx.click(), setSlotAt(i))} aria-label={c ? c.rc.line.name + ', tap to change' : 'Empty, tap to add a card'}>
                    {c ? <UtCard rc={c.rc} w={72} level={c.oc.level} /> : <span className="ut-slot-empty" style={{ width: 72, height: 101 }}><b>+</b></span>}
                    {c?.slot && <i className="ut-insquad">{c.slot}</i>}
                  </button>
                );
              })}
            </div>
            <div className="btnrow">
              <button className="btn withicon" onClick={fill}>
                <IconWand size={16} /> AUTO-FILL
              </button>
              <button className={'btn ' + (check.ok ? 'gold' : '')} aria-disabled={!check.ok} onClick={() => (check.ok ? setConfirm(true) : (sfx.nope(), onToast('Not yet: every requirement needs a tick.')))}>
                SUBMIT
              </button>
            </div>
            <button className="btn ut-sbc-close" onClick={() => close()}>
              CLOSE
            </button>
          </div>
        )}
      </Sheet>
      {slotAt !== null && (
        <SbcPicker
          s={s}
          club={club}
          taken={picked.filter((u, i) => u && i !== slotAt) as string[]}
          current={picked[slotAt]}
          onPick={(uid) => {
            setPicked((p) => p.map((x, i) => (i === slotAt ? uid : x)));
            setSlotAt(null);
          }}
          onClose={() => setSlotAt(null)}
        />
      )}
      {confirm && (
        <Confirm
          title="Trade them in?"
          body={'These ' + s.size + ' cards leave your club for ' + rewardText(s.reward, SPORT, packName) + '.' + (fromSquad ? ' ' + fromSquad + (fromSquad === 1 ? ' of them plays' : ' of them play') + ' in your squad.' : '')}
          yes="TRADE IN"
          no="NOT YET"
          tone="gold"
          onYes={() => {
            setConfirm(false);
            onSubmit(cards.map((c) => c.uid));
          }}
          onNo={() => setConfirm(false)}
        />
      )}
    </>
  );
}

function SbcPicker({ s, club, taken, current, onPick, onClose }: { s: Sbc; club: ClubCard[]; taken: string[]; current: string | null; onPick: (uid: string | null) => void; onClose: () => void }) {
  const [fits, setFits] = useState(true);
  const takenPids = new Set(taken.map((u) => club.find((c) => c.uid === u)?.rc.line.pid));
  const list = club
    .filter((c) => !taken.includes(c.uid) && !takenPids.has(c.rc.line.pid))
    .filter((c) => !fits || s.reqs.every((r) => cardFits(r, c.rc, s.size)))
    // cheapest first: these cards are leaving; squad cards last
    .sort((a, b) => (a.slot ? 1 : 0) - (b.slot ? 1 : 0) || quickSellValue(a.rc) - quickSellValue(b.rc) || a.rc.ovr - b.rc.ovr)
    .slice(0, 100);
  return (
    <Sheet label="Pick a card" kind="bottom" onClose={onClose}>
      {(close) => (
        <div className="ut-picker">
          <div className="ut-picker-head">
            <h2 className="disp">Pick a card</h2>
            <span className="ut-picker-cur">
              <button className={'chip' + (fits ? ' on' : '')} aria-pressed={fits} onClick={() => setFits(!fits)}>
                FITS
              </button>
              {current && (
                <button className="chip" onClick={() => close(() => onPick(null))}>
                  REMOVE
                </button>
              )}
            </span>
          </div>
          {list.length ? (
            <div className="ut-picker-list">
              {list.map((c) => (
                <button key={c.uid} className="ut-pickrow" onClick={() => close(() => onPick(c.uid))}>
                  <UtCard rc={c.rc} w={44} level={c.oc.level} />
                  <span className="ut-pickrow-txt">
                    <b>{c.rc.line.name}</b>
                    <small>
                      {c.rc.line.pos.join('/')} · {seasonText(c.rc.line)} {c.rc.line.abbr}
                      {c.slot ? ' · in squad at ' + c.slot : ''}
                    </small>
                  </span>
                  <span className="ut-pickrow-nums">
                    <b className="num">{c.rc.ovr}</b>
                    <small className="num">{quickSellValue(c.rc)}c</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty">{fits ? 'No cards fit every requirement on their own. Turn off FITS to see them all.' : 'No more cards.'}</div>
          )}
        </div>
      )}
    </Sheet>
  );
}
