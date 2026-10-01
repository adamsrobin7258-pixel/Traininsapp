import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { NUTRITION_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import {
  SAVED_MEAL_NAME_MAX_LENGTH,
  useNutrition,
  useNutritionData,
  type FoodEntry,
  type MealSlot,
} from '@/core/nutrition';
import { toLocalDateKey } from '@/shared/lib/date';
import { List, ListRow, PromptSheet, Screen, Section } from '@/ui';
import { AddSheet } from '../components/AddSheet';
import { DayNavigator } from '../components/DayNavigator';
import { DayOverview } from '../components/DayOverview';
import { EntrySheet } from '../components/EntrySheet';
import { GoalSheet } from '../components/GoalSheet';
import { MealSection } from '../components/MealSection';
import { WaterSection } from '../components/WaterSection';
import { groupDay, resolveDay, type MealGroup } from '../domain/day';
import { describeNutritionError, mealName } from '../domain/format';
import styles from '../components/Nutrition.module.css';

const DAY_PARAM = 'day';

type Open =
  | { kind: 'add'; meal: MealSlot }
  | { kind: 'entry'; entry: FoodEntry }
  | { kind: 'goal' }
  | { kind: 'template'; group: MealGroup }
  | null;

/**
 * The food diary of one day (today by default): energy and macros against the day's goal,
 * the configured meals with their entries, and water. Past days can be viewed and corrected;
 * future days cannot be opened.
 */
export function NutritionScreen() {
  const { t } = useI18n();
  const { mutate } = useNutrition();
  const [params, setParams] = useSearchParams();
  const today = toLocalDateKey(new Date());
  const day = resolveDay(params.get(DAY_PARAM), today);
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const data = useNutritionData(
    async (s, profileId) => ({
      day: await s.diary.getDay(profileId, day),
      goal: await s.goals.goalFor(profileId, day),
      todayGoal: await s.goals.goalFor(profileId, today),
      meals: await s.meals.listAll(profileId),
    }),
    [day, today],
  );

  function changeDay(next: string) {
    setNotice(null);
    // Replacing keeps the history short: system back leaves the diary instead of
    // stepping through every day that was looked at.
    setParams(next === today ? {} : { [DAY_PARAM]: next }, { replace: true });
  }

  const close = () => {
    setOpen(null);
  };
  const ready = data.status === 'ready' ? data.data : null;
  const activeMeals = ready ? ready.meals.filter((meal) => meal.active) : [];
  const groups = ready ? groupDay(ready.meals, ready.day.entries) : [];

  return (
    <Screen title={t('nutrition.title')}>
      <DayNavigator day={day} today={today} onChange={changeDay} />
      {data.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {ready ? (
        <>
          <DayOverview
            totals={ready.day.summary.totals.totals}
            goal={ready.goal}
            onEditGoal={() => {
              setOpen({ kind: 'goal' });
            }}
          />
          {groups.map((group) => (
            <MealSection
              key={group.key}
              group={group}
              onAdd={() => {
                if (group.meal) setOpen({ kind: 'add', meal: group.meal });
              }}
              onEdit={(entry) => {
                setOpen({ kind: 'entry', entry });
              }}
              onSaveTemplate={() => {
                setOpen({ kind: 'template', group });
              }}
            />
          ))}
          <WaterSection
            day={day}
            entries={ready.day.water}
            totalMl={ready.day.waterMl}
            goalMl={ready.goal?.effective.waterMl.value ?? null}
            onSetGoal={() => {
              setOpen({ kind: 'goal' });
            }}
          />
          <Section title={t('nutrition.more')}>
            <List label={t('nutrition.more')}>
              <ListRow title={t('nutrition.foods.manage')} to={NUTRITION_LINKS.foods} />
              <ListRow title={t('nutrition.mealsManage.manage')} to={NUTRITION_LINKS.meals} />
              <ListRow title={t('nutrition.templates.manage')} to={NUTRITION_LINKS.templates} />
            </List>
          </Section>
        </>
      ) : null}

      {open?.kind === 'add' ? (
        <AddSheet day={day} meal={open.meal} meals={activeMeals} onClose={close} />
      ) : null}
      {open?.kind === 'entry' ? (
        <EntrySheet entry={open.entry} meals={activeMeals} onClose={close} />
      ) : null}
      {open?.kind === 'goal' && ready ? (
        <GoalSheet current={ready.todayGoal} onClose={close} />
      ) : null}
      {open?.kind === 'template' ? (
        <PromptSheet
          title={t('nutrition.mealSection.templateTitle')}
          label={t('nutrition.mealSection.templateName')}
          initialValue={mealName(open.group, t)}
          maxLength={SAVED_MEAL_NAME_MAX_LENGTH}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          describeError={(error) => describeNutritionError(error, t)}
          onSubmit={async (name) => {
            const { group } = open;
            const items = group.entries.flatMap((entry) =>
              entry.foodId
                ? [{ foodId: entry.foodId, amount: entry.amount, unit: entry.unit }]
                : [],
            );
            const saved = await mutate((s, profileId) =>
              s.meals.saveMeal(profileId, { name, mealId: group.meal?.id ?? null, items }),
            );
            const skipped = group.entries.some((entry) => entry.foodId === null);
            setNotice(
              [
                t('nutrition.templates.saved', { name: saved.name }),
                skipped ? t('nutrition.mealSection.templateSkipped') : null,
              ]
                .filter(Boolean)
                .join(' '),
            );
            close();
          }}
          onClose={close}
        />
      ) : null}
    </Screen>
  );
}
