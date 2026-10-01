import type { ReactElement } from 'react';

/**
 * Hand-tuned 24×24 line icons (1.75 stroke). Kept in-house to avoid an icon-library
 * dependency and to guarantee a consistent visual weight.
 */
const paths = {
  today: (
    <>
      <circle cx="12" cy="12" r="3.75" />
      <path d="M12 2.75v2M12 19.25v2M2.75 12h2M19.25 12h2M5.46 5.46l1.41 1.41M17.13 17.13l1.41 1.41M5.46 18.54l1.41-1.41M17.13 6.87l1.41-1.41" />
    </>
  ),
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
  arrowUp: <path d="M12 18.5v-13M6.75 10.75 12 5.5l5.25 5.25" />,
  arrowDown: <path d="M12 5.5v13M6.75 13.25 12 18.5l5.25-5.25" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
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
