import { LeagueSeasonView } from './LeagueSeason';
import { startLeague } from './league';
import { favoriteFor } from '../lib/favorites';
import { Rivals } from './Rivals';
import { recordActivity, claimObjective, claimSeason, claimReadySeason, hqOf, objectiveDeck, rewardLabel, type Prize } from './progression';
import { PlayHQ, SeasonView, ObjectivesView, CircuitView, DevelopmentView, SquadPresets, ClubRecords } from './Clubhouse';
import { Moments } from './Moments';
import { claimMoment, finishMoment } from './moments';
import { startCircuit, abandonCircuit } from './circuit';
import { savePreset, loadPreset, startDevelopment, cancelDevelopment, claimDevelopment } from './club-management';
import './clubhouse.css';
// Ultimate Team: the mode's own screen, with its own tabs (home, play, squad, club, store, challenges).
// It keeps everything in the profile's `ut` (this sport's) and spends the profile's coins. The
// card pool loads when the screen opens. App.tsx only routes here (screen 'ut').
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { easternDateKey } from '../engine/season';
import { NFL, SPORT } from '../engine/sport';
import { newId, saveProfile, type Profile } from '../lib/profile';
import { reloadForMissingFiles } from '../lib/update';
import { sfx, vibrate } from '../lib/sound';
import { NET_ON } from '../net/nostr';
import { CoinChip } from '../ui/common';
import { Back } from '../ui/icons';
import { Battles } from './Battles';
import { CardDetail } from './CardDetail';
import { Challenges } from './Challenges';
import { Club } from './Club';
import { Hub } from './Hub';
import { IconClub, IconHub, IconPlay, IconSbc, IconSquad, IconStore } from './icons';
import { PackOpening } from './PackOpening';
import { openPack, packDefs, packName, quickSellValue } from './packs';
import type { PlaySquad } from './play';
import { getPool, type Pool, ratedOf } from './pool';
import { battlesThisWeek } from './battles';
import { checkSbc, rewardCard, type Sbc, sbcsFor, weekOf } from './sbc';
import { autoBuild, canPlay, type Lineup, rateSquad, slotsFor, startersComplete } from './squad';
import { SquadView } from './SquadView';
import type { UtState } from './state';
import { organizeStorage, removeCards, storedCards, useStoredCopy } from './storage';
import './storage.css';
import './content.css';
import { CollectionGallery } from './CollectionGallery';
import { Events } from './Events';
import { ownedCardsForPack } from './acquisition';
import { claimCollection } from './collection';
import { openRegisteredPack } from './registry';
import { registeredOpening } from './promo';
import { Store } from './Store';
import type { OwnedCard, RatedCard, CardMint } from './types';
// Claude 2026-11-01: UT content drop 2 (docs/UT-CONTENT-2.md)
import { trueRand } from '../engine/rng';
import { claimed, contentOf, isLocked, lockedSet, toggleLock, withClaim } from './content-state';
import { addPick, buysLeft, claimDaily, dailyPackId, dailyStatus, keepPick, pickFor, recordBuy, type LimitedKind } from './content-packs';
import { claimStandoutObjective, standoutObjectiveId } from './content-progress';
import { contentDone, contentSbcs } from './content-sbc';
import { autoDraft, chooseCaptain, claimDraft, DRAFT_PRICE, draftOf, draftPick, retireDraft, startDraft, tokenReady } from './draft-mode';
import { buyMarket, SWAP_SIZE, swapCandidates, swapForPick } from './market';
import { packTags, type HelperTag } from './pack-helper';
import { FEATURED_STANDOUT } from './packs';
import { claimSet } from './sets';
import { drawStandout } from './standouts';
import { PickSheet } from './PickSheet';
import { StandoutsView } from './StandoutsView';
import { SetsView } from './SetsView';
import { DraftView } from './DraftView';
import './content-ui.css';
import { claimNewEra, newEraPickId } from './new-era';
import { cancelEvo, claimEvo, playId, startEvo } from './evolutions';
import { EvolutionsView } from './EvolutionsView';
import { calendarStatus, claimCalendar, claimDailyBonus } from './daily-hub';
import { DailyHubView } from './DailyHubView';
import { claimAll, inboxCount, inboxItems } from './inbox';
import { InboxView } from './InboxView';
import { nextPreview, previewCards, previewId, PREVIEW_KIND, withPreviewSeed } from './preview-pack';
import { PreviewPack } from './PreviewPack';
import { submitStream } from './streamlined';
import { StreamlinedSection } from './StreamlinedView';
import { itemScore } from './item-score';
import { claimObjective as claimObjectiveFn } from './progression';

/** An owned card with its rating and where it plays (if it's in the squad). */
export interface ClubCard {
  uid: string;
  oc: OwnedCard;
  rc: RatedCard;
  slot: string | null;
  storage?: boolean;
}

export type UtView =
  | 'hub'
  | 'squad'
  | 'club'
  | 'store'
  | 'sbc'
  | 'battles'
  | 'rivals'
  | 'gallery'
  | 'events'
  | 'play'
  | 'season'
  | 'objectives'
  | 'league'
  | 'circuit'
  | 'moments'
  | 'development'
  | 'records'
  | 'standouts'
  | 'sets'
  | 'draft'
  | 'daily'
  | 'evolutions'
  | 'inbox';

/** the view to come back to after a match (the screen unmounts while it's played) */
let lastView: UtView = 'hub';

const TABS: [UtView, string, React.ReactNode][] = [
  ['hub', 'HOME', <IconHub />],
  ['play', 'PLAY', <IconPlay />],
  ['squad', 'SQUAD', <IconSquad />],
  ['club', 'CLUB', <IconClub />],
  ['store', 'STORE', <IconStore />],
  ['sbc', 'SBC', <IconSbc />]
];

export interface Opening {
  id: string;
  title: string;
  kind: string;
  cards: { uid: string; rc: RatedCard; mint?: CardMint }[];
  stored?: number;
  mint?: { serial: number; total: number };
  /** Claude: Pack Helper tags by copy uid (pack-helper.ts) */
  tags?: Record<string, HelperTag[]>;
}

