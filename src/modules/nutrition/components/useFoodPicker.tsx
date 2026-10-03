import { useDeferredValue, useEffect, useId, useState, type ReactNode } from 'react';
import { useI18n, type TranslateFn } from '@/core/i18n';
import {
  useNutrition,
  useNutritionData,
  type Food,
  type FoodSearchResult,
  type ReferenceFood,
} from '@/core/nutrition';
import { dismissKeyboard, EmptyState, FoodArt, Icon, List, ListRow } from '@/ui';
import { describeNutritionError, foodSourceLabel, formatQuantity } from '../domain/format';
import { useBarcodeFlow } from './useBarcodeFlow';
import { FoodFormSheet } from './FoodFormSheet';
import { FavoriteMark, FoodThumb } from './FoodThumb';
import styles from './Nutrition.module.css';

type Step = { kind: 'search' } | { kind: 'create'; name: string };

/** How many recently used foods the search shows before the full list. */
const RECENT_SHOWN = 8;

const per100 = (
  values: { energyKcal: number | null },
  reference: { amount: number; unit: Food['reference']['unit'] },
  t: TranslateFn,
  locale: string,
) =>
  values.energyKcal === null
    ? null
    : t('nutrition.lookup.perReference', {
        kcal: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(values.energyKcal),
        amount: formatQuantity(reference.amount, reference.unit, t, locale),
      });

export interface FoodPicker {
  /** The search: barcode, search field, recently used, favourites, all foods / results. */
  panel: ReactNode;
  /**
   * A step that replaces the surrounding sheet (create a food, barcode entry and lookup,
   * import a product); `null` while the search is shown. Its back action returns to the search.
   */
  overlay: ReactNode;
}

/**
 * The one food selection of the nutrition area – used when logging (add sheet) and when
 * putting together recipes and templates. Quick access first (recently used, favourites),
 * then the saved foods and the barcode (scan or type). The search is offline: own foods, saved
 * products and the BLS, in that order; Open Food Facts is only asked for an unknown barcode.
 * A BLS food is stored on first use; a new food is created with the shared `FoodFormSheet`.
 * Every picked food reaches `onPicked` as a stored food.
 */
