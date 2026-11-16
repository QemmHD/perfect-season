// The pause button (V2 A.5): 44 x 44 at the top-left of every match, inside the safe area.
import React from 'react';

export function PauseButton({ onPause, label = 'Pause' }: { onPause: () => void; label?: string }) {
  return (
    <button
      type="button"
      className="ps-hud-pause"
      aria-label={label}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onPause();
      }}
      onKeyDown={(e) => {
        if (!e.repeat && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
          e.preventDefault();
          onPause();
        }
      }}
    >
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="4.5" y="3.5" width="4" height="13" rx="1.4" />
        <rect x="11.5" y="3.5" width="4" height="13" rx="1.4" />
      </svg>
    </button>
  );
}
