import { cupOpponent, CUP_ROUNDS, cupOf, type CupRequest } from './cup';
import { MatchRecap } from './MatchRecap';
import { boxOf, gradeOf, stripLocal } from './match-box';
import { rateBox } from './match-ratings';
import {
  afterCtxOf,
  bankedLedger,
  buildRecap,
  milestonesOf,
  type MatchKind,
  oneMoreStart,
  type Recap,
  verdictOf,
} from './match-recap';
import { nextCtxOf, nextUp, type NextAction } from './next-action';
import { claimMinutes, minutesExtras, minutesView } from './minutes';
import { claimAll, inboxCount } from './inbox';
import { elsewhereOf, readDevice } from '../ui/next-up-main';
import { rememberUtReturn } from './return-view';
import { leagueOpponent, type LeagueRequest } from './league';
import { applyLeagueTeams } from './league-match';
import { withLeagueForm } from './league-form';
import { publishRivals } from './rivals-net';
import { LABEL } from './labels';
// Ultimate Team's played matches: Squad Battles against this week's AI ladder, and online head to
// head against a squad near yours (by overall: within 3, wider by 2 every 10 seconds up to 10, then
// an AI squad at your level steps in). The two squads become the arcade game's teams (teams.ts):
// each side plays its offense against the other's defense, with the draft head to head's vote,
// takeover and tiebreak rules. The result pays coins and card XP and climbs the ladder (play.ts).
// Online, the squads cross over the match channel (src/net/match.ts) in a queue of their own.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { bankActivity, pendingSec, usePlaytime } from '../lib/playtime';
import { holdBreak } from '../ui/BreakReminder';
import { levelInfo } from '../engine/economy';
import { hashString } from '../engine/rng';
import { easternDateKey } from '../engine/season';
import { pick, SPORT } from '../engine/sport';
import { loadSoccerGame } from '../soccer-lazy';
import type { Pens } from '../game/Arcade';

/** Claude 2026-11-01: soccer is the third sport; each branch names it. */
const SOCCER = pick({ nba: false, nfl: false, soccer: true });
const FOOTBALL = pick({ nba: false, nfl: true, soccer: false });
import { AI_SKILL, Arcade, type Progress } from '../game/Arcade';
import { DRIVES } from '../game/football2/drive';
import { aiDrivesOf } from '../game/football2/Football2';
import { POSSESSIONS } from '../game/hoops2/game';
import { aiPossessionsOf } from '../game/hoops2/Hoops2';
import { kitsFor } from '../game/uniforms';
import { favoriteFor } from '../lib/favorites';
import { newId, type Profile } from '../lib/profile';
import { sfx } from '../lib/sound';
import {
  type ArcadeState,
  type Found,
  MatchConn,
  type MatchState,
  Matchmaker,
  setPresence,
  squadWindow,
} from '../net/match';
import { NET_ON } from '../net/nostr';
import { NO_VOTE, type VoteWire, voteWireOf } from '../net/vote';
import { CoinChip, initials } from '../ui/common';
import { Back } from '../ui/icons';
import { Sparks } from '../ui/motion';
import { Vote } from '../ui/Vote';
import {
  aiOpponent,
  battlesThisWeek,
  LEVEL,
  LEVEL_NAME,
  levelOf,
  type Rung,
  RUNGS,
  shortName,
  skillName,
  weekLadder,
} from './battles';
import { UtCard } from './CardArt';
import { eventRung } from './events';
import { circuitRung } from './circuit';
import { addCareerXp, careerXp, type CareerGain, decide, PAID_GAMES_A_DAY, settle, type UtMatchRequest } from './play';
import { byValue, getPool, type Pool } from './pool';
import { weekOf } from './sbc';
import {
  rateSquad,
  CHEM_BONUS,
  setSoccerFormation,
  type SquadRating,
  startersComplete,
} from './squad';
import {
  lineupOf,
  ratingOf,
  type SquadCards,
  squadFromWire,
  squadToWire,
  type SquadWire,
  teamsOf,
} from './teams';
import type { UtState } from './state';
import './match.css';
// Claude 2026-11-01: UT Draft matches and the Weekly Standouts objective
import {
  DRAFT_GAMES,
  draftOf,
  draftRung,
  draftWire,
  settleDraft,
} from './draft-mode';
import { recordStandoutWin } from './content-progress';
import { playId, recordEvoMatch } from './evolutions';
import type { UtSport } from './types';

/**
 * The queue of its own: Ultimate Team squads never pair with draft head to heads, nor with a build
 * whose cards (the pool's fingerprint) or match rules differ, since each phone rates both squads
 * and plays the sim itself. Bump UT_RULES when teams.ts or play.ts change how a match comes out.
 */
