import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import {
  MEAL_NAME_MAX_LENGTH,
  useNutrition,
  useNutritionData,
  type MealSlot,
} from '@/core/nutrition';
import { Button, List, ListRow, PromptSheet, Screen, Section, Sheet } from '@/ui';
import { describeNutritionError, mealName } from '../domain/format';
import styles from '../components/Nutrition.module.css';

type Open =
  { kind: 'add' } | { kind: 'options'; meal: MealSlot } | { kind: 'rename'; meal: MealSlot } | null;

/** Configure the meals of a day: add, rename, reorder, hide (at least one stays visible). */
export function MealsScreen() {
  const { t } = useI18n();
  const { mutate } = useNutrition();
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const meals = useNutritionData((s, profileId) => s.meals.listAll(profileId), []);
  const list = meals.status === 'ready' ? meals.data : [];
  const close = () => {
    setOpen(null);
  };

  function run(change: Parameters<typeof mutate>[0]) {
    setError(null);
    mutate(change).then(close, (failure: unknown) => {
      setError(describeNutritionError(failure, t));
    });
  }

  const current = open?.kind === 'options' ? list.find((m) => m.id === open.meal.id) : undefined;
  const index = current ? list.findIndex((m) => m.id === current.id) : -1;

  return (
    <Screen
      title={t('nutrition.mealsManage.title')}
      back={{ to: ROUTES.nutrition, label: t('nutrition.back') }}
    >
      {meals.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      <Section footer={t('nutrition.mealsManage.hint')}>
        <List label={t('nutrition.mealsManage.title')}>
          {list.map((meal) => (
            <ListRow
              key={meal.id}
              title={mealName(meal, t)}
              subtitle={meal.active ? undefined : t('nutrition.mealsManage.hidden')}
              onPress={() => {
                setError(null);
                setOpen({ kind: 'options', meal });
              }}
            />
          ))}
          <ListRow
            title={t('nutrition.mealsManage.add')}
            icon="plus"
            action
            onPress={() => {
              setOpen({ kind: 'add' });
            }}
          />
        </List>
      </Section>

      {open?.kind === 'options' && current ? (
        <Sheet title={mealName(current, t)} onClose={close} closeLabel={t('common.close')}>
          <div className={styles.stack}>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setOpen({ kind: 'rename', meal: current });
              }}
            >
              {t('nutrition.mealsManage.rename')}
            </Button>
            <div className={styles.pair}>
              <Button
                variant="secondary"
                disabled={index <= 0}
                onClick={() => {
                  setError(null);
                  void mutate((s, profileId) => s.meals.move(profileId, current.id, -1));
                }}
              >
                {t('nutrition.mealsManage.moveUp')}
              </Button>
              <Button
                variant="secondary"
                disabled={index < 0 || index >= list.length - 1}
                onClick={() => {
                  setError(null);
                  void mutate((s, profileId) => s.meals.move(profileId, current.id, 1));
                }}
              >
                {t('nutrition.mealsManage.moveDown')}
              </Button>
            </div>
            <Button
              variant={current.active ? 'destructive' : 'primary'}
              fullWidth
              onClick={() => {
                run((s, profileId) => s.meals.setActive(profileId, current.id, !current.active));
              }}
            >
              {current.active ? t('nutrition.mealsManage.hide') : t('nutrition.mealsManage.show')}
            </Button>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </Sheet>
      ) : null}
      {open?.kind === 'add' || open?.kind === 'rename' ? (
        <PromptSheet
          title={
            open.kind === 'add' ? t('nutrition.mealsManage.add') : t('nutrition.mealsManage.rename')
          }
          label={t('nutrition.mealsManage.name')}
          initialValue={open.kind === 'rename' ? mealName(open.meal, t) : ''}
          maxLength={MEAL_NAME_MAX_LENGTH}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          describeError={(failure) => describeNutritionError(failure, t)}
          onSubmit={async (name) => {
            await mutate(async (s, profileId) => {
              if (open.kind === 'add') await s.meals.add(profileId, name);
              else await s.meals.rename(profileId, open.meal.id, name);
            });
            close();
          }}
          onClose={close}
        />
      ) : null}
    </Screen>
  );
}
