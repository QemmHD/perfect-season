import React, { useEffect, useRef, useState } from 'react';
import { DATA_SOURCE, LATEST_SEASON } from './engine/data';
import { assignSlots, type DraftState } from './engine/draft';
import { BOOSTER_PRICES, LEVEL_UP_COINS, levelInfo, rewardsFor, unlockedAt } from './engine/economy';
import { ALL_MISSIONS_BONUS, advance, type GameEvent, missionsFor, nextStreak, rewardFor } from './engine/missions';
import { buildBracket, gameWinChance, PLAYOFF_MIN_WINS, playoffOutcome, ROUND_NAMES, type Series, seriesScore } from './engine/playoffs';
import { rarityOf } from './engine/rarity';
import { dailyPar, reviewDraft } from './engine/review';
import { collect, SET_REWARD } from './engine/collection';
import { asOpponent, castGame, matchScore, mirrorCast } from './engine/broadcast';
import { CLEAR_COINS, clearChance, GAUNTLET_SIZE, gauntletLadder, RUNG_COINS, rungChance, rungsWon } from './engine/gauntlet';
import { GAMES, gradeFor, rateTeam, type TeamRating } from './engine/rating';
import { hashString, rng } from './engine/rng';
import { clearSportParam, NFL, SPORT, type SportId, switchSport } from './engine/sport';
import { dailyNumber, easternDateKey, lineupKey, playSeason, type Season } from './engine/season';
import { type Booster, type BotLevel, type Mode, type Player, type PlayoffTeam, type Slot, SLOTS } from './engine/types';
import { freshProfile, type H2HStats, loadProfile, newId, type Profile, readOtherLb, resetOtherSport, type RunRecord, saveProfile, updateOtherLb } from './lib/profile';
import { setFeedback, sfx, vibrate } from './lib/sound';
import { applyUpdate, justUpdated, newerVersionLive } from './lib/update';
import { type BoardKind, boardTag, fetchBoard, prune, publishEntry, renamed, type Span, weekKey, withH2H, withRun } from './net/leaderboard';
import { type ArcadeState, cleanRoomCode, type Found, MatchConn, type OnlineCount, type OnlinePick, onCounts, setPresence, startPresence } from './net/match';
import { NET_ON } from './net/nostr';
import { Sheet, Toast, TopBar } from './ui/common';
import { Transition } from './ui/motion';
import { Draft, type OnlineProps } from './ui/Draft';
import { type LbStatus, NameSheet } from './ui/Leaderboard';
import { BoostersPage, DailyPage, HomePage, HowToSheet, ProfilePage, RanksPage, SettingsSheet, type Tab, Tabs } from './ui/Pages';
import { type ResultInfo, Results } from './ui/Results';
import { DailyReward, MissionsSheet } from './ui/Rewards';
import { type Room, Search } from './ui/Search';
import { Binder } from './ui/Binder';
import { GameCast } from './ui/GameCast';
import { Gauntlet } from './ui/Gauntlet';
import { Arcade, arcadeAvailable } from './game/Arcade';
import { aiFavorite, kitsFor } from './game/uniforms';
import { favoriteFor, shouldAskFavorites } from './lib/favorites';
import { NO_VOTE, type VoteWire, voteWireOf } from './net/vote';
import { FavSheet } from './ui/Favorites';
import { Vote } from './ui/Vote';

/** tests: ?autoplay lets the autopilot play the arcade game */
const AUTOPLAY = typeof location !== 'undefined' && new URLSearchParams(location.search).has('autoplay');
import { Playoffs, Reveal } from './ui/Season';
import { Football, Hoop } from './ui/icons';
import { Welcome } from './ui/Welcome';

type Screen = 'tab' | 'search' | 'draft' | 'vote' | 'arcade' | 'reveal' | 'playoffs' | 'results' | 'gauntlet';

interface Run {
  id: number;
  mode: Mode;
  botLevel: BotLevel;
  /** 1v1: the bot has the first pick (always for Legend, a coin flip for Pro, never for Rookie) */
  botFirst: boolean;
  dailyKey: string | null;
  ranked: boolean;
  /** head to head against a real player */
  online?: { found: Found };
  draft?: DraftState;
  season?: Season;
  bracket?: Series[];
  result?: ResultInfo;
}

/** What we know about the other player in a live match. */
interface OppView {
  picks: OnlinePick[];
  lineup: Partial<Record<Slot, string>>;
  gone: boolean;
  left: boolean;
  tookOver: boolean;
  /** their game after the draft, as last heard */
  arcade: ArcadeState | null;
  /** their phone gave up on ours in that game and let the AI finish our drives from this one on */
  arcadeTook: number | null;
  /** their sim-or-play vote, as last heard */
  vote: VoteWire;
  /** their favorite team in this sport (their uniforms) */
  fav: string | null;
}

const MODE_LABEL: Record<Mode, string> = { classic: 'Classic', blind: 'Blind', daily: 'Daily', '1v1': '1 vs 1' };
const NO_PICKS: OnlinePick[] = [];
/** the other side's colors in a head-to-head game: the rival purple */
const RIVAL: [string, string] = ['#9B7BFF', '#5B3FD1'];

/** A round's score: the series, or in football the game. */
function roundScore(s: Series): [number, number] {
  return NFL && s.scores ? s.scores[0] : seriesScore(s.games);
}

function playoffLine(bracket: Series[]): { text: string; title: boolean; perfect: boolean } {
  const out = playoffOutcome(bracket);
  if (out.title) {
    const [w, l] = roundScore(out.finals);
    return { text: (NFL ? 'Super Bowl champions' : 'Champions') + ': beat the ' + out.finals.opp.year + ' ' + out.finals.opp.team + ' ' + w + '–' + l + (NFL ? ' in the Super Bowl' : ' in the Finals'), title: true, perfect: out.sweeps === 4 };
  }
  const lost = out.lostTo!;
  const [w, l] = roundScore(lost);
  return { text: 'Lost in the ' + ROUND_NAMES[lost.round] + ' ' + w + '–' + l + ' to the ' + lost.opp.year + ' ' + lost.opp.team, title: false, perfect: false };
}

/** A head-to-head result against a real player, all-time and this week. */
function addH2H(h: H2HStats, won: boolean, week: string): H2HStats {
  const b = h.week === week ? h : { ...h, week, ww: 0, wl: 0, wstreak: 0 };
  if (won) return { ...b, w: b.w + 1, streak: b.streak + 1, best: Math.max(b.best, b.streak + 1), ww: b.ww + 1, wstreak: b.wstreak + 1 };
  return { ...b, l: b.l + 1, streak: 0, wl: b.wl + 1, wstreak: 0 };
}

