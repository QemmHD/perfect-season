// The store: packs to buy with coins (never real money), packs you've earned waiting to be opened,
// the free starter, and every pack's odds.
// Claude 2026-11-01: sections (Daily Drop · Featured · Gold · Bronze & Silver · Online), the new
// packs with their limits, open pick sheets under Your packs, and the MARKET tab (Scout Market and
// Swap Desk). Odds sheets list every slot including rare golds and Weekly Standouts.
import React, { useEffect, useState } from 'react';
import { Sheet } from '../ui/common';
import { Coin } from '../ui/icons';
import { PackArt } from './Hub';
import { IconInfo } from './icons';
import { type Odds, type PackDef, packName, positionChoices, FEATURED_STANDOUT, type SlotTier } from './packs';
import { TIER_NAMES } from './rate';
import { fcToDisplay } from './fc-scale';
import type { PendingPack, UtState } from './state';
import type { UtSport } from './types';
import { contentOf } from './content-state';
import { buysLeft, dailyStatus, LIMITS, lightningWindow, minutesToLightning, STREAK_DAYS, type LimitedKind } from './content-packs';
import { marketBought, marketFor, SWAP_SIZE, swapCandidates } from './market';
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

function pct(p: number): string {
  return p >= 0.995
    ? '100%'
    : p >= 0.1
      ? Math.round(p * 100) + '%'
      : p >= 0.01
        ? (Math.round(p * 1000) / 10).toString().replace(/\.0$/, '') + '%'
        : (Math.round(p * 10000) / 100).toString() + '%';
}

/** Claude (UI reorganisation): the always-on packs, listed cheapest first. */
const BY_PRICE = ['bronze', 'silver', 'position', 'gold', 'premium', 'spotlight'];

const SLOT_ORDER: SlotTier[] = ['goat', 'spotlight', 'legend', 'landmark', 'program', 'promo', 'standout', 'rare', 'gold', 'silver', 'bronze'];
const slotName = (t: SlotTier) => (t === 'rare' ? 'Rare Gold' : TIER_NAMES[t]);

/** What a pack holds, slot by slot, and the chance of a promo or a legend in the whole pack. */
function OddsSheet({ def, onClose }: { def: PackDef; onClose: () => void }) {
  const rows = new Map<string, { o: Odds; n: number }>();
  for (const o of def.slots) {
    const k = JSON.stringify(o);
    const r = rows.get(k);
    if (r) r.n++;
    else rows.set(k, { o, n: 1 });
  }
  const any = (t: SlotTier) => 1 - def.slots.reduce((a, o) => a * (1 - (o[t] ?? 0)), 1);
  const pick = def.kind === 'scout';
  return (
    <Sheet label={def.name + ' odds'} kind="center" onClose={onClose}>
      {(close) => (
        <div className="ut-odds">
          <h2 className="disp">{def.name}</h2>
          <p>{def.blurb.replace(/\.+$/, '')}.</p>
          <div className="ut-odds-rows">
            {Array.from(rows.values()).map(({ o, n }, i) => (
              <div key={i} className="ut-odds-row">
                <b className="num">{n}×</b>
                <span>
                  {SLOT_ORDER.filter((t) => (o[t] ?? 0) > 0).map((t) => (
                    <i key={t} className={'ut-tierchip t-' + t}>
                      {slotName(t)} {pct(o[t]!)}
                    </i>
                  ))}
                </span>
              </div>
            ))}
          </div>
          {pick && <p className="note">These are the odds of each of the three face-down options. You keep exactly one of them; the other two are never added to your club.</p>}
          {any('goat') > 0 && (
            <p className="note">
              GOAT: {pct(any('goat'))} per pack (1 in 2,000). Spotlight: {pct(any('spotlight'))}. This is the chance of any GOAT edition; one specific GOAT is rarer. Odds reset
              each pack; no guaranteed GOAT after 2,000 packs. Special editions are chosen uniformly within their tier.
            </p>
          )}
          {!pick && (any('legend') > 0 || any('standout') > 0 || any('promo') > 0) && (
            <p className="note">
              In this pack: {any('standout') > 0 ? 'a Weekly Standout ' + pct(any('standout')) : ''}
              {any('promo') > 0 ? (any('standout') > 0 ? ', ' : '') + 'a Hot Season ' + pct(any('promo')) : ''}
              {any('legend') > 0 ? ', a Legend ' + pct(any('legend')) + ' (about 1 in ' + Math.round(1 / any('legend')) + ')' : ''}.
            </p>
          )}
          {any('standout') > 0 && (
            <p className="note">
              A Standout is one of this week’s Weekly Standouts: the Featured Standout {pct(FEATURED_STANDOUT)} of the time, otherwise any of the others equally. Owned Standouts keep their week
              forever.
            </p>
          )}
          {any('program') > 0 && <p className="note">A program card is one of this program’s cards released so far, all equally likely. The program’s cards are the same for everyone.</p>}
          {any('rare') > 0 && <p className="note">Rare golds are the top 35% of golds at each position; a rare slot is always a gold.</p>}
          <p className="note">Within a tier, lower overalls are more common: each point above the tier’s floor is a little rarer.</p>
          <button className="btn" onClick={() => close()}>
            CLOSE
          </button>
        </div>
      )}
    </Sheet>
  );
}

