// Claude (studio overhaul, shell-6, 2026-11-16): Ultimate Team's loading screen.
//
// Opening UT downloads its code, then its card file, then rates every card (seconds on a slow phone,
// before shell-7). Until now that was a spinner on an empty screen. Now the first frame after the tap
// is UT itself: its real top bar and 6-tab bar, with the screen it will open on (utReturnView: Home,
// Play, Squad, Club, Challenges, Store, or the sub-screen a match left from) sketched in placeholders
// and a live label, "Preparing your club · 64%".
//
//  - `UtSkeleton`: the whole screen, App's Suspense fallback while UT's code downloads. It draws the
//    same markup and classes as UltimateTeam's chrome (with the few nav.css rules it needs copied in
//    ut-skeleton.css, since nav.css arrives with UT's code), so nothing moves when UT takes over.
//  - `UtSkeletonBody`: the content area only. UltimateTeam renders its own chrome while the pool loads
//    and puts this in its body.
//  - `UtLoadError`: the load failed. Offline it says why and what to do.
//
// It reads nothing from the pool module (pool-progress.ts is a store with no imports), so the
// first-paint bundle gains only this file, its CSS, the nav map and UT's tab icons.
import React, { useEffect, useState } from 'react';
import { CoinChip } from '../ui/common';
import { Back } from '../ui/icons';
import { IconChallenges, IconClub, IconExit, IconHome, IconPlay, IconSquad, IconStore } from '../ut/icons';
import { SEGMENTS, tabLabel, tabOf, UT_TABS, viewInfo, type UtTab } from '../ut/nav';
import { utReturnView } from '../ut/return-view';
import type { UtView } from '../ut/UltimateTeam';
import { onPoolProgress, poolLoadAbandoned, poolLoadStarted, poolPercent, poolProgress } from './pool-progress';
import './ut-skeleton.css';

const TAB_ICON: Record<UtTab, React.ReactNode> = {
  hub: <IconHome />,
  play: <IconPlay />,
  squad: <IconSquad />,
  club: <IconClub />,
  sbc: <IconChallenges />,
  store: <IconStore />,
};

/** The label's percentage: live from the pool, never stepping back while this screen is up. */
function usePoolPercent(): number {
  const [pct, setPct] = useState(() => poolPercent(poolProgress()));
  useEffect(() => onPoolProgress((p) => setPct((old) => Math.max(old, poolPercent(p)))), []);
  return pct;
}

