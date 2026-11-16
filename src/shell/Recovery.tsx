// Claude (studio overhaul, shell-4, 2026-11-16): no screen of the installed app can go blank.
//
// RecoveryBoundary catches a render error anywhere below it and shows a recovery card instead of an
// empty page: RELOAD and BACK TO HOME, with copy that knows a missing download (a newer build went
// live, or the phone is offline) from a plain bug. It never writes a save; the error is kept in the
// on-phone error log (Settings → "Problems on this phone"), which is not part of any profile.
//
// Placed three times: the root (main.tsx), and around App's view and tab bodies. React portals keep
// their React parent, so an error inside a match's body-portaled `.arcade-full` (Arcade, Training
// Camp, Moments, UT matches) reaches the view boundary, which unmounts the arena with the view.
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { logError } from '../lib/errlog';
import { reloadForMissingFiles } from '../lib/update';
import { arenaActive, onArenaChange } from './arena';
import './recovery.css';

/** A dynamic import that couldn't be fetched (Chrome, Safari, Firefox and bundler wordings). */
export function isChunkError(e: unknown): boolean {
  const err = e as { name?: unknown; message?: unknown } | null;
  const text = (typeof err?.name === 'string' ? err.name + ' ' : '') + (typeof err?.message === 'string' ? err.message : String(e));
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Unable to preload CSS|Loading chunk [\w-]+ failed/i.test(text);
}

type Where = 'root' | 'view' | 'tab';
interface Props {
  where: Where;
  /** a new value (the next screen) clears a caught error */
  resetKey?: string;
  /** BACK TO HOME; without it only RELOAD is offered */
  onHome?: () => void;
  children: React.ReactNode;
}
interface State {
  failed: boolean;
  chunk: boolean;
  /** a match was on screen when it broke */
  arena: boolean;
}

export class RecoveryBoundary extends React.Component<Props, State> {
  state: State = { failed: false, chunk: false, arena: false };

  static getDerivedStateFromError(e: unknown): State {
    return { failed: true, chunk: isChunkError(e), arena: arenaActive() };
  }

  componentDidCatch(e: unknown) {
    logError('boundary:' + this.props.where, e);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false, chunk: false, arena: false });
  }

  private home = () => {
    this.props.onHome?.();
    this.setState({ failed: false, chunk: false, arena: false });
  };

  render() {
    if (this.state.failed) return <RecoveryCard {...this.state} where={this.props.where} onHome={this.props.onHome ? this.home : undefined} />;
    return (
      <>
        {QA_CRASH && <QaCrash where={this.props.where} screen={this.props.resetKey} />}
        {this.props.children}
      </>
    );
  }
}

function reload(chunk: boolean) {
  // a missing file online: load the live build (rate-limited to once a minute inside, so a tap
  // after that is a plain reload). Offline, or for any other error, a plain reload.
  if (chunk && navigator.onLine && reloadForMissingFiles()) return;
  location.reload();
}

const useOnline = () =>
  useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb);
      window.addEventListener('offline', cb);
      return () => {
        window.removeEventListener('online', cb);
        window.removeEventListener('offline', cb);
      };
    },
    () => navigator.onLine
  );

function RecoveryCard({ chunk, arena, where, onHome }: State & { where: Where; onHome?: () => void }) {
  const online = useOnline();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus({ preventScroll: true }), []);
  const title = chunk ? (online ? 'Part of the game didn’t load' : 'You’re offline') : arena ? 'This match stopped' : 'Something went wrong';
  const body = chunk
    ? online
      ? 'A download didn’t finish, or a new version is out. Reload to get it.'
      : 'This needs one download. Connect once, then try again.'
    : arena
      ? 'The match hit a problem and couldn’t go on. Nothing was saved from it.'
      : 'This screen hit a problem and stopped. Reload to start it fresh.';
  return (
    <div className={'recovery recovery-' + (where === 'tab' ? 'panel' : 'screen') + (arena ? ' recovery-arena' : '')} role="alert" aria-live="assertive">
      <div className="recovery-card">
        <svg className="recovery-mark" width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
          <circle cx="28" cy="28" r="25" />
          {chunk && !online ? (
            <path d="M14 24a20 20 0 0 1 28 0M19 30a13 13 0 0 1 18 0M24.5 36a5 5 0 0 1 7 0M16 14l24 28" />
          ) : (
            <path d="M28 15v16M28 38.5v1" />
          )}
        </svg>
        <h2 className="disp">{title}</h2>
        <p>{body}</p>
        <p className="recovery-safe">Your coins, cards and progress are safe on this phone.</p>
        <div className="recovery-actions">
          <button ref={first} className="btn primary" onClick={() => reload(chunk)}>
            RELOAD
          </button>
          {onHome && (
            <button className="btn" onClick={onHome}>
              BACK TO HOME
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- QA: ?qa-crash=root|view|tab|arena|ut (dev server only; dropped from production builds) ----------

const QA_CRASH: string | null = import.meta.env.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('qa-crash') : null;

/** Throws a render error at the asked-for place: root, view or tab at once; arena when a match comes on screen; ut on Ultimate Team. */
function QaCrash({ where, screen }: { where: Where; screen?: string }) {
  const inArena = useSyncExternalStore((cb) => onArenaChange(cb), arenaActive);
  const hit = QA_CRASH === where || (where === 'view' && ((QA_CRASH === 'arena' && inArena) || (QA_CRASH === 'ut' && screen === 'ut')));
  if (hit) throw new Error('qa-crash: ' + QA_CRASH);
  return null;
}
