import { useId, useState, type SyntheticEvent } from 'react';
import { useI18n } from '@/core/i18n';
import {
  RECIPE_NAME_MAX_LENGTH,
  recipeNutrition,
  useNutrition,
  useNutritionData,
  type Food,
  type Recipe,
  type RecipeNutrition,
} from '@/core/nutrition';
import { Button, ConfirmSheet, Icon, Sheet } from '@/ui';
import { describeNutritionError } from '../domain/format';
import { formatNumberInput, parseNumberInput, parseOptionalNumber } from '../domain/input';
import {
  draftForFood,
  draftFromQuantity,
  parseQuantities,
  type QuantityDraft,
} from '../domain/quantities';
import { FoodPickerSheet } from './FoodPicker';
import { NutrientPreview } from './NutrientPreview';
import { QuantityRows } from './QuantityRows';
import styles from './Nutrition.module.css';

/** Same limits as `RecipeService` – checked here only to point at the field. */
const MAX_SERVINGS = 100;
const MAX_PREP_MINUTES = 24 * 60;
const TEXT_MAX_LENGTH = 2000;

type Field = 'name' | 'servings' | 'prep';

/**
 * Create or edit a recipe – the one recipe form, used in Einstellungen → Meine Inhalte →
 * Rezepte and as quick access when logging. Ingredients are picked with the shared food
 * selection; the nutrients (total and per serving) come from the core (`recipeNutrition`).
 * Changing a recipe never changes logged days: diary entries keep their own values.
 * Opens without the keyboard – a text field is only focused when tapped.
 */