/** The whole UT screen while its code downloads (App's Suspense fallback). */
export function UtSkeleton({ coins, onExit }: { coins: number; onExit: () => void }) {
  const view = utReturnView();
  const info = viewInfo(view);
  const tab = tabOf(view);
  const back = view === 'hub' ? null : (info.parent ?? null);
  const backLabel = back ? tabLabel(tabOf(back)) : '';
  // the same fit rule as UltimateTeam's top bar (a long title keeps only the back chevron)
  const titleSize = view === 'circuit' || view === 'standouts' ? 19 : 21;
  const backFits = !back || backLabel.length * 8.2 + 41 + info.title.length * titleSize * 0.5 <= 250;
  const segments = SEGMENTS[tab];
  // UT's code is downloading: that is the first part of the same load
  useEffect(() => {
    poolLoadStarted('screen');
    return poolLoadAbandoned;
  }, []);
  return (
    <div className={'screen ut ut-skel ut-v-' + view + ' ut-t-' + tab + (info.parent ? ' ut-sub' : ' ut-root')} aria-busy="true">
      <div className={'topbar ut-top' + (view !== 'hub' && !back ? ' no-back' : '')}>
        {view === 'hub' ? (
          <button className="icon-btn pill-btn ut-back" onClick={onExit} aria-label="Leave Ultimate Team">
            <IconExit size={16} /> EXIT
          </button>
        ) : back ? (
          // where it goes back to is UT's own screen, still loading: shown, not yet live
          <span className={'icon-btn pill-btn ut-back ut-skel-off' + (backFits ? '' : ' icon-only')} aria-hidden="true">
            <Back size={16} /> {backFits && backLabel}
          </span>
        ) : null}
        <span className="ut-title disp">{info.title}</span>
        <CoinChip coins={coins} />
      </div>
      {segments && (
        <div className="ut-segbar" aria-hidden="true">
          <div className="ut-segs" style={{ '--n': segments.length, '--i': Math.max(0, segments.findIndex(([k]) => k === view)) } as React.CSSProperties}>
            <span className="ut-segs-ind" />
            {segments.map(([k, label]) => (
              <span key={k} className="ut-skel-seg" data-on={k === view || undefined}>
                <span>{label}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="ut-body">
        <UtSkeletonBody view={view} />
      </div>
      <nav className="ut-tabs" aria-label="Ultimate Team">
        {UT_TABS.map(([k, label]) => (
          // the tabs work once UT is in: drawn now, inert until then
          <button key={k} aria-current={tab === k ? 'page' : undefined} aria-disabled="true" tabIndex={-1}>
            {TAB_ICON[k]}
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/** Placeholders shaped like the screen UT is about to show, and the progress label. */
export function UtSkeletonBody({ view }: { view: UtView }) {
  const pct = usePoolPercent();
  const tab = tabOf(view);
  const sub = !!viewInfo(view).parent;
  return (
    // `ut-loading` stays on it: QA scripts (and anything else) that wait for UT to finish loading look for that class to go
    <div className={'ut-loading ut-skel-body ut-skel-' + (sub ? 'list' : tab)} role="status" aria-live="polite" aria-label={'Preparing your club, ' + pct + ' percent'}>
      <div className="ut-skel-shapes" aria-hidden="true">
        {sub ? <ListShapes /> : <TabShapes tab={tab} />}
      </div>
      <p className="ut-skel-label">
        Preparing your club <span className="num">· {pct}%</span>
      </p>
      <span className="ut-skel-track" aria-hidden="true">
        <i style={{ width: pct + '%' }} />
      </span>
    </div>
  );
}

const Box = ({ h, w, r = 14, cls = '' }: { h: number; w?: string; r?: number; cls?: string }) => <span className={'sk ' + cls} style={{ height: h, width: w, borderRadius: r }} />;

function TabShapes({ tab }: { tab: UtTab }) {
  switch (tab) {
    case 'hub':
      return (
        <>
          <Box h={148} r={20} cls="sk-hero" />
          <div className="sk-row">
            <Box h={84} />
            <Box h={84} />
          </div>
          <Box h={58} />
          <Box h={58} />
        </>
      );
    case 'play':
      return (
        <>
          <Box h={40} w="62%" r={12} />
          <div className="sk-grid">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Box key={i} h={104} r={16} />
            ))}
          </div>
        </>
      );
    case 'squad':
      return (
        <>
          <Box h={40} r={12} />
          <div className="sk-court">
            {[0, 1, 2, 3, 4].map((i) => (
              <Box key={i} h={92} w="27%" r={10} cls={'sk-card sk-c' + i} />
            ))}
          </div>
        </>
      );
    case 'club':
      return (
        <>
          <Box h={36} r={10} />
          <div className="sk-cards">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <Box key={i} h={112} r={10} cls="sk-card" />
            ))}
          </div>
        </>
      );
    case 'sbc':
      return (
        <>
          {[0, 1, 2, 3].map((i) => (
            <Box key={i} h={78} r={16} />
          ))}
        </>
      );
    case 'store':
      return (
        <>
          <Box h={128} r={20} cls="sk-hero" />
          <div className="sk-row">
            <Box h={150} r={16} />
            <Box h={150} r={16} />
          </div>
          <Box h={58} />
        </>
      );
  }
}

function ListShapes() {
  return (
    <>
      <Box h={92} r={18} cls="sk-hero" />
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} h={64} />
      ))}
    </>
  );
}

/** The cards didn't load. Offline the copy says why; RETRY tries again (44 px and up). */
export function UtLoadError({ onRetry }: { onRetry: () => void }) {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return (
    <div className="ut-loading ut-load-error" role="alert">
      <span className="ut-load-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
          {online ? (
            <>
              <path d="M12 8v5" />
              <path d="M12 16.5v.5" />
              <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
            </>
          ) : (
            <>
              <path d="M2 8.8a15 15 0 0 1 4.2-2.6M9.6 5.2A15 15 0 0 1 22 8.8M5 12.5a10 10 0 0 1 3.4-2M15.3 10.8A10 10 0 0 1 19 12.5M8.5 16a5 5 0 0 1 7 0" />
              <path d="M12 20h.01" />
              <path d="M3 3l18 18" />
            </>
          )}
        </svg>
      </span>
      <h2 className="disp">{online ? 'THE CARDS DIDN’T LOAD' : 'YOU’RE OFFLINE'}</h2>
      <p>{online ? 'A download didn’t finish. Your club is safe on this phone.' : 'Ultimate Team needs one online visit after each update. Your club is safe on this phone.'}</p>
      <button className="btn primary" onClick={onRetry}>
        {online ? 'TRY AGAIN' : 'RETRY'}
      </button>
    </div>
  );
}
