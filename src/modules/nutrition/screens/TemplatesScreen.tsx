import { useState } from 'react';
import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import {
  SAVED_MEAL_NAME_MAX_LENGTH,
  useNutrition,
  useNutritionData,
  type SavedMeal,
} from '@/core/nutrition';
import {
  Button,
  ConfirmSheet,
  EmptyState,
  List,
  ListRow,
  PromptSheet,
  Screen,
  Section,
  Sheet,
} from '@/ui';
import { describeNutritionError, formatQuantity } from '../domain/format';
import styles from '../components/Nutrition.module.css';

type Open =
  | { kind: 'options'; template: SavedMeal }
  | { kind: 'rename'; template: SavedMeal }
  | { kind: 'delete'; template: SavedMeal }
  | null;

/**
 * Saved meals: rename or delete. They are logged from a meal's "Add" sheet; deleting a
 * template never touches logged days.
 */
export function TemplatesScreen() {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const [open, setOpen] = useState<Open>(null);
  const data = useNutritionData(async (s, profileId) => {
    const templates = await s.meals.listSavedMeals(profileId);
    const foods = await s.foods.findMany(
      profileId,
      templates.flatMap((template) => template.items.map((item) => item.foodId)),
    );
    return { templates, foods: new Map(foods.map((food) => [food.id, food])) };
  }, []);
  const close = () => {
    setOpen(null);
  };
  const templates = data.status === 'ready' ? data.data.templates : [];

  return (
    <Screen
      title={t('nutrition.templates.title')}
      back={{ to: ROUTES.nutrition, label: t('nutrition.back') }}
    >
      {data.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      {data.status === 'ready' && templates.length === 0 ? (
        <EmptyState
          icon="plate"
          title={t('nutrition.templates.empty')}
          body={t('nutrition.templates.emptyBody')}
        />
      ) : null}
      {templates.length > 0 ? (
        <Section>
          <List label={t('nutrition.templates.title')}>
            {templates.map((template) => (
              <ListRow
                key={template.id}
                title={template.name}
                subtitle={template.items
                  .map((item) => {
                    const food = data.status === 'ready' ? data.data.foods.get(item.foodId) : null;
                    return `${food?.name ?? '–'} (${formatQuantity(item.amount, item.unit, t, locale)})`;
                  })
                  .join(', ')}
                onPress={() => {
                  setOpen({ kind: 'options', template });
                }}
              />
            ))}
          </List>
        </Section>
      ) : null}

      {open?.kind === 'options' ? (
        <Sheet title={open.template.name} onClose={close} closeLabel={t('common.close')}>
          <div className={styles.stack}>
            <p className={styles.hint}>
              {t('nutrition.templates.itemCount', { count: open.template.items.length })}
            </p>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setOpen({ kind: 'rename', template: open.template });
              }}
            >
              {t('nutrition.templates.rename')}
            </Button>
            <Button
              variant="destructive"
              fullWidth
              onClick={() => {
                setOpen({ kind: 'delete', template: open.template });
              }}
            >
              {t('nutrition.templates.delete')}
            </Button>
          </div>
        </Sheet>
      ) : null}
      {open?.kind === 'rename' ? (
        <PromptSheet
          title={t('nutrition.templates.rename')}
          label={t('nutrition.templates.name')}
          initialValue={open.template.name}
          maxLength={SAVED_MEAL_NAME_MAX_LENGTH}
          confirmLabel={t('common.save')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          describeError={(failure) => describeNutritionError(failure, t)}
          onSubmit={async (name) => {
            const { template } = open;
            await mutate((s, profileId) =>
              s.meals.updateSavedMeal(profileId, template.id, {
                name,
                mealId: template.mealId,
                items: template.items,
              }),
            );
            close();
          }}
          onClose={close}
        />
      ) : null}
      {open?.kind === 'delete' ? (
        <ConfirmSheet
          title={t('nutrition.templates.deleteTitle')}
          body={t('nutrition.templates.deleteBody', { name: open.template.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          destructive
          errorText={t('nutrition.errors.saveFailed')}
          onConfirm={async () => {
            const { template } = open;
            await mutate((s, profileId) => s.meals.deleteSavedMeal(profileId, template.id));
            close();
          }}
          onClose={close}
        />
      ) : null}
    </Screen>
  );
}
