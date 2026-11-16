import { catalogOf, STUDIO_PACKS, studioKind, useCatalog } from '../admin/catalog';
import { pickFor } from '../engine/sport';
// The store: packs to buy with coins (never real money), packs you've earned waiting to be opened,
// the free starter, and every pack's odds.
// Claude 2026-11-01: sections (Daily Drop · Featured · Gold · Bronze & Silver · Online), the new
// packs with their limits, open pick sheets under Your packs, and the MARKET tab (Scout Market and
// Swap Desk). Odds sheets list every slot including rare golds and Weekly Standouts.
import React, { useEffect, useMemo, useState } from 'react';
import { Sheet } from '../ui/common';
import { Coin } from '../ui/icons';
import { PackArt } from './Hub';
import { IconInfo } from './icons';
import { type PackDef, knownPack, packName, positionChoices } from './packs';
import { confirmFor, fmtPct, hasPickOdds, headline, oddsFor, oneIn, type OddsRow, pickTable } from './odds';
import { type OddsSource, useOddsHost, useOddsPreload } from './odds-lazy';
import './odds-sheet.css';
import { fcToDisplay } from './fc-scale';
import type { PendingPack, UtState } from './state';
import type { UtSport } from './types';
import { contentOf, type PickState } from './content-state';
import { buysLeft, dailyStatus, GOLD_PICKS, LIMITS, lightningWindow, minutesToLightning, STREAK_DAYS, type LimitedKind } from './content-packs';
import { marketBought, marketFor, type MarketTag, swapCandidates, swapSize } from './market';
import { LIGHTNING_DISCOUNT, nextLightning } from './flash';
import { flashDeals, flashLeft } from './pack-actions';
import './store.css';
import { UtCard } from './CardArt';
import { SectionHead, Segmented } from './ui';
import type { CalPack } from './calendar';
import { livePackDef, liveBuysLeft, livePacksOn } from './live-packs';
import type { Pool } from './pool';
import type { ClubCard } from './UltimateTeam';

const SHORT: Record<string, string> = {
  bronze: 'BRONZE',
  silver: 'SILVER',
  gold: 'GOLD',
  premium: 'PREMIUM',
  position: 'POSITION',
  starter: 'STARTER',
  spotlight: 'SPOTLIGHT',
  daily: 'DAILY',
  scout: 'SCOUT',
  'standout-pick': 'STANDOUT',
  elite: 'ELITE',
  jumbo: 'JUMBO',
  standout: 'STANDOUT',
  lightning: 'LIGHTNING',
  live: 'PROGRAM',
  'live-plus': 'GUARANTEE',
  'live-pick': 'PICK',
};

/** Claude (UI reorganisation): the always-on packs, listed cheapest first. */
const BY_PRICE = ['bronze', 'silver', 'position', 'gold', 'premium', 'spotlight'];

/** Claude (packs-2): a waiting pick's name on its tile ("Player Pick 84+"; Scout's Choice for the Store's own). */
function pickLabel(p: PickState, sport: UtSport): string {
  if (p.kind === 'standout-pick') return 'Standout Pick';
  if (p.kind === 'new-era') return 'Icon Pick';
  if (p.kind === 'program-pick' || p.kind === 'live-pick') return 'Program Pick';
  const g = GOLD_PICKS[p.kind as keyof typeof GOLD_PICKS];
  return g ? g.title + ' ' + fcToDisplay(g.floor, sport) + '+' : 'Scout’s Choice';
}

