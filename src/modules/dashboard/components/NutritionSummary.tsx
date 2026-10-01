import { Link } from 'react-router';
import { ROUTES } from '@/app/routes';
import { useHealthSync } from '@/core/health';
import { useI18n, type TranslationKey } from '@/core/i18n';
import {
  goalProgress,
  mealDisplayName,
  useNutritionData,
  type DefaultMealKey,
  type FoodEntry,
  type MainNutrient,
  type MealSlot,
} from '@/core/nutrition';
import { useSettings } from '@/core/settings';
import { toLocalDateKey } from '@/shared/lib/date';
import { formatWater } from '@/shared/lib/format';
import { Icon, List, ListRow, Meter, Section, type IconName } from '@/ui';
import styles from './NutritionSummary.module.css';

const MACROS: { key: Exclude<MainNutrient, 'energyKcal'>; label: TranslationKey }[] = [
  { key: 'proteinG', label: 'dashboard.nutrition.protein' },
  { key: 'carbsG', label: 'dashboard.nutrition.carbs' },
  { key: 'fatG', label: 'dashboard.nutrition.fat' },
];

const MEAL_ICONS: Record<DefaultMealKey, IconName> = {
  breakfast: 'cup',
  lunch: 'plate',
  dinner: 'moon',
  snacks: 'apple',
};

/** How many food names a meal previews before "+n". */
const PREVIEW_FOODS = 2;

/**
 * Nutrition at a glance – the calm center of Today. Calories as the one big number with the
 * goal and a thin progress line, the macros and water below, then the meals of the day. All
 * values come from the food diary (read only); without entries they stay empty ("–") – nothing
 * is invented. Everything opens the diary.
 */
