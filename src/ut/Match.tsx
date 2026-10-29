import { Promotion } from './Rivals';
import { divisionOf, rivalsOf } from './rivals';
import { publishRivals } from './rivals-net';
// Ultimate Team's played matches: Squad Battles against this week's AI ladder, and online head to
// head against a squad near yours (by overall: within 3, wider by 2 every 10 seconds up to 10, then
// an AI squad at your level steps in). The two squads become the arcade game's teams (teams.ts):
// each side plays its offense against the other's defense, with the draft head to head's vote,
// takeover and tiebreak rules. The result pays coins and card XP and climbs the ladder (play.ts).
// Online, the squads cross over the match channel (src/net/match.ts) in a queue of their own.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { levelInfo } from '../engine/economy';
import { hashString } from '../engine/rng';
import { easternDateKey } from '../engine/season';
import { NFL, SPORT } from '../engine/sport';
import { AI_SKILL, Arcade, type Progress } from '../game/Arcade';
import { aiDrivesOf } from '../game/football2/Football2';
import { POSSESSIONS } from '../game/hoops2/game';
import { aiPossessionsOf } from '../game/hoops2/Hoops2';
import { kitsFor } from '../game/uniforms';
import { favoriteFor } from '../lib/favorites';
import { newId, type Profile } from '../lib/profile';
import { sfx, vibrate } from '../lib/sound';
import { type ArcadeState, type Found, MatchConn, type MatchState, Matchmaker, setPresence, squadWindow } from '../net/match';
import { NET_ON } from '../net/nostr';
import { NO_VOTE, type VoteWire, voteWireOf } from '../net/vote';
import { CoinChip, initials } from '../ui/common';
import { Back, Coin } from '../ui/icons';
import { Sparks } from '../ui/motion';
import { Vote } from '../ui/Vote';
import { aiOpponent, battlesThisWeek, LEVEL, LEVEL_NAME, levelOf, type Rung, RUNGS, shortName, skillName, weekLadder } from './battles';
import { UtCard } from './CardArt';
import { packName } from './packs';
import { eventRung } from './events';
import { decide, PAID_GAMES_A_DAY, settle, type UtMatchRequest } from './play';
import { byValue, getPool, type Pool } from './pool';
import { weekOf } from './sbc';
import { CHEM_BONUS, type SquadRating, startersComplete } from './squad';
import { lineupOf, ratingOf, type SquadCards, squadFromWire, squadToWire, type SquadWire, teamsOf } from './teams';
import type { UtState } from './state';
import './match.css';

/**
 * The queue of its own: Ultimate Team squads never pair with draft head to heads, nor with a build
 * whose cards (the pool's fingerprint) or match rules differ, since each phone rates both squads
 * and plays the sim itself. Bump UT_RULES when teams.ts or play.ts change how a match comes out.
 */
const UT_RULES = 2;
const queueOf = (pool: Pool) => 'ut-' + UT_RULES + '-' + pool.print;
/** Seconds of searching before an AI squad steps in: the window is at its widest (10) from 40. */
export const UT_AI_AFTER = 50;
/** The match found, the other phone's squad not here after this long: back to the queue. */
const CONNECT_MS = 15000;
/** how long the found splash and the VS screen stay up */
const FOUND_MS = 2300;
const VS_MS = 2800;

interface Side {
  name: string;
  sq: SquadCards;
  wire: SquadWire;
  rating: SquadRating;
  fav: string | null;
}

interface Setup {
  /** the match's: the game's seed and both teams' come from it */
  seed: string;
  me: Side;
  rival: Side;
  /** online; null against the AI */
  online: Found | null;
  /** the AI: a ladder rung (i from 0), or the squad that stepped in for a no-show (i = -1) */
  rung: Rung | null;
  event?: { id: string; node: number; title: string };
  /** Squad Battles: the difficulty's name and what it pays (times the coins) */
  level?: { name: string; pay: number; def: number };
}

