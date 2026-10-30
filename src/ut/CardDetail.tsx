// A card up close: the big card (tilt it), its six key attributes and all the rest, its abilities,
// the season it stands for, its level, and quick-sell.
import React, { useState } from 'react';
import { CardSerial } from './CardSerial';
import { Confirm, Sheet } from '../ui/common';
import { Coin } from '../ui/icons';
import { UtCard } from './CardArt';
import { quickSellValue } from './packs';
import { seasonText } from './pool';
import { ABILITY_HELP, abilityName, attrName, NBA_ATTRS, TIER_NAMES } from './rate';
import { MAX_LEVEL, xpToNext } from './state';
import { cardStatLine as statLine } from './card-stats';
import type { UtSport } from './types';
import type { ClubCard } from './UltimateTeam';

const HONOR: Record<string, string> = {
  MVP: 'MVP',
  ALLNBA1: 'All-NBA 1st',
  ALLNBA2: 'All-NBA 2nd',
  ALLNBA3: 'All-NBA 3rd',
  ALLPRO1: 'All-Pro',
  ALLPRO2: 'All-Pro 2nd',
  PB: 'Pro Bowl',
  DPOY: 'Defensive POY',
  SCORING: 'Scoring title',
};

const height = (ht: number | null) => (ht ? Math.floor(ht / 12) + '′' + (ht % 12) + '″' : '');

function Bar({ v, max = 99 }: { v: number; max?: number }) {
  return (
    <span className={'ut-abar' + (v >= 90 ? ' elite' : v >= 80 ? ' good' : v >= 65 ? '' : ' low')}>
      <i style={{ width: Math.max(4, Math.min(100, (v / max) * 100)) + '%' }} />
    </span>
  );
}

