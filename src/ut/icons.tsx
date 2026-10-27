// Ultimate Team's own icons (the app's set is in src/ui/icons.tsx), in the same 24px line style.
import React from 'react';

type P = { size?: number };
const S = ({ size = 22, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

export const IconHub = (p: P) => (
  <S {...p}>
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
  </S>
);
export const IconSquad = (p: P) => (
  <S {...p}>
    <path d="M8 4l-4 3 2 3 2-1v11h8V9l2 1 2-3-4-3c-.5 1.4-2 2.4-4 2.4S8.5 5.4 8 4z" />
  </S>
);
export const IconClub = (p: P) => (
  <S {...p}>
    <rect x="3" y="6" width="11" height="15" rx="2" />
    <path d="M8 3h11a2 2 0 0 1 2 2v13" />
  </S>
);
export const IconStore = (p: P) => (
  <S {...p}>
    <path d="M6 3h12l1 18H5z" />
    <path d="M5.5 8h13M9 12l3 3 3-3" />
  </S>
);
export const IconSbc = (p: P) => (
  <S {...p}>
    <path d="M7 7h10l-3-3M17 17H7l3 3" />
    <rect x="9" y="9.5" width="6" height="5" rx="1" />
  </S>
);
export const IconPlay = (p: P) => (
  <S {...p}>
    <path d="M8 5v14l11-7z" />
  </S>
);
export const IconSwap = (p: P) => (
  <S {...p}>
    <path d="M4 8h13l-3-3M20 16H7l3 3" />
  </S>
);
export const IconWand = (p: P) => (
  <S {...p}>
    <path d="M4 20L15 9M14 4v3M18 6l-2 2M20 10h-3M12 6l2 2" />
  </S>
);
export const IconCheck = (p: P) => (
  <S {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </S>
);
export const IconX = (p: P) => (
  <S {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </S>
);
export const IconInfo = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </S>
);
