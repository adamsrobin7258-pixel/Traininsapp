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
