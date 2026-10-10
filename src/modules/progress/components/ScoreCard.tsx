import { useState, type CSSProperties } from 'react';
import { useI18n } from '@/core/i18n';
import { SCORE_AREAS, useScore, type ScoreResult, type ScoreTrend } from '@/core/score';
import { Icon, ICON_FOR, type IconName } from '@/ui';
import type { PeriodRange, ProgressPeriod } from '../domain/period';
import { ScoreDetailSheet } from './ScoreDetailSheet';
import styles from './Score.module.css';

const TREND_ICON: Record<ScoreTrend, IconName | null> = {
  up: 'arrowUp',
  down: 'arrowDown',
  steady: 'arrowRight',
  none: null,
};

/**
 * The Kalethra score of the chosen period: one big number, its wording, the trend against the
 * period before and the four areas. The whole card opens the explanation.
 */
export function ScoreCard({
  period,
  range,
  previous,
}: {
  period: ProgressPeriod;
  range: PeriodRange;
  previous: PeriodRange;
}) {
  const { t, locale } = useI18n();
  const state = useScore(range.dates, previous.dates);
  const [open, setOpen] = useState(false);
  if (state.status === 'loading') return <div className={styles.placeholder} aria-hidden="true" />;
  if (state.status === 'error') return null;

  const { current, trend, delta } = state.data;
  const number = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' });
  const trendText =
    trend === 'none'
      ? t('progress.score.trend.none')
      : `${t(`progress.score.trend.${trend}`)} ${t(`progress.score.trendVs.${period}`)}`;
  const deltaText =
    trend !== 'none' && delta !== null && delta !== 0
      ? t('progress.score.trendDelta', { delta: number.format(delta) })
      : null;
  const trendIcon = TREND_ICON[trend];

  return (
    <section className={styles.wrap} aria-label={t('progress.score.title')}>
      <button
        type="button"
        className={styles.card}
        aria-label={summary(current, trendText, deltaText, t)}
        onClick={() => {
          setOpen(true);
        }}
      >
        <span className={styles.header}>
          <span className={styles.title}>{t('progress.score.title')}</span>
          <Icon name={ICON_FOR.navForward} size={20} className={styles.chevron} />
        </span>

        {current.score !== null && current.band !== null ? (
          <>
            <span className={styles.hero}>
              <ScoreRing
                value={current.score}
                state={current.preliminary ? 'preliminary' : 'final'}
                outOf={t('progress.score.outOf')}
              />
              <span className={styles.summary}>
                {current.preliminary ? (
                  // Few data: the number steps back, no wording ("Sehr gut unterwegs") and one
                  // short line says why. A real trend stays; "no comparison yet" would only repeat it.
                  <span className={styles.preliminary}>
                    {t('progress.score.preliminaryLine', {
                      label: t('progress.score.preliminary'),
                      hint: t('progress.score.preliminaryHint'),
                    })}
                  </span>
                ) : (
                  <span className={styles.band}>{t(`progress.score.bands.${current.band}`)}</span>
                )}
                {!current.preliminary || trend !== 'none' ? (
                  <span className={styles.trend} data-trend={trend}>
                    {trendIcon ? <Icon name={trendIcon} size={16} /> : null}
                    <span>
                      {trendText}
                      {deltaText ? ` · ${deltaText}` : ''}
                    </span>
                  </span>
                ) : null}
              </span>
            </span>
          </>
        ) : (
          <>
            <span className={styles.hero}>
              <ScoreRing value={null} state="empty" outOf={null} />
              <span className={styles.summary}>
                <span className={styles.band}>{t('progress.score.empty')}</span>
              </span>
            </span>
            <span className={styles.note}>{t('progress.score.emptyHint')}</span>
          </>
        )}

        <span className={styles.areas}>
          {SCORE_AREAS.map((area) => {
            const value = current.areas[area].score;
            return (
              <span key={area} className={styles.area}>
                <span className={styles.areaLine}>
                  <span className={styles.areaName}>{t(`progress.score.areas.${area}`)}</span>
                  <span className={styles.areaValue} data-empty={value === null || undefined}>
                    {value ?? '–'}
                  </span>
                </span>
                {/* Decorative: the number says everything. Without a rating no track – it would read as 0. */}
                <span
                  className={styles.areaTrack}
                  data-empty={value === null || undefined}
                  aria-hidden="true"
                >
                  {value !== null ? (
                    <span
                      className={styles.areaFill}
                      style={{ '--area-ratio': value / 100 } as CSSProperties}
                    />
                  ) : null}
                </span>
              </span>
            );
          })}
        </span>
      </button>
      {open ? (
        <ScoreDetailSheet
          result={current}
          period={period}
          trendText={trendText}
          deltaText={deltaText}
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}

/**
 * The score as a ring around its number: the arc shows score / 100 – the same value as the
 * number, nothing more. Preliminary: a quieter arc; no score: only the track and "–".
 * Decorative for assistive technology – the card's accessible name says it all.
 */
function ScoreRing({
  value,
  state,
  outOf,
}: {
  value: number | null;
  state: 'final' | 'preliminary' | 'empty';
  outOf: string | null;
}) {
  const ratio = value === null ? 0 : Math.min(1, Math.max(0, value / 100));
  return (
    <span className={styles.ring} data-state={state}>
      <svg className={styles.ringArt} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
        <circle className={styles.ringTrack} cx="60" cy="60" r={RING_RADIUS} />
        {ratio > 0 ? (
          <circle
            className={styles.ringArc}
            cx="60"
            cy="60"
            r={RING_RADIUS}
            pathLength={100}
            strokeDasharray={`${String(ratio * 100)} 100`}
          />
        ) : null}
      </svg>
      <span className={styles.ringText}>
        <span
          className={styles.number}
          data-empty={state === 'empty' || undefined}
          data-preliminary={state === 'preliminary' || undefined}
        >
          {value ?? '–'}
        </span>
        {outOf ? <span className={styles.outOf}>{outOf}</span> : null}
      </span>
    </span>
  );
}

const RING_RADIUS = 52;

/** What a screen reader announces for the card – the same facts as the visual card. */
function summary(
  result: ScoreResult,
  trendText: string,
  deltaText: string | null,
  t: ReturnType<typeof useI18n>['t'],
): string {
  const parts: string[] = [];
  if (result.score !== null && result.band !== null && result.preliminary) {
    parts.push(
      t('progress.score.a11yPreliminary', {
        score: result.score,
        hint: t('progress.score.preliminaryHint'),
      }),
    );
    // A real comparison stays; "no comparison yet" would only repeat "preliminary".
    if (trendText !== t('progress.score.trend.none')) {
      parts.push(deltaText ? `${trendText}, ${deltaText}.` : `${trendText}.`);
    }
  } else if (result.score !== null && result.band !== null) {
    parts.push(
      t('progress.score.a11y', {
        score: result.score,
        band: t(`progress.score.bands.${result.band}`),
      }),
    );
    parts.push(deltaText ? `${trendText}, ${deltaText}.` : `${trendText}.`);
  } else {
    parts.push(t('progress.score.a11yEmpty'));
  }
  for (const area of SCORE_AREAS) {
    const value = result.areas[area].score;
    parts.push(
      `${t('progress.score.areaLabel', {
        area: t(`progress.score.areas.${area}`),
        value: value ?? t('progress.score.noRating'),
      })}.`,
    );
  }
  parts.push(t('progress.score.openDetails'));
  return parts.join(' ');
}