const hm = (m: number) => (m >= 60 * 24 ? Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm');

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const clock = (h: number) => (h % 12 || 12) + (h < 12 ? ' am' : ' pm');

/** Claude (packs-3): when the next Lightning window opens, and which two slots this weekend has. */
function lightningNote(now: number): string {
  const w = nextLightning(now);
  if (!w) return '';
  const day = DAYS[new Date(w.day + 'T12:00:00Z').getUTCDay()];
  return 'Lightning Standout (' + Math.round(LIGHTNING_DISCOUNT * 100) + '% off) opens in ' + hm(minutesToLightning(now)) + ': ' + day + ' ' + clock(w.hour) + '–' + clock(w.hour + 2) + ' Eastern. Two surprise windows every weekend.';
}

/** Claude (packs-3): a named flash sale's deals while its window is open (1 each per player). */
function FlashSale({ sport, ut, coins, now, onBuy, onOdds }: { sport: UtSport; ut: UtState; coins: number; now: number; onBuy: (key: string, price: number, name: string, kind: string) => void; onOdds: (s: OddsSource) => void }) {
  const deals = flashDeals(sport, now);
  if (!deals.length) return null;
  return (
    <section className="ut-flash" aria-label={deals[0].sale + ' flash sale'}>
      <span className="ut-flash-head">
        <span className="eyebrow">FLASH SALE</span>
        <b className="disp">{deals[0].sale}</b>
        <small>Ends in {hm(Math.max(1, Math.ceil((deals[0].end - now) / 60000)))} · one of each per player</small>
      </span>
      {deals.map((d) => {
        const left = flashLeft(ut, d.key);
        const short = coins < d.price;
        return (
          <div key={d.key} className="ut-shopitem ut-flash-item">
            <PackArt kind={d.kind.startsWith('live:') ? 'live' : d.kind} label={d.kind.startsWith('live:') ? 'PROGRAM' : (SHORT[d.kind] ?? 'PACK')} sport={sport} small />
            <div className="ut-shop-txt">
              <strong>{d.name}</strong>
              <small>
                <s className="num">{d.was.toLocaleString('en-US')}</s> <b className="ut-flash-off">−{Math.round(d.off * 100)}%</b>
              </small>
              <small className="ut-limit">{left ? '1 left in this sale' : 'Bought in this sale'}</small>
              <button className="ut-oddsbtn" onClick={() => onOdds(d.kind === 'scout' ? { type: 'pick', kind: 'scout' } : { type: 'pack', kind: d.kind })} aria-label={d.name + ' odds'}>
                <IconInfo size={13} /> Odds
              </button>
            </div>
            <button className={'btn ut-buy' + (short || !left ? ' short' : ' gold')} aria-disabled={short || !left} aria-label={'Buy ' + d.name + ' for ' + d.price + ' coins, ' + Math.round(d.off * 100) + ' percent off'} onClick={() => onBuy(d.key, short || !left ? 0 : d.price, d.name, d.kind)}>
              <Coin size={14} />
              <span className="num">{d.price.toLocaleString('en-US')}</span>
            </button>
          </div>
        );
      })}
    </section>
  );
}

function DailyDrop({ ut, day, sport, pool, onClaim, onOdds }: { ut: UtState; day: string; sport: UtSport; pool: Pool; onClaim: () => void; onOdds: () => void }) {
  const s = dailyStatus(ut, day);
  // Claude (packs-4, audit L2): the drop's own chances, from its odds sheet (computed after the first paint)
  const [chance, setChance] = useState<{ gold: number; standout: number } | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const o = oddsFor(pool, 'daily');
      if (o) setChance({ gold: o.tiers.find((r) => r.key === 't-gold')?.p ?? 0, standout: o.tiers.find((r) => r.key === 't-standout')?.p ?? 0 });
    }, 0);
    return () => clearTimeout(t);
  }, [pool, day]);
  return (
    <div className={'ut-daily' + (s.ready ? ' ready' : '')}>
      <PackArt kind="daily" label="DAILY" sport={sport} small />
      <span className="ut-daily-txt">
        <span className="eyebrow">{s.ready ? 'FREE · DAILY DROP' : 'DAILY DROP · CLAIMED'}</span>
        <b className="disp">{s.ready ? 'Day ' + s.streak + ' is ready' : 'Back tomorrow'}</b>
        <span className="ut-streak" aria-label={'Streak day ' + s.streak + ' of ' + STREAK_DAYS}>
          {Array.from({ length: STREAK_DAYS }, (_, i) => (
            <i key={i} className={(i < s.streak - (s.ready ? 1 : 0) ? 'on' : '') + (i === STREAK_DAYS - 1 ? ' gold' : '') + (s.ready && i === s.streak - 1 ? ' next' : '')}>
              {i + 1}
            </i>
          ))}
        </span>
        <small>
          {chance ? 'A gold ' + fmtPct(chance.gold) + ', a Weekly Standout ' + fmtPct(chance.standout) + '. ' : ''}Day 7 adds a Gold Pack. Miss a day and the streak starts over.
        </small>
        <button className="ut-oddsbtn" onClick={onOdds} aria-label="Daily Drop odds">
          <IconInfo size={13} /> Odds
        </button>
      </span>
      {s.ready && (
        <button className="btn gold ut-daily-btn" onClick={onClaim}>
          OPEN
        </button>
      )}
    </div>
  );
}

