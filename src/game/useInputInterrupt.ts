// Codex: forget held gestures when the OS takes input away; never reset the game or online clock.
import { useEffect, useRef } from 'react';

export function useInputInterrupt(clear: () => void) {
  const latest = useRef(clear);
  latest.current = clear;
  useEffect(() => {
    const reset = () => latest.current();
    const hidden = () => {
      if (document.hidden) reset();
    };
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    window.addEventListener('orientationchange', reset);
    screen.orientation?.addEventListener('change', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      window.removeEventListener('orientationchange', reset);
      screen.orientation?.removeEventListener('change', reset);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
}