interface OppView {
  gone: boolean;
  left: boolean;
  arcade: ArcadeState | null;
  arcadeTook: number | null;
  vote: VoteWire;
  fav: string | null;
  ut: MatchState['ut'];
}

interface Outcome {
  won: boolean;
  tiebreak: boolean;
  us: number;
  them: number;
  how: 'played' | 'sim';
  eventCleared?: boolean;
  ends: [string[], string[]];
  coins: number;
  xp: number;
  ups: { name: string; level: number }[];
  climbed: boolean;
  pack: string | null;
  /** past today's paid games: no coins or XP */
  capped: boolean;
  /** the top rung: the next ladder is up */
  refreshed: boolean;
}

type Stage = 'load' | 'search' | 'found' | 'vs' | 'vote' | 'play' | 'result' | 'error';

/** how each drive or possession ended, on the result screen */
const END_LABEL: Record<string, string> = { A: '2+1', X: '·', TO: 'TO', MISS: 'FG✕', DOWNS: 'DWN' };
const END_POINTS: Record<string, number> = { TD: 7, FG: 3, '2': 2, '3': 3, A: 3 };

const clock = (s: number) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

/** Your squad as it is in the profile, read the way the other phone reads it off the wire. */
function mySide(pool: Pool, ut: UtState, name: string): Side {
  const byUid = new Map(ut.owned.map((o) => [o.uid, o]));
  const raw: SquadWire = [];
  for (const [slot, uid] of Object.entries(ut.squad)) {
    const o = byUid.get(uid);
    if (o) raw.push([slot, o.cardId, o.level]);
  }
  const sq = squadFromWire(pool, raw);
  return { name, sq, wire: squadToWire(sq), rating: ratingOf(SPORT, sq), fav: favoriteFor(SPORT) };
}

function aiSide(pool: Pool, r: Rung): Side {
  const sq = squadFromWire(pool, r.squad);
  return { name: shortName(r), sq, wire: squadToWire(sq), rating: ratingOf(SPORT, sq), fav: r.fav };
}

/** a squad's best cards, for the VS screen */
function bestOf(sq: SquadCards, n: number) {
  return Object.values(lineupOf(sq))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort(byValue)
    .slice(0, n);
}

function oppOf(theirs: MatchState, gone: boolean): OppView {
  return {
    gone,
    left: theirs.left,
    arcade: theirs.arcade ?? null,
    arcadeTook: theirs.arcadeTook ?? null,
    vote: voteWireOf(theirs),
    fav: theirs.fav ?? null,
    ut: theirs.ut ?? null,
  };
}

