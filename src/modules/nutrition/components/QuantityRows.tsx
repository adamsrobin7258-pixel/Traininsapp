import { useI18n } from '@/core/i18n';
import type { Food, QuantityUnit } from '@/core/nutrition';
import { Icon } from '@/ui';
import { unitsForDraft, type QuantityDraft } from '../domain/quantities';
import styles from './QuantityRows.module.css';
import base from './Nutrition.module.css';

/**
 * The foods of a recipe or a template while they are edited: amount and unit per row (only
 * units the food can be converted to), an optional note, and remove. A hidden food stays as it
 * is and is marked – it is never replaced by another food.
 */
export function QuantityRows({
  label,
  drafts,
  foods,
  errors,
  withNote = false,
  onChange,
  onRemove,
}: {
  label: string;
  drafts: readonly QuantityDraft[];
  foods: ReadonlyMap<string, Food>;
  errors: Readonly<Record<string, string>>;
  /** Recipes keep a short note per ingredient ("gehackt"); templates have none. */
  withNote?: boolean;
  onChange: (key: string, change: Partial<QuantityDraft>) => void;
  onRemove: (key: string) => void;
}) {
  const { t } = useI18n();
  return (
    <ul className={styles.rows} aria-label={label}>
      {drafts.map((draft) => {
        const food = foods.get(draft.foodId);
        const name = food?.name ?? t('nutrition.editor.unknownFood');
        const units: QuantityUnit[] = unitsForDraft(food, draft.unit);
        const error = errors[draft.key];
        return (
          <li key={draft.key} className={styles.row}>
            <div className={styles.head}>
              <span className={styles.name}>
                {name}
                {food?.brand ? <span className={styles.state}>{food.brand}</span> : null}
                {food && !food.active ? (
                  <span className={styles.state}>{t('nutrition.editor.hiddenFood')}</span>
                ) : null}
              </span>
              <button
                type="button"
                className={styles.remove}
                aria-label={t('nutrition.editor.remove', { name })}
                onClick={() => {
                  onRemove(draft.key);
                }}
              >
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className={base.pair}>
              <input
                className={base.field}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                enterKeyHint="done"
                aria-label={t('nutrition.editor.amount', { name })}
                value={draft.amount}
                aria-invalid={Boolean(error)}
                onChange={(event) => {
                  onChange(draft.key, { amount: event.target.value });
                }}
              />
              <select
                className={base.field}
                aria-label={t('nutrition.editor.unit', { name })}
                value={draft.unit}
                disabled={units.length < 2}
                onChange={(event) => {
                  onChange(draft.key, { unit: event.target.value as QuantityUnit });
                }}
              >
                {units.map((unit) => (
                  <option key={unit} value={unit}>
                    {t(`nutrition.units.${unit}`)}
                  </option>
                ))}
              </select>
            </div>
            {withNote ? (
              <input
                className={base.field}
                type="text"
                autoComplete="off"
                enterKeyHint="done"
                maxLength={200}
                aria-label={t('nutrition.editor.note', { name })}
                placeholder={t('nutrition.editor.notePlaceholder')}
                value={draft.note}
                onChange={(event) => {
                  onChange(draft.key, { note: event.target.value });
                }}
              />
            ) : null}
            {error ? <p className={base.fieldError}>{error}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}
