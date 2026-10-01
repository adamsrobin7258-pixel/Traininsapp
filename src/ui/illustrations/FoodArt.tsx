import type { ReactElement } from 'react';
import styles from './FoodArt.module.css';

/**
 * Kalethra's food illustrations: one small line drawing per food family on a soft, slightly
 * organic tint. One family of shapes (24 × 24 grid, 1.6 line, round ends) so they read as a
 * set, never as collected clip art. `food` is the neutral fallback – used whenever the family
 * of a food is not known, so no wrong category is ever suggested.
 */
const art = {
  fruit: (
    <>
      <path d="M12 8.6c-1.6-1-4.8-1.25-6.1 1.3-1.35 2.75-.4 7.25 2.35 9.25 1.3.9 2.45.55 3.75.1 1.3.45 2.45.8 3.75-.1 2.75-2 3.7-6.5 2.35-9.25C16.8 7.35 13.6 7.6 12 8.6Z" />
      <path d="M12 8.6c0-2 .6-3.45 2-4.45" />
      <path d="M12.9 6.4c1.25-1.1 3-1.3 4.1-.55-.95 1.25-2.75 1.55-4.1.55Z" />
    </>
  ),
  vegetable: (
    <>
      <path d="M15.7 8.3a3.1 3.1 0 0 0-4.3.1l-6.1 9.3c-.55.85.3 1.7 1.15 1.15l9.3-6.1a3.1 3.1 0 0 0-.05-4.45Z" />
      <path d="M15.7 8.3c.25-1.85 1.35-3.3 3.15-3.85M15.7 8.3c1.85-.25 3.3.25 4.05 1.35M15.7 8.3c-.55-1.5-.35-3.05.6-4.2" />
      <path d="M9.6 13.2l1.1 1.1M11.9 10.9l.85.85" />
    </>
  ),
  grain: (
    <>
      <path d="M12 20.5V7.75" />
      <path d="M12 7.75c-.95-.85-.95-2.65 0-3.5.95.85.95 2.65 0 3.5Z" />
      <path d="M12 11c-1.75-.15-2.95-1.45-3-3.15 1.75.15 2.95 1.45 3 3.15Zm0 0c1.75-.15 2.95-1.45 3-3.15-1.75.15-2.95 1.45-3 3.15Z" />
      <path d="M12 14.75c-1.75-.15-2.95-1.45-3-3.15 1.75.15 2.95 1.45 3 3.15Zm0 0c1.75-.15 2.95-1.45 3-3.15-1.75.15-2.95 1.45-3 3.15Z" />
      <path d="M12 18.5c-1.75-.15-2.95-1.45-3-3.15 1.75.15 2.95 1.45 3 3.15Zm0 0c1.75-.15 2.95-1.45 3-3.15-1.75.15-2.95 1.45-3 3.15Z" />
    </>
  ),
  bread: (
    <>
      <path d="M5.25 11.6c-1.2-.6-1.5-2.3-.6-3.3C6.25 6.5 9.1 5.5 12 5.5s5.75 1 7.35 2.8c.9 1 .6 2.7-.6 3.3v6.65c0 .7-.55 1.25-1.25 1.25h-11c-.7 0-1.25-.55-1.25-1.25Z" />
      <path d="M9 12.25 10.25 10.5M12.25 12.25 13.5 10.5" />
    </>
  ),
  bakery: (
    <>
      <path d="M4.75 13.25 18.5 7v11.25c0 .7-.55 1.25-1.25 1.25H6c-.7 0-1.25-.55-1.25-1.25Z" />
      <path d="M4.75 15.75H18.5" />
      <circle cx="17.25" cy="4.75" r="1.25" />
    </>
  ),
  egg: (
    <>
      <path d="M12 4.25c-3.2 0-5.75 5.1-5.75 8.75a5.75 5.75 0 0 0 11.5 0c0-3.65-2.55-8.75-5.75-8.75Z" />
      <path d="M9.4 12.6c.05-1.45.55-2.85 1.35-3.85" />
    </>
  ),
  potato: (
    <>
      <path d="M6.9 7.6c2.55-2.25 7.35-2.6 9.95.1 2.3 2.4 1.65 6.6-.45 9.2-2.4 2.9-7.45 3.55-9.95.75-2.2-2.5-2.4-7.65.45-10.05Z" />
      <path d="M10 10.6h.01M14.1 9.6h.01M12.6 14.4h.01M9.2 15.1h.01" strokeWidth="2.2" />
    </>
  ),
  dairy: (
    <>
      <path d="M8 8.75 10 4.5h4l2 4.25v10.5c0 .7-.55 1.25-1.25 1.25h-5.5C8.55 20.5 8 19.95 8 19.25Z" />
      <path d="M8 8.75h8M10 4.5l2 4.25" />
      <path d="M10.5 13.5h3" />
    </>
  ),
  legumes: (
    <>
      <path d="M4.75 17.75c4.6.9 11-3.2 14.4-10.55.2-.4-.2-.8-.6-.6C12.1 9.55 7.7 13.15 4.75 17.75Z" />
      <circle cx="9.1" cy="14.9" r="1.1" />
      <circle cx="12.2" cy="12.6" r="1.1" />
      <circle cx="15.1" cy="10" r="1.1" />
    </>
  ),
  meat: (
    <>
      <path d="M5.5 9.4c1.3-3.3 5-4.65 8.55-4.05 3.6.6 5.6 3.15 5 6.35-.7 3.6-4.6 7-9 7-3.55 0-5.85-2.65-5.3-5.3.2-1 .9-1.3.65-2.3-.15-.6-.15-1.1.1-1.7Z" />
      <circle cx="14" cy="11.25" r="1.85" />
    </>
  ),
  sausage: (
    <>
      <path d="M6.2 13.9 13.9 6.2a3.2 3.2 0 0 1 4.5 4.5l-7.7 7.7a3.2 3.2 0 0 1-4.5-4.5Z" />
      <path d="M18.4 6.2l1.6-1.6M4.6 19.4l1.6-1.6" />
      <path d="M9.2 13.6l3.9-3.9" />
    </>
  ),
  fish: (
    <>
      <path d="M6.25 12c2.25-3.15 5.2-4.75 8.1-4.75 2.85 0 5.15 1.75 6.4 4.75-1.25 3-3.55 4.75-6.4 4.75-2.9 0-5.85-1.6-8.1-4.75Z" />
      <path d="M6.25 12 3.25 9v6Z" />
      <path d="M16.75 11h.01" strokeWidth="2.2" />
      <path d="M12.5 9.75c.55.6.85 1.35.85 2.25s-.3 1.65-.85 2.25" />
    </>
  ),
  fats: (
    <>
      <path d="M10 3.5h4M10.5 3.5v2.4c-1.85.85-3 2.55-3 4.5v8.85c0 .7.55 1.25 1.25 1.25h6.5c.7 0 1.25-.55 1.25-1.25V10.4c0-1.95-1.15-3.65-3-4.5V3.5" />
      <path d="M12 11.5c1 1.15 1.75 2.1 1.75 3a1.75 1.75 0 0 1-3.5 0c0-.9.75-1.85 1.75-3Z" />
    </>
  ),
  sweets: (
    <>
      <circle cx="12" cy="12" r="3.6" />
      <path d="M8.7 10.55 4.5 8.4v7.2l4.2-2.15M15.3 10.55l4.2-2.15v7.2l-4.2-2.15" />
      <path d="M10.6 10.6c.6-.5 1.35-.6 2-.35" />
    </>
  ),
  drinks: (
    <>
      <path d="M7.25 8.25h9.5l-1.05 11.1c-.07.65-.6 1.15-1.25 1.15H9.55c-.65 0-1.18-.5-1.25-1.15Z" />
      <path d="M13 8.25 14.75 3.5h2" />
      <path d="M7.7 12.5h8.6" />
    </>
  ),
  dishes: (
    <>
      <circle cx="13.5" cy="12" r="6" />
      <path d="M11 10.5a3 3 0 0 1 4.6-.4" />
      <path d="M3.75 4.75v4.5a1.5 1.5 0 0 0 1.5 1.5M5.25 4.75v14.5M6.75 4.75v4.5a1.5 1.5 0 0 1-1.5 1.5" />
    </>
  ),
  food: (
    <>
      <path d="M3.75 11.75h16.5a8.25 8.25 0 0 1-16.5 0Z" />
      <path d="M9.5 3.75c-.9 1.1.9 2.15 0 3.25M14.5 3.75c-.9 1.1.9 2.15 0 3.25" />
    </>
  ),
} satisfies Record<string, ReactElement>;