/** The room code in an invite link (?room=K7QM). */
function roomFromUrl(): string | null {
  try {
    const c = cleanRoomCode(new URLSearchParams(location.search).get('room') ?? '');
    return c.length === 4 ? c : null;
  } catch {
    return null;
  }
}

export function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tab');
  const [run, setRun] = useState<Run | null>(null);
  /** the run whose head-to-head game has been watched */
  const [watched, setWatched] = useState<number | null>(null);
  const [modal, setModal] = useState<'settings' | 'howto' | 'name' | 'missions' | 'reward' | 'binder' | 'fav' | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number; out: boolean } | null>(null);
  const toastT = useRef<number[]>([]);
  const toastN = useRef(0);
  const runCounter = useRef(0);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  const todayKey = easternDateKey();
  const dailyNo = dailyNumber(todayKey);
  const dailyDone = !!profile.daily && profile.daily.key === todayKey;
  // the Legends Gauntlet: this week's ladder, the same for everyone
  const week = weekKey(todayKey);
  const ladder = React.useMemo(() => gauntletLadder(week), [week]);
  const gauntletBest = profile.gauntlet.week === week ? profile.gauntlet.best : 0;
  /** the climb on screen: its run, and the week, ladder and best it started with */
  const [gauntletAt, setGauntletAt] = useState<{ runId: number; week: string; ladder: PlayoffTeam[]; best: number } | null>(null);
  const needsName = NET_ON && !profile.name;

  useEffect(() => saveProfile(profile), [profile]);
  useEffect(() => {
    if (screen === 'draft') return;
    toastT.current.forEach(clearTimeout);
    setToast((t) => t && { ...t, out: true });
    toastT.current = [window.setTimeout(() => setToast(null), 250)];
  }, [screen]);
  useEffect(() => setFeedback(profile.settings.sound, profile.settings.haptics), [profile.settings]);

  const showToast = (text: string) => {
    toastT.current.forEach(clearTimeout);
    setToast({ text, id: ++toastN.current, out: false });
    toastT.current = [window.setTimeout(() => setToast((t) => t && { ...t, out: true }), 2600), window.setTimeout(() => setToast(null), 2850)];
  };

  const update = (fn: (p: Profile) => Profile) => setProfile((p) => fn(p));

  // ---------- online: presence and the leaderboard ----------

  const [online, setOnline] = useState<OnlineCount | null>(null);
  useEffect(() => {
    if (!NET_ON || !profile.name) return;
    startPresence(profile.name);
    return onCounts(setOnline);
  }, [profile.name]);

  // closed boards (past days and weeks) drop out of your entries; a name changed while playing
  // the other sport goes onto this sport's boards too (and the other way round)
  useEffect(() => {
    const tidy = (lb: Profile['lb'], name: string | null) => {
      const live = prune(lb, todayKey);
      return name && Object.values(live.entries).some((c) => c.name !== name) ? renamed(live, name, todayKey) : live;
    };
    update((p) => ({ ...p, lb: tidy(p.lb, p.name) }));
    updateOtherLb((lb) => tidy(lb, profileRef.current.name));
  }, []);

  // the app was closed in the middle of a match last time: that match was lost
  useEffect(() => {
    const m = profileRef.current.activeMatch;
    if (m) {
      recordForfeit(m.opp);
      window.setTimeout(() => showToast('You left the match against ' + m.opp + ', so it counts as a loss.'), 900);
    }
  }, []);

  /** Send every entry that changed, this sport's and then the other's. Each one stays queued until a relay takes it. */
  const flushing = useRef(false);
  const flushLb = async () => {
    const p = profileRef.current;
    const other = readOtherLb();
    if (!NET_ON || !p.name || flushing.current || (!p.lb.dirty.length && !other?.dirty.length)) return;
    flushing.current = true;
    const send = async (lb: Profile['lb']) => {
      const sent: [string, unknown][] = [];
      for (const d of lb.dirty) {
        const c = lb.entries[d];
        if (c && !(await publishEntry(d, c))) return { sent, ok: false };
        sent.push([d, c]);
      }
      return { sent, ok: true };
    };
    const ours = await send(p.lb);
    const theirs = ours.ok && other?.dirty.length ? await send(other) : null;
    flushing.current = false;
    if (ours.sent.length)
      // only clear an entry that didn't change again while it was being sent
      update((q) => ({ ...q, lb: { ...q.lb, dirty: q.lb.dirty.filter((d) => !ours.sent.some(([sd, sc]) => sd === d && q.lb.entries[d] === sc)) } }));
    if (theirs?.sent.length) {
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      updateOtherLb((lb) => ({ ...lb, dirty: lb.dirty.filter((d) => !theirs.sent.some(([sd, sc]) => sd === d && same(lb.entries[d], sc))) }));
    }
  };
  useEffect(() => {
    void flushLb();
  }, [profile.lb.dirty.join('|'), profile.name]);
  useEffect(() => {
    const again = () => document.visibilityState === 'visible' && void flushLb();
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    const t = window.setInterval(again, 30000);
    return () => {
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
      clearInterval(t);
    };
  }, []);

  // your place on the board a finished game went to, for the Results screen
  const [lbView, setLbView] = useState<Record<string, LbStatus>>({});
  const [pendingRank, setPendingRank] = useState<{ rid: string; d: string; kind: BoardKind; span: Span; day: string; label: string; at: number } | null>(null);
  useEffect(() => {
    if (!pendingRank) return;
    const pr = pendingRank;
    if (profile.lb.dirty.includes(pr.d)) {
      // still sending: say so, and after a while that it's queued for later
      const t = window.setTimeout(() => setLbView((m) => ({ ...m, [pr.rid]: { kind: 'queued' } })), Math.max(0, 9000 - (Date.now() - pr.at)));
      return () => clearTimeout(t);
    }
    setPendingRank(null);
    fetchBoard(pr.kind, pr.span, pr.day)
      .then((rows) => {
        const me = rows.find((r) => r.me);
        setLbView((m) => ({ ...m, [pr.rid]: me ? { kind: 'ranked', rank: me.rank, of: rows.length, label: pr.label } : { kind: 'note', text: 'Posted to the leaderboard.' } }));
      })
      .catch(() => setLbView((m) => ({ ...m, [pr.rid]: { kind: 'queued' } })));
  }, [pendingRank, profile.lb.dirty.join('|')]);

  // ---------- updates ----------

  // A newer deploy is live (checked whenever the app comes to the front): switch to it the
  // next time the player is on a menu, never in the middle of a game.
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    if (justUpdated()) showToast('Updated to the latest version.');
    let last = 0;
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 10000) return;
      last = Date.now();
      void newerVersionLive().then((v) => v && setUpdateReady(true));
    };
    check();
    document.addEventListener('visibilitychange', check);
    return () => document.removeEventListener('visibilitychange', check);
  }, []);
  /** a finished match keeps sending its last state until then; a reload would cut that short */
  const lingerUntil = useRef(0);
  useEffect(() => {
    if (!(updateReady && screen === 'tab' && !modal && !needsName)) return;
    const t = window.setTimeout(applyUpdate, Math.max(0, lingerUntil.current - Date.now()));
    return () => clearTimeout(t);
  }, [updateReady, screen, modal, needsName]);

  // ---------- favorite teams ----------

  /** asked once on the home screen of a player who doesn't have them yet (new players pick them in Welcome) */
  const favAsked = useRef(false);
  /** the sheet on screen is that first ask (not a change from Profile) */
  const favFirst = useRef(false);
  useEffect(() => {
    if (needsName || screen !== 'tab' || modal || favAsked.current || !shouldAskFavorites()) return;
    const t = window.setTimeout(() => {
      favAsked.current = true;
      favFirst.current = true;
      setModal('fav');
    }, 450);
    return () => clearTimeout(t);
  }, [needsName, screen, modal]);

  // ---------- daily reward and missions ----------

  /** the day the chest was last offered this session (once a day, even if the app stays open) */
  const rewardShown = useRef<string | null>(null);
  useEffect(() => {
    if (needsName || screen !== 'tab' || modal || rewardShown.current === todayKey || profile.rewardDay === todayKey) return;
    const t = window.setTimeout(() => {
      rewardShown.current = todayKey;
      setModal('reward');
    }, 700);
    return () => clearTimeout(t);
  }, [needsName, screen, modal, profile.rewardDay, todayKey]);

  const missionState = profile.missions && profile.missions.day === todayKey ? profile.missions : { day: todayKey, progress: [0, 0, 0], claimed: [false, false, false] };
  const missionList = missionsFor(todayKey);
  const missionsDone = missionList.filter((m, i) => missionState.progress[i] >= m.goal).length;
  const missionsClaimable = missionList.some((m, i) => missionState.progress[i] >= m.goal && !missionState.claimed[i]);

  const claimMission = (i: number) => {
    const m = missionList[i];
    if (missionState.progress[i] < m.goal || missionState.claimed[i]) return;
    const claimed = missionState.claimed.map((c, j) => c || j === i);
    const bonus = claimed.every(Boolean) ? ALL_MISSIONS_BONUS : 0;
    update((p) => ({ ...p, coins: p.coins + m.coins + bonus, xp: p.xp + m.xp, missions: { ...missionState, claimed } }));
    sfx.coin();
    showToast('+' + (m.coins + bonus) + ' coins · +' + m.xp + ' XP' + (bonus ? ' · all three done!' : ''));
  };

  // ---------- the other sport ----------

  /** Switching sports reloads the app into it, after a short fade. */
  const [sportTo, setSportTo] = useState<{ to: SportId; late: boolean } | null>(null);
  const goSport = (to: SportId) => {
    if (sportTo || screen !== 'tab') return;
    sfx.click();
    vibrate(12);
    // a match that just ended is still sending its last state: a reload would cut that short
    const wait = Math.max(420, lingerUntil.current - Date.now());
    setSportTo({ to, late: wait > 1000 });
    saveProfile(profileRef.current);
    window.setTimeout(() => {
      saveProfile(profileRef.current);
      switchSport(to);
    }, wait);
    // a reload the browser refused leaves the game as it was
    window.setTimeout(() => setSportTo(null), wait + 6000);
  };

  // ---------- starting games ----------

  const startDraft = (mode: Mode) => {
    sfx.click();
    const dailyKey = mode === 'daily' ? todayKey : null;
    runCounter.current += 1;
    const level = profile.botLevel;
    const botFirst = mode === '1v1' && (level === 'legend' || (level === 'pro' && Math.random() < 0.5));
    setRun({ id: runCounter.current, mode, botLevel: level, botFirst, dailyKey, ranked: mode === 'daily' && !dailyDone });
    setScreen('draft');
    if (mode === '1v1')
      showToast(
        (botFirst ? (level === 'legend' ? 'The Legend AI always picks first.' : 'Coin flip: the AI picks first.') : level === 'pro' ? 'Coin flip: you pick first.' : 'You pick first.') +
          ' Each round you both pick from the same team and decade, and you take turns going first.'
      );
    else if (mode === 'daily') showToast(dailyDone ? 'Practice run: today’s spins again, not ranked.' : 'Daily #' + dailyNo + ': everyone gets these same spins today.');
  };

  /** the friend room Search is in, so a match that doesn't connect goes back to it */
  const [room, setRoom] = useState<Room>(null);
  const roomRef = useRef(room);
  roomRef.current = room;
  const startRun = (mode: Mode = profile.mode) => {
    if (mode === '1v1' && NET_ON) {
      sfx.click();
      setRoom(null);
      setScreen('search');
      return;
    }
    startDraft(mode);
  };

  // an invite link opens straight into the friend's room (in their sport: ?sport= picked it already)
  useEffect(clearSportParam, []);
  const [linkRoom, setLinkRoom] = useState<string | null>(roomFromUrl);
  useEffect(() => {
    if (!linkRoom || needsName || screen !== 'tab') return;
    try {
      const u = new URL(location.href);
      u.searchParams.delete('room');
      history.replaceState(null, '', u.pathname + u.search + u.hash);
    } catch {
      // ignore
    }
    setRoom({ code: linkRoom, hosting: false });
    setLinkRoom(null);
    setScreen('search');
  }, [linkRoom, needsName, screen]);

  // ---------- a live match ----------

  const matchRef = useRef<MatchConn | null>(null);
  const [opp, setOpp] = useState<OppView | null>(null);
  const oppRef = useRef(opp);
  oppRef.current = opp;
  /** we let the AI finish the other player's draft (they left or lost connection) */
  const droppedRef = useRef(false);
  const [kicked, setKicked] = useState(false);

  const onFound = (f: Found) => {
    matchRef.current?.close(false);
    droppedRef.current = false;
    setOpp({ picks: [], lineup: {}, gone: false, left: false, tookOver: false, arcade: null, arcadeTook: null, vote: NO_VOTE, fav: null });
    const conn: MatchConn = new MatchConn(f, (theirs, gone) => {
      // only the current match talks to the screen
      if (matchRef.current !== conn) return;
      setOpp((prev) => {
        const next: OppView = { picks: theirs.picks, lineup: theirs.lineup, gone, left: theirs.left, tookOver: theirs.tookOver, arcade: theirs.arcade ?? null, arcadeTook: theirs.arcadeTook ?? null, vote: voteWireOf(theirs), fav: theirs.fav ?? null };
        if (prev && JSON.stringify(prev) === JSON.stringify(next)) return prev;
        return next;
      });
    });
    matchRef.current = conn;
    conn.start();
    // our favorite team rides along with everything else: the other phone dresses our side in it
    const fav = favoriteFor(SPORT);
    if (fav) conn.update((s) => ({ ...s, fav }));
    runCounter.current += 1;
    setRun({ id: runCounter.current, mode: '1v1', botLevel: 'pro', botFirst: !f.host, dailyKey: null, ranked: false, online: { found: f } });
    setScreen('draft');
    // saved, so quitting the app mid-match still counts as a loss next time it opens
    update((p) => ({ ...p, activeMatch: { id: f.matchId, opp: f.opp.name } }));
    // they never showed up (their phone missed the start): no result, back to the queue or the room
    window.setTimeout(() => {
      if (matchRef.current !== conn || conn.heard()) return;
      endMatch(false);
      update((p) => ({ ...p, activeMatch: null }));
      showToast(f.opp.name + ' didn’t connect. Back to ' + (roomRef.current ? 'your room ' + roomRef.current.code : 'the queue') + '.');
      setScreen('search');
    }, 12000);
  };

  const endMatch = (leaving: boolean, lingerMs = 0) => {
    matchRef.current?.close(leaving, lingerMs);
    matchRef.current = null;
    if (lingerMs) lingerUntil.current = Date.now() + lingerMs;
    setPresence('menu');
  };

  /** A head-to-head loss without a finished draft: you left, or got dropped. */
  const recordForfeit = (oppName: string) => {
    update((p) => {
      const h2h = addH2H(p.h2h, false, weekKey(todayKey));
      return { ...p, activeMatch: null, h2h, stats: { ...p.stats, h2hGames: p.stats.h2hGames + 1 }, lb: p.name ? withH2H(p.lb, p.name, { w: h2h.w, l: h2h.l, streak: h2h.streak }, { w: h2h.ww, l: h2h.wl, streak: h2h.wstreak }, todayKey) : p.lb };
    });
    showToast('Match against ' + oppName + ' counts as a loss.');
  };

  // the other phone gave up on you (you were gone too long) while you were still drafting:
  // stop the match here at once, so this phone can't answer with a takeover of its own. It can
  // land just after this phone finished the draft too (its last pick never reached them).
  useEffect(() => {
    if ((screen === 'draft' || screen === 'vote' || screen === 'arcade') && run?.online && opp?.tookOver && !droppedRef.current) {
      endMatch(false);
      setKicked(true);
    }
  }, [opp?.tookOver, screen]);

  const spend = (n: number) => {
    if (profile.coins < n) return false;
    update((p) => ({ ...p, coins: p.coins - n }));
    return true;
  };

  // ---------- finishing a game ----------

  const finish = (
    r: Run,
    season: TeamRating,
    bracket: Series[] | null,
    bot: { lineup: DraftState['botLineup']; rating: TeamRating } | null,
    arcade?: { us: number; them: number; how: 'played' | 'sim'; takenOver: boolean; tookMe: boolean }
  ) => {
    const draft = r.draft!;
    const p0 = profileRef.current;
    const po = bracket ? playoffLine(bracket) : null;
    const oppName = r.online?.found.opp.name;
    // both phones lost each other and let the AI finish: nobody gets the result
    const noContest = !!r.online && droppedRef.current && !!opp?.tookOver;
    const forfeit = r.online && droppedRef.current && !noContest ? ('them' as const) : undefined;
    const byRating = bot ? (season.rating > bot.rating.rating ? true : season.rating < bot.rating.rating ? false : null) : null;
    // a played game: the score decides, a tie goes to the better team
    const byGame = arcade ? (arcade.us > arcade.them ? true : arcade.us < arcade.them ? false : byRating) : null;
    const vsWon = noContest ? null : forfeit ? true : arcade ? byGame : byRating;
    const g = gradeFor(season.wins);
    const out = bracket ? playoffOutcome(bracket) : null;
    const rewards = rewardsFor({ wins: season.wins, seriesWon: out ? out.seriesWon : 0, title: !!po?.title, mode: r.mode, vsWon: bot ? vsWon : null, botLevel: r.botLevel, rankedDaily: r.ranked, vsName: oppName });
    const players = SLOTS.map((s) => draft.lineup[s]!) as Player[];
    // a head-to-head is played out as a game, the same one on both phones: told from the host's
    // bench (seeded by the match), and turned around on the guest's
    let showdown: ResultInfo['showdown'];
    if (bot && byRating !== null && !noContest && !forfeit && !arcade) {
      const host = r.online ? r.online.found.host : true;
      const me = p0.name ?? 'You';
      const them = oppName ?? 'AI ' + r.botLevel.toUpperCase();
      const abbr = (n: string) => n.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 4) || 'OPP';
      const [la, lb, ra, rb, na, nb] = host ? [draft.lineup, bot.lineup, season, bot.rating, me, them] : [bot.lineup, draft.lineup, bot.rating, season, them, me];
      const aWins = ra.rating > rb.rating;
      const seed = 'h2h:' + (r.online ? r.online.found.matchId : r.id + ':' + lineupKey(draft.lineup));
      const told = castGame({ lineup: la, opp: asOpponent(lb, nb, abbr(nb), RIVAL), won: aWins, score: NFL ? matchScore(aWins, ra, rb, seed) : null, pre: gameWinChance(ra.rating, rb.rating), seed, ourTeam: na });
      showdown = { cast: host ? told : mirrorCast(told), opp: asOpponent(bot.lineup, them, abbr(them), RIVAL) };
    }
    // the cards go into the binder: new ones, and team-decade sets they finish
    const binder = collect(p0.collection ?? {}, players);
    const setCoins = SET_REWARD * binder.sets.length;
    // the draft looked back on, and (Daily) the day's par
    const review = draft.log?.length ? reviewDraft(draft.log, draft.lineup) : undefined;
    const par = r.mode === 'daily' && r.dailyKey ? dailyPar(r.dailyKey) : undefined;
    const record: RunRecord = {
      id: newId(),
      at: new Date().toISOString(),
      mode: r.mode,
      dailyKey: r.dailyKey ?? undefined,
      ranked: r.ranked,
      wins: season.wins,
      rating: Math.round(season.rating * 10) / 10,
      grade: g.letter,
      tier: g.tier,
      playoff: bot
        ? oppName
          ? noContest
            ? 'No contest: you and ' + oppName + ' both lost connection'
            : vsWon
            ? 'Beat ' + oppName + ' head to head' + (forfeit ? ' (they left)' : '')
            : vsWon === false
              ? 'Lost to ' + oppName + ' head to head'
              : 'Tied ' + oppName + ' head to head'
          : vsWon
            ? 'Beat the ' + r.botLevel + ' AI in 1 vs 1'
            : vsWon === false
              ? 'Lost to the ' + r.botLevel + ' AI in 1 vs 1'
              : 'Tied the ' + r.botLevel + ' AI'
        : po
          ? po.text
          : 'Missed the playoffs: ' + PLAYOFF_MIN_WINS + ' wins get you in',
      series: out ? out.seriesWon : 0,
      title: !!po?.title,
      perfect: !!po?.perfect && season.wins === GAMES,
      lineup: SLOTS.map((s) => {
        const p = draft.lineup[s]!;
        return { slot: s, name: p.name, abbr: p.abbr, era: p.era, primed: !!p.primedFrom };
      }),
      ids: SLOTS.map((s) => {
        const p = draft.lineup[s]!;
        return p.primedFrom ? { s, id: p.id, pr: p.primedFrom.cellId } : { s, id: p.id };
      }),
      vs: bot ? { won: vsWon, botWins: bot.rating.wins, botLevel: r.botLevel } : undefined,
      online: oppName ? { opp: oppName, forfeit } : undefined,
      draft: review
        ? {
            picks: review.picks.map((p) => (p.grade === 'good' ? 'o' : p.grade.charAt(0))).join(''),
            score: Math.round(review.score),
            letter: review.letter,
            left: review.winsLeft,
            par: par && par.rating.rating > 0 ? Math.round((100 * review.yours.rating) / par.rating.rating) : undefined,
          }
        : undefined,
    };
    const legends = players.filter((p) => rarityOf(p) === 'legendary').length;
    const margin = bracket ? Math.max(0, ...bracket.filter((b) => b.played && b.won && b.scores).map((b) => b.scores![0][0] - b.scores![0][1])) : 0;
    const event: GameEvent = { mode: r.mode, wins: season.wins, series: record.series ?? 0, title: record.title, sweeps: out ? out.sweeps : 0, balance: season.balance, legends, vsWon: bot ? vsWon : null, online: !!oppName, margin };
    const prevBest = p0.history.filter((h) => h.mode === r.mode && r.mode !== '1v1').reduce((m, h) => Math.max(m, h.wins), -1);
    const newBest = prevBest >= 0 && season.wins > prevBest;
    const ms = p0.missions && p0.missions.day === todayKey ? p0.missions : { day: todayKey, progress: [0, 0, 0], claimed: [false, false, false] };
    const adv = advance(todayKey, ms.progress, event);
    const missionsDone = adv.completed.map((i) => missionsFor(todayKey)[i].text);
    const before = levelInfo(p0.xp).level;
    const after = levelInfo(p0.xp + rewards.xp).level;
    const levelUps: number[] = [];
    const unlocked: Booster[] = [];
    for (let l = before + 1; l <= after; l++) {
      levelUps.push(l);
      unlocked.push(...unlockedAt(l));
    }

    // the board this game is ranked on
    const week = weekKey(todayKey);
    let rank: { d: string; kind: BoardKind; span: Span; label: string } | null = null;
    if (NET_ON && p0.name) {
      if (r.mode === 'daily' && r.ranked && r.dailyKey) rank = { d: boardTag('daily', 'all', r.dailyKey), kind: 'daily', span: 'all', label: 'Daily #' + dailyNumber(r.dailyKey) };
      else if (r.mode === 'classic' || r.mode === 'blind') rank = { d: boardTag(r.mode, 'week', todayKey), kind: r.mode, span: 'week', label: (r.mode === 'blind' ? 'Blind' : 'Classic') + ' this week' };
      else if (oppName && vsWon !== null) rank = { d: boardTag('h2h', 'week', todayKey), kind: 'h2h', span: 'week', label: 'Head to Head this week' };
    }

    update((p) => {
      const inv = { ...p.inventory };
      for (const b of unlocked) inv[b] += 1;
      const msNow = p.missions && p.missions.day === todayKey ? p.missions : { day: todayKey, progress: [0, 0, 0], claimed: [false, false, false] };
      let lb = p.lb;
      let h2h = p.h2h;
      if (p.name && (r.mode === 'classic' || r.mode === 'blind' || r.mode === 'daily')) lb = withRun(lb, p.name, record, todayKey).lb;
      if (oppName && vsWon !== null) {
        h2h = addH2H(h2h, vsWon, week);
        if (p.name) lb = withH2H(lb, p.name, { w: h2h.w, l: h2h.l, streak: h2h.streak }, { w: h2h.ww, l: h2h.wl, streak: h2h.wstreak }, todayKey);
      }
      return {
        ...p,
        collection: collect(p.collection ?? {}, players).next,
        coins: p.coins + rewards.coins + LEVEL_UP_COINS * levelUps.length + setCoins,
        xp: p.xp + rewards.xp,
        inventory: inv,
        firstRun: false,
        history: [record, ...p.history].slice(0, 60),
        daily: r.ranked && r.dailyKey ? { key: r.dailyKey, record } : p.daily,
        stats: {
          ...p.stats,
          games: p.stats.games + 1,
          titles: p.stats.titles + (record.title ? 1 : 0),
          perfect: p.stats.perfect + (record.perfect ? 1 : 0),
          undefeated: p.stats.undefeated + (season.wins === GAMES ? 1 : 0),
          vsWins: p.stats.vsWins + (vsWon ? 1 : 0),
          legends: p.stats.legends + legends,
          h2hGames: p.stats.h2hGames + (oppName ? 1 : 0),
        },
        missions: { ...msNow, progress: advance(todayKey, msNow.progress, event).progress },
        lb,
        h2h,
        activeMatch: null,
      };
    });

    if (r.online) endMatch(false, 30000);
    if (rank) {
      setLbView((m) => ({ ...m, [record.id!]: { kind: 'sending' } }));
      setPendingRank({ rid: record.id!, ...rank, day: r.mode === 'daily' && r.dailyKey ? r.dailyKey : todayKey, at: Date.now() });
    } else if (NET_ON && r.mode === 'daily' && !r.ranked) setLbView((m) => ({ ...m, [record.id!]: { kind: 'note', text: 'Practice run: only your first Daily is ranked.' } }));
    missionsDone.forEach((_, i) => window.setTimeout(() => sfx.levelUp(), 1600 + i * 400));

    // show the other player's lineup the way they arranged it
    let botLineup = bot?.lineup;
    if (bot && r.online && opp) {
      const seated = assignSlots(SLOTS.map((s) => bot.lineup[s]).filter(Boolean) as Player[], opp.lineup);
      if (seated) botLineup = seated;
    }
    const result: ResultInfo = {
      record,
      rating: season,
      lineup: draft.lineup,
      bot: bot ? { lineup: botLineup!, rating: bot.rating } : undefined,
      rewards,
      levelUps,
      unlocked,
      dailyNo: r.dailyKey ? dailyNumber(r.dailyKey) : null,
      bracket: bracket ?? undefined,
      newBest,
      missionsDone,
      review,
      par,
      fresh: binder.fresh,
      sets: binder.sets,
      showdown,
      arcade: arcade ? { ...arcade, tiebreak: arcade.us === arcade.them } : undefined,
    };
    setRun({ ...r, result });
    setScreen('results');
  };

  const onDraftComplete = (draft: DraftState) => {
    if (!run) return;
    const r = { ...run, draft };
    if (r.mode === '1v1') {
      // sim or play, then played out on the field (or simmed), unless the other player already
      // dropped out of the draft (tests: ?autoplay goes straight to the game)
      if (arcadeAvailable() && !droppedRef.current) {
        setRun(r);
        setScreen(AUTOPLAY ? 'arcade' : 'vote');
        return;
      }
      const season = playSeason(draft.lineup);
      const botRating = rateTeam(SLOTS.map((s) => draft.botLineup[s]));
      setRun(r);
      finish(r, season, null, { lineup: draft.botLineup, rating: botRating });
      return;
    }
    const season = playSeason(draft.lineup);
    setRun({ ...r, season });
    setScreen('reveal');
  };

  /** A head to head the vote sent to the sim: the broadcast of the game, the same on both phones. */
  const simH2H = (r: Run) => {
    const d = r.draft!;
    finish(r, playSeason(d.lineup), null, { lineup: d.botLineup, rating: rateTeam(SLOTS.map((s) => d.botLineup[s])) });
  };

  const onRevealDone = () => {
    if (!run?.season || !run.draft) return;
    if (run.season.wins < PLAYOFF_MIN_WINS) {
      finish(run, run.season, null, null);
      return;
    }
    const rand = run.dailyKey ? rng(hashString('playoffs:' + run.dailyKey + ':' + lineupKey(run.draft.lineup))) : Math.random;
    setRun({ ...run, bracket: buildBracket(run.season, rand) });
    setScreen('playoffs');
  };

  const goTab = (t: Tab) => {
    if (screen === 'tab' && t === tab) return;
    sfx.click();
    setTab(t);
    setScreen('tab');
  };

  const leaveDraft = (done?: DraftState) => {
    if (run?.online && matchRef.current) {
      // both teams are already picked: the result stands, so show it
      if (done) {
        onDraftComplete(done);
        return;
      }
      const theyLeft = droppedRef.current || !!opp?.left || !!opp?.gone;
      endMatch(true);
      if (theyLeft) update((p) => ({ ...p, activeMatch: null }));
      else recordForfeit(run.online.found.opp.name);
    }
    goTab('home');
  };

  // ---------- screens ----------

  let page: React.ReactNode;
  if (tab === 'daily') page = <DailyPage profile={profile} dailyNo={dailyNo} dailyKey={todayKey} onPlay={() => startRun('daily')} />;
  else if (tab === 'ranks') page = <RanksPage profile={profile} dailyKey={todayKey} dailyNo={dailyNo} onName={() => (sfx.click(), setModal('name'))} />;
  else if (tab === 'boosters')
    page = (
      <BoostersPage
        profile={profile}
        onBuy={(b) => {
          if (!spend(BOOSTER_PRICES[b])) {
            showToast('Not enough coins yet. Each draft earns 20 to 100.');
            sfx.nope();
            return;
          }
          sfx.coin();
          update((p) => ({ ...p, inventory: { ...p.inventory, [b]: p.inventory[b] + 1 } }));
          showToast('Bought 1.');
        }}
      />
    );
  else if (tab === 'profile')
    page = (
      <ProfilePage
        profile={profile}
        onName={NET_ON ? () => (sfx.click(), setModal('name')) : undefined}
        onBinder={() => (sfx.click(), setModal('binder'))}
        onFavs={() => {
          sfx.click();
          favFirst.current = false;
          setModal('fav');
        }}
      />
    );
  else
    page = (
      <HomePage
        gauntlet={{ best: gauntletBest, boss: ladder[ladder.length - 1].year + ' ' + ladder[ladder.length - 1].team }}
        profile={profile}
        dailyNo={dailyNo}
        dailyDone={dailyDone}
        onMode={(m) => {
          sfx.click();
          update((p) => ({ ...p, mode: m }));
        }}
        onBot={(b) => {
          sfx.click();
          update((p) => ({ ...p, botLevel: b }));
        }}
        onPlay={() => startRun()}
        onToast={showToast}
        streak={profile.streak.last === todayKey || profile.streak.last === null ? profile.streak.count : nextStreak(profile.streak, todayKey).count - 1}
        online={NET_ON ? online : null}
        missions={{ done: missionsDone, claimable: missionsClaimable }}
        onMissions={() => (sfx.click(), setModal('missions'))}
        onStreak={() => {
          sfx.click();
          const c = profile.streak.last === todayKey ? profile.streak.count : 0;
          showToast(c > 1 ? c + ' days in a row. Come back tomorrow for a ' + rewardFor(c + 1).coins + '-coin chest.' : 'Open the app every day: the daily chest grows for 7 days.');
        }}
        onSport={goSport}
      />
    );

  const onlineProps: OnlineProps | undefined =
    run?.online && screen === 'draft'
      ? {
          seed: run.online.found.seed,
          host: run.online.found.host,
          oppName: run.online.found.opp.name,
          oppPicks: opp?.picks ?? NO_PICKS,
          oppGone: !!opp && (opp.gone || opp.left),
          halted: !!opp?.tookOver && !droppedRef.current,
          onPick: (p) => matchRef.current?.update((s) => ({ ...s, picks: s.picks.filter((x) => x.r !== p.r).concat([p]) })),
          onLineup: (l) => matchRef.current?.update((s) => ({ ...s, lineup: l })),
          onTakeover: () => {
            // they already took over for us: the match is theirs to finish, not ours
            if (oppRef.current?.tookOver) return;
            droppedRef.current = true;
            matchRef.current?.update((s) => ({ ...s, tookOver: true }));
          },
        }
      : undefined;

  let body: React.ReactNode;
  let viewId = 'shell';
  let enter = 'fade';
  if (needsName) {
    viewId = 'welcome';
    body = (
      <Welcome
        onDone={(name) => {
          update((p) => ({ ...p, name, lb: renamed(p.lb, name, todayKey) }));
          updateOtherLb((lb) => renamed(lb, name, todayKey));
          showToast('Welcome, ' + name + '!');
        }}
      />
    );
  } else if (screen === 'search') {
    viewId = 'search';
    enter = 'up';
    body = (
      <Search
        name={profile.name ?? 'Player'}
        level={levelInfo(profile.xp).level}
        botLevel={profile.botLevel}
        room={room}
        onRoom={setRoom}
        onMatch={onFound}
        onAI={() => startDraft('1v1')}
        onBack={() => goTab('home')}
        onToast={showToast}
      />
    );
  } else if (screen === 'draft' && run) {
    viewId = 'draft:' + run.id;
    enter = 'up';
    body = (
      <Draft
        key={run.id}
        mode={run.mode}
        botLevel={run.botLevel}
        botFirst={run.botFirst}
        dailyKey={run.dailyKey}
        coins={profile.coins}
        xp={profile.xp}
        inventory={profile.inventory}
        hints={profile.settings.hints}
        firstRun={profile.firstRun}
        onSpend={spend}
        onBooster={(b, d) => update((p) => ({ ...p, inventory: { ...p.inventory, [b]: Math.max(0, p.inventory[b] + d) } }))}
        onToast={showToast}
        onExit={leaveDraft}
        onComplete={onDraftComplete}
        onCoachDone={() => update((p) => ({ ...p, firstRun: false }))}
        online={onlineProps}
      />
    );
  } else if (screen === 'vote' && run?.draft) {
    const r = run;
    const d = run.draft;
    viewId = 'vote:' + run.id;
    enter = 'zoom';
    body = (
      <Vote
        key={run.id}
        rivalName={r.online ? r.online.found.opp.name : 'AI ' + r.botLevel.toUpperCase()}
        online={!!r.online}
        seed={r.online ? r.online.found.matchId : 'vote:' + r.id + ':' + lineupKey(d.lineup)}
        rival={r.online ? (opp?.vote ?? null) : null}
        rivalGone={!!r.online && (!!opp?.gone || !!opp?.left)}
        onWire={(w) => matchRef.current?.update((s) => ({ ...s, vote: w.vote, voteAt: w.at, voteSaw: w.saw }))}
        onDone={(o) => (o === 'play' ? setScreen('arcade') : simH2H(r))}
      />
    );
  } else if (screen === 'arcade' && run?.draft) {
    const r = run;
    const d = run.draft;
    const seed = 'arc:' + (r.online ? r.online.found.matchId : r.id + ':' + lineupKey(d.lineup));
    // each side in its favorite team's colors (the AI picks one from the game's seed)
    const mine = favoriteFor(SPORT);
    const kits = kitsFor(mine, r.online ? (opp?.fav ?? null) : aiFavorite(seed, SPORT, mine), SPORT);
    viewId = 'arcade:' + run.id;
    enter = 'zoom';
    body = (
      <div className="screen arcade">
        <Arcade
          lineup={d.lineup}
          rivalLineup={d.botLineup}
          rivalName={r.online ? r.online.found.opp.name : 'AI ' + r.botLevel.toUpperCase()}
          seed={seed}
          online={!!r.online}
          botLevel={r.botLevel}
          rivalLive={opp?.arcade ?? null}
          rivalGone={!!r.online && (!!opp?.gone || !!opp?.left)}
          tookMe={r.online ? (opp?.arcadeTook ?? null) : null}
          autoplay={AUTOPLAY}
          kits={kits}
          onProgress={(p) => matchRef.current?.update((s) => ({ ...s, arcade: p }))}
          onTakeover={(k) => matchRef.current?.update((s) => ({ ...s, arcadeTook: k }))}
          onFinish={(us, them, how, took) => {
            const season = playSeason(d.lineup);
            const botRating = rateTeam(SLOTS.map((s) => d.botLineup[s]));
            finish(r, season, null, { lineup: d.botLineup, rating: botRating }, { us: us.score, them: them.score, how, takenOver: took.them, tookMe: took.us });
          }}
        />
      </div>
    );
  } else if (screen === 'reveal' && run?.season && run.draft) {
    viewId = 'reveal:' + run.id;
    enter = 'zoom';
    body = <Reveal season={run.season} lineup={run.draft.lineup} label={MODE_LABEL[run.mode]} onDone={onRevealDone} />;
  } else if (screen === 'playoffs' && run?.season && run.bracket) {
    viewId = 'playoffs:' + run.id;
    enter = 'up';
    body = <Playoffs season={run.season} bracket={run.bracket} lineup={run.draft!.lineup} ourName={profile.name ?? 'You'} onDone={() => finish(run, run.season!, run.bracket!, null)} />;
  } else if (screen === 'results' && run?.result?.showdown && watched !== run.id) {
    // the head-to-head game first (the result is already saved)
    const sd = run.result.showdown;
    viewId = 'showdown:' + run.id;
    enter = 'zoom';
    body = (
      <div className="screen showdown">
        <GameCast games={[{ cast: sd.cast, n: 1, where: 'NEUTRAL', decider: true }]} round="Head to Head" opp={sd.opp} ourName={profile.name ?? 'You'} onDone={() => setWatched(run.id)} />
      </div>
    );
  } else if (screen === 'results' && run?.result) {
    viewId = 'results:' + run.id;
    enter = 'zoom';
    body = (
      <Results
        info={run.result}
        xp={profile.xp}
        coins={profile.coins}
        lb={lbView[run.result.record.id!] ?? null}
        gauntlet={{ ladder, first: rungChance(run.result.rating.rating, ladder[0]), chance: clearChance(run.result.rating.rating, ladder), best: gauntletBest }}
        onGauntlet={() => {
          sfx.click();
          // the climb keeps the week it started in, even past midnight on Sunday
          setGauntletAt({ runId: run.id, week, ladder, best: gauntletBest });
          setScreen('gauntlet');
        }}
        onAgain={() => startRun(run.mode)}
        onHome={() => goTab('home')}
        onToast={showToast}
      />
    );
  } else if (screen === 'gauntlet' && run?.result && gauntletAt?.runId === run.id) {
    viewId = 'gauntlet:' + run.id;
    enter = 'up';
    const res = run.result;
    const gw = gauntletAt.week;
    body = (
      <Gauntlet
        lineup={res.lineup}
        team={res.rating}
        ladder={gauntletAt.ladder}
        // the run's saved id: unique, so replaying the same lineup is a new climb
        seed={res.record.id + ':' + lineupKey(res.lineup)}
        week={gw}
        ourName={profile.name ?? 'You'}
        coins={profile.coins}
        best={gauntletAt.best}
        onGame={(g, i, all) =>
          update((p) => {
            // a new week starts a new best
            const cur = p.gauntlet.week === gw ? p.gauntlet : { ...p.gauntlet, week: gw, best: 0 };
            const up = rungsWon(all.slice(0, i + 1));
            const top = g.won && g.rung === GAUNTLET_SIZE - 1;
            return {
              ...p,
              coins: p.coins + (g.won ? RUNG_COINS[g.rung] + (top ? CLEAR_COINS : 0) : 0),
              gauntlet: { week: gw, best: Math.max(cur.best, up), allBest: Math.max(cur.allBest, up), clears: cur.clears + (top ? 1 : 0) },
            };
          })
        }
        onAgain={() => startRun(run.mode)}
        onHome={() => goTab('home')}
        onToast={showToast}
      />
    );
  } else {
    body = (
      <div className="shell">
        <div className="shell-top">
          <TopBar xp={profile.xp} coins={profile.coins} onProfile={() => goTab('profile')} onSettings={() => setModal('settings')} onHelp={() => setModal('howto')} />
        </div>
        <div className="shell-views">
          <Transition id={tab} enter="tab" exitMs={160}>
            {page}
          </Transition>
        </div>
        <Tabs tab={tab} onTab={goTab} />
      </div>
    );
  }

  return (
    <>
      <Transition id={viewId} enter={enter} exitMs={260}>
        {body}
      </Transition>
      {modal === 'settings' && (
        <SettingsSheet
          profile={profile}
          source={DATA_SOURCE}
          latest={LATEST_SEASON}
          onClose={() => setModal(null)}
          onChange={(k, v) => update((p) => ({ ...p, settings: { ...p.settings, [k]: v } }))}
          onReset={() => {
            // keep your name, and your entries on the boards stay yours (in both sports)
            setProfile({ ...freshProfile(), name: profile.name, lb: profile.lb, h2h: profile.h2h, streak: profile.streak, rewardDay: profile.rewardDay });
            resetOtherSport();
            setModal(null);
            showToast('Progress erased.');
          }}
        />
      )}
      {modal === 'howto' && <HowToSheet onClose={() => setModal(null)} />}
      {modal === 'binder' && <Binder collection={profile.collection ?? {}} onClose={() => setModal(null)} />}
      {modal === 'fav' && <FavSheet first={favFirst.current} onClose={() => setModal(null)} />}
      {modal === 'name' && (
        <NameSheet
          profile={profile}
          onClose={() => setModal(null)}
          onSaved={(name) => {
            setModal(null);
            update((p) => ({ ...p, name, lb: renamed(p.lb, name, todayKey) }));
            updateOtherLb((lb) => renamed(lb, name, todayKey));
            if (NET_ON) startPresence(name);
            showToast('Your name is now ' + name + '.');
          }}
        />
      )}
      {modal === 'missions' && <MissionsSheet profile={profile} day={todayKey} onClaim={claimMission} onClose={() => setModal(null)} />}
      {modal === 'reward' && (
        <DailyReward
          streakDay={nextStreak(profile.streak, todayKey).count}
          onClaim={() =>
            update((p) => {
              if (p.rewardDay === todayKey) return p;
              const st = nextStreak(p.streak, todayKey);
              const rw = rewardFor(st.count);
              return { ...p, streak: st, rewardDay: todayKey, coins: p.coins + rw.coins, xp: p.xp + rw.xp };
            })
          }
          onClose={() => setModal(null)}
        />
      )}
      {kicked && (
        <Sheet label="Connection lost" kind="center" onClose={() => {}}>
          {() => (
            <>
              <h2 className="disp">Connection lost</h2>
              <p>{'You were away too long, so ' + (run?.online?.found.opp.name ?? 'your opponent') + '’s phone finished the match without you. It counts as a loss.'}</p>
              <button
                className="btn primary"
                onClick={() => {
                  setKicked(false);
                  endMatch(false);
                  recordForfeit(run?.online?.found.opp.name ?? 'your opponent');
                  goTab('home');
                }}
              >
                OK
              </button>
            </>
          )}
        </Sheet>
      )}
      {toast && <Toast key={toast.id} text={toast.text} out={toast.out} />}
      {sportTo && (
        <div className={'sportfade ' + sportTo.to} role="status" aria-label={'Switching to ' + (sportTo.to === 'nfl' ? 'NFL' : 'NBA')}>
          <span className="ball">{sportTo.to === 'nfl' ? <Football size={64} /> : <Hoop size={64} />}</span>
          <b className="disp">{sportTo.to === 'nfl' ? 'NFL' : 'NBA'}</b>
          {sportTo.late && <small>Sending your match’s last picks first…</small>}
        </div>
      )}
    </>
  );
}
