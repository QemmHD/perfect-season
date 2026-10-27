import React, { useEffect, useRef, useState } from 'react';
import type { BotLevel } from '../engine/types';
import { copyText } from '../lib/share';
import { sfx } from '../lib/sound';
import { ROUNDS } from '../engine/draft';
import { NFL, SPORT, switchSport } from '../engine/sport';
import type { VsRecord } from '../lib/profile';
import { cleanRoomCode, type Found, Matchmaker, newRoomCode, onCounts, type Rec, type RoomMismatch, setPresence } from '../net/match';
import { Fit, initials } from './common';
import { Back, Share } from './icons';
import { Sparks } from './motion';

/** Seconds of searching before the AI steps in. */
export const AI_AFTER = 30;

const clock = (s: number) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

type Tab = 'quick' | 'friend';

/** A head-to-head record as the splash shows it: "14–6 H2H", or "No H2H games yet". */
export function recText(r: Rec): string {
  return r.w + r.l ? r.w + '–' + r.l + ' H2H' : 'No H2H games yet';
}

/** Your series with this opponent: "You lead Sam 3–1", "First meeting". */
export function seriesText(v: VsRecord | undefined, name: string): string {
  if (!v || v.w + v.l === 0) return 'First meeting';
  const score = Math.max(v.w, v.l) + '–' + Math.min(v.w, v.l);
  return v.w > v.l ? 'You lead ' + name + ' ' + score : v.w < v.l ? name + ' leads you ' + score : 'Tied with ' + name + ' ' + score;
}
export type Room = { code: string; hosting: boolean } | null;

/**
 * Finding a head-to-head opponent: the public queue (the AI steps in after 30 seconds),
 * or a private code to play a friend.
 */
/** The rounds you pick first in, every other one from `from`: "1, 3, 5 and 7". */
function firstPicks(from: number): string {
  const r: number[] = [];
  for (let i = from; i <= ROUNDS; i += 2) r.push(i);
  return r.length > 1 ? r.slice(0, -1).join(', ') + ' and ' + r[r.length - 1] : String(r[0]);
}

