import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BOOSTER_NAMES, LEVEL_UP_COINS, levelInfo, type Rewards } from '../engine/economy';
import { playoffOutcome, ROUND_NAMES, type Series, seriesScore } from '../engine/playoffs';
import { CATEGORY_LABELS, GAMES, gradeFor, type TeamRating } from '../engine/rating';
import { type DraftReview, GRADE_LABEL } from '../engine/review';
import { SET_REWARD } from '../engine/collection';
import { CELL_BY_ID } from '../engine/data';
import { NFL } from '../engine/sport';
import type { Booster, Lineup, Player, PlayoffTeam } from '../engine/types';
import type { GameCast as GameCastData } from '../engine/broadcast';
import { SLOTS } from '../engine/types';
import type { RunRecord } from '../lib/profile';
import { copyText, nativeShare, shareText } from '../lib/share';
import { drawPoster } from './poster';
import { sfx } from '../lib/sound';
import { frameRect, useLayout } from '../stage';
import { CoinChip, Confetti, lastName, Sheet, shortEra } from './common';
import { Back, Coin, Share, Trophy } from './icons';
import { CountUp, reducedMotion } from './motion';
import { type LbStatus, LbLine } from './Leaderboard';
import { NET_ON } from '../net/nostr';
import { CardSheet, TradingCard } from './Card';
import { Scout, teamBar } from './Scout';
import { record } from './sportui';

export interface ResultInfo {
  record: RunRecord;
  rating: TeamRating;
  lineup: Lineup;
  bot?: { lineup: Lineup; rating: TeamRating };
  rewards: Rewards;
  levelUps: number[];
  unlocked: Booster[];
  dailyNo: number | null;
  /** The playoff bracket when the team made it; undefined for 1 vs 1 and lottery seasons. */
  bracket?: Series[];
  /** Beat your best record in this mode */
  newBest?: boolean;
  /** Missions this game completed */
  missionsDone?: string[];
  /** the draft, looked back on */
  review?: DraftReview;
  /** Daily: the best team from the day's spins */
  par?: { lineup: Lineup; rating: TeamRating; wins: number };
  /** cards new to the binder, and team-decade sets this draft finished */
  fresh?: string[];
  sets?: string[];
  /** a head-to-head played out as a game, before the results */
  showdown?: { cast: GameCastData; opp: PlayoffTeam };
}

const MODE_TAG: Record<string, string> = { classic: 'CLASSIC', blind: 'BLIND', daily: 'DAILY', '1v1': '1 VS 1' };

/** XP bar that fills from the old total to the new one, wrapping once per level gained. */
function XpBar({ before, after }: { before: number; after: number }) {
  const a = levelInfo(before);
  const b = levelInfo(after);
  const [w, setW] = useState(a.into / a.need);
  const [instant, setInstant] = useState(false);
  useEffect(() => {
    if (reducedMotion()) {
      setW(b.into / b.need);
      return;
    }
    const ts: number[] = [];
    if (b.level > a.level) {
      ts.push(window.setTimeout(() => setW(1), 900));
      ts.push(
        window.setTimeout(() => {
          setInstant(true);
          setW(0);
        }, 1650)
      );
      ts.push(
        window.setTimeout(() => {
          setInstant(false);
          setW(b.into / b.need);
        }, 1720)
      );
    } else ts.push(window.setTimeout(() => setW(b.into / b.need), 900));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <span className="bar xpbar">
      <i style={{ width: Math.round(w * 1000) / 10 + '%', transition: instant ? 'none' : undefined }} />
    </span>
  );
}

/** Coins fly from the record up into the coin counter, which then counts up. */
function CoinFlight({ from, to, n }: { from: React.RefObject<HTMLElement>; to: React.RefObject<HTMLElement>; n: number }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = box.current?.parentElement;
    const a = from.current;
    const b = to.current;
    if (!root || !a || !b || reducedMotion()) return;
    // frame coordinates, so this works on a scaled or sideways-turned frame
    const rr = frameRect(root);
    const ra = frameRect(a);
    const rb = frameRect(b);
    const x0 = ra.x + ra.w / 2 - rr.x;
    const y0 = ra.y + ra.h / 2 - rr.y;
    const x1 = rb.x + 18 - rr.x;
    const y1 = rb.y + rb.h / 2 - rr.y;
    const coins = [...(box.current?.children ?? [])] as HTMLElement[];
    coins.forEach((c, i) => {
      const sx = x0 + (Math.random() - 0.5) * 120;
      const sy = y0 + (Math.random() - 0.5) * 50;
      const mx = (sx + x1) / 2 + (Math.random() - 0.5) * 80;
      const my = Math.min(sy, y1) - 40 - Math.random() * 50;
      c.animate(
        [
          { transform: 'translate(' + x0 + 'px,' + y0 + 'px) scale(0.3)', opacity: 0 },
          { transform: 'translate(' + sx + 'px,' + sy + 'px) scale(1.15)', opacity: 1, offset: 0.25 },
          { transform: 'translate(' + mx + 'px,' + my + 'px) scale(0.95)', opacity: 1, offset: 0.62 },
          { transform: 'translate(' + x1 + 'px,' + y1 + 'px) scale(0.55)', opacity: 0.9 },
        ],
        { duration: 900, delay: 350 + i * 55, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'both' }
      ).onfinish = () => (c.style.visibility = 'hidden');
    });
  }, []);
  return (
    <div className="coinflight" ref={box} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i}>
          <Coin size={20} />
        </span>
      ))}
    </div>
  );
}