const isPickKind = (kind: string) => kind === 'scout' || kind === 'standout-pick' || kind.startsWith('live-pick:');
/** A waiting pack whose contents are drawn (not the starter, an admin award or a single event reward). */
const hasPackOdds = (kind: string) => kind !== 'starter' && !kind.startsWith('admin-') && !kind.startsWith('event-spotlight:');

/** A purchase waiting on the buy confirm. */
interface Ask {
  name: string;
  price: number;
  /** its pack art */
  art: string;
  label: string;
  source: OddsSource;
  go: () => void;
}

/** One "at least one" row (the odds sheet's look, odds-sheet.css). */
function ConfirmRow({ r }: { r: OddsRow }) {
  const one = oneIn(r.p);
  return (
    <div className={'ps-odds-row' + (r.key.startsWith('t-') ? ' tone-' + r.key.slice(2) : '')} role="row">
      <span className="ps-odds-label" role="rowheader">
        {r.label}
      </span>
      <span className="ps-odds-bar" aria-hidden="true">
        <i style={{ width: Math.max(1.5, Math.min(100, r.p * 100)) + '%' }} />
      </span>
      <b className="ps-odds-pct num" role="cell">
        {fmtPct(r.p)}
        {one && <small>{one}</small>}
      </b>
    </div>
  );
}

/**
 * Claude (packs-4, packs-plan item 4): the buy confirm for a pack of CONFIRM_FROM (1,500) coins or more: its
 * art and price, the three most telling "at least one" chances, VIEW ODDS, BUY and CANCEL. "Don't ask again"
 * is offered only under 10,000 coins (odds.ts confirmFor) and saved through `onPrefs`.
 */
