import type { ReactElement } from 'react';

/**
 * Hand-tuned 24×24 line icons (1.75 stroke). Kept in-house to avoid an icon-library
 * dependency and to guarantee a consistent visual weight.
 */
const paths = {
  /** A gently rising line over a baseline – the progress main page. */
  progress: <path d="M3.75 20.25h16.5M4.75 15.75l4.5-4.5 3.5 3 6.5-7.5M15.25 6.75h4v4" />,
  training: <path d="M6.75 6.25v11.5M17.25 6.25v11.5M3.75 9v6M20.25 9v6M6.75 12h10.5" />,
  nutrition: (
    <>
      <path d="M3.75 11.75h16.5a8.25 8.25 0 0 1-16.5 0Z" />
      <path d="M9.5 3.75c-.9 1.1.9 2.15 0 3.25M14.5 3.75c-.9 1.1.9 2.15 0 3.25" />
    </>
  ),
  health: (
    <path d="M12 19.75s-7.75-4.6-7.75-10.1A4.4 4.4 0 0 1 12 7.1a4.4 4.4 0 0 1 7.75 2.55c0 5.5-7.75 10.1-7.75 10.1Z" />
  ),
  profile: (
    <>
      <circle cx="12" cy="8.25" r="3.75" />
      <path d="M4.75 20.25a7.25 7.25 0 0 1 14.5 0" />
    </>
  ),
  chevronRight: <path d="M9.5 5.75 15.75 12 9.5 18.25" />,
  check: <path d="m5.5 12.5 4.25 4.25L18.5 8" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
  arrowUp: <path d="M12 18.5v-13M6.75 10.75 12 5.5l5.25 5.25" />,
  arrowDown: <path d="M12 5.5v13M6.75 13.25 12 18.5l5.25-5.25" />,
  /** Einstellungen: two sliders. */
  settings: (
    <>
      <path d="M4.75 7.25h9M18.25 7.25h1M4.75 16.75h1M9.75 16.75h9.5" />
      <circle cx="16.25" cy="7.25" r="2" />
      <circle cx="7.75" cy="16.75" r="2" />
    </>
  ),
  /** Goals. */
  target: (
    <>
      <circle cx="12" cy="12" r="7.25" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  /** "About the same" (score trend). */
  arrowRight: <path d="M5.5 12h13M13.25 6.75 18.5 12l-5.25 5.25" />,
  /** Two opposite arrows – replace one thing with another. */
  swap: <path d="M6.75 7.75h11.5M15 4.5l3.25 3.25L15 11M17.25 16.25H5.75M9 13l-3.25 3.25L9 19.5" />,
  /** A stopwatch – the rest timer. */
  timer: <path d="M12 20.75a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM12 10.25v3.5l2.25 1.5M9.75 3.25h4.5" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  /** Three dots – more actions of a screen or a group. */
  more: <path d="M5.75 12h.01M12 12h.01M18.25 12h.01" strokeWidth={3} />,
  pause: <path d="M9 6.25v11.5M15 6.25v11.5" />,
  play: <path d="M8 5.75v12.5L18.25 12Z" />,
  /** Skip to the end – skipping the rest. */
  skip: <path d="M6.25 6.25v11.5L14.75 12ZM17.75 6.25v11.5" />,
  plan: <path d="M9 6.75h10.25M9 12h10.25M9 17.25h10.25M4.75 6.75h.5M4.75 12h.5M4.75 17.25h.5" />,
  chevronLeft: <path d="M14.5 5.75 8.25 12l6.25 6.25" />,
  star: (
    <path d="m12 3.75 2.5 5.3 5.75.7-4.25 3.95 1.1 5.7L12 16.6l-5.1 2.8 1.1-5.7-4.25-3.95 5.75-.7Z" />
  ),
  barcode: (
    <path d="M4.75 6.25v11.5M7.75 6.25v11.5M11.25 6.25v11.5M13.75 6.25v11.5M16.25 6.25v11.5M19.25 6.25v11.5" />
  ),
  search: (
    <>
      <circle cx="10.75" cy="10.75" r="5.5" />
      <path d="m15 15 4.25 4.25" />
    </>
  ),
  /** Calories. */
  flame: (
    <path d="M12 20.25c3.45 0 6-2.45 6-5.75 0-3.6-2.65-5.6-3.9-8.75-.35 1.9-1.3 3.15-2.6 3.85.25-2.6-.85-4.95-3-6.35.2 3.3-3.5 5.85-3.5 11.25 0 3.3 2.55 5.75 6 5.75Z" />
  ),
  /** Water. */
  drop: (
    <path d="M12 3.75c3.1 3.6 5.75 6.95 5.75 10.25a5.75 5.75 0 0 1-11.5 0c0-3.3 2.65-6.65 5.75-10.25Z" />
  ),
  /** Breakfast: a cup. */
  cup: (
    <>
      <path d="M5.25 9.25h11v4.5a5.5 5.5 0 0 1-11 0Z" />
      <path d="M16.25 10.75h1a2.25 2.25 0 0 1 0 4.5h-1.4M9 3.75c-.6.75.6 1.5 0 2.25M12.5 3.75c-.6.75.6 1.5 0 2.25M5 20.25h11.5" />
    </>
  ),
  /** Lunch: plate with cutlery. */
  plate: (
    <>
      <circle cx="13.5" cy="12" r="6" />
      <circle cx="13.5" cy="12" r="3" />
      <path d="M3.75 4.75v4.5a1.5 1.5 0 0 0 1.5 1.5M5.25 4.75v14.5M6.75 4.75v4.5a1.5 1.5 0 0 1-1.5 1.5" />
    </>
  ),
  /** Dinner. */
  moon: <path d="M19.25 14.6A7.75 7.75 0 0 1 9.4 4.75a7.75 7.75 0 1 0 9.85 9.85Z" />,
  /** Snacks. */
  apple: (
    <>
      <path d="M12 8.25c-1.5-.95-4.6-1.2-5.85 1.25-1.3 2.65-.35 6.95 2.25 8.85 1.25.85 2.35.55 3.6.1 1.25.45 2.35.75 3.6-.1 2.6-1.9 3.55-6.2 2.25-8.85C16.6 7.05 13.5 7.3 12 8.25Z" />
      <path d="M12 8.25c0-1.9.55-3.3 1.9-4.25" />
    </>
  ),
  /** Body weight. */
  scale: (
    <>
      <rect x="3.75" y="3.75" width="16.5" height="16.5" rx="4" />
      <path d="M8.5 9.25a5 5 0 0 1 7 0M12 9.75l1.25-2" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type IconName = keyof typeof paths;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 24, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