// Codex: NFL rushing execution differs from v4; NBA queues remain compatible.
// Claude ratings rework + NBA shot curve (2026-11-01): ratings, levels and jumpers changed.
// Soccer (Claude 2026-11-01): its own queue, from 1.
// soccer 2 (Claude 2026-11-02): the aim/shoot, keeper and passing update changes how a match comes out
const UT_RULES: Record<UtSport, number> = { nba: 10, nfl: 11, soccer: 2 };
const queueOf = (pool: Pool) => 'ut-' + UT_RULES[pool.sport] + '-' + pool.print;
/** Seconds of searching before an AI squad steps in: the window is at its widest (10) from 40. */
export const UT_AI_AFTER = 50;
/** The match found, the other phone's squad not here after this long: back to the queue. */
const CONNECT_MS = 15000;
/** how long the found splash and the VS screen stay up */
const FOUND_MS = 2300;
const VS_MS = 2800;
/** Claude ut-5: a match started from the One-More bar shows its opponent this long, then kicks off (V2 D.1) */
const QUICK_VS_MS = 1500;

interface Side {
  form?: Record<string, number>;
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
  circuit?: { runId: string; round: number };
  league?: LeagueRequest;
  cup?: CupRequest;
  draft?: { runId: string; game: number };
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
  cupDone?: boolean;
  seasonXP?: number;
  circuitPrizes?: string[];
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
  /** Claude: a draft game: the run's wins after it, and whether the run is over */
  draft?: { wins: number; done: boolean };
  /** Claude ut-5: the 5-second end of match, and the One-More bar's next match */
  recap: Recap;
  next: NextAction;
  kind: MatchKind & { event?: { id: string; node: number } };
  paidToday: number;
}

type Stage =
  'load' | 'search' | 'found' | 'vs' | 'vote' | 'play' | 'result' | 'error';

const clock = (s: number) =>
  Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

/** Your squad as it is in the profile, read the way the other phone reads it off the wire. */
function mySide(pool: Pool, ut: UtState, name: string): Side {
  const byUid = new Map(ut.owned.map((o) => [o.uid, o]));
  const raw: SquadWire = [];
  for (const [slot, uid] of Object.entries(ut.squad)) {
    const o = byUid.get(uid);
    if (o) raw.push([slot, playId(ut, o), o.level]);
  }
  const sq = squadFromWire(pool, raw);
  return {
    name,
    sq,
    wire: squadToWire(sq),
    rating: ratingOf(SPORT, sq),
    fav: favoriteFor(SPORT),
  };
}

function aiSide(pool: Pool, r: Rung): Side {
  const sq = squadFromWire(pool, r.squad);
  return {
    name: shortName(r),
    sq,
    wire: squadToWire(sq),
    rating: ratingOf(SPORT, sq),
    fav: r.fav,
  };
}