export default function UtMatch(props: {
  req: UtMatchRequest;
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  onToast: (t: string) => void;
  /** back to Ultimate Team */
  onExit: () => void;
  /** another match: the next rung, the same one again, or another head to head */
  onAgain: (req: UtMatchRequest) => void;
  /** tests: straight into the game, the autopilot playing it */
  autoplay?: boolean;
}) {
  const { req, profile } = props;
  const name = profile.name ?? 'You';
  const [pool, setPool] = useState<Pool | null>(null);
  const [stage, setStage] = useState<Stage>('load');
  const [error, setError] = useState('');
  const [setup, setSetup] = useState<Setup | null>(null);
  const [found, setFound] = useState<Found | null>(null);
  const [opp, setOpp] = useState<OppView | null>(null);
  const [out, setOut] = useState<Outcome | null>(null);
  const [promotion, setPromotion] = useState<number | null>(null);
  const [week] = useState(() => weekOf(easternDateKey()));
  const connRef = useRef<MatchConn | null>(null);
  const oppRef = useRef(opp);
  oppRef.current = opp;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const done = useRef(false);
  const foundAt = useRef(0);
  // a new search each time the queue starts over (a match that never connected)
  const [searchNo, setSearchNo] = useState(0);

  const me = useMemo(() => (pool ? mySide(pool, profile.ut, name) : null), [pool]);

  useEffect(() => {
    let live = true;
    getPool()
      .then((p) => live && setPool(p))
      .catch(() => {
        if (!live) return;
        setError('The cards didn’t load. Check your connection and try again.');
        setStage('error');
      });
    return () => {
      live = false;
    };
  }, []);

  // what to play, once the cards are here
  useEffect(() => {
    if (!pool || !me || stage !== 'load') return;
    if (!startersComplete(SPORT, lineupOf(me.sq))) {
      setError('Fill every starting spot in your squad first.');
      setStage('error');
      return;
    }
    if (req.mode === 'online') {
      if (!NET_ON) {
        setError('Head to head needs a connection.');
        setStage('error');
        return;
      }
      setStage('search');
      return;
    }
    if (req.event) {
      const e = req.event;
      if (e.node > (profileRef.current.ut.events?.[e.id] ?? 0)) {
        setError('Clear the previous event match first.');
        setStage('error');
        return;
      }
      const rung = eventRung(pool, e.id, e.node);
      if (!rung) {
        setError('This event match is unavailable.');
        setStage('error');
        return;
      }
      setSetup({ seed: 'event:' + SPORT + ':' + e.id + ':' + e.node + ':' + req.id, me, rival: aiSide(pool, rung), online: null, rung, event: { ...e, title: rung.title } });
      setStage('vs');
      return;
    }
    const bt = battlesThisWeek(profileRef.current.ut.battles, week);
    const level = levelOf(bt.level);
    const rung = weekLadder(pool, week, bt.round ?? 0, level)[req.rung ?? 0];
    if (!rung) {
      setError('That rung isn’t on this week’s ladder.');
      setStage('error');
      return;
    }
    setSetup({
      seed: 'ut:' + SPORT + ':' + week + ':' + (bt.round ?? 0) + ':' + level + ':' + rung.i + ':' + req.id,
      me,
      rival: aiSide(pool, rung),
      online: null,
      rung,
      level: { name: LEVEL_NAME[level], pay: LEVEL[level].pay, def: LEVEL[level].def },
    });
    setStage('vs');
  }, [pool, me, stage]);

  // leaving mid-match tells the other phone; nothing more from this match either way
  useEffect(
    () => () => {
      if (connRef.current) connRef.current.close(!done.current);
      connRef.current = null;
      setPresence('menu');
    },
    []
  );

  // ---------- online ----------

  const onFound = (f: Found) => {
    if (!me) return;
    setFound(f);
    foundAt.current = Date.now();
    setPresence('match');
    sfx.seriesWin();
    setOpp(null);
    const conn: MatchConn = new MatchConn(f, (theirs, gone) => {
      if (connRef.current !== conn) return;
      const next = oppOf(theirs, gone);
      setOpp((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    });
    connRef.current = conn;
    conn.start();
    conn.update((s) => ({ ...s, fav: me.fav, ut: { squad: me.wire, ovr: me.rating.ovr } }));
    setStage('found');
    // their squad never came (their phone missed the start): back to the queue
    window.setTimeout(() => {
      if (connRef.current !== conn || oppRef.current?.ut) return;
      conn.close(false);
      connRef.current = null;
      setPresence('menu');
      setFound(null);
      props.onToast(f.opp.name + ' didn’t connect. Back to the queue.');
      setSearchNo((n) => n + 1);
      setStage('search');
    }, CONNECT_MS);
  };

  // their squad is here (and the splash has had its moment): the teams
  useEffect(() => {
    if (stage !== 'found' || !found || !opp?.ut || !pool || !me) return;
    const t = window.setTimeout(
      () => {
        const sq = squadFromWire(pool, opp.ut!.squad);
        setSetup({ seed: found.matchId, me, rival: { name: found.opp.name, sq, wire: squadToWire(sq), rating: ratingOf(SPORT, sq), fav: opp.fav }, online: found, rung: null });
        setStage('vs');
      },
      Math.max(0, foundAt.current + FOUND_MS - Date.now())
    );
    return () => clearTimeout(t);
  }, [stage, !!opp?.ut, found]);

  /** No one near your squad: an AI squad at your overall. */
  const goAI = () => {
    if (!pool || !me || stage !== 'search') return;
    sfx.click();
    const rung = aiOpponent(pool, me.rating.ovr, week + ':' + req.id);
    setSetup({ seed: 'ut-ai:' + SPORT + ':' + req.id, me, rival: aiSide(pool, rung), online: null, rung });
    setStage('vs');
  };

  // ---------- the game ----------

  const teams = useMemo(() => (setup ? teamsOf(SPORT, setup.me.sq, setup.rival.sq, setup.seed) : null), [setup]);
  const kits = useMemo(() => (setup ? kitsFor(setup.me.fav, setup.rival.fav, SPORT) : undefined), [setup]);
  const aiSkill = setup?.rung ? setup.rung.skill : AI_SKILL.pro;

  useEffect(() => {
    if (stage !== 'vs') return;
    const t = window.setTimeout(() => setStage(props.autoplay ? 'play' : 'vote'), props.autoplay ? 400 : VS_MS);
    return () => clearTimeout(t);
  }, [stage]);

  const finish = (us: Progress, them: Progress, how: 'played' | 'sim') => {
    if (done.current || !setup || !pool) return;
    done.current = true;
    const s = setup;
    // two squads exactly as good: a coin both phones read the same way off the match
    const coin = () => {
      const a = hashString(s.seed + JSON.stringify(s.me.wire));
      const b = hashString(s.seed + JSON.stringify(s.rival.wire));
      return a !== b ? a > b : !!s.online?.host;
    };
    const d = decide(us.score, them.score, s.me.rating.raw, s.rival.rating.raw, s.online ? coin : () => true);
    const ut = profileRef.current.ut;
    const input = {
      matchId: s.online?.matchId ?? 'ut-ai:' + req.id,
      event: s.event,
      won: d.won,
      us: us.score,
      them: them.score,
      online: !!s.online,
      rung: s.rung && s.rung.i >= 0 ? { i: s.rung.i, pack: s.rung.pack } : null,
      played: Object.values(ut.squad),
      week,
      day: easternDateKey(),
      packId: newId(),
      at: Date.now(),
      pay: s.rung && s.rung.i >= 0 ? s.level?.pay : undefined,
    };
    const shown = settle(ut, input);
    const beforeDivision = divisionOf(rivalsOf(ut.rivals, week).points),
      afterDivision = divisionOf(rivalsOf(shown.ut.rivals, week).points);
    if (s.online && afterDivision > beforeDivision) setPromotion(afterDivision);
    if (s.online) void publishRivals({ ...profileRef.current, ut: shown.ut }, week);
    props.update((p) => {
      const r = settle(p.ut, input);
      return { ...p, coins: p.coins + r.coins, ut: r.ut };
    });
    // our final state lingers a while, for a phone still finishing
    connRef.current?.close(false, 30000);
    connRef.current = null;
    setPresence('menu');
    const cardOf = new Map(ut.owned.map((o) => [o.uid, o.cardId]));
    const ups = shown.ups.map((u) => ({ name: pool.byId.get(cardOf.get(u.uid) ?? '')?.name ?? 'A card', level: u.level }));
    setOut({
      eventCleared: !!s.event && (shown.ut.events?.[s.event.id] ?? 0) > (ut.events?.[s.event.id] ?? 0),
      ...d,
      us: us.score,
      them: them.score,
      how,
      ends: [us.ends, them.ends],
      coins: shown.coins,
      xp: shown.xp,
      ups,
      climbed: shown.climbed,
      pack: shown.pack,
      capped: shown.capped,
      refreshed: shown.refreshed,
    });
    setStage('result');
    if (d.won) {
      sfx.seriesWin();
      vibrate([30, 60, 30]);
    } else sfx.nope();
    if (shown.ups.length) window.setTimeout(() => sfx.levelUp(), 900);
  };

  /** The vote went to the sim: both sides' drives by the autopilot, the same on both phones. */
  const simBoth = () => {
    if (!setup || !teams) return;
    const t = teams;
    const key = (w: SquadWire) => setup.seed + ':sim:' + hashString(JSON.stringify(w));
    const mine = 0.6;
    const theirs = setup.online ? 0.6 : aiSkill;
    const us = NFL ? aiDrivesOf(t.offense!, t.rivalDefense!, key(setup.me.wire), mine) : aiPossessionsOf(t.five!, t.rivalFive!, key(setup.me.wire), mine, POSSESSIONS, t.bench);
    const them = NFL
      ? aiDrivesOf(t.rivalOffense!, t.defense!, key(setup.rival.wire), theirs)
      : aiPossessionsOf(t.rivalFive!, t.five!, key(setup.rival.wire), theirs, POSSESSIONS, t.rivalBench);
    finish(us, them, 'sim');
  };

  // ---------- screens ----------

  if (stage === 'play' && setup && teams) {
    const conn = connRef.current;
    return (
      <div className="screen arcade">
        <Arcade
          teams={teams}
          rivalName={setup.rival.name}
          seed={'arc:' + setup.seed}
          online={!!setup.online}
          botLevel="pro"
          aiSkill={aiSkill}
          aiDefense={setup.online ? 0 : (setup.level?.def ?? 0)}
          rivalLive={setup.online ? (opp?.arcade ?? null) : null}
          rivalGone={!!setup.online && (!!opp?.gone || !!opp?.left)}
          tookMe={setup.online ? (opp?.arcadeTook ?? null) : null}
          autoplay={props.autoplay}
          kits={kits}
          onProgress={(p) => conn?.update((s) => ({ ...s, arcade: p }))}
          onTakeover={(k) => conn?.update((s) => ({ ...s, arcadeTook: k }))}
          onFinish={(us, them, how) => finish(us, them, how)}
        />
      </div>
    );
  }

  if (stage === 'vote' && setup) {
    return (
      <Vote
        rivalName={setup.rival.name}
        online={!!setup.online}
        seed={setup.online ? setup.online.matchId : 'vote:' + setup.seed}
        rival={setup.online ? (opp?.vote ?? NO_VOTE) : null}
        rivalGone={!!setup.online && (!!opp?.gone || !!opp?.left)}
        waitFor="to get here"
        simText="Skip to the final: both sides simmed"
        onWire={(w) => connRef.current?.update((s) => ({ ...s, vote: w.vote, voteAt: w.at, voteSaw: w.saw }))}
        onDone={(o) => (o === 'play' ? setStage('play') : simBoth())}
      />
    );
  }

  const leave = () => {
    sfx.click();
    props.onExit();
  };

  let body: React.ReactNode;
  if (stage === 'error')
    body = (
      <div className="utm-center">
        <p>{error}</p>
        <button className="btn primary" onClick={leave}>
          BACK
        </button>
      </div>
    );
  else if (stage === 'load' || !me)
    body = (
      <div className="utm-center" role="status">
        <span className="ut-spinner" aria-hidden="true" />
        <p>Loading your squad…</p>
      </div>
    );
  else if (stage === 'search' || stage === 'found')
    body = <SearchView key={searchNo} me={me} queue={pool ? queueOf(pool) : 'ut'} level={levelInfo(profile.xp).level} found={found} onFound={onFound} onAI={goAI} />;
  else if (stage === 'vs' && setup) body = <VsView setup={setup} />;
  else if (stage === 'result' && setup && out)
    body = (
      <ResultView
        setup={setup}
        out={out}
        onDone={leave}
        onAgain={() => {
          sfx.click();
          const r = setup.rung;
          if (setup.event) {
            props.onAgain({ id: Date.now(), mode: 'ai', event: { id: setup.event.id, node: out.won ? Math.min(2, setup.event.node + 1) : setup.event.node } });
            return;
          }
          if (setup.online || !r || r.i < 0) props.onAgain({ id: Date.now(), mode: req.mode });
          else props.onAgain({ id: Date.now(), mode: 'ai', rung: out.refreshed ? 0 : out.climbed ? r.i + 1 : r.i });
        }}
      />
    );

  if (promotion !== null && stage === 'result') return <Promotion division={promotion} onDone={() => setPromotion(null)} />;
  const canLeave = stage === 'search' || stage === 'error' || stage === 'load';
  const title = req.event ? 'Spotlight Events' : req.mode === 'online' ? 'Head to Head' : 'Squad Battles';
  return (
    <div className={'screen ut utm utm-s-' + stage}>
      <div className="topbar ut-top">
        {canLeave ? (
          <button className="icon-btn pill-btn" onClick={leave} aria-label="Back to Ultimate Team">
            <Back size={16} /> UT
          </button>
        ) : (
          <span className="pill-btn utm-ghost" aria-hidden="true" />
        )}
        <span className="ut-title disp">{title}</span>
        <CoinChip coins={profile.coins} />
      </div>
      <div className="ut-body">{body}</div>
    </div>
  );
}

/** Waiting in the queue: the window of overalls it takes, widening, and the AI after UT_AI_AFTER. */
function SearchView(props: { me: Side; queue: string; level: number; found: Found | null; onFound: (f: Found) => void; onAI: () => void }) {
  const { me, found } = props;
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const mmRef = useRef<Matchmaker | null>(null);
  const foundRef = useRef(props.onFound);
  foundRef.current = props.onFound;
  const aiRef = useRef(props.onAI);
  aiRef.current = props.onAI;
  const elapsed = Math.floor((now - t0) / 1000);
  const win = squadWindow(now - t0);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let got = false;
    const mm = new Matchmaker({ name: me.name, level: props.level, queue: props.queue, ovr: me.rating.ovr }, (f) => {
      if (got) return;
      got = true;
      foundRef.current(f);
    });
    mm.start();
    mmRef.current = mm;
    return () => {
      mm.stop();
      mmRef.current = null;
    };
  }, []);

  // nobody near: the AI steps in (not in the middle of pairing up with someone)
  useEffect(() => {
    if (found || elapsed < UT_AI_AFTER || mmRef.current?.pending()) return;
    mmRef.current?.stop();
    aiRef.current();
  }, [elapsed, found]);

  const lo = Math.max(1, me.rating.ovr - win);
  const hi = Math.min(110 + CHEM_BONUS, me.rating.ovr + win);
  return (
    <div className="page utm-search">
      <div className="radar-wrap">
        <div className="radar" aria-hidden="true">
          <i />
          <i />
          <i />
          <span className="sweep" />
          <b className="disp num">{me.rating.ovr}</b>
        </div>
        <div className="search-text" role="status">
          <strong>Looking for a squad near yours…</strong>
          <small key={win}>
            Squads rated <b className="num">{lo}</b>–<b className="num">{hi}</b>
            {win < 10 ? ', wider every 10 seconds' : ''}
          </small>
          <b className="disp num search-clock">{clock(elapsed)}</b>
        </div>
        <div className="ai-meter">
          <span className="track">
            <i style={{ transform: 'scaleX(' + Math.min(1, elapsed / UT_AI_AFTER) + ')' }} />
          </span>
          <small>{elapsed < UT_AI_AFTER ? 'An AI squad at your level steps in at ' + clock(UT_AI_AFTER) : 'An AI squad is stepping in…'}</small>
        </div>
      </div>
      <div className="utm-mine">
        <span className="eyebrow">Your squad</span>
        <span className="utm-mine-nums">
          <b className="disp num">{me.rating.ovr}</b> OVR <b className="disp num">{me.rating.chem}</b> CHEM
        </span>
      </div>
      <div className="spacer" />
      <div className="actionbar">
        <button className="big ghost" onClick={props.onAI} disabled={!!found}>
          <span>PLAY AN AI SQUAD NOW</span>
        </button>
      </div>
      {found && (
        <div className="vs-splash" role="dialog" aria-label={'Match found: ' + me.name + ' versus ' + found.opp.name}>
          <span className="eyebrow wide">Match found</span>
          <div className="vs-names">
            <div className="vs-a">
              <b className="disp">{initials(me.name)}</b>
              <strong>{me.name}</strong>
              <small>{me.rating.ovr} OVR</small>
            </div>
            <span className="disp vs-x">VS</span>
            <div className="vs-b">
              <b className="disp">{initials(found.opp.name)}</b>
              <strong>{found.opp.name}</strong>
              <small>{typeof found.opp.ovr === 'number' ? found.opp.ovr + ' OVR' : 'Level ' + found.opp.level}</small>
            </div>
          </div>
          <small className="vs-note">Swapping squads…</small>
          <span className="vs-burst" aria-hidden="true">
            <Sparks color="#F5B83D" />
          </span>
        </div>
      )}
    </div>
  );
}

