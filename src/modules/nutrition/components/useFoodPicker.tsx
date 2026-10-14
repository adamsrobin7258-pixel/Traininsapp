import { useDeferredValue, useEffect, useId, useState, type ReactNode } from 'react';
import { useI18n, type TranslateFn } from '@/core/i18n';
import {
  FoodProviderError,
  ONLINE_SEARCH,
  useNutrition,
  useNutritionData,
  type ExternalProduct,
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

type Step =
  | { kind: 'search' }
  | { kind: 'create'; name: string }
  /** A product found online: reviewed in the food form before it is stored (as barcode). */
  | { kind: 'import'; product: ExternalProduct };

/** The automatic online search for one query (Phase 28). */
type Online =
  | { query: string; status: 'loading' }
  | { query: string; status: 'ready'; products: ExternalProduct[] }
  | { query: string; status: 'failed'; offline: boolean };

/** No online products (stable, so the search does not run again for nothing). */
const NO_PRODUCTS: ExternalProduct[] = [];

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
 * Typing a barcode is a quiet action next to "new food". The search ranks all sources in one
 * list (Phase 28): own foods, saved products and the BLS appear at once, offline; after a pause
 * in typing Open Food Facts is asked for products (nothing but the search text) and they join
 * the same ranking – clear matches first, the rest under "Weitere Treffer". The list updates in
 * place: the previous results stay until the new ones are ready, the status line at its end
 * keeps its height. A BLS food is stored on first use, an online product after review in the
 * shared `FoodFormSheet`. Every picked food reaches `onPicked` as a stored food.
 */
export function useFoodPicker({ onPicked }: { onPicked: (food: Food) => void }): FoodPicker {
  const { t, locale } = useI18n();
  const { services, mutate } = useNutrition();
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
  const canSearchOnline =
    services.lookup.canSearchOnline && searchQuery.length >= ONLINE_SEARCH.minQueryLength;

  // The online search starts after a pause in typing – never per keystroke. A newer query
  // cancels the waiting or running one; a repeated query is answered from memory at once.
  useEffect(() => {
    if (!canSearchOnline) return;
    const controller = new AbortController();
    const run = () => {
      if (!services.lookup.cachedOnlineProducts(searchQuery)) {
        setOnline({ query: searchQuery, status: 'loading' });
      }
      services.lookup.onlineProducts(searchQuery, { signal: controller.signal }).then(
        (products) => {
          if (!controller.signal.aborted) {
            setOnline({ query: searchQuery, status: 'ready', products });
          }
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          const offline = error instanceof FoodProviderError && error.code === 'offline';
          setOnline({ query: searchQuery, status: 'failed', offline });
        },
      );
    };
    const cached = services.lookup.cachedOnlineProducts(searchQuery) !== null;
    const timer = window.setTimeout(run, cached ? 0 : ONLINE_SEARCH.debounceMs);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [services, searchQuery, canSearchOnline]);

  // Online products belong to the query they were asked for; a new query starts without them.
  const onlineNow = canSearchOnline && online?.query === searchQuery ? online : null;
  const onlineProducts = onlineNow?.status === 'ready' ? onlineNow.products : NO_PRODUCTS;
  const results = useNutritionData(
    (s, id) => s.lookup.search(id, searchQuery, { lang, online: onlineProducts }),
    [searchQuery, lang, onlineProducts],
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
  const showsProducts = matches.some((match) => match.kind === 'product');
  const onlineStatus = !canSearchOnline
    ? null
    : onlineNow?.status === 'loading'
      ? t('nutrition.lookup.onlineSearching')
      : onlineNow?.status === 'failed'
        ? t(
            onlineNow.offline
              ? 'nutrition.lookup.onlineOffline'
              : 'nutrition.lookup.onlineUnavailable',
          )
        : t('nutrition.lookup.onlineHint');
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

  /** A product found online: reviewed in the food form, then stored like a scanned one. */
  const productRow = (product: ExternalProduct) => (
    <ListRow
      key={`off-${product.provider}-${product.externalId}`}
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

  const resultRow = (result: FoodSearchResult) =>
    result.kind === 'food'
      ? foodRow(result.food, result.food.id)
      : result.kind === 'reference'
        ? referenceRow(result.reference)
        : productRow(result.product);

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
              {/* Phase 29: only partial matches – say so, never call them passend. */}
              {results.status === 'ready' && matches.length > 0 && strongMatches.length === 0 ? (
                <p className={styles.noExactMatch} role="status" data-testid="no-exact-match">
                  {t('nutrition.lookup.noExactMatch')}
                </p>
              ) : null}
              {results.status === 'ready' && matches.length === 0 ? (
                <EmptyState
                  art={<FoodArt name="food" size={48} />}
                  title={t('nutrition.add.noResults')}
                  body={t('nutrition.add.noResultsBody')}
                />
              ) : null}
            </section>

            {weakMatches.length > 0 ? (
              <section aria-label={t('nutrition.lookup.moreMatches')}>
                <h3 className={styles.listTitle}>{t('nutrition.lookup.moreMatches')}</h3>
                <List label={t('nutrition.lookup.moreMatches')}>{weakMatches.map(resultRow)}</List>
              </section>
            ) : null}
            {/* One line at the end, always the same height: loading never moves the list. */}
            {onlineStatus ? (
              <p
                className={styles.onlineStatus}
                role="status"
                aria-busy={onlineNow?.status === 'loading'}
                data-testid="online-status"
              >
                {onlineStatus}
              </p>
            ) : null}
            {referenceVersion ? (
              <p className={styles.empty}>
                {t('nutrition.sources.blsAttribution', { version: referenceVersion })}
              </p>
            ) : null}
            {showsProducts ? (
              <p className={styles.empty}>{t('nutrition.lookup.attribution')}</p>
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
