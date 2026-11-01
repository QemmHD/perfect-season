// Claude, 2026-11-01 (wave 2): the Evolutions lab (Home → Development → Evolutions, and a card's
// details). Choose an evolution, see its eligibility caps and the whole chain's result on your card,
// play matches with him, then apply the upgrade.
import { Lede } from './ui';
import React, { useMemo, useState } from 'react';
import { Sheet } from '../ui/common';
import { UtCard } from './CardArt';
import { HQArrow } from './Clubhouse';
import { applyEvos, EVOS, evoBlock, evoById, evoOf, evoReady, MAX_ACTIVE_EVOS, type EvoDef } from './evolutions';
import type { Pool } from './pool';
import { fcToDisplay } from './fc-scale';
import type { UtState } from './state';
import type { ClubCard } from './UltimateTeam';

/** The rest of a chain from this evolution on (Rising Star I → II). */
function chainFrom(def: EvoDef): EvoDef[] {
  const out = [def];
  for (let k = 0; k < 5; k++) {
    const next = EVOS.find((e) => e.needs === out[out.length - 1].id);
    if (!next) break;
    out.push(next);
  }
  return out;
}

export function EvolutionsView(props: {
  pool: Pool;
  ut: UtState;
  club: ClubCard[];
  onStart: (uid: string, evoId: string) => void;
  onCancel: (uid: string) => void;
  onClaim: (uid: string) => void;
  onInspect: (uid: string) => void;
}) {
  const { pool, ut } = props;
  const [choose, setChoose] = useState<EvoDef | null>(null);
  const active = props.club.filter((c) => evoOf(ut, c.uid).active);
  const sport = pool.sport;
  return (
    <div className="page ut-evos">
      <Lede>Pick an evolution, play matches with the card, then apply the upgrade for good. Up to {MAX_ACTIVE_EVOS} at once; each has a ceiling below the top promos.</Lede>
      {active.length > 0 && (
        <>
          <span className="eyebrow">IN PROGRESS</span>
          {active.map((c) => {
            const e = evoOf(ut, c.uid);
            const def = evoById(e.active!.id)!;
            const ready = evoReady(e);
            return (
              <div key={c.uid} className={'ut-evo-run' + (ready ? ' ready' : '')}>
                <button className="ut-evo-card" onClick={() => props.onInspect(c.uid)} aria-label={'Details: ' + c.rc.line.name}>
                  <UtCard rc={c.rc} w={58} level={c.oc.level} />
                </button>
                <span className="ut-evo-txt">
                  <b>{def.title}</b>
                  <small>{c.rc.line.name}</small>
                  <small className="num">
                    Games {Math.min(def.games, e.active!.games)}/{def.games} · Wins {Math.min(def.wins, e.active!.wins)}/{def.wins}
                  </small>
                  <span className="bar">
                    <i style={{ width: (100 * (Math.min(def.games, e.active!.games) + Math.min(def.wins, e.active!.wins))) / (def.games + def.wins || 1) + '%' }} />
                  </span>
                </span>
                {ready ? (
                  <button className="btn gold" onClick={() => props.onClaim(c.uid)}>
                    APPLY
                  </button>
                ) : (
                  <button className="btn ut-evo-cancel" onClick={() => props.onCancel(c.uid)} aria-label={'Cancel ' + def.title}>
                    STOP
                  </button>
                )}
              </div>
            );
          })}
        </>
      )}
      <span className="eyebrow">AVAILABLE EVOLUTIONS</span>
      {EVOS.map((def) => {
        const chain = chainFrom(def);
        return (
          <div key={def.id} className="ut-evo-def">
            <span className="ut-evo-txt">
              <b className="disp">{def.title}</b>
              <small>{def.blurb}</small>
              <span className="ut-evo-reqs">
                <i>max OVR {fcToDisplay(def.maxOvr, sport)}</i>
                <i>{def.tiers.join(' / ')}</i>
                {def.needs && <i>after {evoById(def.needs)?.title}</i>}
                <i>
                  Play {def.games} · win {def.wins}
                </i>
                <i>
                  +{def.upgrade.ovr} OVR · cap {fcToDisplay(def.cap, sport)}
                </i>
              </span>
              {chain.length > 1 && <small className="ut-evo-chain">Chain: {chain.map((d) => d.title).join(' → ')}</small>}
            </span>
            <button className="btn primary" disabled={!!def.needs} onClick={() => setChoose(def)}>
              {def.needs ? 'CHAIN' : 'CHOOSE'}
            </button>
          </div>
        );
      })}
      <p className="note">A chain’s next step starts from its first step’s CHOOSE, once the previous step is applied to that card.</p>
      {choose && <ChooseCard def={choose} {...props} onClose={() => setChoose(null)} />}
    </div>
  );
}

function ChooseCard({ def, pool, ut, club, onStart, onClose }: { def: EvoDef; pool: Pool; ut: UtState; club: ClubCard[]; onStart: (uid: string, evoId: string) => void; onClose: () => void }) {
  const rows = useMemo(() => {
    const out: { c: ClubCard; next: EvoDef; block: string | null }[] = [];
    for (const c of club) {
      if (c.storage) continue;
      // the next step of this chain for this card (Rising Star II once I is applied)
      const done = evoOf(ut, c.uid).done;
      let next = def;
      for (const step of chainFrom(def)) if (!done.includes(step.id)) {
        next = step;
        break;
      }
      const block = evoBlock(ut, c.uid, c.rc, next, pool.sport);
      if (!block || block.startsWith('Needs')) out.push({ c, next, block });
    }
    return out.sort((a, b) => Number(!!a.block) - Number(!!b.block) || b.c.rc.ovr - a.c.rc.ovr).slice(0, 60);
  }, [def, club, ut, pool.sport]);
  return (
    <Sheet label={'Choose a player for ' + def.title} kind="bottom" onClose={onClose}>
      {(close) => (
        <div className="ut-evo-choose">
          <h2 className="disp">{def.title}</h2>
          <p>Eligible players and the result of the whole chain on each.</p>
          <div className="ut-evo-list" data-sheet-noswipe>
            {rows.map(({ c, next, block }) => {
              const end = applyEvos(c.rc, chainFrom(next).map((d) => d.id));
              return (
                <div key={c.uid} className="ut-evo-row">
                  <UtCard rc={c.rc} w={46} level={c.oc.level} />
                  <span className="ut-evo-arrow" aria-hidden="true">
                    <HQArrow />
                  </span>
                  <UtCard rc={end} w={46} level={c.oc.level} />
                  <span className="ut-evo-txt">
                    <b>{c.rc.line.name}</b>
                    <small>
                      {next.title} · {c.rc.ovr} → {end.ovr} after the chain
                    </small>
                  </span>
                  <button className="btn primary" disabled={!!block} onClick={() => close(() => (onClose(), onStart(c.uid, next.id)))}>
                    {block ? 'LOCKED' : 'START'}
                  </button>
                </div>
              );
            })}
            {!rows.length && <p className="note">No eligible players in your club right now.</p>}
          </div>
        </div>
      )}
    </Sheet>
  );
}
