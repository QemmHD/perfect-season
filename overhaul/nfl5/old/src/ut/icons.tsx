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

// Claude, 2026-11-01 (UI reorganisation): one line-icon per mode and section, same 24px grid.
export const IconChallenges = (p: P) => (
  <S {...p}>
    <path d="M9 3h6v3a2 2 0 1 0 4 0h2v6h-3a2 2 0 1 0 0 4h3v5H3v-5h3a2 2 0 1 0 0-4H3V6h6z" />
  </S>
);
export const IconTrophy = (p: P) => (
  <S {...p}>
    <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
    <path d="M8 6H4.5a3.5 3.5 0 0 0 3.8 4M16 6h3.5a3.5 3.5 0 0 1-3.8 4M12 13v4M8 21h8M9.5 17h5l.5 4h-6z" />
  </S>
);
export const IconLeague = (p: P) => (
  <S {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M8 4v16M12 13h5M12 16.5h3" />
  </S>
);
export const IconBattles = (p: P) => (
  <S {...p}>
    <path d="M4 4l9 9M4 4v4M4 4h4M20 4l-9 9M20 4v4M20 4h-4M7 17l-3 3M17 17l3 3M6.5 14.5l3 3M17.5 14.5l-3 3" />
  </S>
);
export const IconRoute = (p: P) => (
  <S {...p}>
    <circle cx="6" cy="18" r="2.2" />
    <path d="M8.2 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7" />
    <path d="M16 3v6M16 3h4l-1 1.5 1 1.5h-4" />
  </S>
);
export const IconCrown = (p: P) => (
  <S {...p}>
    <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />
    <path d="M5 19h14" />
  </S>
);
export const IconBolt = (p: P) => (
  <S {...p}>
    <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
  </S>
);
export const IconDraft = (p: P) => (
  <S {...p}>
    <rect x="3" y="6" width="8" height="12" rx="1.5" transform="rotate(-10 7 12)" />
    <rect x="13" y="6" width="8" height="12" rx="1.5" transform="rotate(10 17 12)" />
    <path d="M12 3v3M10.5 4.5h3" />
  </S>
);
export const IconShield = (p: P) => (
  <S {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6z" />
    <path d="M12 8l1.4 2.9 3.1.4-2.3 2.1.6 3.1L12 15l-2.8 1.5.6-3.1-2.3-2.1 3.1-.4z" />
  </S>
);
export const IconCalendar = (p: P) => (
  <S {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4M8 14h2M14 14h2M8 17.5h2" />
  </S>
);
export const IconGift = (p: P) => (
  <S {...p}>
    <rect x="3" y="8" width="18" height="5" rx="1" />
    <path d="M5 13v8h14v-8M12 8v13M12 8c-2-4-6-4-6-1.5S10 8 12 8c2 0 6 1 6-1.5S14 4 12 8z" />
  </S>
);
export const IconTarget = (p: P) => (
  <S {...p}>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="5" />
    <circle cx="12" cy="12" r="1.2" />
  </S>
);
export const IconPass = (p: P) => (
  <S {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" />
    <path d="M9 5v14" strokeDasharray="2 2.4" />
    <path d="M13 12h5" />
  </S>
);
export const IconBook = (p: P) => (
  <S {...p}>
    <path d="M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2z" />
    <path d="M4 20a2 2 0 0 0 2 1h13v-3M9 7h6M9 10.5h4" />
  </S>
);
export const IconGrow = (p: P) => (
  <S {...p}>
    <path d="M4 20h16M7 16l4-4 3 3 6-7" />
    <path d="M15 8h5v5" />
  </S>
);
export const IconBox = (p: P) => (
  <S {...p}>
    <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
    <path d="M3 7l9 4 9-4M12 11v10" />
  </S>
);
export const IconSliders = (p: P) => (
  <S {...p}>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </S>
);
export const IconChart = (p: P) => (
  <S {...p}>
    <path d="M4 20V4M4 20h16" />
    <path d="M8 16v-4M12 16V8M16 16v-6M20 16v-9" />
  </S>
);
export const IconStar = (p: P) => (
  <S {...p}>
    <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z" />
  </S>
);
export const IconTag = (p: P) => (
  <S {...p}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="8" cy="8" r="1.6" />
  </S>
);
export const IconHome = (p: P) => (
  <S {...p}>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 9.5V20h5v-6h4v6h5V9.5" />
  </S>
);
export const IconExit = (p: P) => (
  <S {...p}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </S>
);
export const IconChevron = (p: P) => (
  <S {...p}>
    <path d="M9 5l7 7-7 7" />
  </S>
);
export const IconLock = (p: P) => (
  <S {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </S>
);
export const IconCoins = (p: P) => (
  <S {...p}>
    <ellipse cx="10" cy="7" rx="6" ry="3" />
    <path d="M4 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M4 11v4c0 1.7 2.7 3 6 3 1 0 2-.1 2.8-.4" />
    <circle cx="17.5" cy="16.5" r="3.5" />
  </S>
);