function SideCard({ side, you }: { side: Side; you: boolean }) {
  const best = bestOf(side.sq, 3);
  return (
    <div className={'utm-side' + (you ? ' utm-me' : ' utm-them')}>
      <span className="utm-fan" aria-hidden="true">
        {best.map((rc, i) => (
          <span key={rc.line.id} style={{ '--i': i - (best.length - 1) / 2 } as React.CSSProperties}>
            <UtCard rc={rc} w={54} />
          </span>
        ))}
      </span>
      <strong className="utm-side-name">{side.name}</strong>
      <span className="utm-side-nums">
        <b className="disp num">{side.rating.ovr}</b>
        <i>OVR</i>
        <b className="disp num">{side.rating.chem}</b>
        <i>CHEM</i>
      </span>
    </div>
  );
}

function VsView({ setup }: { setup: Setup }) {
  const r = setup.rung;
  const eyebrow = setup.event
    ? 'Spotlight Series · ' + setup.event.title
    : setup.online
      ? 'Head to head · online'
      : r && r.i >= 0
        ? 'Squad Battles · ' + (setup.level ? setup.level.name + ' · ' : '') + 'rung ' + (r.i + 1) + ' of ' + RUNGS
        : 'No one near your squad right now';
  return (
    <div className="utm-vs rise-in" role="status" aria-label={setup.me.name + ' versus ' + setup.rival.name}>
      <span className="eyebrow wide">{eyebrow}</span>
      <div className="utm-vs-row">
        <SideCard side={setup.me} you />
        <span className="disp utm-vs-x">VS</span>
        <SideCard side={setup.rival} you={false} />
      </div>
      <small className="utm-vs-note">
        {setup.event
          ? setup.event.title
          : r
            ? r.i >= 0
              ? r.title + ' · ' + skillName(r.skill) + ' AI'
              : 'An AI squad of the ' + r.title + ', at your level'
            : 'Each of you plays your offense against the other’s defense.'}
      </small>
    </div>
  );
}

