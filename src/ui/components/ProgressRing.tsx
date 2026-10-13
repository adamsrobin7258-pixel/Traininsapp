import { useId, type CSSProperties, type ReactNode } from 'react';
import styles from './ProgressRing.module.css';

export type RingState = 'final' | 'preliminary' | 'empty';

interface ProgressRingProps {
  /**
   * Progress as a ratio (1 = goal). `null`: no value – only the track, no invented arc. Above 1
   * the ring is full and the part beyond the goal runs as a second, deeper lap (at most one).
   */
  ratio: number | null;
  /** `preliminary`: the arc steps back to a quiet grey; `empty`: track only. */
  state?: RingState;
  /** Spoken name and value. Without them the ring is decorative (its text says it all). */
  label?: string;
  valueText?: string;
  /** The centred content: the number and a small line under it. */
  children?: ReactNode;
  className?: string;
}

/** Radius and stroke in the 120-unit box; the stroke is even all the way round. */
const R = 51;
const STROKE = 11;

/** Dash length in percent of the circle, without floating point noise (1.3 − 1 = 0.30000…4). */
const dash = (ratio: number) => String(Math.round(ratio * 10000) / 100);

/**
 * Kalethra's progress ring (Phase 26): a recessed track, the arc in a sage-to-forest gradient with
 * round ends and a soft shadow, a fine light reflection along its outer edge and a lightly
 * domed centre for the number. Shared by the Kalethra score and the nutrition goal, so every
 * ring in the app looks the same. The arc grows once when it appears (not with reduced motion);
 * there is no lasting animation. Passing a goal is never red.
 */
export function ProgressRing({
  ratio,
  state = ratio === null ? 'empty' : 'final',
  label,
  valueText,
  children,
  className,
}: ProgressRingProps) {
  const id = `ring-${useId().replace(/[^\w-]/g, '')}`;
  const value = ratio === null || !Number.isFinite(ratio) ? null : Math.max(0, ratio);
  const main = value === null ? 0 : Math.min(1, value);
  const over = value === null ? 0 : Math.min(1, Math.max(0, value - 1));
  const accessible = label !== undefined;
  return (
    <span
      className={`${styles.ring} ${className ?? ''}`}
      data-state={state}
      data-over={over > 0 || undefined}
      {...(accessible
        ? {
            role: 'progressbar',
            'aria-label': label,
            'aria-valuemin': 0,
            'aria-valuemax': 100,
            'aria-valuenow': Math.round(main * 100),
            'aria-valuetext': valueText,
          }
        : {})}
    >
      <svg className={styles.art} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-arc`} x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.stopLight} />
            <stop offset="0.55" className={styles.stopMid} />
            <stop offset="1" className={styles.stopDeep} />
          </linearGradient>
          <linearGradient id={`${id}-track`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.trackTop} />
            <stop offset="1" className={styles.trackBottom} />
          </linearGradient>
          <radialGradient id={`${id}-dome`} cx="0.5" cy="0.32" r="0.7">
            <stop offset="0" className={styles.domeLight} />
            <stop offset="1" className={styles.domeEdge} />
          </radialGradient>
        </defs>
        {/* The centre: lightly domed, so the number sits on its own surface. */}
        <circle
          className={styles.dome}
          cx="60"
          cy="60"
          r={R - STROKE / 2 - 3}
          fill={`url(#${id}-dome)`}
        />
        <circle
          className={styles.track}
          cx="60"
          cy="60"
          r={R}
          stroke={`url(#${id}-track)`}
          strokeWidth={STROKE}
        />
        <g transform="rotate(-90 60 60)">
          {main > 0 ? (
            <>
              <circle
                className={styles.arc}
                cx="60"
                cy="60"
                r={R}
                pathLength={100}
                strokeWidth={STROKE}
                strokeDasharray={`${dash(main)} 100`}
                style={
                  state === 'final'
                    ? ({ '--ring-arc': `url(#${id}-arc)` } as CSSProperties)
                    : undefined
                }
              />
              {/* Light from above: a fine bright line along the outer edge of the arc. */}
              <circle
                className={styles.sheen}
                cx="60"
                cy="60"
                r={R + STROKE / 2 - 2}
                pathLength={100}
                strokeDasharray={`0 1 ${dash(Math.max(0, main - 0.02))} 100`}
              />
            </>
          ) : null}
          {over > 0 ? (
            /* A light lane under the second lap keeps it apart from the full ring. */
            <circle
              className={styles.overGap}
              cx="60"
              cy="60"
              r={R}
              pathLength={100}
              strokeWidth={STROKE - 3}
              strokeDasharray={`${dash(over)} 100`}
            />
          ) : null}
          {over > 0 ? (
            <circle
              className={styles.over}
              cx="60"
              cy="60"
              r={R}
              pathLength={100}
              strokeWidth={STROKE - 6}
              strokeDasharray={`${dash(over)} 100`}
            />
          ) : null}
        </g>
      </svg>
      <span className={styles.content}>{children}</span>
    </span>
  );
}