/** a squad's best cards, for the VS screen */
function bestOf(sq: SquadCards, n: number, form?: Record<string, number>) {
  return Object.values(lineupOf(sq))
    .filter((x): x is NonNullable<typeof x> => !!x)
    .map((rc) => (form ? withLeagueForm(rc, form[rc.line.id] ?? 0) : rc))
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
  onPractice?: () => void;
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
  const [week] = useState(() => weekOf(easternDateKey()));
  const connRef = useRef<MatchConn | null>(null);
  const oppRef = useRef(opp);
  oppRef.current = opp;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  // soccer: the squad's formation (squad.ts), before any squad is rated here
  setSoccerFormation(profile.ut.formation);
  const done = useRef(false);
  const foundAt = useRef(0);
  // a new search each time the queue starts over (a match that never connected)
  const [searchNo, setSearchNo] = useState(0);
  // Claude 2026-11-16 (V2 E.1): MINUTES. The match's seconds are provisional until finish() banks them
  usePlaytime(stage === 'play' ? 'match' : stage === 'result' ? 'replay' : stage === 'search' ? 'queue' : 'menu', { id: 'ut:' + req.id, sport: SPORT, kind: 'match' });
  // ut-3 (V2 D.11): the break reminder never lands on the match handshake (found, VS, the timed vote)
  useEffect(() => (holdBreak('ut-match', stage === 'found' || stage === 'vs' || stage === 'vote'), () => holdBreak('ut-match', false)), [stage]);

  const me = useMemo(() => {
    if (!pool) return null;
    // Claude: a draft game fields the drafted squad (never the club's cards)
    if (req.draft) {
      const run = draftOf(profile.ut);
      const sq = squadFromWire(
        pool,
        run && run.id === req.draft.runId ? draftWire(run) : [],
      );
      return {
        name,
        sq,
        wire: squadToWire(sq),
        rating: ratingOf(SPORT, sq),
        fav: favoriteFor(SPORT),
      };
    }
    return mySide(pool, profile.ut, name);
  }, [pool]);

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
    if (req.draft) {
      const run = draftOf(profileRef.current.ut);
      const g = req.draft.game;
      const rung =
        run &&
        run.id === req.draft.runId &&
        !run.done &&
        run.games === g &&
        startersComplete(SPORT, lineupOf(me.sq))
          ? draftRung(pool, run, g)
          : null;
      if (!rung) {
        setError('This draft match is no longer active. Return to Play.');
        setStage('error');
        return;
      }
      setSetup({
        seed: 'draft:' + req.draft.runId + ':' + g + ':' + req.id,
        me,
        rival: aiSide(pool, rung),
        online: null,
        rung,
        draft: req.draft,
        level: {
          name: 'Draft · Game ' + (g + 1),
          pay: 1,
          def: g / DRAFT_GAMES,
        },
      });
      setStage('vs');
      return;
    }
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
    if (req.cup) {
      const rival = cupOpponent(pool, profileRef.current.ut, req.cup);
      if (!rival) {
        setError(
          'This Cup match is no longer active, or your squad does not meet its rules. Return to Club Cups to check.',
        );
        setStage('error');
        return;
      }
      setSetup({
        seed: 'cup:' + req.cup.runId + ':' + req.cup.round,
        me,
        rival: aiSide(pool, rival.rung),
        online: null,
        rung: rival.rung,
        cup: req.cup,
        level: { name: rival.name, pay: 1, def: rival.def },
      });
      setStage('vs');
      return;
    }
    if (req.league) {
      const season = leagueOpponent(pool, profileRef.current.ut, req.league);
      if (!season) {
        setError('This season fixture is no longer active. Return to Play.');
        setStage('error');
        return;
      }
      const sq = squadFromWire(pool, season.squad);
      const rated = Object.fromEntries(
        Object.entries(lineupOf(sq)).map(([slot, rc]) => [
          slot,
          rc ? withLeagueForm(rc, season.form[rc.line.id] ?? 0) : null,
        ]),
      );
      setSetup({
        seed: 'league:' + req.league.game,
        me,
        rival: {
          name: season.team.name,
          sq,
          wire: season.squad,
          rating: rateSquad(SPORT, rated),
          fav: season.team.abbr,
          form: season.form,
        },
        online: null,
        rung: {
          i: -4,
          title: season.team.name,
          fr: season.team.abbr,
          decade: 2020,
          target: season.rating.ovr,
          ovr: season.rating.ovr,
          squad: season.squad,
          skill: season.skill,
          fav: season.team.abbr,
          pack: null,
        },
        league: req.league,
        level: {
          name:
            'Season · ' +
            LEVEL_NAME[profileRef.current.ut.league!.active.level],
          pay: 1,
          def: season.def,
        },
      });
      setStage('vs');
      return;
    }
    if (req.circuit) {
      const rung = circuitRung(
        pool,
        profileRef.current.ut,
        req.circuit.runId,
        req.circuit.round,
        me.rating.ovr,
      );
      if (!rung) {
        setError('This Circuit match is no longer active. Return to Play HQ.');
        setStage('error');
        return;
      }
      setSetup({
        seed:
          'circuit:' +
          req.circuit.runId +
          ':' +
          req.circuit.round +
          ':' +
          req.id,
        me,
        rival: aiSide(pool, rung),
        online: null,
        rung,
        circuit: req.circuit,
        level: {
          name: req.circuit.round === 5 ? 'Legend' : 'Circuit',
          pay: 1,
          def: req.circuit.round / 5,
        },
      });
      setStage('vs');
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
      setSetup({
        seed: 'event:' + SPORT + ':' + e.id + ':' + e.node + ':' + req.id,
        me,
        rival: aiSide(pool, rung),
        online: null,
        rung,
        event: { ...e, title: rung.title },
      });
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
      seed:
        'ut:' +
        SPORT +
        ':' +
        week +
        ':' +
        (bt.round ?? 0) +
        ':' +
        level +
        ':' +
        rung.i +
        ':' +
        req.id,
      me,
      rival: aiSide(pool, rung),
      online: null,
      rung,
      level: {
        name: LEVEL_NAME[level],
        pay: LEVEL[level].pay,
        def: LEVEL[level].def,
      },
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
    [],
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
      setOpp((prev) =>
        prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next,
      );
    });
    connRef.current = conn;
    conn.start();
    conn.update((s) => ({
      ...s,
      fav: me.fav,
      ut: { squad: me.wire, ovr: me.rating.ovr },
    }));
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
        setSetup({
          seed: found.matchId,
          me,
          rival: {
            name: found.opp.name,
            sq,
            wire: squadToWire(sq),
            rating: ratingOf(SPORT, sq),
            fav: opp.fav,
          },
          online: found,
          rung: null,
        });
        setStage('vs');
      },
      Math.max(0, foundAt.current + FOUND_MS - Date.now()),
    );
    return () => clearTimeout(t);
  }, [stage, !!opp?.ut, found]);

  /** No one near your squad: an AI squad at your overall. */
  const goAI = () => {
    if (!pool || !me || stage !== 'search') return;
    sfx.click();
    const rung = aiOpponent(pool, me.rating.ovr, week + ':' + req.id);
    setSetup({
      seed: 'ut-ai:' + SPORT + ':' + req.id,
      me,
      rival: aiSide(pool, rung),
      online: null,
      rung,
    });
    setStage('vs');
  };

  // ---------- the game ----------

  const teams = useMemo(() => {
    if (!setup) return null;
    const base = teamsOf(SPORT, setup.me.sq, setup.rival.sq, setup.seed);
    return setup.league && pool
      ? applyLeagueTeams(base, pool, setup.rival.form ?? {})
      : base;
  }, [setup, pool]);
  const kits = useMemo(
    () => (setup ? kitsFor(setup.me.fav, setup.rival.fav, SPORT) : undefined),
    [setup],
  );
  const aiSkill = setup?.rung ? setup.rung.skill : AI_SKILL.pro;
  const defenseIQ = setup?.online ? 1 : (setup?.level?.def ?? 0);

  useEffect(() => {
    if (stage !== 'vs') return;
    const t = window.setTimeout(
      () =>
        setStage(
          props.autoplay || setup?.circuit || setup?.league || setup?.cup || req.quick
            ? 'play'
            : 'vote',
        ),
      props.autoplay ? 400 : req.quick ? QUICK_VS_MS : VS_MS,
    );
    return () => clearTimeout(t);
  }, [stage]);

  const finish = (
    us: Progress,
    them: Progress,
    how: 'played' | 'sim',
    pens?: Pens,
  ) => {
    if (done.current || !setup || !pool) return;
    done.current = true;
    // Claude ut-5: this match's counted seconds, before they bank (the recap's "+N min")
    const minutesSec = pendingSec();
    bankActivity('ut:' + req.id, 'complete');
    const s = setup;
    const before = profileRef.current;
    const now = Date.now(),
      day = easternDateKey();
    // two squads exactly as good: a coin both phones read the same way off the match
    const coin = () => {
      const a = hashString(s.seed + JSON.stringify(s.me.wire));
      const b = hashString(s.seed + JSON.stringify(s.rival.wire));
      return a !== b ? a > b : !!s.online?.host;
    };
    // soccer: a level match was settled on penalties (Arcade.tsx)
    const d =
      pens && us.score === them.score
        ? { won: pens.won, tiebreak: true }
        : decide(
            us.score,
            them.score,
            s.me.rating.raw,
            s.rival.rating.raw,
            s.online ? coin : () => true,
          );
    // Claude ut-5: what this phone's game reported at the whistle (C1 grade, C2 box), read without
    // trusting it; neither ever reached the wire (stripLocal on every update)
    const local = us as Progress & { grade?: unknown; box?: unknown; ot?: unknown };
    const grade = gradeOf(local.grade, d.won),
      box = rateBox(SPORT, boxOf(local.box)),
      verdict = verdictOf(
        {
          us: us.score,
          them: them.score,
          won: d.won,
          tiebreak: d.tiebreak,
          ...(pens && us.score === them.score ? { pens } : {}),
          ...(typeof local.ot === 'number' ? { ot: local.ot } : {}),
          ends: [us.ends, them.ends],
        },
        SPORT,
      );
    const ut = before.ut;
    const bt = battlesThisWeek(ut.battles, week);
    const kind: Outcome['kind'] = {
      online: req.mode === 'online',
      cup: s.cup,
      circuit: s.circuit,
      league: s.league,
      draft: s.draft,
      event: s.event ? { id: s.event.id, node: s.event.node } : undefined,
      rung: s.rung && s.rung.i >= 0 && !s.event && !s.cup && !s.circuit && !s.league && !s.draft ? s.rung.i : undefined,
      level: levelOf(bt.level),
    };
    /** the One-More bar: the best next match, from the save as this match settled it */
    const oneMore = (after: Profile): NextAction => {
      const ledger = bankedLedger(after.playtime, minutesSec, now, SPORT);
      const ctx = nextCtxOf(after.ut, SPORT, now, {
        ...minutesExtras(ledger, now),
        after: afterCtxOf(after.ut, kind, { won: d.won, us: us.score, them: them.score, flawless: grade?.flawless }),
      });
      return nextUp({ ...ctx, elsewhere: elsewhereOf(readDevice(), SPORT, ctx.day) });
    };
    const result = (after: Profile, o: Omit<Outcome, 'recap' | 'next' | 'kind' | 'paidToday' | keyof typeof d | 'us' | 'them' | 'how' | 'ends'>, extra: { career: CareerGain | null; milestones: Parameters<typeof milestonesOf>[0] }): Outcome => ({
      ...o,
      ...d,
      us: us.score,
      them: them.score,
      how,
      ends: [us.ends, them.ends],
      kind,
      paidToday: after.ut.paid.day === day ? after.ut.paid.n : 0,
      next: oneMore(after),
      recap: buildRecap({
        sport: SPORT,
        day,
        week,
        now,
        before,
        after,
        verdict,
        cards: { xp: o.xp, ups: o.ups },
        capped: o.capped,
        career: extra.career,
        online: !!s.online,
        minutesSec,
        milestones: milestonesOf(extra.milestones),
        grade,
        box,
      }),
    });
    if (s.draft) {
      // Claude: a draft game settles on the run only (exactly once: active run, its game, a new match id)
      const dIn = {
        runId: s.draft.runId,
        game: s.draft.game,
        won: d.won,
        us: us.score,
        them: them.score,
        matchId: 'ut-ai:' + req.id,
        at: now,
        day,
        how,
        opponent: s.rival.name,
      };
      const applyD = (p: Profile): Profile => ({ ...p, ut: settleDraft(p.ut, dIn).ut });
      const shownD = settleDraft(ut, dIn);
      const after = applyD(before);
      props.update(applyD);
      const run = draftOf(shownD.ut);
      const draft = { wins: run?.wins ?? 0, done: !!run?.done };
      setOut(
        result(
          after,
          { coins: 0, xp: 0, ups: [], climbed: false, pack: null, capped: false, refreshed: false, seasonXP: shownD.sp, draft },
          { career: null, milestones: { sport: SPORT, draft: { ...draft, games: DRAFT_GAMES } } },
        ),
      );
      setStage('result');
      // sound only: this runs from the game's timer, and iOS replays a timed vibration on the next tap
      if (d.won) sfx.seriesWin();
      else sfx.nope();
      return;
    }
    const input = {
      matchId: s.online?.matchId ?? 'ut-ai:' + req.id,
      event: s.event,
      circuit: s.circuit,
      league: s.league,
      cup: s.cup,
      clubOvr: s.me.rating.ovr,
      opponent: s.rival.name,
      how,
      won: d.won,
      us: us.score,
      them: them.score,
      online: !!s.online,
      rung: s.rung && s.rung.i >= 0 ? { i: s.rung.i, pack: s.rung.pack } : null,
      played: Object.values(ut.squad),
      week,
      day,
      packId: newId(),
      at: now,
      pay: s.rung && s.rung.i >= 0 ? s.level?.pay : undefined,
    };
    const cardIds = s.me.wire.map((w) => w[1]);
    // one pure step for the save: settlement, Evolutions, the Standout objective and Career XP (a
    // match that paid nothing, capped or already settled, adds no Career XP)
    const apply = (p: Profile): { profile: Profile; gain: CareerGain } => {
      const r = settle(p.ut, input);
      const evo = recordEvoMatch(r.ut, {
        matchId: input.matchId,
        won: d.won,
        played: input.played,
      });
      const next: Profile = {
        ...p,
        coins: p.coins + r.coins,
        ut: s.online
          ? evo
          : recordStandoutWin(evo, {
              matchId: input.matchId,
              week,
              won: d.won,
              cardIds,
            }),
      };
      return addCareerXp(next, careerXp({ how, won: d.won, paid: r.xp > 0 }));
    };
    const shown = settle(ut, input);
    const applied = apply(before);
    if (s.online)
      void publishRivals({ ...before, ut: shown.ut }, week);
    props.update((p) => apply(p).profile);
    // our final state lingers a while, for a phone still finishing
    connRef.current?.close(false, 30000);
    connRef.current = null;
    setPresence('menu');
    const cardOf = new Map(ut.owned.map((o) => [o.uid, o.cardId]));
    const ups = shown.ups.map((u) => ({
      name: pool.byId.get(cardOf.get(u.uid) ?? '')?.name ?? 'A card',
      level: u.level,
    }));
    const eventCleared =
      !!s.event &&
      (shown.ut.events?.[s.event.id] ?? 0) > (ut.events?.[s.event.id] ?? 0);
    const cupDone = !!s.cup && !!cupOf(shown.ut).active?.done;
    setOut(
      result(
        applied.profile,
        {
          cupDone,
          seasonXP: shown.seasonXP,
          circuitPrizes: shown.circuitPrizes,
          eventCleared,
          coins: shown.coins,
          xp: shown.xp,
          ups,
          climbed: shown.climbed,
          pack: shown.pack,
          capped: shown.capped,
          refreshed: shown.refreshed,
        },
        {
          career: applied.gain,
          milestones: {
            sport: SPORT,
            career: applied.gain,
            climbed: shown.climbed && s.rung ? { rung: s.rung.i, rungs: RUNGS, pack: shown.pack, level: s.level?.name } : undefined,
            refreshed: shown.refreshed,
            event: s.event ? { title: s.event.title, won: d.won, cleared: eventCleared, final: s.event.node === 2 } : undefined,
            circuitPrizes: shown.circuitPrizes,
            cupDone,
          },
        },
      ),
    );
    setStage('result');
    // sound only: this runs from the game's timer, and iOS replays a timed vibration on the next tap
    if (d.won) sfx.seriesWin();
    else sfx.nope();
  };

  /** The vote went to the sim: both sides' drives by the autopilot, the same on both phones. */
  const simBoth = () => {
    if (!setup || !teams) return;
    const t = teams;
    const key = (w: SquadWire) =>
      setup.seed + ':sim:' + hashString(JSON.stringify(w));
    const mine = 0.6;
    const theirs = setup.online ? 0.6 : aiSkill;
    if (SOCCER) {
      // soccer's engine loads on first use; both phones work out the same attacks and penalties
      void loadSoccerGame().then((sg) => {
        const c = t.soccerCards!;
        const a = sg.cardSquad(c.us, {
          name: 'You',
          abbr: 'YOU',
          c1: '#19E3C9',
          c2: '#0B2631',
        });
        const b = sg.cardSquad(c.them, {
          name: setup.rival.name,
          abbr: 'OPP',
          c1: '#9B7BFF',
          c2: '#5B3FD1',
        });
        const us = sg.aiProgress(a, b, key(setup.me.wire), mine, defenseIQ);
        const them = sg.aiProgress(
          b,
          a,
          key(setup.rival.wire),
          theirs,
          defenseIQ,
        );
        const so =
          us.score === them.score
            ? sg.agreedShootout(
                a,
                b,
                'arc:' + setup.seed,
                setup.online ? !!setup.online.host : true,
              )
            : null;
        finish(
          us,
          them,
          'sim',
          so
            ? { us: so.us, them: so.them, won: so.winner === 'us' }
            : undefined,
        );
      });
      return;
    }
    const us = FOOTBALL
      ? aiDrivesOf(
          t.offense!,
          t.rivalDefense!,
          key(setup.me.wire),
          mine,
          DRIVES,
          defenseIQ,
        )
      : aiPossessionsOf(
          t.five!,
          t.rivalFive!,
          key(setup.me.wire),
          mine,
          POSSESSIONS,
          t.bench,
          defenseIQ,
        );
    const them = FOOTBALL
      ? aiDrivesOf(
          t.rivalOffense!,
          t.defense!,
          key(setup.rival.wire),
          theirs,
          DRIVES,
          defenseIQ,
        )
      : aiPossessionsOf(
          t.rivalFive!,
          t.five!,
          key(setup.rival.wire),
          theirs,
          POSSESSIONS,
          t.rivalBench,
          defenseIQ,
        );
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
          aiDefense={defenseIQ}
          rivalLive={setup.online ? (opp?.arcade ?? null) : null}
          rivalGone={!!setup.online && (!!opp?.gone || !!opp?.left)}
          tookMe={setup.online ? (opp?.arcadeTook ?? null) : null}
          autoplay={props.autoplay}
          manualOnly={!!setup.circuit || !!setup.league || !!setup.cup || !!req.quick}
          kits={kits}
          soccerFavs={{ mine: setup.me.fav, theirs: setup.rival.fav }}
          host={setup.online ? !!setup.online.host : true}
          onProgress={(p) => conn?.update((s) => ({ ...s, arcade: stripLocal(p) }))}
          onTakeover={(k) => conn?.update((s) => ({ ...s, arcadeTook: k }))}
          onFinish={(us, them, how, _took, pens) => finish(us, them, how, pens)}
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
        onWire={(w) =>
          connRef.current?.update((s) => ({
            ...s,
            vote: w.vote,
            voteAt: w.at,
            voteSaw: w.saw,
          }))
        }
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
    body = (
      <SearchView
        key={searchNo}
        me={me}
        queue={pool ? queueOf(pool) : 'ut'}
        level={levelInfo(profile.xp).level}
        found={found}
        onFound={onFound}
        onAI={goAI}
      />
    );
  else if (stage === 'vs' && setup) body = <VsView setup={setup} />;
  if (stage === 'result' && setup && out)
    return (
      <div className="screen ut utm mr-screen">
        <ResultRecap
          setup={setup}
          out={out}
          pool={pool}
          profile={profile}
          week={week}
          onHome={leave}
          onStore={() => {
            rememberUtReturn('store');
            leave();
          }}
          onPractice={SOCCER ? undefined : props.onPractice}
          onToast={props.onToast}
          update={props.update}
          onOneMore={() => {
            const st = oneMoreStart(out.next, profileRef.current.ut, out.kind, Date.now(), out.won);
            if (st.kind === 'view') {
              rememberUtReturn(st.view);
              props.onExit();
              return;
            }
            // a different difficulty starts its ladder at rung 1, exactly as picking it in Squad Battles does
            const level = st.level;
            if (level)
              props.update((p) => ({
                ...p,
                ut: { ...p.ut, battles: { ...battlesThisWeek(p.ut.battles, week), level, cleared: 0 } },
              }));
            props.onAgain(st.req);
          }}
        />
      </div>
    );

  const canLeave = stage === 'search' || stage === 'error' || stage === 'load';
  const title = req.cup
    ? LABEL.clubCups
    : req.draft
      ? LABEL.utDraft
      : req.league
        ? LABEL.clubSeason
        : req.circuit
          ? LABEL.championsCircuit
          : req.event
            ? LABEL.legendsEvents
            : req.mode === 'online'
              ? LABEL.rivals
              : LABEL.squadBattles;
  return (
    <div className={'screen ut utm utm-s-' + stage}>
      <div className="topbar ut-top">
        {canLeave ? (
          <button
            className="icon-btn pill-btn"
            onClick={leave}
            aria-label="Back to Ultimate Team"
          >
            <Back size={16} /> {LABEL.ut}
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
function SearchView(props: {
  me: Side;
  queue: string;
  level: number;
  found: Found | null;
  onFound: (f: Found) => void;
  onAI: () => void;
}) {
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
    const mm = new Matchmaker(
      {
        name: me.name,
        level: props.level,
        queue: props.queue,
        ovr: me.rating.ovr,
      },
      (f) => {
        if (got) return;
        got = true;
        foundRef.current(f);
      },
    );
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
            <i
              style={{
                transform: 'scaleX(' + Math.min(1, elapsed / UT_AI_AFTER) + ')',
              }}
            />
          </span>
          <small>
            {elapsed < UT_AI_AFTER
              ? 'An AI squad at your level steps in at ' + clock(UT_AI_AFTER)
              : 'An AI squad is stepping in…'}
          </small>
        </div>
      </div>
      <div className="utm-mine">
        <span className="eyebrow">Your squad</span>
        <span className="utm-mine-nums">
          <b className="disp num">{me.rating.ovr}</b> OVR{' '}
          <b className="disp num">{me.rating.chem}</b> CHEM
        </span>
      </div>
      <div className="spacer" />
      <div className="actionbar">
        <button className="big ghost" onClick={props.onAI} disabled={!!found}>
          <span>PLAY AN AI SQUAD NOW</span>
        </button>
      </div>
      {found && (
        <div
          className="vs-splash"
          role="dialog"
          aria-label={'Match found: ' + me.name + ' versus ' + found.opp.name}
        >
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
              <small>
                {typeof found.opp.ovr === 'number'
                  ? found.opp.ovr + ' OVR'
                  : 'Level ' + found.opp.level}
              </small>
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
  const best = bestOf(side.sq, 3, side.form);
  return (
    <div className={'utm-side' + (you ? ' utm-me' : ' utm-them')}>
      <span className="utm-fan" aria-hidden="true">
        {best.map((rc, i) => (
          <span
            key={rc.line.id}
            style={{ '--i': i - (best.length - 1) / 2 } as React.CSSProperties}
          >
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
  const eyebrow = setup.cup
    ? LABEL.clubCups + ' · ' + CUP_ROUNDS[setup.cup.round]
    : setup.league
      ? LABEL.clubSeason + ' · ' + (setup.level?.name ?? '')
      : setup.event
        ? LABEL.legendsEvents + ' · ' + setup.event.title
        : setup.online
          ? LABEL.headToHead + ' · online'
          : r && r.i >= 0
            ? LABEL.squadBattles + ' · ' +
              (setup.level ? setup.level.name + ' · ' : '') +
              'rung ' +
              (r.i + 1) +
              ' of ' +
              RUNGS
            : 'No one near your squad right now';
  return (
    <div
      className="utm-vs rise-in"
      role="status"
      aria-label={setup.me.name + ' versus ' + setup.rival.name}
    >
      <span className="eyebrow wide">{eyebrow}</span>
      <div className="utm-vs-row">
        <SideCard side={setup.me} you />
        <span className="disp utm-vs-x">VS</span>
        <SideCard side={setup.rival} you={false} />
      </div>
      <small className="utm-vs-note">
        {setup.cup
          ? (setup.level?.name ?? 'Cup knockout')
          : setup.league
            ? (setup.level?.name ?? 'Season') +
              ' · ' +
              skillName(r!.skill) +
              ' AI'
            : setup.event
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

/** "PLAY '86 BOSTON" and its stake line: what the One-More bar says about the match it starts. */
function oneMoreText(a: NextAction, setup: Setup, pool: Pool | null, ut: UtState, week: string): { title: string; line: string } {
  const strip = (l: string) => l.replace(new RegExp('^' + LABEL.doneForToday + ' · '), '');
  const t = a.target;
  if (t.app !== 'match') return { title: t.app === 'ut' && t.view === 'moments' ? LABEL.moments + ' DRILL' : a.cta, line: strip(a.line) };
  const m = t.setup;
  if (m.mode === 'battles') {
    const level = m.level ?? levelOf(battlesThisWeek(ut.battles, week).level);
    const bt = battlesThisWeek(ut.battles, week);
    const rung = pool ? weekLadder(pool, week, bt.round ?? 0, level)[m.rung ?? 0] : undefined;
    const name = m.rematch ? setup.rival.name : rung ? shortName(rung) : LABEL.squadBattles;
    const where = LEVEL_NAME[level] + ' · rung ' + ((m.rung ?? 0) + 1) + ' of ' + RUNGS;
    return {
      title: (m.rematch ? 'REMATCH ' : 'PLAY ') + name,
      line: (a.id.endsWith('after:harder') ? 'FLAWLESS · step up · ' : a.id.endsWith('after:easier') ? 'Reset the rhythm · ' : '') + where + (a.stake ? ' · 1 win to a ' + a.stake : ''),
    };
  }
  const title: Record<typeof m.mode, string> = {
    cup: 'NEXT CUP ROUND',
    circuit: 'NEXT CIRCUIT MATCH',
    league: 'NEXT SEASON GAME',
    draft: 'NEXT DRAFT GAME',
    rivals: 'PLAY ONLINE AGAIN',
    events: 'NEXT EVENT MATCH',
    moments: LABEL.moments,
  };
  if (m.rematch && m.mode !== 'rivals') return { title: 'REMATCH ' + setup.rival.name, line: strip(a.line) };
  return { title: title[m.mode], line: m.mode === 'rivals' ? 'Back into the ' + LABEL.rivals + ' queue' : strip(a.line) };
}

/** The result: the 5-second recap (MatchRecap.tsx), its CLAIM ALL and the One-More bar's words. */
function ResultRecap(props: {
  setup: Setup;
  out: Outcome;
  pool: Pool | null;
  profile: Profile;
  week: string;
  onHome: () => void;
  onStore: () => void;
  onPractice?: () => void;
  onOneMore: () => void;
  onToast: (t: string) => void;
  update: (fn: (p: Profile) => Profile) => void;
}) {
  const { setup, out, pool, profile, week } = props;
  const r = setup.rung;
  const [claimable, setClaimable] = useState(0);
  // what waits to claim (the Rewards inbox and Minutes rungs): counted after the first frames, and
  // again whenever the save changes (the match's minutes bank a moment after the whistle)
  useEffect(() => {
    if (!pool) return;
    const t = window.setTimeout(() => {
      const day = easternDateKey();
      setClaimable(inboxCount(pool, profile, day, week) + minutesView(profile.playtime, Date.now()).ready.length);
    }, 60);
    return () => clearTimeout(t);
  }, [pool, profile, week]);
  const claim = () => {
    if (!pool) return;
    const at = Date.now(),
      day = easternDateKey();
    const all = (p: Profile) => {
      const a = claimAll(pool, p, day, week, at);
      const m = claimMinutes(a.profile, at, SPORT);
      return { profile: m.profile, n: a.claimed + m.granted.length, coins: m.profile.coins - p.coins };
    };
    const shown = all(profile);
    if (!shown.n) return;
    props.update((p) => all(p).profile);
    sfx.levelUp();
    props.onToast(
      'Claimed ' + shown.n + (shown.n === 1 ? ' reward' : ' rewards') + (shown.coins ? ' · +' + shown.coins.toLocaleString('en-US') + ' coins' : '') + '. Packs and picks are in your Store.',
    );
  };
  const eyebrow = setup.cup
    ? LABEL.clubCups + ' · ' + CUP_ROUNDS[setup.cup.round]
    : setup.draft
      ? LABEL.utDraft + ' · Game ' + (setup.draft.game + 1) + ' / ' + DRAFT_GAMES
      : setup.league
        ? LABEL.clubSeason + ' · ' + (setup.level?.name ?? '')
        : setup.circuit
          ? LABEL.championsCircuit + ' · Match ' + (setup.circuit.round + 1) + ' / 6'
          : setup.event
            ? setup.event.title
            : r && r.i >= 0
              ? LABEL.squadBattles + ' · ' + (setup.level ? setup.level.name + ' · ' : '') + 'rung ' + (r.i + 1)
              : setup.online
                ? LABEL.headToHead
                : 'Vs an AI squad';
  const next = useMemo(() => ({ action: out.next, ...oneMoreText(out.next, setup, pool, profile.ut, week) }), [out.next]);
  return (
    <MatchRecap
      sport={SPORT}
      eyebrow={eyebrow}
      me={setup.me.name}
      rival={setup.rival.name}
      us={out.us}
      them={out.them}
      ends={out.ends}
      simulated={out.how === 'sim'}
      recap={out.recap}
      next={next}
      paidToday={{ n: out.paidToday, of: PAID_GAMES_A_DAY }}
      claimable={claimable}
      onClaimAll={claim}
      onOneMore={props.onOneMore}
      onHome={props.onHome}
      onStore={props.onStore}
      onPractice={props.onPractice}
    />
  );
}