export function RecipeFormSheet({
  recipe,
  onSaved,
  onRemoved,
  onClose,
}: {
  /** Edit this recipe; omit to create one. */
  recipe?: Recipe;
  onSaved: (recipe: Recipe) => void;
  /** Called after the recipe was deleted (only when editing). */
  onRemoved?: (recipe: Recipe) => void;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { mutate } = useNutrition();
  const ids = { name: useId(), servings: useId(), prep: useId(), text: useId(), notes: useId() };
  const [name, setName] = useState(recipe?.name ?? '');
  const [servings, setServings] = useState(formatNumberInput(recipe?.servings ?? 1, locale));
  const [prep, setPrep] = useState(formatNumberInput(recipe?.prepMinutes ?? null, locale));
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [notes, setNotes] = useState(recipe?.notes ?? '');
  const [drafts, setDrafts] = useState<QuantityDraft[]>(() =>
    (recipe?.ingredients ?? []).map((ingredient) => draftFromQuantity(ingredient, locale)),
  );
  const [picked, setPicked] = useState<Food[]>([]);
  const [step, setStep] = useState<'form' | 'pick' | 'delete'>('form');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Hidden foods are included: an ingredient stays what it is, even if hidden by now.
  const stored = useNutritionData(
    (s, profileId) =>
      s.foods.findMany(
        profileId,
        (recipe?.ingredients ?? []).map((ingredient) => ingredient.foodId),
      ),
    [recipe],
  );
  const foods = new Map<string, Food>(
    [...(stored.status === 'ready' ? stored.data : []), ...picked].map((food) => [food.id, food]),
  );

  const servingsValue = parseServings(servings);
  const quantities = parseQuantities(drafts, t);
  let nutrition: RecipeNutrition | null = null;
  if (servingsValue !== null && quantities.ok) {
    try {
      nutrition = recipeNutrition(
        {
          servings: servingsValue,
          ingredients: quantities.items.map((item, position) => ({
            ...item,
            id: String(position),
            position,
          })),
        },
        foods,
      );
    } catch {
      nutrition = null;
    }
  }

  function changed() {
    setFailure(null);
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<Field, string>> = {};
    if (name.trim() === '') nextErrors.name = t('nutrition.errors.name');
    if (servingsValue === null) nextErrors.servings = t('nutrition.recipes.servingsRange');
    const prepValue = parseOptionalNumber(prep);
    if (
      !prepValue.ok ||
      (prepValue.value !== null &&
        (!Number.isInteger(prepValue.value) || prepValue.value > MAX_PREP_MINUTES))
    ) {
      nextErrors.prep = t('nutrition.recipes.prepRange');
    }
    setErrors(nextErrors);
    setRowErrors(quantities.ok ? {} : quantities.errors);
    if (Object.keys(nextErrors).length > 0 || !quantities.ok || servingsValue === null) {
      setFailure(t('nutrition.errors.checkFields'));
      return;
    }
    const input = {
      name,
      servings: servingsValue,
      prepMinutes: prepValue.ok ? prepValue.value : null,
      description,
      notes,
      ingredients: quantities.items,
    };
    setBusy(true);
    try {
      const saved = await mutate((s, profileId) =>
        recipe ? s.recipes.update(profileId, recipe.id, input) : s.recipes.create(profileId, input),
      );
      onSaved(saved);
    } catch (error) {
      setFailure(describeNutritionError(error, t));
      setBusy(false);
    }
  }

  if (step === 'pick') {
    return (
      <FoodPickerSheet
        title={t('nutrition.recipes.addIngredient')}
        onPicked={(food) => {
          setPicked((current) => [...current, food]);
          setDrafts((current) => [...current, draftForFood(food, locale)]);
          setStep('form');
          changed();
        }}
        onClose={() => {
          setStep('form');
        }}
      />
    );
  }

  if (step === 'delete' && recipe) {
    return (
      <ConfirmSheet
        title={t('nutrition.recipes.deleteTitle')}
        body={t('nutrition.recipes.deleteBody', { name: recipe.name })}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        closeLabel={t('common.close')}
        destructive
        errorText={t('nutrition.errors.saveFailed')}
        onConfirm={async () => {
          await mutate((s, profileId) => s.recipes.delete(profileId, recipe.id));
          onRemoved?.(recipe);
        }}
        onClose={() => {
          setStep('form');
        }}
      />
    );
  }

  return (
    <Sheet
      title={recipe ? t('nutrition.recipes.edit') : t('nutrition.recipes.create')}
      onClose={onClose}
      closeLabel={t('common.close')}
    >
      <form className={styles.form} noValidate onSubmit={(event) => void submit(event)}>
        {recipe ? <p className={styles.hint}>{t('nutrition.recipes.editHint')}</p> : null}
        <label htmlFor={ids.name} className={styles.label}>
          {t('nutrition.recipes.name')}
        </label>
        <input
          id={ids.name}
          className={styles.field}
          value={name}
          maxLength={RECIPE_NAME_MAX_LENGTH}
          autoComplete="off"
          enterKeyHint="next"
          aria-invalid={Boolean(errors.name)}
          onChange={(event) => {
            setName(event.target.value);
            setErrors((current) => ({ ...current, name: undefined }));
            changed();
          }}
        />
        {errors.name ? <p className={styles.fieldError}>{errors.name}</p> : null}
        <div className={styles.pair}>
          <div className={styles.pairItem}>
            <label htmlFor={ids.servings} className={styles.label}>
              {t('nutrition.recipes.servings')}
            </label>
            <input
              id={ids.servings}
              className={styles.field}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              enterKeyHint="done"
              value={servings}
              aria-invalid={Boolean(errors.servings)}
              onChange={(event) => {
                setServings(event.target.value);
                setErrors((current) => ({ ...current, servings: undefined }));
                changed();
              }}
            />
          </div>
          <div className={styles.pairItem}>
            <label htmlFor={ids.prep} className={styles.label}>
              {t('nutrition.recipes.prepMinutes')}
            </label>
            <input
              id={ids.prep}
              className={styles.field}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              enterKeyHint="done"
              value={prep}
              aria-invalid={Boolean(errors.prep)}
              onChange={(event) => {
                setPrep(event.target.value);
                setErrors((current) => ({ ...current, prep: undefined }));
                changed();
              }}
            />
          </div>
        </div>
        {errors.servings ? <p className={styles.fieldError}>{errors.servings}</p> : null}
        {errors.prep ? <p className={styles.fieldError}>{errors.prep}</p> : null}

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('nutrition.recipes.ingredients')}</legend>
          {drafts.length === 0 ? (
            <p className={styles.hint}>{t('nutrition.recipes.noIngredients')}</p>
          ) : (
            <QuantityRows
              label={t('nutrition.recipes.ingredients')}
              drafts={drafts}
              foods={foods}
              errors={rowErrors}
              withNote
              onChange={(key, change) => {
                setDrafts((current) =>
                  current.map((draft) => (draft.key === key ? { ...draft, ...change } : draft)),
                );
                setRowErrors((current) => ({ ...current, [key]: '' }));
                changed();
              }}
              onRemove={(key) => {
                setDrafts((current) => current.filter((draft) => draft.key !== key));
                changed();
              }}
            />
          )}
          <button
            type="button"
            className={styles.addRow}
            onClick={() => {
              setStep('pick');
            }}
          >
            <Icon name="plus" size={18} />
            {t('nutrition.recipes.addIngredient')}
          </button>
        </fieldset>

        <fieldset className={styles.group}>
          <legend className={styles.groupTitle}>{t('nutrition.recipes.nutrition')}</legend>
          <p className={styles.label}>{t('nutrition.recipes.perServing')}</p>
          <NutrientPreview
            nutrients={nutrition?.perServing.totals ?? null}
            label={t('nutrition.recipes.perServing')}
          />
          <p className={styles.label}>{t('nutrition.recipes.total')}</p>
          <NutrientPreview
            nutrients={nutrition?.total.totals ?? null}
            label={t('nutrition.recipes.total')}
          />
          <p className={styles.hint}>{t('nutrition.recipes.nutritionHint')}</p>
        </fieldset>

        <label htmlFor={ids.text} className={styles.label}>
          {t('nutrition.recipes.description')}
        </label>
        <textarea
          id={ids.text}
          className={`${styles.field} ${styles.textArea}`}
          value={description}
          rows={3}
          maxLength={TEXT_MAX_LENGTH}
          onChange={(event) => {
            setDescription(event.target.value);
            changed();
          }}
        />
        <label htmlFor={ids.notes} className={styles.label}>
          {t('nutrition.recipes.notes')}
        </label>
        <textarea
          id={ids.notes}
          className={`${styles.field} ${styles.textArea}`}
          value={notes}
          rows={3}
          maxLength={TEXT_MAX_LENGTH}
          onChange={(event) => {
            setNotes(event.target.value);
            changed();
          }}
        />

        {failure ? (
          <p className={styles.error} role="alert">
            {failure}
          </p>
        ) : null}
        <div className={styles.actions}>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={busy}>
            {t('common.save')}
          </Button>
        </div>
        {recipe ? (
          <Button
            variant="destructive"
            fullWidth
            disabled={busy}
            onClick={() => {
              setStep('delete');
            }}
          >
            {t('nutrition.recipes.delete')}
          </Button>
        ) : null}
      </form>
    </Sheet>
  );
}

/** Servings above 0 and at most 100 (the recipe service's rule); `null` when not valid. */
function parseServings(text: string): number | null {
  const parsed = parseNumberInput(text);
  return parsed.ok && parsed.value > 0 && parsed.value <= MAX_SERVINGS ? parsed.value : null;
}
