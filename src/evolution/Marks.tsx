import React from 'react';
import type { Drill } from './training';

/** Drawn icons avoid platform-dependent symbol fonts in the installed iPhone app. */
export function ArrowMark() {
  return (
    <svg
      className="evo-arrow"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M5 19 19 5M5 5h14v14" />
    </svg>
  );
}
export function DrillMark({ drill }: { drill: Drill }) {
  return (
    <svg
      className="drill-mark"
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {drill === 'shoot' ? (
        <>
          <circle cx="32" cy="32" r="22" />
          <circle cx="32" cy="32" r="11" />
          <circle cx="32" cy="32" r="2" fill="currentColor" />
        </>
      ) : drill === 'finish' ? (
        <>
          <path d="M15 49 48 16M30 16h18v18M14 55h38" />
          <path d="M23 55v-7m20 7v-7" />
        </>
      ) : drill === 'pass' ? (
        <>
          <path d="M9 23h44l-9-9m9 9-9 9M55 43H11l9-9m-9 9 9 9" />
        </>
      ) : drill === 'throw' ? (
        <>
          <path d="M10 48Q20 8 51 14" strokeDasharray="3 5" />
          <ellipse
            cx="47"
            cy="17"
            rx="10"
            ry="6"
            transform="rotate(-35 47 17)"
          />
          <path d="m43 20 8-6m-7 0 4 5" />
        </>
      ) : drill === 'run' ? (
        <>
          <path d="m35 8-12 23h16L25 56M13 21h8m-13 9h7m27 5h9m-12 9h13" />
        </>
      ) : (
        <>
          <path d="M13 10v22h38V10M32 32v24M25 56h14" />
          <ellipse cx="32" cy="15" rx="5" ry="9" transform="rotate(25 32 15)" />
        </>
      )}
    </svg>
  );
}
export function MedalMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      className="drill-mark"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="32" cy="32" r="27" />
      <circle cx="32" cy="32" r="22" opacity=".4" />
      <path
        d="m32 17 4.6 9.3 10.3 1.5-7.5 7.3 1.8 10.3L32 40.5l-9.2 4.9 1.8-10.3-7.5-7.3 10.3-1.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
