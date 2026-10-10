import { ICON_PATHS, type IconName } from './paths';

export type { IconName };

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  /**
   * Accessible name for an icon that carries meaning on its own (no visible text next to it).
   * Without it the icon is decorative and hidden from assistive technology.
   */
  label?: string;
}

export function Icon({ name, size = 24, className, label }: IconProps) {
  const a11y = label
    ? ({ role: 'img', 'aria-label': label } as const)
    : ({ 'aria-hidden': true } as const);
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
      focusable="false"
      {...a11y}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}