export default function UltimateTeam(props: {
  profile: Profile;
  update: (fn: (p: Profile) => Profile) => void;
  onExit: () => void;
  onToast: (t: string) => void;
  /** play the squad: a Squad Battles rung, or online head to head (App.tsx opens Match.tsx) */
  onPlaySquad?: PlaySquad;
}) {
  const { profile, update, onToast } = props;
  const ut = profile.ut;
  const [pool, setPool] = useState<Pool | null>(null);
  const [failed, setFailed] = useState(false);
  const [view, setViewNow] = useState<UtView>(() => lastView);
  const setView = (v: UtView) => {
    lastView = v;
    setViewNow(v);
  };
  const [opening, setOpening] = useState<Opening | null>(null);
  const [showStorage, setShowStorage] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const busy = useRef(false);
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState('');
  const [promoRetry, setPromoRetry] = useState(0);
  const latest = useRef(profile);
  latest.current = profile;
  const [day, setDay] = useState(() => easternDateKey());
  useEffect(() => {
    const refresh = () => setDay(easternDateKey());
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const tries = useRef(0);
  const load = () => {
    setFailed(false);
    // a second miss: this build's card files are likely gone (a newer build is live), so reload
    if (tries.current++ >= 1 && reloadForMissingFiles()) return;
    getPool()
      .then(setPool)
      .catch(() => setFailed(true));
  };
  useEffect(load, []);

  const slotOf = useMemo(() => new Map(Object.entries(ut.squad).map(([s, u]) => [u, s])), [ut.squad]);
  const club: ClubCard[] = useMemo(() => {
    if (!pool) return [];
    const out: ClubCard[] = [];
    const stored = new Set(ut.duplicateStorage ?? []);
    for (const oc of ut.owned) {
      if (stored.has(oc.uid)) continue;
      // Claude wave 2: an evolved copy shows and plays as its evolved variant (evolutions.ts)
      const rc = ratedOf(pool, { cardId: playId(ut, oc), level: oc.level });
      if (rc) out.push({ uid: oc.uid, oc, rc, slot: slotOf.get(oc.uid) ?? null });
    }
    return out;
  }, [pool, ut.owned, ut.duplicateStorage, slotOf, ut.content?.evo]);
  const stored: ClubCard[] = useMemo(() => {
    if (!pool) return [];
    return storedCards(ut).flatMap((oc) => {
      const rc = ratedOf(pool, { cardId: playId(ut, oc), level: oc.level });
      return rc ? [{ uid: oc.uid, oc, rc, slot: null, storage: true }] : [];
    });
  }, [pool, ut.owned, ut.duplicateStorage, ut.content?.evo]);
  const inventory = useMemo(() => [...club, ...stored], [club, stored]);
  const byUid = useMemo(() => new Map(inventory.map((c) => [c.uid, c])), [inventory]);
  const lineup: Lineup = useMemo(() => Object.fromEntries(Object.entries(ut.squad).map(([s, u]) => [s, byUid.get(u)?.rc ?? null])), [ut.squad, byUid]);
  const rating = useMemo(() => rateSquad(SPORT, lineup), [lineup]);
  const sbcs = useMemo(() => (pool ? [...sbcsFor(pool, day, ut.sbc.done), ...contentSbcs(pool, weekOf(day))] : []), [pool, day, ut.sbc.done]);
  const sbcDone = useMemo(() => ({ ...ut.sbc.done, ...contentDone(ut, sbcs) }), [ut.sbc.done, ut.content?.claims, sbcs]);
  const [pickOpen, setPickOpen] = useState<string | null>(null);
  const ready = useMemo(() => startersComplete(SPORT, lineup), [lineup]);

  const setUt = (fn: (u: UtState) => UtState) => update((p) => ({ ...p, ut: organizeStorage(fn(p.ut)) }));

  const go = (v: UtView) => {
    if (v === view) return;
    sfx.click();
    setView(v);
  };

  // A pending request is persisted before contact. Retries recover the same server receipt.
  const startPromo = (kind: string, price: number, packId?: string) => {
    if (busy.current || promoBusy || ut.pendingPromo) {
      onToast('Finish your reserved pack in the Store first.');
      return;
    }
    if (profile.coins < price) {
      onToast('Not enough coins for this pack.');
      return;
    }
    busy.current = true;
    const pending = { id: newId(), kind, price, at: Date.now(), ...(packId ? { packId } : {}) };
    const next = { ...profile, ut: { ...ut, pendingPromo: pending } };
    if (!saveProfile(next)) {
      busy.current = false;
      onToast('Your phone could not save the pack request. Back up your progress and retry.');
      return;
    }
    setPromoError('');
    update((p) => ({ ...p, ut: { ...p.ut, pendingPromo: pending } }));
  };
  useEffect(() => {
    const pending = ut.pendingPromo;
    if (!pool || !pending) return;
    let live = true;
    setPromoBusy(true);
    setPromoError('');
    void openRegisteredPack(SPORT, pending.id, pending.kind)
      .then((receipt) => {
        if (!live) return;
        const preview = registeredOpening(pool, latest.current, receipt);
        update((p) => registeredOpening(pool, p, receipt).profile);
        if (preview.opening) setOpening(preview.opening);
        busy.current = false;
        setPromoBusy(false);
      })
      .catch((e) => {
        if (live) {
          busy.current = false;
          setPromoBusy(false);
          setPromoError(e instanceof Error ? e.message : 'Retry to recover your reserved pack.');
        }
      });
    return () => {
      live = false;
    };
  }, [pool, ut.pendingPromo?.id, promoRetry]);

  const claimPrize = (get: (u: UtState) => Prize) => {
    const shown = get(latest.current.ut);
    if (shown.ut === latest.current.ut) return;
    update((p) => {
      const r = get(p.ut);
      return { ...p, coins: p.coins + r.coins, ut: r.ut };
    });
    sfx.coin();
    onToast(
      'Reward claimed. ' +
        [rewardLabel({ coins: shown.coins, pack: shown.pack ?? undefined, sp: shown.sp }), shown.packCount ? shown.packCount + ' packs added to your Store' : '']
          .filter(Boolean)
          .join(' · ')
    );
  };

  // ---------- packs ----------

  /** Open a pack now: its cards go into the club at once (closing the app mid-reveal keeps them).
   * `fill`: an empty squad is built from the club, these cards included (the starter pack). */
  const openNow = (kind: string, seed: string, title: string, also?: (p: Profile) => Profile, fill = false, guard?: (p: Profile) => boolean, preset?: RatedCard[]) => {
    // Claude: a reserved Spotlight pack only holds other packs while its registry request is in
    // flight. Before, one failed request (offline, a dropped connection) blocked every pack, the
    // starter and reward packs included, until the registry answered. The reservation itself, its
    // same-ID retry and the charge-on-arrival rule are unchanged.
    if (!pool || busy.current || promoBusy) {
      if (promoBusy) onToast('Your Spotlight pack is registering. Try again in a moment.');
      return;
    }
    busy.current = true;
    window.setTimeout(() => (busy.current = false), 600);
    // truly random cards (`seed` only names the pack and its cards' ids)
    // Claude: a Preview Pack opens exactly the cards it showed
    const cards = preset ?? openPack(pool, kind);
    const at = Date.now();
    const owned = ownedCardsForPack(cards, seed, at);
    const helper = packTags(pool, ut, lineup, cards);
    update((p) => {
      if (guard && !guard(p)) return p;
      const deposited = organizeStorage(recordActivity(p.ut, 'pack:' + seed, easternDateKey(), { packs: 1 }), owned);
      const empty = fill && !Object.keys(deposited.squad).length;
      const squad = empty
        ? autoBuild(
            SPORT,
            deposited.owned
              .filter((oc) => !deposited.duplicateStorage?.includes(oc.uid))
              .flatMap((oc) => {
                const rc = ratedOf(pool, oc);
                return rc ? [{ uid: oc.uid, rc }] : [];
              })
          )
        : deposited.squad;
      const q = { ...p, ut: { ...deposited, squad, packsOpened: p.ut.packsOpened + 1 } };
      return also ? also(q) : q;
    });
    const stored = new Set(organizeStorage(ut, owned).duplicateStorage);
    setOpening({
      id: seed,
      title,
      kind,
      stored: owned.filter((c) => stored.has(c.uid)).length,
      cards: cards.map((rc, i) => ({ uid: owned[i].uid, rc })),
      tags: Object.fromEntries(owned.map((c, i) => [c.uid, helper[i]])),
    });
  };

  // ---------- Claude: content drop 2 (Daily Drop, new packs, picks, market, sets, draft) ----------

  const week = weekOf(day);
  const LIMITED: LimitedKind[] = ['elite', 'jumbo', 'standout', 'lightning'];

  const claimDailyDrop = () => {
    const at = Date.now();
    const shown = claimDaily(ut, day, at);
    if (!shown) {
      onToast('Today’s Daily Drop is claimed. A new one arrives at midnight Eastern.');
      return;
    }
    sfx.coin();
    openNow(
      'daily',
      dailyPackId(SPORT, day),
      'Daily Drop · Day ' + shown.streak,
      (p) => {
        const r = claimDaily(p.ut, day, at);
        return r ? { ...p, ut: r.ut } : p;
      },
      false,
      (p) => dailyStatus(p.ut, day).ready
    );
    if (shown.gold) window.setTimeout(() => onToast('Day 7 streak! A Gold Pack is waiting in your Store.'), 400);
  };

  const buyLimited = (kind: LimitedKind, price: number) => {
    const at = Date.now();
    if (buysLeft(ut, kind, day, at) <= 0) {
      sfx.nope();
      onToast(kind === 'lightning' ? 'The Lightning window is closed. It opens on weekend afternoons and evenings.' : 'You’ve reached this pack’s limit. It resets ' + (kind === 'standout' || kind === 'scout' ? 'next week.' : 'tomorrow.'));
      return;
    }
    if (profile.coins < price) {
      sfx.nope();
      onToast('Not enough coins yet: ' + (price - profile.coins).toLocaleString('en-US') + ' more.');
      return;
    }
    sfx.coin();
    openNow(
      kind,
      newId(),
      packName(SPORT, kind),
      (p) => ({ ...p, coins: p.coins - price, ut: recordBuy(p.ut, kind, day, at) }),
      false,
      (p) => p.coins >= price && buysLeft(p.ut, kind, day, at) > 0
    );
  };

  const buyScout = (price: number) => {
    if (!pool) return;
    const at = Date.now();
    if (buysLeft(ut, 'scout', day, at) <= 0) return onToast('Three Scout’s Choice picks a week. More next week.');
    if (profile.coins < price) {
      sfx.nope();
      return onToast('Not enough coins yet: ' + (price - profile.coins).toLocaleString('en-US') + ' more.');
    }
    const id = 'scout:' + newId();
    const pick = pickFor(pool, 'scout', id, week, at);
    sfx.coin();
    update((p) => (p.coins < price || buysLeft(p.ut, 'scout', day, at) <= 0 ? p : { ...p, coins: p.coins - price, ut: addPick(recordBuy(p.ut, 'scout', day, at), pick) }));
    setPickOpen(id);
  };

  const keep = (id: string, index: number) => {
    if (!pool) return;
    const at = Date.now();
    const pick = contentOf(latest.current.ut).picks?.find((x) => x.id === id);
    const shown = keepPick(latest.current.ut, id, index, at);
    if (!shown.card || !pick) return;
    update((p) => ({ ...p, ut: keepPick(p.ut, id, index, at).ut }));
    setPickOpen(null);
    const rc = ratedOf(pool, shown.card);
    sfx.levelUp();
    if (rc) setOpening({ id: 'pick:' + id, title: pick.title, kind: 'reward', cards: [{ uid: shown.card.uid, rc }] });
  };

  const buyFromMarket = (i: number) => {
    if (!pool) return;
    const at = Date.now();
    const shown = buyMarket(ut, pool, day, i, profile.coins, at);
    if (!shown) {
      sfx.nope();
      return onToast('Not enough coins for this card yet.');
    }
    update((p) => {
      const r = buyMarket(p.ut, pool, day, i, p.coins, at);
      return r ? { ...p, coins: p.coins - r.price, ut: r.ut } : p;
    });
    sfx.coin();
    const rc = ratedOf(pool, shown.card);
    if (rc) setOpening({ id: shown.card.uid, title: 'Scout Market', kind: 'reward', cards: [{ uid: shown.card.uid, rc }] });
  };

  const swap = () => {
    if (!pool) return;
    const locked = lockedSet(ut);
    const uids = swapCandidates(stored.filter((c) => !locked.has(c.uid)))
      .slice(0, SWAP_SIZE)
      .map((c) => c.uid);
    const at = Date.now();
    const id = newId();
    if (!swapForPick(ut, pool, uids, id, day, at)) return onToast('The Swap Desk takes five duplicate golds from storage, three times a day.');
    update((p) => {
      const r = swapForPick(p.ut, pool, uids, id, day, at);
      return r ? { ...p, ut: r } : p;
    });
    sfx.select();
    setPickOpen('swap:' + id);
  };

  const claimSetReward = (id: string) => {
    if (!pool) return;
    const at = Date.now();
    const shown = claimSet(pool, latest.current.ut, id, at);
    if (!shown.coins && !shown.pack) return;
    update((p) => {
      const r = claimSet(pool, p.ut, id, at);
      return { ...p, coins: p.coins + r.coins, ut: r.ut };
    });
    sfx.levelUp();
    onToast('Set complete! +' + shown.coins.toLocaleString('en-US') + ' coins' + (shown.pack ? ' and a ' + packName(SPORT, shown.pack) + ' in your Store.' : '.'));
  };

  const claimNewEraBundle = () => {
    if (!pool) return;
    const at = Date.now();
    const shown = claimNewEra(latest.current, pool, at);
    if (shown === latest.current) return;
    update((p) => claimNewEra(p, pool, at));
    sfx.levelUp();
    vibrate([20, 40, 20]);
    if (shown.coins > latest.current.coins) onToast('+' + (shown.coins - latest.current.coins).toLocaleString('en-US') + ' coins. Now choose your Icon.');
    setPickOpen(newEraPickId(SPORT));
  };

  // ---------- Claude wave 2: daily hub, preview pack, streams, evolutions, inbox ----------

  const claimCalendarDay = () => {
    if (!pool) return;
    const at = Date.now();
    const shown = claimCalendar(latest.current.ut, pool, day, at);
    if (!shown) return;
    update((p) => {
      const r = claimCalendar(p.ut, pool, day, at);
      return r ? { ...p, coins: p.coins + r.coins, ut: r.ut } : p;
    });
    sfx.coin();
    if (shown.reward.pick) setPickOpen('calendar:' + SPORT + ':' + day);
    else onToast('Login calendar day ' + shown.reward.day + ': ' + shown.reward.label + (shown.reward.pack ? ' (in your Store)' : '') + '.');
  };

  const claimBonus = () => {
    const at = Date.now();
    const shown = claimDailyBonus(latest.current.ut, SPORT, day, at);
    if (!shown) return;
    update((p) => {
      const r = claimDailyBonus(p.ut, SPORT, day, at);
      return r ? { ...p, coins: p.coins + r.coins, ut: r.ut } : p;
    });
    sfx.levelUp();
    onToast('All three done! +' + shown.coins + ' coins and a Silver Pack in your Store.');
  };

  const startPreview = () => setUt((u) => withPreviewSeed(u, newId().replace(/-/g, '').slice(0, 12)));
  const buyPreview = () => {
    if (!pool) return;
    const id = previewId(ut);
    const price = packDefs(SPORT)[PREVIEW_KIND].price;
    if (!id) return;
    if (profile.coins < price) {
      sfx.nope();
      return onToast('Not enough coins yet: ' + (price - profile.coins).toLocaleString('en-US') + ' more.');
    }
    const cards = previewCards(pool, ut, week);
    const at = Date.now();
    sfx.coin();
    openNow(PREVIEW_KIND, id, 'Preview Pack', (p) => ({ ...p, coins: p.coins - price, ut: nextPreview(p.ut, true, at) }), false, (p) => p.coins >= price && previewId(p.ut) === id, cards);
  };
  const skipPreview = () => {
    const at = Date.now();
    setUt((u) => nextPreview(u, false, at));
    onToast('Skipped. Your next preview is ready in an hour.');
  };

  const submitStreamCards = (id: string, uids: string[]) => {
    if (!pool) return;
    const score = (uid: string) => {
      const c = byUid.get(uid);
      return c ? itemScore(c.rc) : null;
    };
    const at = Date.now();
    const shown = submitStream(latest.current.ut, pool, id, uids, score, at);
    if (!shown) return onToast('Those cards can’t go in (locked or playing in your squad).');
    update((p) => {
      const r = submitStream(p.ut, pool, id, uids, score, at);
      return r ? { ...p, ut: r.ut } : p;
    });
    sfx.levelUp();
    onToast('+' + shown.points.toLocaleString('en-US') + ' points.' + (shown.rewards ? ' ' + shown.rewards + (shown.rewards === 1 ? ' reward' : ' rewards') + ' in your Store!' : ''));
  };

  const inbox = pool ? inboxItems(pool, profile, day, week) : [];
  const inboxReady = pool ? inboxCount(pool, profile, day, week) : 0;
  const claimEverything = () => {
    if (!pool) return;
    const at = Date.now();
    const shown = claimAll(pool, latest.current, day, week, at);
    if (!shown.claimed) return;
    update((p) => claimAll(pool, p, day, week, at).profile);
    sfx.levelUp();
    vibrate([20, 40, 20]);
    onToast('Claimed ' + shown.claimed + (shown.claimed === 1 ? ' reward' : ' rewards') + (shown.coins ? ' · +' + shown.coins.toLocaleString('en-US') + ' coins' : '') + '. Packs and picks are in your Store.');
  };

  const claimObjectivePick = () => {
    if (!pool) return;
    const at = Date.now();
    update((p) => ({ ...p, ut: claimStandoutObjective(p.ut, pool, week, at) }));
    sfx.levelUp();
    setPickOpen(standoutObjectiveId(week));
  };

  const buy = (kind: string, price: number) => {
    if (kind === 'spotlight') return startPromo(kind, packDefs(SPORT).spotlight.price);
    if (kind === 'daily') return claimDailyDrop();
    if (kind === 'scout') return buyScout(packDefs(SPORT).scout.price);
    if ((LIMITED as string[]).includes(kind)) return buyLimited(kind as LimitedKind, packDefs(SPORT)[kind as LimitedKind & keyof ReturnType<typeof packDefs>].price);
    if (profile.coins < price) {
      sfx.nope();
      onToast('Not enough coins yet: ' + (price - profile.coins).toLocaleString('en-US') + ' more. Games, missions and challenges all pay.');
      return;
    }
    sfx.coin();
    openNow(kind, newId(), packName(SPORT, kind), (p) => ({ ...p, coins: p.coins - price }));
  };

  const claimStarter = () => {
    if (ut.starterClaimed) return;
    sfx.click();
    // a card for every spot: they go straight into the squad (if it's still empty)
    openNow('starter', newId(), 'Starter Pack', (p) => ({ ...p, ut: { ...p.ut, starterClaimed: true } }), true);
  };

  const openPending = (id: string) => {
    const pp = ut.packs.find((x) => x.id === id);
    if (!pp) return;
    if (pp.kind.startsWith('event-spotlight:') || pp.kind === 'spotlight') return startPromo(pp.kind, 0, pp.id);
    // Claude: a reward Scout's Choice / Standout pick becomes a pick sheet (its id is the pack's)
    if ((pp.kind === 'scout' || pp.kind === 'standout-pick') && pool) {
      const pick = pickFor(pool, pp.kind, pp.id, week, Date.now());
      update((p) => (p.ut.packs.some((x) => x.id === id) ? { ...p, ut: addPick({ ...p.ut, packs: p.ut.packs.filter((x) => x.id !== id) }, pick) } : p));
      sfx.click();
      setPickOpen(pp.id);
      return;
    }
    sfx.click();
    openNow(pp.kind, pp.id, packName(SPORT, pp.kind), (p) => ({ ...p, ut: { ...p.ut, packs: p.ut.packs.filter((x) => x.id !== id) } }));
  };

  // ---------- the club ----------

  const quickSell = (uids: string[]) => {
    // Claude: a locked (favourite) copy is never sold
    const locked = lockedSet(ut);
    const cards = [...new Set(uids)].filter((u) => !locked.has(u)).map((u) => byUid.get(u)).filter((c): c is ClubCard => !!c);
    if (!cards.length) {
      if (uids.some((u) => locked.has(u))) onToast('Locked cards can’t be sold. Unlock them in the card’s details first.');
      return;
    }
    const coins = cards.reduce((a, c) => a + quickSellValue(c.rc), 0);
    const gone = new Set(cards.map((c) => c.uid));
    update((p) => {
      const current = new Set(p.ut.owned.map((c) => c.uid));
      const sold = cards.filter((c) => current.has(c.uid) && !isLocked(p.ut, c.uid));
      if (!sold.length) return p;
      const proceeds = sold.reduce((sum, c) => sum + quickSellValue(c.rc), 0);
      return {
        ...p,
        coins: p.coins + proceeds,
        ut: {
          ...removeCards(p.ut, gone, 'sold'),
          sold: { cards: p.ut.sold.cards + sold.length, coins: p.ut.sold.coins + proceeds }
        }
      };
    });
    sfx.coin();
    onToast('Sold ' + (cards.length === 1 ? cards[0].rc.line.name : cards.length + ' cards') + ' for ' + coins.toLocaleString('en-US') + ' coins.');
  };

  // ---------- the squad ----------

  /** Put a card in a slot (or empty it). A card already elsewhere in the squad swaps places. */
  const setSlot = (slot: string, uid: string | null) => {
    const slots = slotsFor(SPORT);
    setUt((u) => {
      const sq = { ...u.squad };
      const cur = sq[slot];
      const from = uid ? Object.keys(sq).find((k) => sq[k] === uid) : undefined;
      if (uid) sq[slot] = uid;
      else delete sq[slot];
      if (from && from !== slot) {
        const back = cur ? byUid.get(cur) : undefined;
        const fromDef = slots.find((s) => s.id === from);
        if (back && fromDef && canPlay(fromDef, back.rc)) sq[from] = cur!;
        else delete sq[from];
      }
      return { ...u, squad: sq };
    });
  };

  const setSquad = (squad: Record<string, string>) => setUt((u) => ({ ...u, squad }));

  // ---------- challenges ----------

  const submitSbc = (s: Sbc, uids: string[]) => {
    if (!pool || sbcDone[s.id]) return;
    const selected = uids.map((uid) => byUid.get(uid));
    if (
      new Set(uids).size !== uids.length ||
      selected.some((c) => !c) ||
      !checkSbc(
        s,
        selected.map((c) => c!.rc)
      ).ok
    )
      return;
    const gone = new Set(uids);
    const week = weekOf(day);
    const content = s.kind === 'standout' || s.kind === 'landmark';
    const rc = s.reward.card ? rewardCard(pool, s.reward.card) : s.reward.standout ? drawStandout(pool, week, trueRand(), FEATURED_STANDOUT) : s.reward.cardId ? (pool.base.get(s.reward.cardId) ?? null) : null;
    const prize: OwnedCard | null = rc ? { uid: 'sbc' + newId().replace(/-/g, '').slice(0, 8), cardId: rc.line.id, level: 1, xp: 0, at: Date.now() } : null;
    const pack = s.reward.pack ? { id: newId(), kind: s.reward.pack, at: Date.now() } : null;
    update((p) => {
      const current = new Set(p.ut.owned.map((c) => c.uid));
      if (p.ut.sbc.done[s.id] || (content && claimed(p.ut, 'sbc:' + s.id)) || uids.some((uid) => isLocked(p.ut, uid)) || uids.some((uid) => !current.has(uid))) return p;
      // only this day's and week's challenges need remembering
      const done = Object.fromEntries(Object.entries(p.ut.sbc.done).filter(([k]) => k.includes(day) || k.includes(week)));
      done[s.id] = Date.now();
      return {
        ...p,
        coins: p.coins + (s.reward.coins ?? 0),
        ut: {
          ...organizeStorage(removeCards(recordActivity(content ? withClaim(p.ut, 'sbc:' + s.id) : p.ut, 'sbc:' + s.id, easternDateKey(), { sbcs: 1 }, 50), gone, 'sbc'), prize ? [prize] : []),
          sbc: { done },
          packs: pack ? [...p.ut.packs, pack] : p.ut.packs
        }
      };
    });
    sfx.levelUp();
    vibrate([20, 40, 20]);
    if (rc && prize) setOpening({ id: 'sbc:' + s.id, title: s.title, kind: 'reward', cards: [{ uid: prize.uid, rc }] });
    else
      onToast(s.title + ' done!' + (pack ? ' Your ' + packName(SPORT, pack.kind) + ' is waiting in the Store.' : '') + (s.reward.coins ? ' +' + s.reward.coins + ' coins.' : ''));
  };

  const detailCard = detail ? (byUid.get(detail) ?? null) : null;
  // (the upgrades and repeatables are always there: they don't count toward what's left to do)
  const todo = sbcs.filter((s) => s.kind !== 'upgrade' && !sbcDone[s.id]).length;

  let body: React.ReactNode;
  if (failed)
    body = (
      <div className="ut-loading">
        <p>The cards didn’t load.</p>
        <button className="btn primary" onClick={load}>
          TRY AGAIN
        </button>
      </div>
    );
  else if (!pool)
    body = (
      <div className="ut-loading" role="status">
        <span className="ut-spinner" aria-hidden="true" />
        <p>Loading {NFL ? 'football' : 'basketball'} cards…</p>
      </div>
    );
  else if (view === 'squad')
    body = (
      <SquadView
        pool={pool}
        club={club}
        lineup={lineup}
        squad={ut.squad}
        rating={rating}
        onSlot={setSlot}
        onSquad={setSquad}
        onInspect={setDetail}
        onToast={onToast}
        management={
          <SquadPresets
            ut={ut}
            pool={pool}
            onSave={(id, name) => {
              setUt((u) => savePreset(u, id, name, Date.now()));
              onToast('Current squad saved. Every card stays in your club.');
            }}
            onLoad={(id) => {
              setUt((u) => loadPreset(u, pool, id));
              onToast('Saved lineup loaded using your owned copies.');
            }}
          />
        }
      />
    );
  else if (view === 'play')
    body = (
      <PlayHQ
        ut={ut}
        onGo={go}
        onOnline={() => {
          if (!props.onPlaySquad || !NET_ON) {
            sfx.nope();
            onToast('Head to head needs a connection.');
            return;
          }
          if (!ready) {
            onToast('Fill your starting squad first.');
            go('squad');
            return;
          }
          props.onPlaySquad?.({ id: Date.now(), mode: 'online' });
        }}
      />
    );
  else if (view === 'season')
    body = (
      <SeasonView
        ut={ut}
        day={day}
        sport={SPORT}
        onStore={() => go('store')}
        onClaim={(period, tier) => {
          const at = Date.now();
          claimPrize((u) => claimSeason(u, period, tier, at));
        }}
        onClaimReady={(period) => {
          const at = Date.now();
          claimPrize((u) => claimReadySeason(u, period, at));
        }}
      />
    );
  else if (view === 'objectives')
    body = (
      <ObjectivesView
        ut={ut}
        day={day}
        onClaim={(id) => {
          const at = Date.now();
          claimPrize((u) => claimObjective(u, id, day, at));
        }}
        onClaimAll={() => {
          const at = Date.now();
          claimPrize((u) => {
            let next = u,
              coins = 0,
              sp = 0;
            for (const o of objectiveDeck(u, day))
              if (!o.claimed && o.progress >= o.target) {
                const r = claimObjective(next, o.id, day, at);
                next = r.ut;
                coins += r.coins;
                sp += r.sp;
              }
            return {
              ut: next,
              coins,
              sp,
              pack: null,
              packCount: next.packs.length - u.packs.length
            };
          });
        }}
      />
    );
  else if (view === 'league')
    body = (
      <LeagueSeasonView
        ut={ut}
        pool={pool}
        ready={ready}
        clubOvr={rating.ovr}
        onSquad={() => go('squad')}
        onStart={(level) => {
          const id = newId(),
            at = Date.now();
          try {
            setUt((u) =>
              startLeague(
                u,
                pool,
                id,
                at,
                rating.ovr,
                level,
                favoriteFor(SPORT)
              )
            );
          } catch {
            onToast(
              'The season could not start. Your club was kept. Please try again.'
            );
          }
        }}
        onPlay={(league) =>
          props.onPlaySquad?.({ id: Date.now(), mode: 'ai', league })
        }
      />
    );
  else if (view === 'circuit')
    body = (
      <CircuitView
        ut={ut}
        week={weekOf(day)}
        ready={ready}
        onSquad={() => go('squad')}
        onStart={() => {
          const id = newId(),
            at = Date.now();
          setUt((u) => startCircuit(u, weekOf(day), id, at));
        }}
        onPlay={(runId, round) =>
          props.onPlaySquad?.({
            id: Date.now(),
            mode: 'ai',
            circuit: { runId, round }
          })
        }
        onEnd={() => setUt(abandonCircuit)}
      />
    );
  else if (view === 'moments')
    body = (
      <Moments
        pool={pool}
        ut={ut}
        ready={ready}
        onSquad={() => go('squad')}
        onFinish={(m, attempts) => {
          const at = Date.now();
          setUt((u) => finishMoment(u, m, attempts, at));
        }}
        onClaim={(id) => {
          const at = Date.now();
          claimPrize((u) => claimMoment(u, SPORT, id, day, at));
        }}
      />
    );
  else if (view === 'development')
    body = (
      <DevelopmentView
        ut={ut}
        club={inventory}
        onUseCopy={(uid) => {
          setUt((u) => useStoredCopy(u, uid));
          onToast(
            'Your development copy is back in the club. Its XP and serial are kept.'
          );
        }}
        onSquad={() => go('squad')}
        onEvolutions={() => go('evolutions')}
        onStart={(uid, path) => {
          const at = Date.now();
          setUt((u) => startDevelopment(u, uid, path, at));
        }}
        onCancel={() => setUt(cancelDevelopment)}
        onClaim={() => {
          const at = Date.now();
          const shown = claimDevelopment(latest.current.ut, day, at);
          if (!shown.xp) return;
          setUt((u) => claimDevelopment(u, day, at).ut);
          sfx.levelUp();
          onToast(
            'Program complete. +' +
              shown.xp +
              ' card XP and +' +
              shown.sp +
              ' Season Points.'
          );
        }}
      />
    );
  else if (view === 'records') body = <ClubRecords ut={ut} />;
  else if (view === 'daily')
    body = (
      <DailyHubView
        ut={ut}
        day={day}
        sport={SPORT}
        onDrop={claimDailyDrop}
        onCalendar={claimCalendarDay}
        onObjective={(id) => {
          const at = Date.now();
          claimPrize((u) => claimObjectiveFn(u, id, day, at));
        }}
        onBonus={claimBonus}
      />
    );
  else if (view === 'inbox') body = <InboxView items={inbox} onClaimAll={claimEverything} onStore={() => go('store')} onDaily={() => go('daily')} />;
  else if (view === 'evolutions')
    body = (
      <EvolutionsView
        pool={pool}
        ut={ut}
        club={inventory}
        onInspect={setDetail}
        onStart={(uid, evoId) => {
          const c = byUid.get(uid);
          if (!c) return;
          const at = Date.now();
          setUt((u) => startEvo(u, pool, uid, c.rc, evoId, at));
          sfx.select();
          onToast('Evolution started. Play matches with ' + c.rc.line.name + ' in your squad.');
        }}
        onCancel={(uid) => setUt((u) => cancelEvo(u, uid))}
        onClaim={(uid) => {
          setUt((u) => claimEvo(u, uid));
          sfx.levelUp();
          vibrate([20, 40, 20]);
          onToast('Evolution applied. The upgrade is permanent.');
        }}
      />
    );
  else if (view === 'standouts')
    body = <StandoutsView pool={pool} ut={ut} week={week} sbcDone={!!sbcDone['so:' + week]} onGo={go} onClaim={claimObjectivePick} />;
  else if (view === 'sets') body = <SetsView pool={pool} ut={ut} onClaim={claimSetReward} onSbc={() => go('sbc')} />;
  else if (view === 'draft')
    body = (
      <DraftView
        pool={pool}
        ut={ut}
        week={week}
        coins={profile.coins}
        onStart={(paid) => {
          if (draftOf(ut)) return;
          if (paid === 'coins' && profile.coins < DRAFT_PRICE) {
            sfx.nope();
            return onToast('Not enough coins yet: ' + (DRAFT_PRICE - profile.coins) + ' more.');
          }
          if (paid === 'token' && !tokenReady(ut, week)) return;
          const id = newId(),
            at = Date.now();
          sfx.coin();
          update((p) => {
            if (draftOf(p.ut) || (paid === 'coins' && p.coins < DRAFT_PRICE) || (paid === 'token' && !tokenReady(p.ut, week))) return p;
            return { ...p, coins: p.coins - (paid === 'coins' ? DRAFT_PRICE : 0), ut: startDraft(p.ut, pool, id, at, week, paid) };
          });
        }}
        onCaptain={(i) => (sfx.select(), setUt((u) => chooseCaptain(u, pool, i)))}
        onPick={(i) => (sfx.select(), setUt((u) => draftPick(u, pool, i)))}
        onAuto={() => (sfx.select(), setUt((u) => autoDraft(u, pool)))}
        onRetire={() => setUt(retireDraft)}
        onPlay={(runId, game) => props.onPlaySquad?.({ id: Date.now(), mode: 'ai', draft: { runId, game } })}
        onClaim={() => {
          const at = Date.now();
          const shown = claimDraft(latest.current.ut, at);
          if (!shown.coins && !shown.pack) return;
          update((p) => {
            const r = claimDraft(p.ut, at);
            return { ...p, coins: p.coins + r.coins, ut: r.ut };
          });
          sfx.levelUp();
          onToast('Draft rewards: ' + [shown.pack ? packName(SPORT, shown.pack) + ' in your Store' : '', shown.coins ? '+' + shown.coins + ' coins' : ''].filter(Boolean).join(' · '));
        }}
      />
    );
  else if (view === 'club')
    body = (
      <div className="ut-collection-shell">
        <div
          className="ut-storage-tabs"
          role="group"
          aria-label="Card location"
        >
          <button
            aria-pressed={!showStorage}
            onClick={() => setShowStorage(false)}
          >
            CLUB <b className="num">{club.length}</b>
          </button>
          <button
            aria-pressed={showStorage}
            onClick={() => setShowStorage(true)}
          >
            DUPLICATE STORAGE <b className="num">{stored.length}</b>
          </button>
        </div>
        <Club
          key={showStorage ? 'storage' : 'club'}
          club={showStorage ? stored : club}
          storage={showStorage}
          onInspect={setDetail}
          onSell={quickSell}
        />
      </div>
    );
  else if (view === 'gallery')
    body = (
      <CollectionGallery
        pool={pool}
        ut={ut}
        onSets={() => go('sets')}
        onClaim={(id) => {
          update((p) => {
            const result = claimCollection(pool, p.ut, id, Date.now());
            return { ...p, coins: p.coins + result.coins, ut: result.ut };
          });
        }}
      />
    );
  else if (view === 'events')
    body = (
      <Events
        pool={pool}
        ut={ut}
        ready={ready}
        onSquad={() => go('squad')}
        onPlay={(id, node) =>
          props.onPlaySquad?.({
            id: Date.now(),
            mode: 'ai',
            event: { id, node }
          })
        }
      />
    );
  else if (view === 'store')
    body = (
      <>
        <div className="ut-registry-status" aria-live="polite">
          {ut.pendingPromo && (
            <>
              <b>
                {promoBusy
                  ? 'Registering your pack…'
                  : 'Your pack is reserved.'}
              </b>
              <p>
                {promoError ||
                  'Your pull is being checked and saved. Coins are charged once when the cards arrive.'}
                {!promoBusy && ' Your other packs still open normally.'}
              </p>
              {!promoBusy && (
                <button
                  className="btn primary"
                  onClick={() => setPromoRetry((n) => n + 1)}
                >
                  RETRY SAME PACK
                </button>
              )}
            </>
          )}
        </div>
        <Store
          sport={SPORT}
          coins={profile.coins}
          starter={!ut.starterClaimed}
          pending={ut.packs}
          defs={packDefs(SPORT)}
          onBuy={buy}
          onStarter={claimStarter}
          onPending={openPending}
          pool={pool}
          ut={ut}
          day={day}
          stored={stored.filter((c) => !isLocked(ut, c.uid))}
          onPick={(id) => (sfx.click(), setPickOpen(id))}
          onMarket={buyFromMarket}
          onSwap={swap}
          onStandouts={() => go('standouts')}
          preview={<PreviewPack pool={pool} ut={ut} week={week} coins={profile.coins} now={Date.now()} onStart={startPreview} onBuy={buyPreview} onSkip={skipPreview} />}
        />
      </>
    );
  else if (view === 'battles')
    body = (
      <Battles
        pool={pool}
        sport={SPORT}
        week={weekOf(day)}
        battles={ut.battles}
        rating={rating}
        ready={ready}
        onSquad={() => go('squad')}
        onToast={onToast}
        onLevel={(level) =>
          setUt((u) => ({
            ...u,
            battles: {
              ...battlesThisWeek(u.battles, weekOf(day)),
              level,
              cleared: 0
            }
          }))
        }
        onPlay={(rung) => {
          const play = props.onPlaySquad;
          if (!play) return onToast('Squad Battles aren’t available here.');
          play({ id: Date.now(), mode: 'ai', rung });
        }}
      />
    );
  else if (view === 'rivals')
    body = (
      <Rivals
        profile={profile}
        update={update}
        onToast={onToast}
        onPlay={() => {
          if (!ready) {
            onToast('Fill your starting squad first.');
            go('squad');
            return;
          }
          props.onPlaySquad?.({ id: Date.now(), mode: 'online' });
        }}
      />
    );
  else if (view === 'sbc')
    body = (
      <Challenges
        pool={pool}
        sbcs={sbcs}
        done={sbcDone}
        club={inventory.filter((c) => !isLocked(ut, c.uid))}
        extra={<StreamlinedSection pool={pool} ut={ut} club={inventory} onSubmit={submitStreamCards} />}
        day={day}
        onSubmit={submitSbc}
        onToast={onToast}
      />
    );
  else
    body = (
      <Hub
        sport={SPORT}
        day={day}
        club={club}
        lineup={lineup}
        rating={rating}
        ut={ut}
        sbcTodo={todo}
        sbcs={sbcs}
        onInspect={setDetail}
        onGo={go}
        onStarter={claimStarter}
        onDaily={() => go('daily')}
        onInbox={() => go('inbox')}
        inboxReady={inboxReady}
        calendarReady={calendarStatus(ut, day).ready}
        onNewEra={claimNewEraBundle}
        week={week}
        pool={pool}
      />
    );

  // Codex: every competition belongs to Play, including the view restored after a match.
  const playChild = ['battles', 'rivals', 'events', 'circuit', 'moments', 'league', 'draft'].includes(view);
  const activeTab = playChild ? 'play' : view === 'gallery' || view === 'sets' ? 'club' : TABS.some(([tab]) => tab === view) ? view : 'hub';

  return (
    <div className={'screen ut ut-v-' + view}>
      <div className="topbar ut-top" {...(opening ? { inert: '' } : {})}>
        <button
          className="icon-btn pill-btn"
          onClick={() => (view === 'hub' ? (sfx.click(), (lastView = 'hub'), props.onExit()) : go(playChild ? 'play' : 'hub'))}
          aria-label={view === 'hub' ? 'Leave Ultimate Team' : playChild ? 'Back to Play' : 'Back to the Ultimate Team home'}
        >
          <Back size={16} /> {view === 'hub' ? 'HOME' : playChild ? 'PLAY' : 'UT'}
        </button>
        <span className="ut-title disp">
          {view === 'hub'
            ? 'Ultimate Team'
            : ((
                {
                  battles: 'Squad Battles',
                  rivals: 'Rivals',
                  gallery: 'Collection',
                  events: 'Spotlight Events',
                  play: 'Play',
                  season: 'Season Rewards',
                  objectives: 'Objectives',
                  circuit: 'Champions Circuit',
                  league: 'Club Season',
                  moments: 'Moments',
                  development: 'Development',
                  records: 'Club Records',
                  standouts: 'Weekly Standouts',
                  sets: 'Set Collections',
                  draft: 'UT Draft',
                  daily: 'Daily',
                  evolutions: 'Evolutions',
                  inbox: 'Rewards'
                } as Partial<Record<UtView, string>>
              )[view] ??
              TABS.find((t) => t[0] === view)?.[1] ??
              'Ultimate Team')}
        </span>
        <CoinChip coins={profile.coins} />
      </div>
      <div className="ut-body" {...(opening ? { inert: '' } : {})}>
        {body}
      </div>
      <nav className="ut-tabs" aria-label="Ultimate Team" {...(opening ? { inert: '' } : {})}>
        {TABS.map(([k, label, icon]) => (
          <button key={k} aria-current={activeTab === k ? 'page' : undefined} onClick={() => go(k)}>
            {icon}
            <span>{label}</span>
            {k === 'sbc' && pool && todo > 0 && <i className="ut-dot num">{todo}</i>}
            {k === 'hub' && inboxReady > 0 && <i className="ut-dot num">{inboxReady}</i>}
            {k === 'store' && (ut.packs.length > 0 || !ut.starterClaimed) && <i className="ut-dot num">{ut.packs.length + (ut.starterClaimed ? 0 : 1)}</i>}
          </button>
        ))}
      </nav>
      {detailCard && (
        <CardDetail
          cc={detailCard}
          clubRecord={hqOf(ut).cardStats[detailCard.uid]}
          developed={!!hqOf(ut).development.completed[detailCard.uid]}
          sport={SPORT}
          onUse={
            detailCard.storage
              ? () => {
                  setUt((u) => useStoredCopy(u, detailCard.uid));
                  setDetail(null);
                  onToast('Copy moved to your club. Your other copy is safe in Duplicate Storage.');
                }
              : undefined
          }
          onSell={() => quickSell([detailCard.uid])}
          locked={isLocked(ut, detailCard.uid)}
          onLock={() => {
            const was = isLocked(ut, detailCard.uid);
            setUt((u) => toggleLock(u, detailCard.uid));
            sfx.click();
            onToast(was ? 'Unlocked. This copy can be sold or used in SBCs again.' : 'Locked as a favourite: never quick-sold, used in SBCs or swapped.');
          }}
          onClose={() => setDetail(null)}
        />
      )}
      {pool && pickOpen && contentOf(ut).picks?.some((x) => x.id === pickOpen) && !opening && (
        <PickSheet pool={pool} pick={contentOf(ut).picks!.find((x) => x.id === pickOpen)!} onKeep={(i) => keep(pickOpen, i)} onLater={() => setPickOpen(null)} />
      )}
      {opening && (
        <PackOpening
          key={opening.id}
          opening={{ ...opening, cards: opening.cards.map((c) => ({ ...c, mint: byUid.get(c.uid)?.oc.mint ?? c.mint })) }}
          onDone={(to) => {
            setOpening(null);
            if (to) setView(to);
          }}
          dupes={(() => {
            // Claude: this pack's spare copies (already in Duplicate Storage), gold and below
            const st = new Set(ut.duplicateStorage ?? []);
            const cards = opening.cards.filter((c) => st.has(c.uid) && !isLocked(ut, c.uid) && ['bronze', 'silver', 'gold'].includes(c.rc.tier) && byUid.has(c.uid));
            return { uids: cards.map((c) => c.uid), coins: cards.reduce((a, c) => a + quickSellValue(c.rc), 0) };
          })()}
          onSellDupes={(uids) => quickSell(uids)}
        />
      )}
    </div>
  );
}
