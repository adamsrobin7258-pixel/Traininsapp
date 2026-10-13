import { useId } from 'react';
import {
  SYMBOL_PATH,
  SYMBOL_VIEWBOX,
  WORDMARK_PATH,
  WORDMARK_STROKE,
  WORDMARK_VIEWBOX,
} from './brandArt';
import styles from './BrandMark.module.css';

/** Badge: the symbol in ivory on a forest disc, with room around it (the header mark). */
const BADGE_VIEWBOX = '-14 -14 76 76';

/**
 * The Kalethra symbol: an abstract figure in a forward step with a reaching arm – the "K" of the
 * brand. Inline vector from the bundled brand artwork (no image request, works offline), coloured
 * by `--color-brand-mark` (forest on light, ivory on dark). Decorative unless it gets a `label`.
 * `badge`: ivory on a round forest disc lit from above – the same in both themes (Phase 25).
 */
export function BrandMark({
  label,
  className,
  badge = false,
}: {
  label?: string;
  className?: string;
  badge?: boolean;
}) {
  const gradientId = `brand-badge-${useId().replace(/[^\w-]/g, '')}`;
  return (
    <svg
      viewBox={badge ? BADGE_VIEWBOX : SYMBOL_VIEWBOX}
      className={`${badge ? styles.badge : styles.mark} ${className ?? ''}`}
      data-brand="symbol"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
    >
      {badge ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#557a5b" />
              <stop offset="1" stopColor="#3d5f43" />
            </linearGradient>
          </defs>
          <circle cx="24" cy="24" r="38" fill={`url(#${gradientId})`} />
          {/* An ivory rim keeps the disc apart from a picture behind it. */}
          <circle
            cx="24"
            cy="24"
            r="36.6"
            fill="none"
            stroke="#f3efe6"
            strokeOpacity="0.55"
            strokeWidth="2.4"
          />
          {/* The fine light edge along the top, as on primary buttons. */}
          <path
            d="M-12.5 18 A37 37 0 0 1 60.5 18"
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.28"
            strokeWidth="1.5"
          />
        </>
      ) : null}
      <path d={SYMBOL_PATH} fill="currentColor" />
    </svg>
  );
}

/** The wordmark "Kalethra" on its own – always next to or below the symbol, never instead. */
export function BrandWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox={WORDMARK_VIEWBOX}
      className={`${styles.wordmark} ${className ?? ''}`}
      data-brand="wordmark"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d={WORDMARK_PATH}
        fill="none"
        stroke="currentColor"
        strokeWidth={WORDMARK_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Symbol and wordmark side by side, read as one name ("Kalethra"). */
export function BrandLogo({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`${styles.logo} ${className ?? ''}`} role="img" aria-label={label}>
      <BrandMark />
      <BrandWordmark />
    </span>
  );
}
