import {
  SYMBOL_PATH,
  SYMBOL_VIEWBOX,
  WORDMARK_PATH,
  WORDMARK_STROKE,
  WORDMARK_VIEWBOX,
} from './brandArt';
import styles from './BrandMark.module.css';

/**
 * The Kalethra symbol: an abstract figure in a forward step with a reaching arm – the "K" of the
 * brand. Inline vector from the bundled brand artwork (no image request, works offline), coloured
 * by `--color-brand-mark` (forest on light, ivory on dark). Decorative unless it gets a `label`.
 */
export function BrandMark({ label, className }: { label?: string; className?: string }) {
  return (
    <svg
      viewBox={SYMBOL_VIEWBOX}
      className={`${styles.mark} ${className ?? ''}`}
      data-brand="symbol"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      focusable="false"
    >
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