export function useFoodPicker({ onPicked }: { onPicked: (food: Food) => void }): FoodPicker {
  const { t, locale } = useI18n();
  const { services, mutate } = useNutrition();
  // Prepares the bundled BLS data while the picker opens, so the first search is instant.
  useEffect(() => {
    services.lookup.referenceInfo().catch(() => undefined);
  }, [services]);
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [picking, setPicking] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const data = useNutritionData(
    async (s, id) => ({
      foods: await s.foods.list(id),
      recent: await s.foods.recent(id, RECENT_SHOWN),
    }),
    [],
  );
  // Searching is local and fast; deferring keeps typing smooth on slower phones.
  const searchQuery = useDeferredValue(query.trim());
  const results = useNutritionData((s, id) => s.lookup.search(id, searchQuery), [searchQuery]);
  const back = () => {
    setStep({ kind: 'search' });
  };
  const picked = (food: Food) => {
    setStep({ kind: 'search' });
    onPicked(food);
  };

  /** A BLS food is stored on first use, then picked like any other food. */
  function pickReference(reference: ReferenceFood) {
    if (picking) return;
    setPicking(reference.code);
    setFailure(null);
    mutate((s) => s.lookup.useReference(reference)).then(
      (food) => {
        setPicking(null);
        onPicked(food);
      },
      (error: unknown) => {
        setPicking(null);
        setFailure(describeNutritionError(error, t));
      },
    );
  }

  // Barcode (scan or type) – the shared flow, also used by the food management.
  const barcode = useBarcodeFlow({
    onLocal: picked,
    onSaved: picked,
    createName: () => query.trim(),
  });

  const overlay: ReactNode =
    step.kind === 'create' ? (
      <FoodFormSheet initialName={step.name} onSaved={picked} onClose={back} />
    ) : (
      barcode.overlay
    );

  const ready = data.status === 'ready' ? data.data : null;
  const searching = query.trim() !== '';
  const matches: FoodSearchResult[] = searching && results.status === 'ready' ? results.data : [];
  const referenceVersion = matches.find((r) => r.kind === 'reference')?.reference.version;
  const favorites = ready ? ready.foods.filter((food) => food.favorite) : [];

  const foodRow = (food: Food, key: string) => (
    <ListRow
      key={key}
      title={food.name}
      subtitle={[
        food.brand,
        foodSourceLabel(food, t),
        per100(food.nutrients, food.reference, t, locale),
      ]
        .filter(Boolean)
        .join(' · ')}
      leading={<FoodThumb food={food} />}
      trailing={food.favorite ? <FavoriteMark /> : undefined}
      onPress={() => {
        onPicked(food);
      }}
    />
  );

  const referenceRow = (reference: ReferenceFood) => (
    <ListRow
      key={`bls-${reference.code}`}
      title={reference.name}
      subtitle={[
        t('nutrition.sources.bls', { version: reference.version }),
        per100(reference.nutrients, { amount: 100, unit: 'g' }, t, locale),
      ].join(' · ')}
      leading={<FoodThumb food={reference} />}
      disabled={picking !== null}
      onPress={() => {
        pickReference(reference);
      }}
    />
  );

  const createRow = (
    <ListRow
      title={t('nutrition.add.create')}
      icon="plus"
      action
      onPress={() => {
        setStep({ kind: 'create', name: query });
      }}
    />
  );

  const panel = (
    <>
      <div className={`${styles.quick} ${styles.quickWide}`}>
        <button type="button" className={styles.chip} onClick={() => void barcode.scan()}>
          <Icon name="barcode" size={18} /> {t('nutrition.lookup.scan')}
        </button>
        <button type="button" className={styles.chip} onClick={barcode.enter}>
          {t('nutrition.lookup.enterBarcode')}
        </button>
      </div>
      <label htmlFor={searchId} className="visually-hidden">
        {t('nutrition.add.search')}
      </label>
      <input
        id={searchId}
        className={styles.search}
        type="search"
        value={query}
        placeholder={t('nutrition.add.searchPlaceholder')}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => {
          setQuery(event.target.value);
          setFailure(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') dismissKeyboard();
        }}
      />
      <div className={styles.scroll} data-testid="food-search-list">
        {!searching && ready && ready.recent.length > 0 ? (
          <section aria-label={t('nutrition.lookup.recent')}>
            <h3 className={styles.listTitle}>{t('nutrition.lookup.recent')}</h3>
            <List label={t('nutrition.lookup.recent')}>
              {ready.recent.map((food) => foodRow(food, `recent-${food.id}`))}
            </List>
          </section>
        ) : null}
        {!searching && favorites.length > 0 ? (
          <section aria-label={t('nutrition.lookup.favorites')}>
            <h3 className={styles.listTitle}>{t('nutrition.lookup.favorites')}</h3>
            <List label={t('nutrition.lookup.favorites')}>
              {favorites.map((food) => foodRow(food, `fav-${food.id}`))}
            </List>
          </section>
        ) : null}

        {searching ? (
          <section aria-label={t('nutrition.lookup.results')}>
            <h3 className={styles.listTitle}>{t('nutrition.lookup.results')}</h3>
            {failure ? (
              <p className={styles.error} role="alert">
                {failure}
              </p>
            ) : null}
            <List label={t('nutrition.lookup.results')}>
              {createRow}
              {matches.map((result) =>
                result.kind === 'food'
                  ? foodRow(result.food, result.food.id)
                  : referenceRow(result.reference),
              )}
            </List>
            {results.status === 'ready' && matches.length === 0 ? (
              <EmptyState
                art={<FoodArt name="food" size={48} />}
                title={t('nutrition.add.noResults')}
                body={t('nutrition.add.noResultsBody')}
              />
            ) : null}
            {referenceVersion ? (
              <p className={styles.empty}>
                {t('nutrition.sources.blsAttribution', { version: referenceVersion })}
              </p>
            ) : null}
          </section>
        ) : (
          <section aria-label={t('nutrition.lookup.allFoods')}>
            <h3 className={styles.listTitle}>{t('nutrition.lookup.allFoods')}</h3>
            <List label={t('nutrition.add.foodsTab')}>
              {createRow}
              {ready ? ready.foods.map((food) => foodRow(food, food.id)) : null}
            </List>
            {ready && ready.foods.length === 0 ? (
              <EmptyState
                art={<FoodArt name="fruit" size={48} />}
                title={t('nutrition.add.noFoods')}
                body={t('nutrition.add.noFoodsBody')}
              />
            ) : null}
          </section>
        )}
        {data.status === 'error' || results.status === 'error' ? (
          <p className={styles.error} role="alert">
            {t('nutrition.errors.loadFailed')}
          </p>
        ) : null}
      </div>
    </>
  );

  return { panel, overlay };
}
