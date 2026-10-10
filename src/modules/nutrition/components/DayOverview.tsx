import { Link } from 'react-router';
import { SETTINGS_LINKS } from '@/app/routes';
import { useI18n, type TranslationKey } from '@/core/i18n';
import { goalProgress, type GoalForDay, type Nutrients } from '@/core/nutrition';
import { Icon, ICON_FOR, Meter } from '@/ui';
import { formatGrams, formatKcal } from '../domain/format';
import { ActivityBudget } from './ActivityBudget';
import styles from './Nutrition.module.css';

const MACROS: { key: 'proteinG' | 'carbsG' | 'fatG'; label: TranslationKey }[] = [
  { key: 'proteinG', label: 'nutrition.nutrients.protein' },
  { key: 'carbsG', label: 'nutrition.nutrients.carbohydrates' },
  { key: 'fatG', label: 'nutrition.nutrients.fat' },
];

/**
 * Energy and macros of the day against the goal that applied on that day. The eaten calories
 * are the one big number; goal and remaining follow quietly. Without a goal the eaten values
 * are shown alone and the user is invited to set goals – none are invented. Goals are set in
 * Einstellungen → Ziele; with goals the diary only tracks (no settings link). Fiber stays in the
 * data, but is not shown here: it is unknown for too many foods to be a useful day value.
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
  const eaten = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    totals.energyKcal,
  );

  return (
    <section className={styles.overview} aria-label={t('nutrition.overview.title')}>
      <div className={styles.hero}>
        <span className={styles.heroLabel}>
          <Icon name={ICON_FOR.energy} size={16} className={styles.heroIcon} />
          {t('nutrition.overview.eaten')}
        </span>
        <span className={styles.heroNumber}>
          <span className={styles.heroValue}>{eaten}</span>
          <span className={styles.heroUnit}>{t('common.kcal')}</span>
        </span>
      </div>
      <div className={styles.energy}>
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
      <ActivityBudget goal={goal} />
      {energyGoal !== null ? (
        <Meter
          ratio={energy?.ratio ?? 0}
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
                <Meter
                  size="thin"
                  ratio={goalProgress(totals[key], target).ratio}
                  label={t(label)}
                  valueText={text}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {hasAnyGoal ? null : (
        <div className={styles.callout}>
          <div>
            <p className={styles.foodName}>{t('nutrition.overview.noGoalTitle')}</p>
            <p className={styles.hint}>{t('nutrition.overview.noGoalBody')}</p>
          </div>
          <Link to={SETTINGS_LINKS.goals} className={styles.linkButtonPrimary}>
            {t('nutrition.overview.setGoals')}
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