function BuyConfirm({ pool, sport, coins, ask, prefs, onOdds, onPrefs, onClose }: { pool: Pool; sport: UtSport; coins: number; ask: Ask; prefs?: { skipBuyConfirm?: boolean }; onOdds: () => void; onPrefs?: (p: { skipBuyConfirm?: boolean }) => void; onClose: () => void }) {
  const [skip, setSkip] = useState(false);
  const rows = useMemo(() => {
    const t = ask.source.type === 'pick' ? pickTable(pool, ask.source.kind) : ask.source.type === 'pack' ? oddsFor(pool, ask.source.kind) : null;
    return t ? headline(t) : [];
  }, [pool, ask]);
  const policy = confirmFor(ask.price, prefs);
  return (
    <Sheet label={'Buy ' + ask.name} kind="center" onClose={onClose}>
      {(close) => (
        <div className="ps-confirm">
          <div className="ps-confirm-top">
            <PackArt kind={ask.art} label={ask.label} sport={sport} small />
            <span>
              <span className="eyebrow">BUY WITH COINS</span>
              <h2 className="disp">{ask.name}</h2>
              <span className="ps-confirm-price">
                <Coin size={16} />
                <span className="num">{ask.price.toLocaleString('en-US')}</span>
                <small>of your {coins.toLocaleString('en-US')}</small>
              </span>
            </span>
          </div>
          {rows.length > 0 && (
            <div className="ps-odds-group" role="table" aria-label="Chance of at least one">
              <span className="ps-odds-sub" role="presentation">
                {ask.source.type === 'pick' ? 'Chance of at least one among the options' : 'Chance of at least one in this pack'}
              </span>
              {rows.map((r) => (
                <ConfirmRow key={r.key} r={r} />
              ))}
            </div>
          )}
          {policy.canSkip ? (
            <button className="ps-confirm-skip" role="checkbox" aria-checked={skip} onClick={() => setSkip((x) => !x)}>
              <i aria-hidden="true">
                {skip && (
                  <svg viewBox="0 0 12 12" width="12" height="12">
                    <path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </i>
              Don’t ask again for packs under 10,000 coins
            </button>
          ) : (
            <p className="ps-confirm-note">Packs of 10,000 coins or more always ask first.</p>
          )}
          <div className="ps-confirm-btns">
            <button className="btn ps-confirm-odds" onClick={onOdds}>
              VIEW ODDS
            </button>
            <button className="btn" onClick={() => close()}>
              CANCEL
            </button>
            <button
              className="btn gold"
              onClick={() =>
                close(() => {
                  if (skip && policy.canSkip) onPrefs?.({ skipBuyConfirm: true });
                  onClose();
                  ask.go();
                })
              }
            >
              BUY
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function Store(props: {
  sport: UtSport;
  coins: number;
  starter: boolean;
  pending: PendingPack[];
  defs: Record<string, PackDef>;
  onBuy: (kind: string, price: number) => void;
  onStarter: () => void;
  onPending: (id: string) => void;
  // Claude: content drop 2
  pool: Pool;
  ut: UtState;
  day: string;
  stored: ClubCard[];
  onPick: (id: string) => void;
  onMarket: (i: number) => void;
  onSwap: () => void;
  onStandouts: () => void;
  /** Claude: open the Pack Tracker (Club → Pack Tracker) */
  onTracker?: () => void;
  /** Claude wave 2: the Preview Pack card */
  preview?: React.ReactNode;
  /** Claude wave 3: buy a Live Calendar program pack */
  onLive?: (pack: CalPack) => void;
  /** Claude (packs-3): buy a named flash sale's deal, by its key */
  onFlash?: (key: string) => void;
  /** Claude (packs-4): save Store preferences (the buy confirm's "Don't ask again") */
  onPrefs?: (prefs: { skipBuyConfirm?: boolean }) => void;
}) {
  const { open: setOdds, host: oddsHost } = useOddsHost(props.pool, props.sport);
  const [ask, setAsk] = useState<Ask | null>(null);
  useOddsPreload();
  // Claude (packs-4): after the first paint, the Store's sheets are computed one per idle moment (memoised in
  // odds.ts), so a tap only has to draw the sheet
  useEffect(() => {
    const kinds = ['premium', 'gold', 'jumbo', 'elite', 'standout', 'silver', 'bronze', 'daily', 'position', ...livePacksOn(props.day).map((p) => p.id)];
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    let id = 0;
    let i = 0;
    const next = () => {
      if (i >= kinds.length) return;
      oddsFor(props.pool, kinds[i++]);
      id = w.requestIdleCallback ? w.requestIdleCallback(next, { timeout: 3000 }) : window.setTimeout(next, 50);
    };
    id = w.requestIdleCallback ? w.requestIdleCallback(next, { timeout: 3000 }) : window.setTimeout(next, 300);
    return () => (w.cancelIdleCallback ? w.cancelIdleCallback(id) : clearTimeout(id));
  }, [props.pool, props.day]);
  /**
   * Claude (packs-4): a purchase of CONFIRM_FROM coins or more asks first (BuyConfirm), unless the player
   * chose "Don't ask again" and it costs under 10,000. One that can't go through (short of coins, at its
   * limit) goes straight on, so its own message explains why.
   */
  const guard = (a: Omit<Ask, 'go'>, go: () => void, blocked: boolean) => {
    if (blocked || !confirmFor(a.price, contentOf(props.ut).prefs).ask) return go();
    setAsk({ ...a, go });
  };
  const [choose, setChoose] = useState(false);
  const [tab, setTab] = useState<'packs' | 'market'>('packs');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  useCatalog();
  const pos = props.defs.position;
  const picks = contentOf(props.ut).picks ?? [];

  const item = (k: string, note?: string, disabled?: string) => {
    const d = props.defs[k];
    if(studioKind(k)&&!catalogOf(props.sport)[k].enabled)return null;
    const short = props.coins < d.price;
    return (
      <div key={k} className={'ut-shopitem s-' + k}>
        <PackArt kind={k} label={SHORT[k]??k.toUpperCase()} sport={props.sport} small />
        <div className="ut-shop-txt">
          <strong>{props.sport === 'nfl' && k === 'position' ? 'Unit Pack' : d.name}</strong>
          <small>{props.sport === 'nfl' && k === 'position' ? d.slots.length + ' golds (2 of them ' + fcToDisplay(78, props.sport) + '+) from the unit you pick' : d.blurb}</small>
          {note && <small className="ut-limit">{note}</small>}
          <button className="ut-oddsbtn" onClick={() => setOdds(k === 'scout' ? { type: 'pick', kind: 'scout' } : { type: 'pack', kind: k })} aria-label={d.name + ' odds'}>
            <IconInfo size={13} /> Odds
          </button>
        </div>
        <button
          className={'btn ut-buy' + (short || disabled ? ' short' : ' gold')}
          aria-disabled={short || !!disabled}
          aria-label={'Buy ' + d.name + ' for ' + d.price + ' coins'}
          onClick={() =>
            k === 'position'
              ? short
                ? props.onBuy(k, d.price)
                : setChoose(true)
              : guard({ name: d.name, price: d.price, art: k, label: SHORT[k] ?? k.toUpperCase(), source: k === 'scout' ? { type: 'pick', kind: 'scout' } : { type: 'pack', kind: k } }, () => props.onBuy(k, d.price), short || !!disabled)
          }
        >
          <Coin size={14} />
          <span className="num">{d.price.toLocaleString('en-US')}</span>
        </button>
      </div>
    );
  };
  const left = (k: LimitedKind) => buysLeft(props.ut, k, props.day, now);
  const per = (k: LimitedKind) => (LIMITS[k].per === 'day' ? 'today' : LIMITS[k].per === 'week' ? 'this week' : 'this window');
  const limitNote = (k: LimitedKind) => (left(k) ? left(k) + ' of ' + LIMITS[k].n + ' left ' + per(k) : 'Limit reached ' + per(k));
  const lw = lightningWindow(now);
  // Claude: the Pack Tracker, next to Your packs (or the pack list when nothing is waiting)
  const history = props.onTracker ? (
    <button className="ut-link ut-so-mini ut-pull-history" onClick={props.onTracker}>
      PULL HISTORY
    </button>
  ) : null;

  return (
    <div className="page ut-store">
      <Segmented
        label="Store sections"
        className="ut-store-seg"
        items={[
          ['packs', 'PACKS'],
          ['market', 'SCOUT MARKET'],
        ]}
        value={tab}
        onChange={(v) => setTab(v)}
      />
      {tab === 'market' ? (
        <Market {...props} />
      ) : (
        <>
          {(props.starter || props.pending.length > 0 || picks.length > 0) && (
            <>
              <SectionHead title={'Your packs · ' + (props.pending.length + picks.length + (props.starter ? 1 : 0))}>{history}</SectionHead>
              <div className="ut-mine">
                {props.starter && (
                  <button className="ut-mine-pack" onClick={props.onStarter} aria-label="Open your free starter pack">
                    <PackArt kind="starter" label="STARTER" sport={props.sport} small />
                    <b>Starter</b>
                    <i className="ut-open">OPEN</i>
                  </button>
                )}
                {picks.map((p) => (
                  <span key={p.id} className="ut-mine-cell">
                    <button className="ut-mine-pack" onClick={() => props.onPick(p.id)} aria-label={'Choose your player: ' + p.title}>
                      <PackArt kind="scout" label={'PICK 1 OF ' + p.options.length} sport={props.sport} small />
                      <b>{pickLabel(p, props.sport)}</b>
                      <i className="ut-open">CHOOSE</i>
                    </button>
                    {hasPickOdds(p.kind) && (
                      <button className="ps-odds-chip" onClick={() => setOdds({ type: 'pick', kind: p.kind })} aria-label={pickLabel(p, props.sport) + ' odds'}>
                        ODDS
                      </button>
                    )}
                  </span>
                ))}
                {props.pending.map((p) =>
                  // Claude (packs-1 fix): a reward pack from a newer build says so before the tap (it stays saved)
                  knownPack(props.sport, p.kind) ? (
                    <span key={p.id} className="ut-mine-cell">
                      <button className="ut-mine-pack" onClick={() => props.onPending(p.id)} aria-label={'Open your ' + packName(props.sport, p.kind)}>
                        <PackArt kind={p.kind} label={SHORT[p.kind.split(':')[0]] ?? 'PACK'} sport={props.sport} small />
                        <b>{packName(props.sport, p.kind).replace(/ Pack$/, '')}</b>
                        <i className="ut-open">OPEN</i>
                      </button>
                      {hasPackOdds(p.kind) && (
                        <button className="ps-odds-chip" onClick={() => setOdds(isPickKind(p.kind) ? { type: 'pick', kind: p.kind } : { type: 'pack', kind: p.kind })} aria-label={packName(props.sport, p.kind) + ' odds'}>
                          ODDS
                        </button>
                      )}
                    </span>
                  ) : (
                    <button key={p.id} className="ut-mine-pack ut-mine-new" onClick={() => props.onPending(p.id)} aria-label="New pack: update the game to open it. It stays saved until then.">
                      <PackArt kind={p.kind} label="NEW" sport={props.sport} small />
                      <b>New Pack</b>
                      <i className="ut-open ut-update">UPDATE TO OPEN</i>
                    </button>
                  ),
                )}
              </div>
            </>
          )}
          <DailyDrop ut={props.ut} day={props.day} sport={props.sport} pool={props.pool} onClaim={() => props.onBuy('daily', 0)} onOdds={() => setOdds({ type: 'pack', kind: 'daily' })} />
          {props.onFlash && (
            <FlashSale
              sport={props.sport}
              ut={props.ut}
              coins={props.coins}
              now={now}
              onOdds={setOdds}
              onBuy={(key, price, name, kind) =>
                guard({ name, price, art: kind.startsWith('live:') ? 'live' : kind, label: kind.startsWith('live:') ? 'PROGRAM' : (SHORT[kind] ?? 'PACK'), source: kind === 'scout' ? { type: 'pick', kind } : { type: 'pack', kind } }, () => props.onFlash!(key), !price)
              }
            />
          )}
          {STUDIO_PACKS.some(k=>catalogOf(props.sport)[k].enabled)&&<><SectionHead title="Club Collection"/><div className="ut-shop">{STUDIO_PACKS.map(k=>item(k))}</div></>}
          {(() => {
            // Claude wave 3: this season's program packs (Live Calendar)
            const live = livePacksOn(props.day);
            if (!live.length || !props.onLive) return null;
            const season = live[0] && (live[0] as { season?: { name: string; accent: string[] } }).season;
            return (
              <>
                <SectionHead title={'This Season' + (season ? ' · ' + season.name : '')} />
                <div className="ut-shop">
                  {live.map((p) => {
                    const d = livePackDef(props.sport, p, now);
                    const left = liveBuysLeft(props.ut, p, props.day);
                    const short = props.coins < d.price;
                    return (
                      <div key={p.id} className={'ut-shopitem s-live' + (p.tpl === 'guarantee' ? ' s-live-plus' : '')} style={season ? ({ '--sa': season.accent[0], '--sb': season.accent[1] } as React.CSSProperties) : undefined}>
                        <PackArt kind={p.tpl === 'guarantee' ? 'live-plus' : 'live'} label={p.tpl === 'guarantee' ? 'GUARANTEE' : 'PROGRAM'} sport={props.sport} small />
                        <div className="ut-shop-txt">
                          <strong>{d.name}</strong>
                          <small>{d.blurb}</small>
                          {d.boost && (
                            <small className="ut-boost">
                              <b>BOOSTED</b> program odds ×1.5 for {hm(Math.max(1, Math.ceil((d.boost.until - now) / 60000)))}
                            </small>
                          )}
                          <small className="ut-limit">{(left ? left + ' left ' : 'Limit reached ') + (p.tpl === 'guarantee' ? 'this week' : 'today') + ' · until ' + p.end.slice(5).replace('-', '/')}</small>
                          <button className="ut-oddsbtn" onClick={() => setOdds({ type: 'pack', kind: p.id })} aria-label={d.name + ' odds'}>
                            <IconInfo size={13} /> Odds
                          </button>
                        </div>
                        <button
                          className={'btn ut-buy' + (short || !left ? ' short' : ' gold')}
                          aria-disabled={short || !left}
                          aria-label={'Buy ' + d.name + ' for ' + d.price + ' coins'}
                          onClick={() =>
                            guard({ name: d.name, price: d.price, art: p.tpl === 'guarantee' ? 'live-plus' : 'live', label: p.tpl === 'guarantee' ? 'GUARANTEE' : 'PROGRAM', source: { type: 'pack', kind: p.id } }, () => props.onLive!(p), short || !left)
                          }
                        >
                          <Coin size={14} />
                          <span className="num">{d.price.toLocaleString('en-US')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}
          <SectionHead title="Featured">
            <button className="ut-link ut-so-mini" onClick={props.onStandouts}>
              WEEKLY STANDOUTS
            </button>
          </SectionHead>
          <div className="ut-shop">
            {lw ? item('lightning', 'Lightning window · ' + hm(lw.minutesLeft) + ' left · ' + limitNote('lightning'), left('lightning') ? undefined : 'limit') : null}
            {item('standout', limitNote('standout'), left('standout') ? undefined : 'limit')}
            {!lw && <p className="ut-lightning-next">{lightningNote(now)}</p>}
            {item('elite', limitNote('elite'), left('elite') ? undefined : 'limit')}
            {item('jumbo', limitNote('jumbo'), left('jumbo') ? undefined : 'limit')}
          </div>
          <SectionHead title="Picks & previews" />
          <div className="ut-shop">{item('scout', limitNote('scout'), left('scout') ? undefined : 'limit')}</div>
          {props.preview}
          <SectionHead title="All packs · by price">{!(props.starter || props.pending.length > 0 || picks.length > 0) && history}</SectionHead>
          <div className="ut-shop">
            {BY_PRICE.filter((k) => k !== 'spotlight' || props.sport !== 'soccer') /* soccer has no Spotlight (no registered serials) */
              .sort((a, b) => props.defs[a].price - props.defs[b].price)
              .map((k) => item(k, k === 'spotlight' ? 'Every card gets a registered serial' : undefined))}
          </div>
          <p className="note">Coins only, never real money. Matches, objectives, SBCs and the daily chest all pay coins.</p>
        </>
      )}
      {ask && <BuyConfirm pool={props.pool} sport={props.sport} coins={props.coins} ask={ask} prefs={contentOf(props.ut).prefs} onOdds={() => setOdds(ask.source)} onPrefs={props.onPrefs} onClose={() => setAsk(null)} />}
      {oddsHost}
      {choose && (
        <Sheet label="Pick a position" kind="bottom" onClose={() => setChoose(false)}>
          {(close) => (
            <div className="ut-choose">
              <h2 className="disp">{pickFor(props.sport, { nba: 'Pick a position', nfl: 'Pick a unit', soccer: 'Pick a line' })}</h2>
              <p>
                {pos.slots.length} golds {pickFor(props.sport, { nba: 'at that position', nfl: 'from that unit, its positions in the mix a squad needs', soccer: 'from that line, its positions in the mix a squad needs' })}, for{' '}
                {pos.price.toLocaleString('en-US')} coins.
              </p>
              <div className="ut-choose-grid">
                {positionChoices(props.sport).map((c) => (
                  <button key={c.key} className="ut-choose-btn" onClick={() => close(() => (setChoose(false), props.onBuy('position:' + c.key, pos.price)))}>
                    <b className="disp">{c.label}</b>
                    {c.positions.length > 1 && c.label !== c.positions.join(' · ') && <small>{c.positions.join(' · ')}</small>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}

/** Claude (packs-3): what the market sells now (Hot Season and Standouts no longer). */
const TAG: Partial<Record<MarketTag, string>> = { silver: 'SILVER', gold: 'GOLD', rare: 'GOLD 78+', high: 'SCOUTED' };

/** Claude: the Scout Market (twelve fixed-price cards a day, each once) and the Swap Desk. */
function Market(props: { pool: Pool; ut: UtState; day: string; coins: number; stored: ClubCard[]; onMarket: (i: number) => void; onSwap: () => void }) {
  const items = marketFor(props.pool, props.day);
  const bought = marketBought(props.ut, props.day);
  const dupes = swapCandidates(props.stored);
  const now = Date.now();
  const swapsLeft = buysLeft(props.ut, 'swap', props.day, now);
  const size = swapSize(now, props.pool.sport);
  return (
    <>
      <p className="ut-lede">Twelve scouted base cards a day at fixed prices, the same for everyone, one of them an {fcToDisplay(83, props.pool.sport)}–{fcToDisplay(86, props.pool.sport)}. Each can be bought once; new cards at midnight Eastern.</p>
      <div className="ut-market">
        {items.map((it) => {
          const rc = props.pool.base.get(it.cardId);
          if (!rc) return null;
          const sold = bought.has(it.i);
          return (
            <button key={it.i} className={'ut-market-item' + (sold ? ' sold' : '')} disabled={sold} onClick={() => props.onMarket(it.i)} aria-label={(sold ? 'Bought: ' : 'Buy ') + rc.line.name + ' for ' + it.price + ' coins'}>
              <UtCard rc={rc} w={66} />
              <i className={'ut-market-tag t-' + it.tag}>{TAG[it.tag] ?? 'GOLD'}</i>
              <span className={'ut-market-price' + (props.coins < it.price && !sold ? ' short' : '')}>
                {sold ? (
                  'BOUGHT'
                ) : (
                  <>
                    <Coin size={11} /> <b className="num">{it.price.toLocaleString('en-US')}</b>
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>
      <div className="ut-swap">
        <span className="ut-swap-txt">
          <span className="eyebrow">SWAP DESK</span>
          <b className="disp">{size} duplicate golds → Scout’s Choice</b>
          <small>
            Trades your cheapest {size} spare golds from Duplicate Storage (never squad cards) for a pick of three {fcToDisplay(84, props.pool.sport)}+ golds. You have {dupes.length}. {swapsLeft ? 'One swap a day: ready.' : 'One swap a day: back tomorrow.'}
          </small>
          {dupes.length > 0 && (
            <span className="ut-swap-cards" aria-hidden="true">
              {dupes.slice(0, size).map((c) => (
                <UtCard key={c.uid} rc={c.rc} w={34} />
              ))}
            </span>
          )}
        </span>
        <button className="btn primary" aria-disabled={dupes.length < size || !swapsLeft} onClick={props.onSwap}>
          SWAP
        </button>
      </div>
    </>
  );
}
