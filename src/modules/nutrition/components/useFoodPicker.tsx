import { useDeferredValue, useEffect, useId, useState, type ReactNode } from 'react';
import { useI18n, type TranslateFn } from '@/core/i18n';
import {
  useNutrition,
  useNutritionData,
  type ExternalProduct,
  type Food,
  type FoodSearchResult,
  type OnlineSearchResult,
  type ReferenceFood,
} from '@/core/nutrition';
import { Button, dismissKeyboard, EmptyState, FoodArt, Icon, List, ListRow } from '@/ui';
import { describeNutritionError, foodSourceLabel, formatQuantity } from '../domain/format';
import { useBarcodeFlow } from './useBarcodeFlow';
import { FoodFormSheet } from './FoodFormSheet';
import { FavoriteMark, FoodThumb } from './FoodThumb';
import styles from './Nutrition.module.css';

type Step =
  | { kind: 'search' }
  | { kind: 'create'; name: string }
  /** A product found online: reviewed in the food form before it is stored (as barcode). */
  | { kind: 'import'; product: ExternalProduct };

/** The optional online search for one query (Phase 27). */
type Online =
  | { query: string; status: 'loading' }
  | { query: string; status: 'ready'; results: OnlineSearchResult[] }
  | { query: string; status: 'error'; message: string };

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
 * putting together recipes and templates. The search comes first (scanning sits in the field),
 * then quick access (recently used, favourites) and the remaining saved foods – each food once.
 * Typing a barcode is a quiet action next to "new food". The search is offline: own foods, saved
 * products and the BLS, ranked together by meaning (Phase 27) – clear matches first, the rest
 * under "Weitere Treffer". Open Food Facts is asked for an unknown barcode and, only when the
 * user taps "Weitere Produkte online suchen", for more products (nothing but the search text).
 * A BLS food is stored on first use; a new food is created with the shared `FoodFormSheet`.
 * Every picked food reaches `onPicked` as a stored food.
 */