export function CardDetail({ cc, sport, onUse, onSell, onClose }: { cc: ClubCard; sport: UtSport; onUse?: () => void; onSell: () => void; onClose: () => void }) {
  const [selling, setSelling] = useState(false);
  const { rc, oc } = cc;
  const l = rc.line;
  const value = quickSellValue(rc);
  const cap = rc.tier === 'goat' ? 110 : rc.tier === 'spotlight' ? 105 : 99;
  const keySet = new Set(rc.key.map(([c]) => c));
  const all = sport === 'nba' ? NBA_ATTRS.map(([c]) => c) : Object.keys(rc.attrs);
  const need = xpToNext(oc.level);
  const stats = statLine(l);
  return (
    <>
      <Sheet label={l.name} kind="bottom" onClose={onClose}>
        {(close) => (
          <div className="ut-detail">
            <div className="ut-detail-top">
              <span className="ut-detail-card">
                <UtCard rc={rc} w={150} level={oc.level} mint={oc.mint} numbered tilt />
              </span>
              <div className="ut-detail-id">
                <span className={'ut-tiername t-' + rc.tier}>{TIER_NAMES[rc.tier].toUpperCase()}</span>
                <strong>{l.name}</strong>
                <small>
                  {seasonText(l)} {l.teamName}
                </small>
                <small>
                  {l.pos.join(' / ')}
                  {l.num !== null ? ' · #' + l.num : ''}
                  {l.ht ? ' · ' + height(l.ht) : ''}
                  {l.wt ? ' ' + l.wt + ' lb' : ''}
                </small>
                {l.honors.length > 0 && (
                  <span className="ut-honors">
                    {l.honors.map((h) => (
                      <i key={h}>{HONOR[h] ?? h}</i>
                    ))}
                  </span>
                )}
                {cc.storage && <span className="ut-detail-slot">In Duplicate Storage · Level {oc.level}</span>}
                {cc.slot && <span className="ut-detail-slot">In your squad · {cc.slot}</span>}
              </div>
            </div>

            {oc.mint && <CardSerial mint={oc.mint} cardId={oc.cardId} sport={sport} />}
            <div className="ut-level">
              <span className="ut-level-pips" aria-hidden="true">
                {Array.from({ length: MAX_LEVEL }, (_, i) => (
                  <i key={i} className={i < oc.level ? 'on' : ''} />
                ))}
              </span>
              <span className="ut-level-txt">
                <b>Level {oc.level}</b>
                {oc.level < MAX_LEVEL ? (
                  <small>
                    {oc.xp}/{need} XP to level {oc.level + 1} (edition cap applies)
                  </small>
                ) : (
                  <small>Max level for this edition</small>
                )}
              </span>
              {oc.level < MAX_LEVEL && (
                <span className="bar">
                  <i style={{ width: Math.round((100 * oc.xp) / need) + '%' }} />
                </span>
              )}
            </div>
            <p className="note ut-xpnote">Cards earn XP in games. Each level improves key attributes and adds up to 1 overall, within the edition’s rating cap.</p>

            <div className="ut-keys">
              {rc.key.map(([c, n, v]) => (
                <span key={c} className="ut-key">
                  <b className="num">{v}</b>
                  <span>
                    <i>{c}</i>
                    <small>{n}</small>
                  </span>
                  <Bar v={v} max={cap} />
                </span>
              ))}
            </div>

            {rc.abil.length > 0 && (
              <>
                <span className="eyebrow">Abilities</span>
                <div className="ut-abils">
                  {rc.abil.map((a) => (
                    <span key={a} className="ut-abil">
                      <b>{abilityName(a)}</b>
                      {ABILITY_HELP[a] && <small>{ABILITY_HELP[a]}</small>}
                    </span>
                  ))}
                </div>
              </>
            )}

            {stats.length > 0 && (
              <>
                <span className="eyebrow">The {seasonText(l)} season</span>
                <div className="ut-stats">
                  {stats.map(([k, v]) => (
                    <span key={k}>
                      <b className="num">{v}</b>
                      <i>{k}</i>
                    </span>
                  ))}
                </div>
              </>
            )}

            <p className="note">
              {rc.ratingSource ? (
                <>
                  <a href={rc.ratingSource} target="_blank" rel="noreferrer">
                    {rc.line.ratingReference ? `${rc.line.sport === 'nba' ? '2K' : 'Madden'} ${rc.line.ratingReference.snapshot} benchmark` : 'Peak 2K reference'}
                  </a>{' '}
                  · Season-calibrated attributes, then edition and level boosts.
                </>
              ) : (
                'Attributes estimated from this season’s statistics, honors and player role.'
              )}
            </p>
            <span className="eyebrow">All attributes</span>
            <div className="ut-allattrs">
              {all.map((c) => (
                <span key={c} className={keySet.has(c) ? 'key' : ''}>
                  <i>{attrName(c)}</i>
                  <b className="num">{rc.attrs[c] ?? '—'}</b>
                  <Bar v={rc.attrs[c] ?? 0} max={cap} />
                </span>
              ))}
            </div>

            {onUse && (
              <button className="btn primary" onClick={() => close(onUse)}>
                USE THIS COPY IN CLUB
              </button>
            )}
            <div className="btnrow ut-detail-btns">
              <button className="btn" onClick={() => close()}>
                CLOSE
              </button>
              <button className="btn danger withicon" onClick={() => setSelling(true)}>
                QUICK SELL <Coin size={14} /> <span className="num">{value.toLocaleString('en-US')}</span>
              </button>
            </div>
          </div>
        )}
      </Sheet>
      {selling && (
        <Confirm
          title="Quick sell?"
          body={
            l.name +
            ' (' +
            seasonText(l) +
            ', ' +
            rc.ovr +
            ' overall' +
            (oc.level > 1 ? ', level ' + oc.level : '') +
            ') goes for ' +
            value.toLocaleString('en-US') +
            ' coins.' +
            (cc.slot ? ' He leaves your squad.' : '') +
            ' This can’t be undone.'
          }
          yes={'SELL · ' + value.toLocaleString('en-US')}
          no="KEEP"
          tone="gold"
          onYes={() => {
            setSelling(false);
            onClose();
            onSell();
          }}
          onNo={() => setSelling(false)}
        />
      )}
    </>
  );
}
