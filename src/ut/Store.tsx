// The store: packs to buy with coins (never real money), packs you've earned waiting to be opened,
// the free starter, and every pack's odds.
import React, { useState } from 'react';
import { Sheet } from '../ui/common';
import { Coin } from '../ui/icons';
import { PackArt } from './Hub';
import { IconInfo } from './icons';
import { type Odds, type PackDef, packName, positionChoices, STORE_ORDER } from './packs';
import { TIER_NAMES, TIER_ORDER } from './rate';
import type { PendingPack } from './state';
import type { UtSport } from './types';

const SHORT: Record<string, string> = { bronze: 'BRONZE', silver: 'SILVER', gold: 'GOLD', premium: 'PREMIUM', position: 'POSITION', starter: 'STARTER' };

function pct(p: number): string {
  return p >= 0.995 ? '100%' : p >= 0.1 ? Math.round(p * 100) + '%' : p >= 0.01 ? (Math.round(p * 1000) / 10).toString().replace(/\.0$/, '') + '%' : (Math.round(p * 10000) / 100).toString() + '%';
}

/** What a pack holds, slot by slot, and the chance of a promo or a legend in the whole pack. */
function OddsSheet({ def, onClose }: { def: PackDef; onClose: () => void }) {
  const rows = new Map<string, { o: Odds; n: number }>();
  for (const o of def.slots) {
    const k = JSON.stringify(o);
    const r = rows.get(k);
    if (r) r.n++;
    else rows.set(k, { o, n: 1 });
  }
  const any = (t: 'promo' | 'legend') => 1 - def.slots.reduce((a, o) => a * (1 - (o[t] ?? 0)), 1);
  return (
    <Sheet label={def.name + ' odds'} kind="center" onClose={onClose}>
      {(close) => (
        <div className="ut-odds">
          <h2 className="disp">{def.name}</h2>
          <p>{def.blurb}.</p>
          <div className="ut-odds-rows">
            {Array.from(rows.values()).map(({ o, n }, i) => (
              <div key={i} className="ut-odds-row">
                <b className="num">{n}×</b>
                <span>
                  {TIER_ORDER.filter((t) => (o[t] ?? 0) > 0)
                    .reverse()
                    .map((t) => (
                      <i key={t} className={'ut-tierchip t-' + t}>
                        {TIER_NAMES[t]} {pct(o[t]!)}
                      </i>
                    ))}
                </span>
              </div>
            ))}
          </div>
          {any('legend') > 0 && (
            <p className="note">
              Chance of a Hot Season card in this pack: {pct(any('promo'))}. Of a Legend: {pct(any('legend'))} (about 1 in {Math.round(1 / any('legend'))}).
            </p>
          )}
          <p className="note">Within a tier, lower overalls are more common: each point above the tier’s floor is a little rarer.</p>
          <button className="btn" onClick={() => close()}>
            CLOSE
          </button>
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
}) {
  const [odds, setOdds] = useState<PackDef | null>(null);
  const [choose, setChoose] = useState(false);
  const pos = props.defs.position;
  return (
    <div className="page ut-store">
      {(props.starter || props.pending.length > 0) && (
        <>
          <span className="eyebrow">Your packs</span>
          <div className="ut-mine">
            {props.starter && (
              <button className="ut-mine-pack" onClick={props.onStarter} aria-label="Open your free starter pack">
                <PackArt kind="starter" label="STARTER" sport={props.sport} small />
                <b>Starter</b>
                <i className="ut-open">OPEN</i>
              </button>
            )}
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
      <span className="eyebrow">Buy with coins</span>
      <div className="ut-shop">
        {STORE_ORDER.map((k) => {
          const d = props.defs[k];
          const short = props.coins < d.price;
          return (
            <div key={k} className={'ut-shopitem s-' + k}>
              <PackArt kind={k} label={SHORT[k]} sport={props.sport} small />
              <div className="ut-shop-txt">
                <strong>{props.sport === 'nfl' && k === 'position' ? 'Unit Pack' : d.name}</strong>
                <small>{props.sport === 'nfl' && k === 'position' ? d.slots.length + ' golds from the unit you pick' : d.blurb}</small>
                <button className="ut-oddsbtn" onClick={() => setOdds(d)} aria-label={d.name + ' odds'}>
                  <IconInfo size={13} /> Odds
                </button>
              </div>
              <button className={'btn ut-buy' + (short ? ' short' : ' gold')} aria-disabled={short} onClick={() => (k === 'position' ? (short ? props.onBuy(k, d.price) : setChoose(true)) : props.onBuy(k, d.price))}>
                <Coin size={14} />
                <span className="num">{d.price.toLocaleString('en-US')}</span>
              </button>
            </div>
          );
        })}
      </div>
      <p className="note">Coins only, never real money. Every game, mission, the daily chest and the challenges pay coins.</p>
      {odds && <OddsSheet def={odds} onClose={() => setOdds(null)} />}
      {choose && (
        <Sheet label="Pick a position" kind="bottom" onClose={() => setChoose(false)}>
          {(close) => (
            <div className="ut-choose">
              <h2 className="disp">{props.sport === 'nfl' ? 'Pick a unit' : 'Pick a position'}</h2>
              <p>
                {pos.slots.length} golds {props.sport === 'nfl' ? 'from that unit, its positions in the mix a squad needs' : 'at that position'}, for {pos.price.toLocaleString('en-US')} coins.
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