function ResultView({ setup, out, onDone, onAgain }: { setup: Setup; out: Outcome; onDone: () => void; onAgain: () => void }) {
  const r = setup.rung;
  const ladder = !!r && r.i >= 0;
  const top = ladder && out.climbed && r!.i + 1 >= RUNGS;
  const again = setup.event
    ? out.won && setup.event.node < 2
      ? 'NEXT EVENT MATCH'
      : 'PLAY AGAIN'
    : setup.online || (r && r.i < 0)
      ? 'PLAY AGAIN'
      : out.refreshed
        ? 'NEW LADDER'
        : out.climbed && !top
          ? 'NEXT RUNG'
          : out.won
            ? 'PLAY IT AGAIN'
            : 'TRY AGAIN';
  return (
    <div className="page utm-result">
      <span className="eyebrow wide">{setup.event ? setup.event.title : ladder ? 'Squad Battles · rung ' + (r!.i + 1) : setup.online ? 'Head to head' : 'Vs an AI squad'}</span>
      <h1 className={'disp utm-verdict ' + (out.won ? 'win' : 'loss')}>{out.won ? 'WIN' : 'LOSS'}</h1>
      <div className="utm-score" aria-label={'You ' + out.us + ', ' + setup.rival.name + ' ' + out.them}>
        <span>
          <b className="disp num">{out.us}</b>
          <small>{setup.me.name}</small>
        </span>
        <i>–</i>
        <span>
          <b className="disp num">{out.them}</b>
          <small>{setup.rival.name}</small>
        </span>
      </div>
      <div className="utm-ends" aria-label={(NFL ? 'Drives' : 'Possessions') + ': yours ' + out.ends[0].join(', ') + '; theirs ' + out.ends[1].join(', ')}>
        {out.ends.map((ends, k) => (
          <span key={k} className={(k ? 'them' : 'us') + (ends.length > 8 ? ' many' : '')}>
            {ends.map((e, i) => (
              <i key={i} className={'e-' + (END_POINTS[e] ? 'pts' : 'none')}>
                {END_LABEL[e] ?? e}
              </i>
            ))}
          </span>
        ))}
      </div>
      {(out.tiebreak || out.how === 'sim') && (
        <p className="utm-note">
          {out.how === 'sim' ? 'Simmed. ' : ''}
          {out.tiebreak ? 'A tie goes to the better squad: ' + (out.won ? 'yours.' : 'theirs.') : ''}
        </p>
      )}
      {setup.event && out.won && (
        <div className="utm-climb rise-in">
          <b className="disp">{out.eventCleared ? (setup.event.node === 2 ? 'SERIES COMPLETE' : 'EVENT MATCH WON') : 'REPLAY COMPLETE'}</b>
          <small>{out.eventCleared ? 'Your first-clear reward is waiting in the Store.' : 'This stage’s first-clear reward has already been earned.'}</small>
        </div>
      )}
      {out.climbed && (
        <div className="utm-climb rise-in">
          <b className="disp">{top ? 'LADDER CLEARED!' : 'RUNG ' + (r!.i + 1) + ' CLEARED'}</b>
          {out.pack ? <small>Your {packName(SPORT, out.pack)} is waiting in the Store.</small> : !top && <small>Next up: rung {r!.i + 2}.</small>}
          {out.refreshed && (
            <small>
              A new ladder of {RUNGS} squads is up{setup.level ? ' on ' + setup.level.name : ''}.
            </small>
          )}
        </div>
      )}
      {out.capped ? (
        <p className="utm-note">Today’s {PAID_GAMES_A_DAY} paid games are played: games pay coins and XP again tomorrow.</p>
      ) : (
        <div className="utm-rewards">
          <span>
            <Coin size={16} /> <b className="num">+{out.coins}</b> coins
          </span>
          <span>
            <b className="num">+{out.xp}</b> XP for every card in your squad
          </span>
        </div>
      )}
      {out.ups.length > 0 && (
        <div className="utm-ups">
          <span className="eyebrow">{out.ups.length === 1 ? 'Level up' : out.ups.length + ' level-ups'}</span>
          {out.ups.slice(0, out.ups.length > 4 ? 3 : 4).map((u, i) => (
            <span key={i} className="utm-up rise-in" style={{ animationDelay: 300 + i * 120 + 'ms' }}>
              <b>{u.name}</b> <i className="num">LV {u.level}</i>
            </span>
          ))}
          {out.ups.length > 4 && <span className="utm-up utm-more">and {out.ups.length - 3} more: every card plays at its new level from your next game</span>}
        </div>
      )}
      <div className="spacer" />
      <div className="btnrow utm-btns">
        <button className="btn" onClick={onDone}>
          DONE
        </button>
        <button className="btn primary" onClick={onAgain}>
          {again}
        </button>
      </div>
    </div>
  );
}