export function Results({
  info,
  xp,
  coins,
  lb,
  onAgain,
  onHome,
  onToast,
}: {
  info: ResultInfo;
  xp: number;
  coins: number;
  /** Global leaderboard status of this run; null when it doesn't go on a board */
  lb: LbStatus | null;
  onAgain: () => void;
  onHome: () => void;
  onToast: (t: string) => void;
}) {
  const { record: r, rating } = info;
  const g = gradeFor(r.wins);
  const lv = levelInfo(xp);
  const [share, setShare] = useState(false);
  const [scout, setScout] = useState<Series | null>(null);
  const [levelPop, setLevelPop] = useState(false);
  const [inspect, setInspect] = useState<{ p: Player; slot: string } | null>(null);
  const [grow, setGrow] = useState(false);
  const gained = info.rewards.coins + LEVEL_UP_COINS * info.levelUps.length + SET_REWARD * (info.sets?.length ?? 0);
  const chipRef = useRef<HTMLSpanElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ts = [window.setTimeout(() => setGrow(true), 60), window.setTimeout(() => sfx.coin(), 1250)];
    if (info.levelUps.length)
      ts.push(
        window.setTimeout(() => {
          setLevelPop(true);
          sfx.levelUp();
        }, 2100)
      );
    return () => ts.forEach(clearTimeout);
  }, []);
  const tag = r.mode === 'daily' && info.dailyNo ? 'DAILY #' + info.dailyNo + (r.ranked ? ' · RANKED' : ' · PRACTICE') : r.online ? 'HEAD TO HEAD' : r.mode === '1v1' && NET_ON ? 'VS THE AI' : MODE_TAG[r.mode];
  const confetti = r.vs ? (r.vs.won ? 1.4 : 0) : r.perfect ? 1.4 : r.title ? 0.8 : g.letter.startsWith('S') || g.letter.startsWith('A') ? 1.2 : g.letter === 'B' ? 0.6 : 0;
  const vs = info.bot;
  const vsTitle = r.vs ? (r.vs.won === true ? 'YOU WON!' : r.vs.won === false ? 'YOU LOST' : 'DRAW') : '';

  return (
    <div className="screen results">
      <div className="topbar">
        <button className="icon-btn pill-btn" onClick={onHome}>
          <Back size={16} /> HOME
        </button>
        <span className="eyebrow">{tag}</span>
        <span ref={chipRef} className="chipwrap">
          <CoinChip coins={coins} from={coins - gained} delay={1250} />
        </span>
      </div>
      <div className="results-body">
        {r.perfect && <div className="perfect disp">PERFECT SEASON · {GAMES + (NFL ? 4 : 16)}–0</div>}
        {info.newBest && !r.perfect && (
          <div className="newbest disp" role="status">
            <span>NEW PERSONAL BEST</span>
          </div>
        )}
        {vs && r.vs ? (
          <>
            <div className="vs-head" ref={headRef}>
              <span className="eyebrow wide">
                {r.online ? (r.online.forfeit === 'them' ? 'Head to head · ' + r.online.opp + ' left' : 'Head to head · live') : '1 vs 1 · snake draft'}
              </span>
              <span className={'disp vs-title stamp-in ' + (r.vs.won ? 'win' : r.vs.won === false ? 'loss' : '')}>{vsTitle}</span>
              {lb && <LbLine lb={lb} />}
            </div>
            <div className="vs">
              <div className="rise-in">
                <span className="eyebrow" style={{ color: 'var(--teal)' }}>
                  You
                </span>
                <span className="disp num">
                  <CountUp value={r.wins} from={0} ms={900} />–<CountUp value={GAMES - r.wins} from={0} ms={900} />
                </span>
                <small>Rating {rating.rating.toFixed(1)}</small>
              </div>
              <div className="bot rise-in" style={{ animationDelay: '90ms' }}>
                <span className="eyebrow vs-name" style={{ color: 'var(--rival-soft)' }}>
                  {r.online ? r.online.opp : 'AI · ' + r.vs.botLevel}
                </span>
                <span className="disp num">
                  <CountUp value={r.vs.botWins} from={0} ms={900} />–<CountUp value={GAMES - r.vs.botWins} from={0} ms={900} />
                </span>
                <small>Rating {vs.rating.rating.toFixed(1)}</small>
              </div>
            </div>
          </>
        ) : (
          <div className="headline" ref={headRef}>
            <div className="record">
              <b className="disp num">
                <CountUp value={r.wins} from={0} ms={900} />
              </b>
              <span className="disp">–</span>
              <b className="disp num">
                <CountUp value={GAMES - r.wins} from={0} ms={900} />
              </b>
            </div>
            <div className="gradeline small">
              <span className="gradebadge disp stamp delayed" style={{ borderColor: g.color, color: g.color }}>
                {g.letter}
              </span>
              <span className="disp tier rise-in" style={{ color: g.color, animationDelay: '820ms' }}>
                {g.tier}
              </span>
            </div>
            <div className={'pill outcome rise-in' + (r.title ? ' gold' : '')} style={{ animationDelay: '950ms' }}>
              {r.title && <Trophy size={18} color="#F5B83D" />}
              <span>{r.playoff}</span>
            </div>
            {lb && <LbLine lb={lb} />}
          </div>
        )}

        <div className="card rise-in" style={{ animationDelay: '200ms' }}>
          <span className="eyebrow">Team vs a near-perfect lineup · era-adjusted</span>
          {rating.ratios.map((x, i) => (
            <div className="catrow" key={i}>
              <span>{CATEGORY_LABELS[i]}</span>
              <span className="bar">
                <i style={{ width: grow ? Math.min(100, Math.round(x * 100)) + '%' : '0%', transitionDelay: 250 + i * 110 + 'ms' }} className={x >= 1 ? 'full' : ''} />
              </span>
              <b className="num">{Math.round(x * 100)}%</b>
            </div>
          ))}
          <span className="note">
            Balance {Math.round(rating.balance * 100)}% · team rating {rating.rating.toFixed(1)}
            {rating.balance < 0.8 ? ' · your weakest category is costing you wins' : ''}
          </span>
        </div>

        {info.review && <ReportCard review={info.review} par={info.par} blind={r.mode === 'blind'} />}

        {info.bracket && <PlayoffRun bracket={info.bracket} onScout={setScout} />}

        <div className="hand" aria-label="Your team">
          {SLOTS.map((k, i) => {
            const p = info.lineup[k] as Player;
            return (
              <button key={k} className="hand-card rise-in" style={{ animationDelay: 320 + i * 70 + 'ms' }} onClick={() => (sfx.click(), setInspect({ p, slot: k }))} aria-label={k + ': ' + p.name + (info.fresh?.includes(p.id) ? ', new to your binder' : '') + '. Tap to look closer.'}>
                <TradingCard p={p} slot={k} tilt={false} />
                {info.fresh?.includes(p.id) && <span className="newtag">NEW</span>}
              </button>
            );
          })}
        </div>
        <span className="hand-hint">
          Tap a card to look closer
          {info.fresh?.length ? ' · ' + info.fresh.length + ' new to your binder' : ''}
        </span>
        {info.sets?.map((id, i) => (
          <div key={id} className="setdone rise-in" style={{ animationDelay: 700 + i * 120 + 'ms' }} role="status">
            <span className="eyebrow">Set complete</span>
            <strong>
              {CELL_BY_ID[id]?.era} {CELL_BY_ID[id]?.name}
            </strong>
            <b className="num">+{SET_REWARD} coins</b>
          </div>
        ))}

        {vs && (
          <div className="roster">
            <span className="eyebrow" style={{ color: 'var(--rival-soft)' }}>
              {r.online ? r.online.opp + '’s lineup' : 'AI lineup'}
            </span>
            {SLOTS.map((k) => {
              const p = vs.lineup[k];
              if (!p) return null;
              return (
                <div key={k} className="histrow bot">
                  <span className="disp slotkey">{k}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.abbr} · {p.era}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {info.missionsDone && info.missionsDone.length > 0 && (
          <div className="missiondone rise-in" style={{ animationDelay: '380ms' }} role="status">
            <span className="eyebrow">Mission complete</span>
            {info.missionsDone.map((m) => (
              <strong key={m}>{m}</strong>
            ))}
            <small>Claim the reward from Missions on the home screen.</small>
          </div>
        )}

        <div className="card rise-in" style={{ animationDelay: '420ms' }}>
          <div className="rewards-head">
            <span className="eyebrow">Rewards</span>
            <b className="num">
              +<CountUp value={info.rewards.coins} from={0} ms={900} delay={500} /> coins · +<CountUp value={info.rewards.xp} from={0} ms={900} delay={500} /> XP
            </b>
          </div>
          <span className="note">{info.rewards.lines.join(' · ')}</span>
          <XpBar before={xp - info.rewards.xp} after={xp} />
          <span className="note">
            Level {lv.level} · {lv.into}/{lv.need} XP to level {lv.level + 1}
          </span>
          {info.levelUps.length > 0 && (
            <span className="levelline">
              LEVEL UP! Level {info.levelUps[info.levelUps.length - 1]} · +{LEVEL_UP_COINS * info.levelUps.length} coins
              {info.unlocked.length ? ' · ' + info.unlocked.map((b) => BOOSTER_NAMES[b]).join(', ') + ' unlocked (1 free)' : ''}
            </span>
          )}
        </div>
      </div>
      <div className="foot">
        <button className="big ghost small" onClick={() => setShare(true)}>
          <span>SHARE</span>
        </button>
        <button className="big small shine" onClick={onAgain}>
          <span>{r.mode === '1v1' && NET_ON ? 'FIND A MATCH' : 'DRAFT AGAIN'}</span>
        </button>
      </div>
      {gained > 0 && <CoinFlight from={headRef} to={chipRef} n={Math.min(12, 4 + Math.round(gained / 15))} />}
      {confetti > 0 && <Confetti density={confetti} />}
      {share && <ShareSheet info={info} onClose={() => setShare(false)} onToast={onToast} />}
      {scout && <Scout series={scout} gamesShown={scout.games.length} ours={rating} onClose={() => setScout(null)} />}
      {inspect && <CardSheet p={inspect.p} slot={inspect.slot} blind={false} onClose={() => setInspect(null)} />}
      {levelPop && (
        <Sheet label="Level up" kind="center" onClose={() => setLevelPop(false)}>
          {(close) => (
            <div className="levelup">
              <span className="levelup-ring">
                <i />
                <b className="disp">{info.levelUps[info.levelUps.length - 1]}</b>
              </span>
              <h2 className="disp">Level up!</h2>
              <p>
                +{LEVEL_UP_COINS * info.levelUps.length} coins
                {info.unlocked.length ? '. ' + info.unlocked.map((b) => BOOSTER_NAMES[b]).join(' and ') + ' unlocked, with 1 free to start.' : '.'}
              </p>
              <button className="btn primary" onClick={() => close()}>
                NICE
              </button>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

/** Every series you played, who knocked you out, and a tap to scout each opponent. */
function PlayoffRun({ bracket, onScout }: { bracket: Series[]; onScout: (s: Series) => void }) {
  const played = bracket.filter((b) => b.played);
  const out = playoffOutcome(bracket);
  return (
    <div className="card po-run rise-in" style={{ animationDelay: '260ms' }}>
      <span className="eyebrow">Playoff run · tap a team to scout</span>
      {played.map((b) => {
        const [w, l] = NFL && b.scores ? b.scores[0] : seriesScore(b.games);
        const ko = out.lostTo === b;
        return (
          <button key={b.round} className={'po-row' + (ko ? ' ko' : '')} onClick={() => (sfx.click(), onScout(b))}>
            <i style={{ background: teamBar(b.opp) }} aria-hidden="true" />
            <span>
              <small>{ko ? 'Knocked out in the ' + ROUND_NAMES[b.round] : ROUND_NAMES[b.round]}</small>
              <strong>
                {b.opp.year} {b.opp.team}
              </strong>
            </span>
            <b className={'num ' + (b.won ? 'w' : 'l')}>
              {b.won ? 'W' : 'L'} {w}–{l}
            </b>
          </button>
        );
      })}
    </div>
  );
}

function ShareSheet({ info, onClose, onToast }: { info: ResultInfo; onClose: () => void; onToast: (t: string) => void }) {
  const text = shareText(info.record, info.dailyNo);
  const img = useMemo(() => drawPoster(info), [info]);
  // keep the buttons on screen: the card gets whatever height the text and buttons leave
  const { content } = useLayout();
  const cardMax = Math.max(170, Math.round(content - 310));
  const doShare = async () => {
    if (await nativeShare(text, img)) return;
    if (await copyText(text)) onToast('Copied. Paste it anywhere. Long-press the card to save the image.');
    else onToast('Sharing is blocked here. Select the text below to copy it.');
  };
  const doCopy = async () => {
    if (await copyText(text)) onToast('Copied to clipboard.');
    else onToast('Copy is blocked here. Select the text below instead.');
  };
  return (
    <Sheet label="Share your result" onClose={onClose}>
      {(close) => (
        <>
          {img ? <img className="sharecard" src={img} style={{ maxHeight: cardMax }} alt={'Share card: ' + record(info.record.wins)} /> : null}
          <div className="sharetext">{text}</div>
          <div className="btnrow">
            <button className="btn" onClick={() => close()}>
              CLOSE
            </button>
            <button className="btn" onClick={doCopy}>
              COPY TEXT
            </button>
            <button className="btn primary withicon" onClick={doShare}>
              <Share size={16} /> SHARE
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}

/**
 * The draft, looked back on: a letter for the whole draft, every pick against the best one there
 * was, and the best team the same spins could have made.
 */
function ReportCard({ review, par, blind }: { review: DraftReview; par?: { rating: TeamRating; wins: number; lineup: Lineup }; blind: boolean }) {
  const best = review.best;
  const flawless = review.winsLeft === 0 && review.score >= 99.5;
  const parPct = par && par.rating.rating > 0 ? Math.round((100 * review.yours.rating) / par.rating.rating) : null;
  return (
    <div className="card report rise-in" style={{ animationDelay: '260ms' }}>
      <div className="rep-head">
        <div>
          <span className="eyebrow">Draft report{blind ? ' · stats revealed' : ''}</span>
          <small>{Math.round(review.score)}% of the best team your spins could make</small>
        </div>
        <b className={'disp rep-letter l-' + review.letter.charAt(0).toLowerCase()}>{review.letter}</b>
      </div>
      <ol className="rep-picks">
        {review.picks.map((p, i) => (
          <li key={i} className={'g-' + p.grade + ' rise-in'} style={{ animationDelay: 420 + i * 120 + 'ms' }}>
            <span className="rd num">R{p.round + 1}</span>
            <div className="who">
              <strong>
                {p.pick.name}
                {p.pick.primedFrom ? ' ★' : ''}
              </strong>
              <small>
                {p.trade ? 'Trade · ' : ''}
                {p.slot} · {p.pick.abbr} {shortEra(p.pick.era)}
                {p.best && p.grade !== 'best' ? ' · best: ' + lastName(p.best.name) + ' (+' + (p.bestGain - p.gain).toFixed(1) + ')' : ''}
              </small>
            </div>
            <span className="rep-chip">{GRADE_LABEL[p.grade]}</span>
          </li>
        ))}
      </ol>
      <div className={'rep-best' + (flawless ? ' flawless' : '')}>
        <div className="rep-row">
          <span className="eyebrow">{flawless ? 'Flawless draft' : 'Best team from your spins'}</span>
          <b className="disp num">{record(best.rating.wins)}</b>
        </div>
        <small>{SLOTS.map((k) => (best.lineup[k] ? lastName(best.lineup[k]!.name) : '—')).join(' · ')}</small>
        <span className="verdict-line">
          {flawless ? 'You drafted the best team these spins allowed.' : review.winsLeft > 0 ? 'You left ' + review.winsLeft + ' win' + (review.winsLeft === 1 ? '' : 's') + ' on the table.' : 'Same record as the best team: nothing left on the table.'}
        </span>
      </div>
      {par && parPct !== null && (
        <div className="rep-par">
          <span className="eyebrow">Today's par</span>
          <b className="num">{record(par.wins)}</b>
          <span className={'pct num' + (parPct >= 100 ? ' over' : '')}>{parPct}% of par</span>
        </div>
      )}
    </div>
  );
}