const hm = (m: number) => (m >= 60 * 24 ? Math.floor(m / 1440) + 'd ' + Math.floor((m % 1440) / 60) + 'h' : m >= 60 ? Math.floor(m / 60) + 'h ' + (m % 60) + 'm' : m + 'm');

function DailyDrop({ ut, day, sport, onClaim }: { ut: UtState; day: string; sport: UtSport; onClaim: () => void }) {
  const s = dailyStatus(ut, day);
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
        <small>Day 7 adds a Gold Pack. Miss a day and the streak starts over.</small>
      </span>
      {s.ready && (
        <button className="btn gold ut-daily-btn" onClick={onClaim}>
          OPEN
        </button>
      )}
    </div>
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
  /** Claude wave 2: the Preview Pack card */
  preview?: React.ReactNode;
  /** Claude wave 3: buy a Live Calendar program pack */
  onLive?: (pack: CalPack) => void;
}) {
  const [odds, setOdds] = useState<PackDef | null>(null);
  const [choose, setChoose] = useState(false);
  const [tab, setTab] = useState<'packs' | 'market'>('packs');
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const pos = props.defs.position;
  const picks = contentOf(props.ut).picks ?? [];

  const item = (k: string, note?: string, disabled?: string) => {
    const d = props.defs[k];
    const short = props.coins < d.price;
    return (
      <div key={k} className={'ut-shopitem s-' + k}>
        <PackArt kind={k} label={SHORT[k]} sport={props.sport} small />
        <div className="ut-shop-txt">
          <strong>{props.sport === 'nfl' && k === 'position' ? 'Unit Pack' : d.name}</strong>
          <small>{props.sport === 'nfl' && k === 'position' ? d.slots.length + ' golds (2 rare) from the unit you pick' : d.blurb}</small>
          {note && <small className="ut-limit">{note}</small>}
          <button className="ut-oddsbtn" onClick={() => setOdds(d)} aria-label={d.name + ' odds'}>
            <IconInfo size={13} /> Odds
          </button>
        </div>
        <button
          className={'btn ut-buy' + (short || disabled ? ' short' : ' gold')}
          aria-disabled={short || !!disabled}
          aria-label={'Buy ' + d.name + ' for ' + d.price + ' coins'}
          onClick={() => (k === 'position' ? (short ? props.onBuy(k, d.price) : setChoose(true)) : props.onBuy(k, d.price))}
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
              <SectionHead title={'Your packs · ' + (props.pending.length + picks.length + (props.starter ? 1 : 0))} />
              <div className="ut-mine">
                {props.starter && (
                  <button className="ut-mine-pack" onClick={props.onStarter} aria-label="Open your free starter pack">
                    <PackArt kind="starter" label="STARTER" sport={props.sport} small />
                    <b>Starter</b>
                    <i className="ut-open">OPEN</i>
                  </button>
                )}
                {picks.map((p) => (
                  <button key={p.id} className="ut-mine-pack" onClick={() => props.onPick(p.id)} aria-label={'Choose your player: ' + p.title}>
                    <PackArt kind="scout" label="PICK 1 OF 3" sport={props.sport} small />
                    <b>{p.kind === 'standout-pick' ? 'Standout Pick' : p.kind === 'new-era' ? 'Icon Pick' : 'Scout’s Choice'}</b>
                    <i className="ut-open">CHOOSE</i>
                  </button>
                ))}
                {props.pending.map((p) => (
                  <button key={p.id} className="ut-mine-pack" onClick={() => props.onPending(p.id)} aria-label={'Open your ' + packName(props.sport, p.kind)}>
                    <PackArt kind={p.kind} label={SHORT[p.kind.split(':')[0]] ?? 'PACK'} sport={props.sport} small />
                    <b>{packName(props.sport, p.kind).replace(/ Pack$/, '')}</b>
                    <i className="ut-open">OPEN</i>
                  </button>
                ))}
              </div>
            </>
          )}
          <DailyDrop ut={props.ut} day={props.day} sport={props.sport} onClaim={() => props.onBuy('daily', 0)} />
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
                    const d = livePackDef(props.sport, p);
                    const left = liveBuysLeft(props.ut, p, props.day);
                    const short = props.coins < d.price;
                    return (
                      <div key={p.id} className={'ut-shopitem s-live' + (p.tpl === 'guarantee' ? ' s-live-plus' : '')} style={season ? ({ '--sa': season.accent[0], '--sb': season.accent[1] } as React.CSSProperties) : undefined}>
                        <PackArt kind={p.tpl === 'guarantee' ? 'live-plus' : 'live'} label={p.tpl === 'guarantee' ? 'GUARANTEE' : 'PROGRAM'} sport={props.sport} small />
                        <div className="ut-shop-txt">
                          <strong>{d.name}</strong>
                          <small>{d.blurb}</small>
                          <small className="ut-limit">{(left ? left + ' left ' : 'Limit reached ') + (p.tpl === 'guarantee' ? 'this week' : 'today') + ' · until ' + p.end.slice(5).replace('-', '/')}</small>
                          <button className="ut-oddsbtn" onClick={() => setOdds(d)} aria-label={d.name + ' odds'}>
                            <IconInfo size={13} /> Odds
                          </button>
                        </div>
                        <button className={'btn ut-buy' + (short || !left ? ' short' : ' gold')} aria-disabled={short || !left} aria-label={'Buy ' + d.name + ' for ' + d.price + ' coins'} onClick={() => props.onLive!(p)}>
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
            {!lw && <p className="ut-lightning-next">Lightning Standout (25% off) opens in {hm(minutesToLightning(now))}: weekends 12–2 pm and 8–10 pm Eastern.</p>}
            {item('elite', limitNote('elite'), left('elite') ? undefined : 'limit')}
            {item('jumbo', limitNote('jumbo'), left('jumbo') ? undefined : 'limit')}
          </div>
          <SectionHead title="Picks & previews" />
          <div className="ut-shop">{item('scout', limitNote('scout'), left('scout') ? undefined : 'limit')}</div>
          {props.preview}
          <SectionHead title="All packs · by price" />
          <div className="ut-shop">
            {BY_PRICE.slice()
              .sort((a, b) => props.defs[a].price - props.defs[b].price)
              .map((k) => item(k, k === 'spotlight' ? 'Every card gets a registered serial' : undefined))}
          </div>
          <p className="note">Coins only, never real money. Matches, objectives, SBCs and the daily chest all pay coins.</p>
        </>
      )}
      {odds && <OddsSheet def={odds} onClose={() => setOdds(null)} />}
      {choose && (
        <Sheet label="Pick a position" kind="bottom" onClose={() => setChoose(false)}>
          {(close) => (
            <div className="ut-choose">
              <h2 className="disp">{props.sport === 'nfl' ? 'Pick a unit' : 'Pick a position'}</h2>
              <p>
                {pos.slots.length} golds {props.sport === 'nfl' ? 'from that unit, its positions in the mix a squad needs' : 'at that position'}, for{' '}
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

const TAG: Record<string, string> = { silver: 'SILVER', gold: 'GOLD', rare: 'RARE GOLD', promo: 'HOT SEASON', standout: 'STANDOUT' };

/** Claude: the Scout Market (twelve fixed-price cards a day, each once) and the Swap Desk. */
function Market(props: { pool: Pool; ut: UtState; day: string; coins: number; stored: ClubCard[]; onMarket: (i: number) => void; onSwap: () => void }) {
  const items = marketFor(props.pool, props.day);
  const bought = marketBought(props.ut, props.day);
  const dupes = swapCandidates(props.stored);
  const swapsLeft = buysLeft(props.ut, 'swap', props.day, Date.now());
  return (
    <>
      <p className="ut-lede">Twelve scouted cards a day at fixed prices, the same for everyone. Each can be bought once; new cards at midnight Eastern.</p>
      <div className="ut-market">
        {items.map((it) => {
          const rc = props.pool.base.get(it.cardId);
          if (!rc) return null;
          const sold = bought.has(it.i);
          return (
            <button key={it.i} className={'ut-market-item' + (sold ? ' sold' : '')} disabled={sold} onClick={() => props.onMarket(it.i)} aria-label={(sold ? 'Bought: ' : 'Buy ') + rc.line.name + ' for ' + it.price + ' coins'}>
              <UtCard rc={rc} w={66} />
              <i className={'ut-market-tag t-' + it.tag}>{TAG[it.tag]}</i>
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
          <b className="disp">{SWAP_SIZE} duplicate golds → Scout’s Choice</b>
          <small>
            Trades your cheapest {SWAP_SIZE} spare golds from Duplicate Storage (never squad cards) for a pick of three {fcToDisplay(84, props.pool.sport)}+ golds. You have {dupes.length}. {swapsLeft} of 3 swaps left today.
          </small>
          {dupes.length > 0 && (
            <span className="ut-swap-cards" aria-hidden="true">
              {dupes.slice(0, SWAP_SIZE).map((c) => (
                <UtCard key={c.uid} rc={c.rc} w={34} />
              ))}
            </span>
          )}
        </span>
        <button className="btn primary" aria-disabled={dupes.length < SWAP_SIZE || !swapsLeft} onClick={props.onSwap}>
          SWAP
        </button>
      </div>
    </>
  );
}