export function Search(props: {
  name: string;
  level: number;
  /** your head-to-head record, and your record against each opponent you've played */
  rec: Rec;
  vs: Record<string, VsRecord>;
  botLevel: BotLevel;
  /** the room to be in (a link, or the one a match that didn't connect came from) */
  room: Room;
  /** where this screen is now: the app puts you back there if a match doesn't connect */
  onRoom: (r: Room) => void;
  onMatch: (f: Found) => void;
  onAI: () => void;
  onBack: () => void;
  onToast: (t: string) => void;
  /** the head-to-head leaderboard, and who's online */
  onBoard: (online: boolean) => void;
}) {
  const [tab, setTab] = useState<Tab>(props.room ? 'friend' : 'quick');
  const [room, setRoom] = useState<Room>(props.room);
  const [joinCode, setJoinCode] = useState('');
  const [t0, setT0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [found, setFound] = useState<Found | null>(null);
  const [aiSoon, setAiSoon] = useState(false);
  /** a friend with the same code on the other sport, or another version of the app */
  const [mismatch, setMismatch] = useState<(RoomMismatch & { at: number }) | null>(null);
  const done = useRef(false);
  const mmRef = useRef<Matchmaker | null>(null);
  useEffect(() => props.onRoom(room), [room?.code, room?.hosting]);
  const elapsed = Math.max(0, Math.floor((now - t0) / 1000));
  // the friend's phone says it's there every 2 seconds: gone once it stops (they left or switched)
  const mm = tab === 'friend' && mismatch && now - mismatch.at < 6000 ? mismatch : null;
  const searching = !found && !aiSoon && (tab === 'quick' || !!room);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // everyone else in the public queue right now, live
  const [queued, setQueued] = useState(0);
  useEffect(() => onCounts((c) => setQueued(Math.max(0, c.searching - (tab === 'quick' && !found && !aiSoon ? 1 : 0)))), [tab, found, aiSoon]);

  // search in the queue, or in the chosen room
  useEffect(() => {
    if (!searching) return;
    setT0(Date.now());
    setPresence('queue');
    setMismatch(null);
    const mm = new Matchmaker(
      { name: props.name, level: props.level, room: tab === 'friend' && room ? room.code : undefined, rec: props.rec },
      (f) => {
        if (done.current) return;
        done.current = true;
        setFound(f);
      },
      undefined,
      (m) => setMismatch({ ...m, at: Date.now() })
    );
    mm.start();
    mmRef.current = mm;
    return () => {
      mm.stop();
      mmRef.current = null;
    };
  }, [tab, room?.code, searching]);

  useEffect(
    () => () => {
      if (!done.current) setPresence('menu');
    },
    []
  );

  // a match: the VS screen, then the draft
  useEffect(() => {
    if (!found) return;
    setPresence('match');
    sfx.seriesWin();
    const t = window.setTimeout(() => props.onMatch(found), 2300);
    return () => clearTimeout(t);
  }, [found]);

  // nobody came: the AI steps in (not in the middle of pairing up with someone)
  useEffect(() => {
    if (tab !== 'quick' || found || aiSoon || elapsed < AI_AFTER || mmRef.current?.pending()) return;
    goAI();
  }, [elapsed, tab]);

  const goAI = () => {
    if (done.current) return;
    done.current = true;
    setAiSoon(true);
    setPresence('menu');
    sfx.click();
    window.setTimeout(props.onAI, 1500);
  };

  const pickTab = (t: Tab) => {
    if (t === tab) return;
    sfx.click();
    setTab(t);
    setRoom(null);
  };

  const invite = async () => {
    if (!room) return;
    const url = location.origin + location.pathname + '?room=' + room.code + '&sport=' + SPORT;
    const text = 'Play me in Perfect Season. Code ' + room.code + ': ' + url;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Perfect Season', text: 'Play me in Perfect Season. Code ' + room.code, url });
        return;
      }
    } catch {
      // cancelled: fall through to copying
    }
    if (await copyText(text)) props.onToast('Invite link copied. Send it to your friend.');
    else props.onToast('Your code is ' + room.code + '.');
  };

  const left = Math.max(0, AI_AFTER - elapsed);

  return (
    <div className="screen search">
      <div className="draft-head">
        <button className="icon-btn" onClick={props.onBack} aria-label="Back">
          <Back size={18} />
        </button>
        <div className="round">
          <span>{NFL ? 'NFL · HEAD TO HEAD' : 'HEAD TO HEAD'}</span>
        </div>
        <span className="icon-btn" aria-hidden="true" style={{ visibility: 'hidden' }} />
      </div>
      <span className="seg wide" role="group" aria-label="Opponent">
        <button className={tab === 'quick' ? 'on' : ''} aria-pressed={tab === 'quick'} onClick={() => pickTab('quick')}>
          QUICK MATCH
        </button>
        <button className={tab === 'friend' ? 'on' : ''} aria-pressed={tab === 'friend'} onClick={() => pickTab('friend')}>
          PLAY A FRIEND
        </button>
      </span>
      <div className="h2h-links">
        <span className="h2h-rec">
          You <b>{recText(props.rec)}</b>
        </span>
        <button className="chip" onClick={() => (sfx.click(), props.onBoard(false))}>
          LEADERBOARD
        </button>
        <button className="chip" onClick={() => (sfx.click(), props.onBoard(true))}>
          <i className="livedot" aria-hidden="true" /> WHO’S ONLINE
        </button>
      </div>

      {tab === 'quick' || room ? (
        <div className={'radar-wrap' + (mm ? ' noted' : '')}>
          <div className="radar" aria-hidden="true">
            <i />
            <i />
            <i />
            <span className="sweep" />
            <b className="disp">{initials(props.name)}</b>
          </div>
          <div className="search-text" role="status">
            {tab === 'quick' ? (
              <>
                <strong>Searching for a real player…</strong>
                <small key={queued}>{queued > 0 ? queued + (queued === 1 ? ' other player is' : ' other players are') + ' searching right now' : 'No one else is searching yet'}</small>
              </>
            ) : room!.hosting ? (
              <>
                <span className="eyebrow">Your code</span>
                <b className="disp roomcode">{room!.code}</b>
                <small>Send it to a friend. They tap Play a Friend and enter it, or open your link.</small>
              </>
            ) : (
              <>
                <strong>Joining {room!.code}…</strong>
                <small>Waiting for your friend’s phone to answer.</small>
              </>
            )}
            <b className="disp num search-clock">{clock(elapsed)}</b>
          </div>
          {mm && (
            <div className="mismatch rise-in" role="alert">
              {mm.sameSport ? (
                <span>
                  <b>{mm.name}</b> has another version of the game. Close and reopen the app on both phones to update, then try again.
                </span>
              ) : room!.hosting ? (
                // the one who joined switches, so the two of them never swap past each other
                <span>
                  <b>{mm.name}</b> joined from {mm.sport === 'nfl' ? 'NFL' : 'NBA'}. Their phone is offering to switch to {SPORT === 'nfl' ? 'NFL' : 'NBA'}.
                </span>
              ) : (
                <>
                  <span>
                    <b>{mm.name}</b> is in this room playing {mm.sport === 'nfl' ? 'NFL' : 'NBA'}.
                  </span>
                  <button
                    className="btn gold"
                    onClick={() => {
                      sfx.click();
                      switchSport(mm.sport, room!.code);
                    }}
                  >
                    SWITCH TO {mm.sport === 'nfl' ? 'NFL' : 'NBA'}
                  </button>
                </>
              )}
            </div>
          )}
          {tab === 'quick' && (
            <div className="ai-meter">
              <span className="track">
                <i style={{ transform: 'scaleX(' + Math.min(1, elapsed / AI_AFTER) + ')' }} />
              </span>
              <small>{left > 0 ? 'The AI (' + props.botLevel + ') steps in at ' + clock(AI_AFTER) : 'The AI is stepping in…'}</small>
            </div>
          )}
        </div>
      ) : (
        <div className="friend">
          <button
            className="friendcard"
            onClick={() => {
              sfx.click();
              setRoom({ code: newRoomCode(), hosting: true });
            }}
          >
            <strong>Create a code</strong>
            <small>Get a 4-letter code and send it to a friend.</small>
          </button>
          <form
            className="friendcard join"
            onSubmit={(e) => {
              e.preventDefault();
              const c = cleanRoomCode(joinCode);
              if (c.length !== 4) {
                sfx.nope();
                props.onToast('Codes have 4 letters or numbers.');
                return;
              }
              sfx.click();
              setRoom({ code: c, hosting: false });
            }}
          >
            <strong>Have a code?</strong>
            <div className="joinrow">
              <input
                className="namefield code"
                value={joinCode}
                onChange={(e) => setJoinCode(cleanRoomCode(e.target.value))}
                placeholder="CODE"
                aria-label="Friend's code"
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                maxLength={4}
                enterKeyHint="go"
              />
              <button type="submit" className="btn primary">
                JOIN
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="spacer" />
      <div className="actionbar">
        {tab === 'quick' ? (
          <button className="big ghost" onClick={goAI}>
            <Fit text={'PLAY THE AI NOW · ' + props.botLevel.toUpperCase()} />
          </button>
        ) : room?.hosting ? (
          <button className="big" onClick={invite}>
            <span className="withicon">
              <Share size={18} /> SEND INVITE
            </span>
          </button>
        ) : room ? (
          <button
            className="big ghost"
            onClick={() => {
              sfx.click();
              setRoom(null);
            }}
          >
            <span>CANCEL</span>
          </button>
        ) : (
          <button className="big ghost" onClick={props.onBack}>
            <span>BACK</span>
          </button>
        )}
      </div>

      {found && (
        <div className="vs-splash" role="dialog" aria-label={'Match found: ' + props.name + ' versus ' + found.opp.name}>
          <span className="eyebrow wide">Match found</span>
          <div className="vs-names">
            <div className="vs-a">
              <b className="disp">{initials(props.name)}</b>
              <strong>{props.name}</strong>
              <small>Level {props.level}</small>
              <small className="vs-rec">{recText(props.rec)}</small>
            </div>
            <span className="disp vs-x">VS</span>
            <div className="vs-b">
              <b className="disp">{initials(found.opp.name)}</b>
              <strong>{found.opp.name}</strong>
              <small>Level {found.opp.level}</small>
              {found.opp.rec && <small className="vs-rec">{recText(found.opp.rec)}</small>}
            </div>
          </div>
          <span className="vs-series">{seriesText(props.vs[found.opp.pubkey], found.opp.name)}</span>
          <small className="vs-note">You pick first in rounds {firstPicks(found.host ? 1 : 2)}. 25 seconds a pick.</small>
          <span className="vs-burst" aria-hidden="true">
            <Sparks color="#F5B83D" />
          </span>
        </div>
      )}
      {aiSoon && (
        <div className="vs-splash ai" role="dialog" aria-label="Playing the AI">
          <span className="eyebrow wide">{tab === 'quick' && elapsed >= AI_AFTER ? 'No one’s around right now' : 'Practice match'}</span>
          <strong className="disp ai-title">VS THE AI</strong>
          <small className="vs-note">{props.botLevel === 'legend' ? 'Legend level. It picks first.' : props.botLevel === 'pro' ? 'Pro level.' : 'Rookie level.'}</small>
        </div>
      )}
    </div>
  );
}
