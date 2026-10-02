import { Link } from 'react-router';
import { NUTRITION_LINKS, ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { SCORE_AREAS, type ScoreResult } from '@/core/score';
import { Sheet } from '@/ui';
import { PERIOD_DAYS, type ProgressPeriod } from '../domain/period';
import { areaExplanation } from '../domain/scoreText';
import styles from './Score.module.css';

/** How the score came about: goal and weighting, the rule for "Vorläufig" and each area. */
export function ScoreDetailSheet({
  result,
  period,
  trendText,
  deltaText,
  onClose,
}: {
  result: ScoreResult;
  period: ProgressPeriod;
  trendText: string;
  deltaText: string | null;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const days = PERIOD_DAYS[period];
  return (
    <Sheet title={t('progress.score.title')} onClose={onClose} closeLabel={t('common.close')}>
      <div className={styles.detail}>
        <p className={styles.detailPeriod}>{t(`progress.score.detail.period.${period}`)}</p>
        {result.score !== null && result.band !== null ? (
          <p className={styles.detailFigure}>
            <span className={styles.detailNumber}>{result.score}</span>
            <span className={styles.outOf}>{t('progress.score.outOf')}</span>
            <span className={styles.detailBand}>{t(`progress.score.bands.${result.band}`)}</span>
            {result.preliminary ? (
              <span className={styles.badge}>{t('progress.score.preliminary')}</span>
            ) : null}
          </p>
        ) : (
          <p className={styles.detailBand}>{t('progress.score.empty')}</p>
        )}
        {result.score !== null ? (
          <p className={styles.note}>{deltaText ? `${trendText} · ${deltaText}` : trendText}</p>
        ) : null}
        <p className={styles.text}>{t('progress.score.detail.intro')}</p>

        <h3 className={styles.subtitle}>{t('progress.score.detail.weightsTitle')}</h3>
        <p className={styles.text}>
          {result.goalSet
            ? t('progress.score.detail.goal', { goal: t(`nutrition.goalTypes.${result.goal}`) })
            : t('progress.score.detail.goalUnset')}
        </p>
        <ul className={styles.weights}>
          {SCORE_AREAS.map((area) => (
            <li key={area}>
              {t('progress.score.detail.weight', {
                area: t(`progress.score.areas.${area}`),
                share: Math.round(result.weights[area] * 100),
              })}
            </li>
          ))}
        </ul>
        <p className={styles.note}>{t('progress.score.detail.weightsNote')}</p>
        <p className={styles.note}>
          {t('progress.score.detail.preliminaryRule', {
            days: result.documentedDays,
            total: days,
          })}
        </p>

        <h3 className={styles.subtitle}>{t('progress.score.detail.areasTitle')}</h3>
        <ul className={styles.explanations}>
          {SCORE_AREAS.map((area) => {
            const value = result.areas[area].score;
            return (
              <li key={area} className={styles.explanation}>
                <span className={styles.explanationTitle}>
                  <span>{t(`progress.score.areas.${area}`)}</span>
                  <span className={styles.areaValue} data-empty={value === null || undefined}>
                    {value ?? t('progress.score.noRating')}
                  </span>
                </span>
                {areaExplanation(area, result.areas, period, days, t, locale).map((line) => (
                  <span key={line} className={styles.explanationText}>
                    {line}
                  </span>
                ))}
                {value === null ? (
                  <span className={styles.explanationText}>
                    {t('progress.score.detail.notCounted')}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>

        <div className={styles.links}>
          <Link to={ROUTES.health} className={styles.linkButton}>
            {t('progress.score.detail.recordRecovery')}
          </Link>
          <Link to={ROUTES.profile} className={styles.linkButton}>
            {t('progress.score.detail.setTargets')}
          </Link>
          <Link to={NUTRITION_LINKS.profile} className={styles.linkButton}>
            {t('progress.score.detail.setGoal')}
          </Link>
        </div>
      </div>
    </Sheet>
  );
}
