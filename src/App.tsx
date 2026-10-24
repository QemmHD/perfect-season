import React, { useEffect, useRef, useState } from 'react';
import { DATA_SOURCE, LATEST_SEASON } from './engine/data';
import type { DraftState } from './engine/draft';
import { BOOSTER_PRICES, LEVEL_UP_COINS, levelInfo, rewardsFor, unlockedAt } from './engine/economy';
import { buildBracket, PLAYOFF_MIN_WINS, playoffOutcome, ROUND_NAMES, type Series, seriesScore } from './engine/playoffs';
import { gradeFor, rateTeam, type TeamRating } from './engine/rating';
import { hashString, rng } from './engine/rng';
import { dailyNumber, easternDateKey, lineupKey, playSeason, type Season } from './engine/season';
import { type Booster, type BotLevel, type Mode, SLOTS } from './engine/types';
import { GLOBAL_ON, postable, postRun, type PostResult } from './lib/leaderboard';
import { freshProfile, loadProfile, newId, type Profile, type RunRecord, saveProfile } from './lib/profile';
import { setFeedback, sfx } from './lib/sound';
import { applyUpdate, justUpdated, newerVersionLive } from './lib/update';
import { Toast, TopBar } from './ui/common';
import { Transition } from './ui/motion';
import { Draft } from './ui/Draft';
import { type LbStatus, NameSheet } from './ui/Leaderboard';
import { BoostersPage, DailyPage, HomePage, HowToSheet, ProfilePage, RanksPage, SettingsSheet, type Tab, Tabs } from './ui/Pages';
import { type ResultInfo, Results } from './ui/Results';
import { Playoffs, Reveal } from './ui/Season';

type Screen = 'tab' | 'draft' | 'reveal' | 'playoffs' | 'results';

interface Run {
  id: number;
  mode: Mode;
  botLevel: BotLevel;
  /** 1v1: the bot has the first pick (always for Legend, a coin flip for Pro, never for Rookie) */
  botFirst: boolean;
  dailyKey: string | null;
  ranked: boolean;
  draft?: DraftState;
  season?: Season;
  bracket?: Series[];
  result?: ResultInfo;
}

const MODE_LABEL: Record<Mode, string> = { classic: 'Classic', blind: 'Blind', daily: 'Daily', '1v1': '1 vs 1' };

function playoffLine(bracket: Series[]): { text: string; title: boolean; perfect: boolean } {
  const out = playoffOutcome(bracket);
  if (out.title) {
    const [w, l] = seriesScore(out.finals.games);
    return { text: 'Champions: beat the ' + out.finals.opp.year + ' ' + out.finals.opp.team + ' ' + w + '–' + l + ' in the Finals', title: true, perfect: out.sweeps === 4 };
  }
  const lost = out.lostTo!;
  const [w, l] = seriesScore(lost.games);
  return { text: 'Lost in the ' + ROUND_NAMES[lost.round] + ' ' + w + '–' + l + ' to the ' + lost.opp.year + ' ' + lost.opp.team, title: false, perfect: false };
}

