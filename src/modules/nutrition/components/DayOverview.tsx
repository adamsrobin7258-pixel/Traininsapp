import { useI18n, type TranslationKey } from '@/core/i18n';
import { goalProgress, type GoalForDay, type Nutrients } from '@/core/nutrition';
import { Link } from 'react-router';
import { NUTRITION_LINKS } from '@/app/routes';
import { formatGrams, formatKcal } from '../domain/format';
import { ProgressBar } from './ProgressBar';
import styles from './Nutrition.module.css';

const MACROS: { key: 'proteinG' | 'carbsG' | 'fatG'; label: TranslationKey }[] = [
  { key: 'proteinG', label: 'nutrition.nutrients.protein' },
  { key: 'carbsG', label: 'nutrition.nutrients.carbohydrates' },
  { key: 'fatG', label: 'nutrition.nutrients.fat' },
];

/**
 * Energy and macros of the day against the goal that applied on that day. Without a goal the
 * eaten values are shown alone and the user is invited to set goals – none are invented.
 */
export function DayOverview({ totals, goal }: { totals: Nutrients; goal: GoalForDay | null }) {
  const { t, locale } = useI18n();
  const energyGoal = goal?.effective.energyKcal.value ?? null;
  const hasAnyGoal =
    goal !== null &&
    (['energyKcal', 'proteinG', 'carbsG', 'fatG'] as const).some(
      (target) => goal.effective[target].value !== null,
    );
  const energy = energyGoal !== null ? goalProgress(totals.energyKcal, energyGoal) : null;

  return (
    <section className={styles.card} aria-label={t('nutrition.overview.title')}>
      <div className={styles.energy}>
        <Figure
          label={t('nutrition.overview.eaten')}
          value={formatKcal(totals.energyKcal, locale)}
        />
        <Figure
          label={t('nutrition.overview.goal')}
          value={energyGoal !== null ? formatKcal(energyGoal, locale) : '–'}
        />
        {energy && energy.over > 0 ? (
          <Figure label={t('nutrition.overview.over')} value={formatKcal(energy.over, locale)} />
        ) : (
          <Figure
            label={t('nutrition.overview.remaining')}
            value={energy ? formatKcal(energy.remaining, locale) : '–'}
          />
        )}
      </div>
      {energyGoal !== null ? (
        <ProgressBar
          value={totals.energyKcal}
          goal={energyGoal}
          label={t('nutrition.nutrients.energy')}
          valueText={t('nutrition.overview.ofGoal', {
            value: formatKcal(totals.energyKcal, locale),
            goal: formatKcal(energyGoal, locale),
          })}
        />
      ) : null}

      <div className={styles.macros}>
        {MACROS.map(({ key, label }) => {
          const target = goal?.effective[key].value ?? null;
          const text =
            target !== null
              ? t('nutrition.overview.ofGoal', {
                  value: formatGrams(totals[key], locale),
                  goal: formatGrams(target, locale),
                })
              : formatGrams(totals[key], locale);
          return (
            <div key={key} className={styles.macro}>
              <div className={styles.macroHead}>
                <span>{t(label)}</span>
                <span className={styles.macroValue}>{text}</span>
              </div>
              {target !== null ? (
                <ProgressBar value={totals[key]} goal={target} label={t(label)} valueText={text} />
              ) : null}
            </div>
          );
        })}
      </div>

      {hasAnyGoal ? (
        <div className={styles.cardActions}>
          <Link to={NUTRITION_LINKS.profile} className={styles.linkButton}>
            {t('nutrition.profile.open')}
          </Link>
        </div>
      ) : (
        <div className={styles.stack}>
          <div>
            <p className={styles.foodName}>{t('nutrition.overview.noGoalTitle')}</p>
            <p className={styles.hint}>{t('nutrition.overview.noGoalBody')}</p>
          </div>
          <Link to={NUTRITION_LINKS.profile} className={styles.linkButtonPrimary}>
            {t('nutrition.profile.setup')}
          </Link>
        </div>
      )}
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.figure}>
      <span className={styles.figureValue}>{value}</span>
      <span className={styles.figureLabel}>{label}</span>
    </div>
  );
}