export type FoodArtName = keyof typeof art;

/** Tint family per illustration (see tokens.css, --tint-*). */
const TINT: Record<FoodArtName, string> = {
  fruit: 'rose',
  vegetable: 'leaf',
  grain: 'wheat',
  bread: 'wheat',
  bakery: 'wheat',
  egg: 'sun',
  potato: 'earth',
  dairy: 'milk',
  legumes: 'olive',
  meat: 'clay',
  sausage: 'clay',
  fish: 'sea',
  fats: 'sun',
  sweets: 'rose',
  drinks: 'sea',
  dishes: 'sage',
  food: 'sage',
};

interface FoodArtProps {
  name: FoodArtName;
  /** Rendered size in px (square). */
  size?: number;
  /** Spoken name (e.g. the food family); without it the art is decorative. */
  label?: string;
}

export function FoodArt({ name, size = 40, label }: FoodArtProps) {
  return (
    <svg
      className={styles.art}
      data-tint={TINT[name]}
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <path
        className={styles.blob}
        d="M20.4 3.2c6.7-.2 13.2 3.6 15.2 10.1 2 6.6-.4 14.1-6 18.4-5.5 4.2-13.8 5.3-19.3 1.4C4.8 29.3 2.7 21.3 4.8 14.6 6.7 8.6 13.6 3.4 20.4 3.2Z"
      />
      <g
        className={styles.line}
        transform="translate(8 8)"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {art[name]}
      </g>
    </svg>
  );
}