export function useFoodPicker({ onPicked }: { onPicked: (food: Food) => void }): FoodPicker {
  const { t, locale } = useI18n();
  const { services, mutate, profileId } = useNutrition();
  const lang = locale.startsWith('en') ? 'en' : 'de';
  // Prepares the bundled BLS data while the picker opens, so the first search is instant.
  useEffect(() => {
    services.lookup.referenceInfo().catch(() => undefined);
  }, [services]);
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [picking, setPicking] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [online, setOnline] = useState<Online | null>(null);
  const data = useNutritionData(
    async (s, id) => ({
      foods: await s.foods.list(id),
      recent: await s.foods.recent(id, RECENT_SHOWN),
    }),
    [],
  );
  // Searching is local and fast; deferring keeps typing smooth on slower phones.
  const searchQuery = useDeferredValue(query.trim());
  const results = useNutritionData(
    (s, id) => s.lookup.search(id, searchQuery, { lang }),
    [searchQuery, lang],
  );
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

  /** The second level: more products online – only on this explicit tap, never while typing. */
  function searchOnline() {
    const text = query.trim();
    dismissKeyboard();
    setOnline({ query: text, status: 'loading' });
    services.lookup.searchOnline(profileId, text).then(
      (found) => {
        setOnline((current) =>
          current?.query === text ? { query: text, status: 'ready', results: found } : current,
        );
      },
      (error: unknown) => {
        setOnline((current) =>
          current?.query === text
            ? { query: text, status: 'error', message: describeNutritionError(error, t) }
            : current,
        );
      },
    );
  }

  const overlay: ReactNode =
    step.kind === 'create' ? (
      <FoodFormSheet initialName={step.name} onSaved={picked} onClose={back} />
    ) : step.kind === 'import' ? (
      <FoodFormSheet product={step.product} onSaved={picked} onClose={back} />
    ) : (
      barcode.overlay
    );

  const ready = data.status === 'ready' ? data.data : null;
  const searching = query.trim() !== '';
  const matches: FoodSearchResult[] = searching && results.status === 'ready' ? results.data : [];
  const strongMatches = matches.filter((match) => match.strong);
  const weakMatches = matches.filter((match) => !match.strong);
  // Online results belong to the query they were asked for; a new query starts over.
  const onlineNow = online && online.query === query.trim() ? online : null;
  const canSearchOnline =
    searching && services.lookup.canSearchOnline && query.trim().length >= 2 && onlineNow === null;
  const referenceVersion = matches.find((r) => r.kind === 'reference')?.reference.version;
  // Each food once: recent first, then favourites not among them, then all the others.
  const recentIds = new Set(ready?.recent.map((food) => food.id) ?? []);
  const favorites = ready
    ? ready.foods.filter((food) => food.favorite && !recentIds.has(food.id))
    : [];
  const shownAbove = new Set([...recentIds, ...favorites.map((food) => food.id)]);
  const otherFoods = ready ? ready.foods.filter((food) => !shownAbove.has(food.id)) : [];

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

  const resultRow = (result: FoodSearchResult) =>
    result.kind === 'food' ? foodRow(result.food, result.food.id) : referenceRow(result.reference);

  const onlineRow = (result: OnlineSearchResult) => {
    if (result.kind === 'saved') return foodRow(result.food, `online-${result.food.id}`);
    const { product } = result;
    return (
      <ListRow
        key={`online-${product.externalId}`}
        title={product.name}
        subtitle={[
          product.brand,
          'Open Food Facts',
          product.missing.length > 0
            ? t('nutrition.lookup.incomplete')
            : per100(product.nutrients, product.reference, t, locale),
        ]
          .filter(Boolean)
          .join(' · ')}
        leading={<FoodThumb food={{ origin: null }} />}
        onPress={() => {
          setStep({ kind: 'import', product });
        }}
      />
    );
  };

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

  const enterBarcodeRow = (
    <ListRow
      title={t('nutrition.lookup.enterBarcode')}
      icon="barcode"
      action
      onPress={barcode.enter}
    />
  );

  const panel = (
    <>
      <label htmlFor={searchId} className="visually-hidden">
        {t('nutrition.add.search')}
      </label>
      <div className={styles.searchField}>
        <Icon name="search" size={20} className={styles.searchIcon} />
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
        <button
          type="button"
          className={styles.scanButton}
          aria-label={t('nutrition.lookup.scan')}
          onClick={() => void barcode.scan()}
        >
          <Icon name="barcode" size={22} />
        </button>
      </div>
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
          <>
            <section aria-label={t('nutrition.lookup.results')}>
              <h3 className={styles.listTitle}>
                {strongMatches.length > 0
                  ? t('nutrition.lookup.bestMatches')
                  : t('nutrition.lookup.results')}
              </h3>
              {failure ? (
                <p className={styles.error} role="alert">
                  {failure}
                </p>
              ) : null}
              <List label={t('nutrition.lookup.results')}>
                {strongMatches.map(resultRow)}
                {createRow}
              </List>
              {results.status === 'ready' && matches.length === 0 ? (
                <EmptyState
                  art={<FoodArt name="food" size={48} />}
                  title={t('nutrition.add.noResults')}
                  body={t('nutrition.add.noResultsBody')}
                />
              ) : null}
            </section>

            {/* The optional online level: one deliberate tap, the text alone is sent. */}
            {canSearchOnline ? (
              <div className={styles.onlineSearch}>
                <Button variant="secondary" fullWidth onClick={searchOnline}>
                  <Icon name="search" size={18} />
                  {t('nutrition.lookup.searchOnline')}
                </Button>
                <p className={styles.onlineHint}>{t('nutrition.lookup.searchOnlineHint')}</p>
              </div>
            ) : null}
            {onlineNow ? (
              <section
                aria-label={t('nutrition.lookup.onlineTitle')}
                aria-busy={onlineNow.status === 'loading'}
              >
                <h3 className={styles.listTitle}>{t('nutrition.lookup.onlineTitle')}</h3>
                {onlineNow.status === 'loading' ? (
                  <p className={styles.onlineHint} role="status">
                    {t('nutrition.lookup.onlineSearching')}
                  </p>
                ) : onlineNow.status === 'error' ? (
                  <p className={styles.error} role="alert">
                    {onlineNow.message}
                  </p>
                ) : onlineNow.results.length === 0 ? (
                  <p className={styles.onlineHint} role="status">
                    {t('nutrition.lookup.onlineEmpty')}
                  </p>
                ) : (
                  <>
                    <List label={t('nutrition.lookup.onlineTitle')}>
                      {onlineNow.results.map(onlineRow)}
                    </List>
                    <p className={styles.empty}>{t('nutrition.lookup.attribution')}</p>
                  </>
                )}
              </section>
            ) : null}

            {weakMatches.length > 0 ? (
              <section aria-label={t('nutrition.lookup.moreMatches')}>
                <h3 className={styles.listTitle}>{t('nutrition.lookup.moreMatches')}</h3>
                <List label={t('nutrition.lookup.moreMatches')}>{weakMatches.map(resultRow)}</List>
              </section>
            ) : null}
            {referenceVersion ? (
              <p className={styles.empty}>
                {t('nutrition.sources.blsAttribution', { version: referenceVersion })}
              </p>
            ) : null}
          </>
        ) : (
          <section aria-label={t('nutrition.lookup.allFoods')}>
            <h3 className={styles.listTitle}>
              {shownAbove.size > 0
                ? t('nutrition.lookup.otherFoods')
                : t('nutrition.lookup.allFoods')}
            </h3>
            <List label={t('nutrition.add.foodsTab')}>
              {createRow}
              {enterBarcodeRow}
              {otherFoods.map((food) => foodRow(food, food.id))}
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