export function NutritionSummary({ now }: { now: Date }) {
  const { t, locale } = useI18n();
  const today = toLocalDateKey(now);
  const { countActivityCalories } = useSettings().settings;
  const { revision: healthRevision } = useHealthSync();
  const data = useNutritionData(
    async (s, profileId) => ({
      day: await s.diary.getDay(profileId, today),
      goal: await s.goals.dayGoal(profileId, today, { countActivity: countActivityCalories }),
      meals: await s.meals.listActive(profileId),
    }),
    [today, countActivityCalories, healthRevision],
  );
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const ready = data.status === 'ready' ? data.data : null;
  const totals = ready?.day.summary.totals.totals ?? null;
  const hasEntries = (ready?.day.summary.entryCount ?? 0) > 0;
  const goal = ready?.goal ?? null;
  const energyGoal = goal?.effective.energyKcal.value ?? null;
  const energy = totals && energyGoal !== null ? goalProgress(totals.energyKcal, energyGoal) : null;
  const kcal = (value: number) => `${number.format(value)} ${t('dashboard.nutrition.kcal')}`;
  const grams = (value: number) => `${number.format(value)} g`;

  const activity = goal?.activity ?? null;
  const waterGoal = goal?.effective.waterMl.value ?? null;
  const waterMl = ready?.day.waterMl ?? 0;

  return (
    <>
      <Link to={ROUTES.nutrition} className={styles.hero}>
        <span className={styles.eyebrow}>
          <Icon name="flame" size={16} className={styles.eyebrowIcon} />
          {t('dashboard.nutrition.title')}
        </span>
        <span className={styles.energy}>
          <span className={styles.energyValue}>
            {hasEntries && totals ? number.format(totals.energyKcal) : '–'}
          </span>
          <span className={styles.energyUnit}>{t('dashboard.nutrition.kcal')}</span>
          <span className="visually-hidden">{t('dashboard.nutrition.calories')}</span>
        </span>
        {energyGoal !== null ? (
          <span className={styles.goalLine}>
            {t('dashboard.nutrition.ofGoal', { goal: kcal(energyGoal) })}
            {energy && hasEntries
              ? ` · ${
                  energy.over > 0
                    ? t('dashboard.nutrition.over', { value: kcal(energy.over) })
                    : t('dashboard.nutrition.remaining', { value: kcal(energy.remaining) })
                }`
              : null}
          </span>
        ) : null}
        {activity && activity.kcal > 0 ? (
          <span className={styles.activityLine}>
            {activity.counted && activity.baseKcal !== null
              ? `${t('nutrition.activityBudget.base')} ${kcal(activity.baseKcal)} · ${t(
                  'nutrition.activityBudget.added',
                )} +${kcal(activity.kcal)}`
              : `${t('nutrition.activityBudget.info')} ${kcal(activity.kcal)} · ${t(
                  'nutrition.activityBudget.notCounted',
                )}`}
          </span>
        ) : null}
        {energyGoal !== null && totals ? (
          <Meter
            ratio={energy?.ratio ?? 0}
            label={t('dashboard.nutrition.calories')}
            valueText={t('dashboard.nutrition.progress', {
              value: kcal(totals.energyKcal),
              goal: kcal(energyGoal),
            })}
          />
        ) : null}

        <span className={styles.macros}>
          {MACROS.map(({ key, label }) => {
            const aim = goal?.effective[key].value ?? null;
            const eaten = totals?.[key] ?? 0;
            return (
              <span key={key} className={styles.macro}>
                <span className={styles.macroLabel}>{t(label)}</span>
                <span className={styles.macroValue}>{hasEntries ? grams(eaten) : '–'}</span>
                {aim !== null ? (
                  <>
                    <span className={styles.macroGoal}>
                      {t('dashboard.nutrition.ofGoal', { goal: grams(aim) })}
                    </span>
                    <Meter
                      size="thin"
                      ratio={goalProgress(eaten, aim).ratio}
                      label={t(label)}
                      valueText={t('dashboard.nutrition.progress', {
                        value: grams(eaten),
                        goal: grams(aim),
                      })}
                    />
                  </>
                ) : null}
              </span>
            );
          })}
        </span>

        <span className={styles.water}>
          <Icon name="drop" size={18} className={styles.waterIcon} />
          <span className={styles.waterText}>
            <span className={styles.waterValue}>
              {t('dashboard.nutrition.water', { value: formatWater(waterMl, locale) })}
            </span>
            {waterGoal !== null ? (
              <span className={styles.macroGoal}>
                {' '}
                {t('dashboard.nutrition.ofGoal', { goal: formatWater(waterGoal, locale) })}
              </span>
            ) : null}
          </span>
          {waterGoal !== null ? (
            <span className={styles.waterMeter}>
              <Meter
                tone="water"
                size="thin"
                ratio={goalProgress(waterMl, waterGoal).ratio}
                label={t('dashboard.nutrition.waterLabel')}
                valueText={t('dashboard.nutrition.progress', {
                  value: formatWater(waterMl, locale),
                  goal: formatWater(waterGoal, locale),
                })}
              />
            </span>
          ) : null}
        </span>

        {ready && !hasEntries ? (
          <span className={styles.note}>{t('dashboard.nutrition.none')}</span>
        ) : null}
        {ready && !goal ? (
          <span className={styles.note}>{t('dashboard.nutrition.setup')}</span>
        ) : null}
      </Link>

      {ready && ready.meals.length > 0 ? (
        <Section title={t('dashboard.nutrition.meals')}>
          <List label={t('dashboard.nutrition.meals')}>
            {ready.meals.map((meal) => (
              <MealRow
                key={meal.id}
                meal={meal}
                entries={ready.day.entries.filter((entry) => entry.mealId === meal.id)}
                kcal={kcal}
              />
            ))}
          </List>
        </Section>
      ) : null}
    </>
  );
}

function MealRow({
  meal,
  entries,
  kcal,
}: {
  meal: MealSlot;
  entries: FoodEntry[];
  kcal: (value: number) => string;
}) {
  const { t } = useI18n();
  // Reference names are long ("Joghurt mild, mind. 3,5 % Fett"); the preview keeps the first part.
  const names = [
    ...new Set(entries.map((entry) => entry.name.split(',')[0]?.trim() ?? entry.name)),
  ];
  const preview =
    names.length > PREVIEW_FOODS
      ? `${names.slice(0, PREVIEW_FOODS).join(' · ')} ${t('dashboard.nutrition.moreFoods', {
          count: names.length - PREVIEW_FOODS,
        })}`
      : names.join(' · ');
  const energy = entries.reduce((sum, entry) => sum + entry.nutrients.energyKcal, 0);
  return (
    <ListRow
      title={mealDisplayName(meal, (key) => t(`nutrition.meals.${key}`))}
      subtitle={preview || t('dashboard.nutrition.mealEmpty')}
      value={entries.length > 0 ? kcal(energy) : '–'}
      icon={meal.defaultKey ? MEAL_ICONS[meal.defaultKey] : 'nutrition'}
      to={ROUTES.nutrition}
    />
  );
}