export function App() {
  const [profile, setProfile] = useState<Profile>(() => loadProfile());
  const [tab, setTab] = useState<Tab>('home');
  const [screen, setScreen] = useState<Screen>('tab');
  const [run, setRun] = useState<Run | null>(null);
  const [modal, setModal] = useState<'settings' | 'howto' | null>(null);
  const [toast, setToast] = useState<{ text: string; id: number; out: boolean } | null>(null);
  const toastT = useRef<number[]>([]);
  const toastN = useRef(0);
  const runCounter = useRef(0);

  const todayKey = easternDateKey();
  const dailyNo = dailyNumber(todayKey);
  const dailyDone = !!profile.daily && profile.daily.key === todayKey;

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
    toastT.current = [window.setTimeout(() => setToast((t) => t && { ...t, out: true }), 2500), window.setTimeout(() => setToast(null), 2750)];
  };

  const update = (fn: (p: Profile) => Profile) => setProfile((p) => fn(p));

  // Global leaderboard: post finished runs once the player has picked a name. History is the
  // queue: anything not yet sent goes up oldest first, and a run that fails to send is retried
  // when the app comes back online or to the front.
  const [nameSheet, setNameSheet] = useState(false);
  const [posts, setPosts] = useState<Record<string, PostResult | 'sending'>>({});
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const flushing = useRef(false);
  const flush = async () => {
    const p = profileRef.current;
    if (!GLOBAL_ON || !p.name || flushing.current) return;
    const todo = p.history.filter((r) => postable(r) && !p.posted.includes(r.id!)).slice(0, 10).reverse();
    if (!todo.length) return;
    flushing.current = true;
    const done: string[] = [];
    let badName = false;
    for (const r of todo) {
      const id = r.id!;
      setPosts((m) => ({ ...m, [id]: 'sending' }));
      try {
        const res = await postRun(p.device, p.name, r);
        setPosts((m) => ({ ...m, [id]: res }));
        if (res.ok || res.error !== 'busy') done.push(id);
        if (res.error === 'name') badName = true;
        if (res.error === 'busy' || res.error === 'name') break;
      } catch {
        setPosts((m) => {
          const n = { ...m };
          delete n[id];
          return n;
        });
        break;
      }
    }
    flushing.current = false;
    if (done.length || badName)
      update((q) => ({ ...q, posted: [...done.filter((d) => !q.posted.includes(d)).reverse(), ...q.posted].slice(0, 120), name: badName ? null : q.name }));
  };
  useEffect(() => {
    void flush();
  }, [profile.name, profile.history[0]?.id]);
  useEffect(() => {
    const again = () => document.visibilityState === 'visible' && void flush();
    window.addEventListener('online', again);
    document.addEventListener('visibilitychange', again);
    return () => {
      window.removeEventListener('online', again);
      document.removeEventListener('visibilitychange', again);
    };
  }, []);
  const lbStatus = (r: RunRecord): LbStatus | null => {
    if (!GLOBAL_ON || !postable(r)) return null;
    if (!profile.name) return { kind: 'join' };
    const st = posts[r.id!];
    if (st === 'sending') return { kind: 'sending' };
    if (st) return { kind: 'done', res: st };
    return profile.posted.includes(r.id!) ? { kind: 'done', res: { ok: true } } : { kind: 'queued' };
  };

  // A newer deploy is live (checked whenever the app comes to the front): switch to it the
  // next time the player is on a menu, never in the middle of a draft or a playoff run.
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
  useEffect(() => {
    if (updateReady && screen === 'tab' && !modal && !nameSheet) applyUpdate();
  }, [updateReady, screen, modal, nameSheet]);

  const startRun = (mode: Mode = profile.mode) => {
    sfx.click();
    const dailyKey = mode === 'daily' ? todayKey : null;
    runCounter.current += 1;
    const level = profile.botLevel;
    const botFirst = mode === '1v1' && (level === 'legend' || (level === 'pro' && Math.random() < 0.5));
    setRun({ id: runCounter.current, mode, botLevel: level, botFirst, dailyKey, ranked: mode === 'daily' && !dailyDone });
    setScreen('draft');
    if (mode === '1v1')
      showToast(
        (botFirst ? (level === 'legend' ? 'The Legend bot always picks first.' : 'Coin flip: the bot picks first.') : level === 'pro' ? 'Coin flip: you pick first.' : 'You pick first.') +
          ' Each round you both pick from the same team and decade, and you take turns going first.'
      );
    else if (mode === 'daily') showToast(dailyDone ? 'Practice run: today’s spins again, not ranked.' : 'Daily #' + dailyNo + ': everyone gets these same spins today.');
  };

  const spend = (n: number) => {
    if (profile.coins < n) return false;
    update((p) => ({ ...p, coins: p.coins - n }));
    return true;
  };

  const finish = (r: Run, season: TeamRating, bracket: Series[] | null, bot: { lineup: DraftState['botLineup']; rating: TeamRating } | null) => {
    const draft = r.draft!;
    const po = bracket ? playoffLine(bracket) : null;
    const vsWon = bot ? (season.rating > bot.rating.rating ? true : season.rating < bot.rating.rating ? false : null) : null;
    const g = gradeFor(season.wins);
    const out = bracket ? playoffOutcome(bracket) : null;
    const rewards = rewardsFor({ wins: season.wins, seriesWon: out ? out.seriesWon : 0, title: !!po?.title, mode: r.mode, vsWon: bot ? vsWon : null, botLevel: r.botLevel, rankedDaily: r.ranked });
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
        ? vsWon
          ? 'Beat the ' + r.botLevel + ' bot in 1 vs 1'
          : vsWon === false
            ? 'Lost to the ' + r.botLevel + ' bot in 1 vs 1'
            : 'Tied the ' + r.botLevel + ' bot'
        : po
          ? po.text
          : 'Missed the playoffs: ' + PLAYOFF_MIN_WINS + ' wins get you in',
      series: out ? out.seriesWon : 0,
      title: !!po?.title,
      perfect: !!po?.perfect && season.wins === 82,
      lineup: SLOTS.map((s) => {
        const p = draft.lineup[s]!;
        return { slot: s, name: p.name, abbr: p.abbr, era: p.era, primed: !!p.primedFrom };
      }),
      vs: bot ? { won: vsWon, botWins: bot.rating.wins, botLevel: r.botLevel } : undefined,
    };
    const before = levelInfo(profile.xp).level;
    const after = levelInfo(profile.xp + rewards.xp).level;
    const levelUps: number[] = [];
    const unlocked: Booster[] = [];
    for (let l = before + 1; l <= after; l++) {
      levelUps.push(l);
      unlocked.push(...unlockedAt(l));
    }
    update((p) => {
      const inv = { ...p.inventory };
      for (const b of unlocked) inv[b] += 1;
      return {
        ...p,
        coins: p.coins + rewards.coins + LEVEL_UP_COINS * levelUps.length,
        xp: p.xp + rewards.xp,
        inventory: inv,
        firstRun: false,
        history: [record, ...p.history].slice(0, 60),
        daily: r.ranked && r.dailyKey ? { key: r.dailyKey, record } : p.daily,
        stats: {
          games: p.stats.games + 1,
          titles: p.stats.titles + (record.title ? 1 : 0),
          perfect: p.stats.perfect + (record.perfect ? 1 : 0),
          undefeated: p.stats.undefeated + (season.wins === 82 ? 1 : 0),
          vsWins: p.stats.vsWins + (vsWon ? 1 : 0),
        },
      };
    });
    const result: ResultInfo = { record, rating: season, lineup: draft.lineup, bot: bot ?? undefined, rewards, levelUps, unlocked, dailyNo: r.dailyKey ? dailyNumber(r.dailyKey) : null, bracket: bracket ?? undefined };
    setRun({ ...r, result });
    setScreen('results');
  };

  const onDraftComplete = (draft: DraftState) => {
    if (!run) return;
    const r = { ...run, draft };
    if (r.mode === '1v1') {
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

  // tab pages share one shell: top bar, page views that cross-fade, and the tab bar
  let page: React.ReactNode;
  if (tab === 'daily') page = <DailyPage profile={profile} dailyNo={dailyNo} dailyKey={todayKey} onPlay={() => startRun('daily')} />;
  else if (tab === 'ranks') page = <RanksPage profile={profile} dailyKey={todayKey} dailyNo={dailyNo} onName={() => (sfx.click(), setNameSheet(true))} />;
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
  else if (tab === 'profile') page = <ProfilePage profile={profile} />;
  else
    page = (
      <HomePage
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
      />
    );

  let body: React.ReactNode;
  let viewId = 'shell';
  let enter = 'fade';
  if (screen === 'draft' && run) {
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
        onExit={() => goTab('home')}
        onComplete={onDraftComplete}
        onCoachDone={() => update((p) => ({ ...p, firstRun: false }))}
      />
    );
  } else if (screen === 'reveal' && run?.season && run.draft) {
    viewId = 'reveal:' + run.id;
    enter = 'zoom';
    body = <Reveal season={run.season} lineup={run.draft.lineup} label={MODE_LABEL[run.mode]} onDone={onRevealDone} />;
  } else if (screen === 'playoffs' && run?.season && run.bracket) {
    viewId = 'playoffs:' + run.id;
    enter = 'up';
    body = <Playoffs season={run.season} bracket={run.bracket} onDone={() => finish(run, run.season!, run.bracket!, null)} />;
  } else if (screen === 'results' && run?.result) {
    viewId = 'results:' + run.id;
    enter = 'zoom';
    body = (
      <Results
        info={run.result}
        xp={profile.xp}
        coins={profile.coins}
        lb={lbStatus(run.result.record)}
        onJoin={() => (sfx.click(), setNameSheet(true))}
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
            // keep the leaderboard identity, so a reset doesn't leave a stranger's name on the board
            setProfile({ ...freshProfile(), device: profile.device, name: profile.name, posted: profile.posted });
            setModal(null);
            showToast('Progress erased.');
          }}
        />
      )}
      {modal === 'howto' && <HowToSheet onClose={() => setModal(null)} />}
      {nameSheet && (
        <NameSheet
          profile={profile}
          onClose={() => setNameSheet(false)}
          onSaved={(name) => {
            setNameSheet(false);
            update((p) => ({ ...p, name }));
            showToast(profile.name ? 'Name changed to ' + name + '.' : 'You’re on the leaderboard as ' + name + '.');
          }}
        />
      )}
      {toast && <Toast key={toast.id} text={toast.text} out={toast.out} />}
    </>
  );
}
