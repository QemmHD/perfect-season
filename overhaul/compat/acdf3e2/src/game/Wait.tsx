// The line under your final score while the other side is still playing: where they are, and,
// when they've stopped playing, how long before the AI finishes for them.
import React, { useEffect, useState } from 'react';
import type { RivalLive } from './progress';

export function WaitLine({ rival, unit, total, className = 'fg-wait' }: { rival: RivalLive; unit: string; total: number; className?: string }) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!rival.deadline) return;
    const t = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [rival.deadline]);
  const left = rival.deadline ? Math.max(0, Math.ceil((rival.deadline - Date.now()) / 1000)) : null;
  return (
    <small className={className}>
      Waiting for {rival.name}: {unit} {Math.min(rival.drive + 1, total)} of {total}
      {left !== null && left <= 30 ? ' · no play from them: the AI finishes for them in ' + left + 's' : ''}
    </small>
  );
}
