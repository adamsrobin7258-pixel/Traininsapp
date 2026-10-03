import { useId, useState, type SyntheticEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { CONTENT_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import {
  NutritionError,
  SAVED_MEAL_NAME_MAX_LENGTH,
  useNutrition,
  useNutritionData,
  type Food,
  type MealSlot,
  type SavedMeal,
} from '@/core/nutrition';
import { Button, ConfirmSheet, Icon, Screen } from '@/ui';
import { FoodPickerSheet } from '../components/FoodPicker';
import { MealSelect } from '../components/MealSelect';
import { QuantityRows } from '../components/QuantityRows';
import { describeNutritionError, mealName } from '../domain/format';
import {
  draftForFood,
  draftFromQuantity,
  parseQuantities,
  type QuantityDraft,
} from '../domain/quantities';
import styles from '../components/Nutrition.module.css';

/**
 * Einstellungen → Meine Inhalte → Vorlagen → one template: name, meal, foods and amounts,
 * saved through `MealService.updateSavedMeal`. Foods are added with the shared food selection.
 * A template only takes effect when it is applied again – logged days keep their entries.
 */
export function TemplateScreen() {
  const { templateId = '' } = useParams();
  const { t } = useI18n();
  const back = { to: CONTENT_LINKS.templates, label: t('nutrition.templates.title') };
  const data = useNutritionData(
    async (s, profileId) => {
      const template = await s.meals.getSavedMeal(profileId, templateId);
      return {
        template,
        meals: await s.meals.listAll(profileId),
        foods: await s.foods.findMany(
          profileId,
          template.items.map((item) => item.foodId),
        ),
      };
    },
    [templateId],
  );

  if (data.status === 'loading') return null;
  if (data.status === 'error') {
    const gone = data.error instanceof NutritionError && data.error.code === 'not-found';
    return (
      <Screen title={t('nutrition.templates.title')} back={back}>
        <p role="alert">
          {gone ? t('nutrition.templates.notFound') : t('nutrition.errors.loadFailed')}
        </p>
      </Screen>
    );
  }
  return (
    <TemplateEditor
      key={data.data.template.id}
      template={data.data.template}
      meals={data.data.meals}
      storedFoods={data.data.foods}
      back={back}
    />
  );
}

function TemplateEditor({
  template,
  meals,
  storedFoods,
  back,
}: {
  template: SavedMeal;
  meals: readonly MealSlot[];
  storedFoods: readonly Food[];
  back: { to: string; label: string };
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const navigate = useNavigate();
  const nameId = useId();
  const [name, setName] = useState(template.name);
  const [mealId, setMealId] = useState(template.mealId ?? '');
  const [drafts, setDrafts] = useState<QuantityDraft[]>(() =>
    template.items.map((item) => draftFromQuantity(item, locale)),
  );
  const [picked, setPicked] = useState<Food[]>([]);
  const [dialog, setDialog] = useState<'pick' | 'delete' | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const foods = new Map<string, Food>([...storedFoods, ...picked].map((food) => [food.id, food]));
  const activeMeals = meals.filter((meal) => meal.active);
  const storedMeal = meals.find((meal) => meal.id === template.mealId);
  const current =
    storedMeal && !storedMeal.active ? { id: storedMeal.id, label: mealName(storedMeal, t) } : null;

  function changed() {
    setFailure(null);
    setSaved(false);
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const quantities = parseQuantities(drafts, t);
    const missingName = name.trim() === '';
    setNameError(missingName ? t('nutrition.errors.name') : null);
    setRowErrors(quantities.ok ? {} : quantities.errors);
    if (drafts.length === 0) {
      setFailure(t('nutrition.templates.needsItem'));
      return;
    }
    if (missingName || !quantities.ok) {
      setFailure(t('nutrition.errors.checkFields'));
      return;
    }
    setBusy(true);
    try {
      await mutate((s, profileId) =>
        s.meals.updateSavedMeal(profileId, template.id, {
          name,
          mealId: mealId === '' ? null : mealId,
          items: quantities.items.map(({ foodId, amount, unit }) => ({ foodId, amount, unit })),
        }),
      );
      setSaved(true);
    } catch (error) {
      setFailure(describeNutritionError(error, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title={template.name} back={back}>
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        <p className={styles.hint}>{t('nutrition.templates.editHint')}</p>
        <label htmlFor={nameId} className={styles.label}>
          {t('nutrition.templates.name')}
        </label>
        <input
          id={nameId}
          className={styles.field}
          value={name}
          maxLength={SAVED_MEAL_NAME_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="done"
          aria-invalid={nameError !== null}
          onChange={(event) => {
            setName(event.target.value);
            setNameError(null);
            changed();
          }}
        />
        {nameError ? <p className={styles.fieldError}>{nameError}</p> : null}
        <MealSelect
          meals={activeMeals}
          value={mealId}
          current={current}
          noneLabel={t('nutrition.templates.noMeal')}
          onChange={(value) => {
            setMealId(value);
            changed();
          }}
        />

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('nutrition.templates.items')}</legend>
          {drafts.length === 0 ? (
            <p className={styles.hint}>{t('nutrition.templates.needsItem')}</p>
          ) : (
            <QuantityRows
              label={t('nutrition.templates.items')}
              drafts={drafts}
              foods={foods}
              errors={rowErrors}
              onChange={(key, change) => {
                setDrafts((list) =>
                  list.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)),
                );
                setRowErrors((list) => ({ ...list, [key]: '' }));
                changed();
              }}
              onRemove={(key) => {
                setDrafts((list) => list.filter((draft) => draft.key !== key));
                changed();
              }}
            />
          )}
          <button
            type="button"
            className={styles.addRow}
            onClick={() => {
              setDialog('pick');
            }}
          >
            <Icon name="plus" size={18} />
            {t('nutrition.templates.addItem')}
          </button>
        </fieldset>

        {failure ? (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        ) : null}
        {saved ? (
          <p className={styles.notice} role="status">
            {t('nutrition.templates.updated')}
          </p>
        ) : null}
        <Button type="submit" fullWidth disabled={busy}>
          {t('nutrition.templates.save')}
        </Button>
        <Button
          variant="destructive"
          fullWidth
          disabled={busy}
          onClick={() => {
            setDialog('delete');
          }}
        >
          {t('nutrition.templates.delete')}
        </Button>
      </form>

      {dialog === 'pick' ? (
        <FoodPickerSheet
          title={t('nutrition.templates.addItem')}
          onPicked={(food) => {
            setPicked((list) => [...list, food]);
            setDrafts((list) => [...list, draftForFood(food, locale)]);
            setDialog(null);
            changed();
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === 'delete' ? (
        <ConfirmSheet
          title={t('nutrition.templates.deleteTitle')}
          body={t('nutrition.templates.deleteBody', { name: template.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          closeLabel={t('common.close')}
          destructive
          errorText={t('nutrition.errors.saveFailed')}
          onConfirm={async () => {
            await mutate((s, profileId) => s.meals.deleteSavedMeal(profileId, template.id));
            await navigate(CONTENT_LINKS.templates, { replace: true });
          }}
          onClose={() => {
            setDialog(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
