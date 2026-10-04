import { useState } from 'react';
import { useI18n } from '@/core/i18n';
import { SCORE_AREAS, useScore, type ScoreResult, type ScoreTrend } from '@/core/score';
import { Icon, type IconName } from '@/ui';
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
          <span className={styles.eyebrow}>{t('progress.score.title')}</span>
          <Icon name="chevronRight" size={18} className={styles.chevron} />
        </span>

        {current.score !== null && current.band !== null ? (
          <>
            <span className={styles.figure}>
              <span className={styles.number} data-preliminary={current.preliminary || undefined}>
                {current.score}
              </span>
              <span className={styles.outOf}>{t('progress.score.outOf')}</span>
            </span>
            {current.preliminary ? (
              // Few data: the number steps back, no wording ("Sehr gut unterwegs") and one short
              // line says why. A real trend stays; "no comparison yet" would only repeat it.
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
          </>
        ) : (
          <>
            <span className={styles.figure}>
              <span className={styles.number} data-empty="true">
                –
              </span>
            </span>
            <span className={styles.band}>{t('progress.score.empty')}</span>
            <span className={styles.note}>{t('progress.score.emptyHint')}</span>
          </>
        )}

        <span className={styles.areas}>
          {SCORE_AREAS.map((area) => {
            const value = current.areas[area].score;
            return (
              <span key={area} className={styles.area}>
                <span className={styles.areaName}>{t(`progress.score.areas.${area}`)}</span>
                <span className={styles.areaValue} data-empty={value === null || undefined}>
                  {value ?? '–'}
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
