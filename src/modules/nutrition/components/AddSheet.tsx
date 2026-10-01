import { useDeferredValue, useEffect, useId, useState } from 'react';
import { useI18n, type TranslateFn } from '@/core/i18n';
import {
  useNutrition,
  useNutritionData,
  type BarcodeLookup,
  type ExternalProduct,
  type Food,
  type FoodSearchResult,
  type MealSlot,
  type ReferenceFood,
  type SavedMeal,
} from '@/core/nutrition';
import { scanBarcode } from '@/core/platform';
import { dismissKeyboard, Icon, List, ListRow, SegmentedControl, Sheet } from '@/ui';
import {
  describeNutritionError,
  foodSourceLabel,
  formatQuantity,
  mealName,
} from '../domain/format';
import { ApplyTemplateSheet } from './ApplyTemplateSheet';
import {
  BarcodeEntrySheet,
  BarcodeLookupSheet,
  BarcodeNotFoundSheet,
  CameraDeniedSheet,
} from './BarcodeSheets';
import { FoodFormSheet } from './FoodFormSheet';
import { FoodQuantitySheet } from './FoodQuantitySheet';
import styles from './Nutrition.module.css';

type Tab = 'foods' | 'templates';

type Step =
  | { kind: 'search' }
  | { kind: 'create'; name: string; barcode?: string }
  | { kind: 'quantity'; food: Food }
  | { kind: 'template'; template: SavedMeal }
  | { kind: 'barcode-entry'; notice?: string }
  | { kind: 'barcode-lookup'; barcode: string }
  | { kind: 'barcode-not-found'; barcode: string }
  | { kind: 'camera-denied' }
  | { kind: 'import'; product: ExternalProduct };

/** How many recently used foods the sheet shows before the full list. */
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

/**
 * Adding to a meal. Quick access first (recently used, favourites), then the saved foods and
 * the barcode (scan or type). The search is offline: own foods, saved products and the BLS, in
 * that order. Open Food Facts is only asked for an unknown barcode. Every step's back action
 * returns to the search, so the system back gesture never discards more than the current step.
 */
export function AddSheet({
  day,
  meal,
  meals,
  onClose,
}: {
  day: string;
  meal: MealSlot;
  meals: readonly MealSlot[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const { services, mutate } = useNutrition();
  // Prepares the bundled BLS data while the sheet opens, so the first search is instant.
  useEffect(() => {
    services.lookup.referenceInfo().catch(() => undefined);
  }, [services]);
  const searchId = useId();
  const [tab, setTab] = useState<Tab>('foods');
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [picking, setPicking] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const data = useNutritionData(
    async (s, id) => ({
      foods: await s.foods.list(id),
      recent: await s.foods.recent(id, RECENT_SHOWN),
      templates: await s.meals.listSavedMeals(id),
    }),
    [],
  );
  // Searching is local and fast; deferring keeps typing smooth on slower phones.
  const searchQuery = useDeferredValue(query.trim());
  const results = useNutritionData((s, id) => s.lookup.search(id, searchQuery), [searchQuery]);
  const back = () => {
    setStep({ kind: 'search' });
  };

  /** A BLS food is stored on first use, then entered like any other food. */
  function pickReference(reference: ReferenceFood) {
    if (picking) return;
    setPicking(reference.code);
    setFailure(null);
    mutate((s) => s.lookup.useReference(reference)).then(
      (food) => {
        setPicking(null);
        setStep({ kind: 'quantity', food });
      },
      (error: unknown) => {
        setPicking(null);
        setFailure(describeNutritionError(error, t));
      },
    );
  }

  async function scan() {
    dismissKeyboard();
    const outcome = await scanBarcode({
      instructions: t('nutrition.lookup.scanInstructions'),
      cancel: t('common.cancel'),
    });
    if (outcome.kind === 'scanned') setStep({ kind: 'barcode-lookup', barcode: outcome.code });
    else if (outcome.kind === 'denied') setStep({ kind: 'camera-denied' });
    else if (outcome.kind === 'unavailable') {
      setStep({ kind: 'barcode-entry', notice: t('nutrition.lookup.scannerUnavailable') });
    }
  }

  function handleLookup(result: BarcodeLookup) {
    if (result.kind === 'local') setStep({ kind: 'quantity', food: result.food });
    else if (result.kind === 'external') setStep({ kind: 'import', product: result.product });
    else setStep({ kind: 'barcode-not-found', barcode: result.barcode });
  }

  switch (step.kind) {
    case 'create':
      return (
        <FoodFormSheet
          initialName={step.name}
          initialBarcode={step.barcode}
          onSaved={(food) => {
            setStep({ kind: 'quantity', food });
          }}
          onClose={back}
        />
      );
    case 'import':
      return (
        <FoodFormSheet
          product={step.product}
          onSaved={(food) => {
            setStep({ kind: 'quantity', food });
          }}
          onClose={back}
        />
      );
    case 'quantity':
      return (
        <FoodQuantitySheet
          food={step.food}
          day={day}
          meals={meals}
          mealId={meal.id}
          onBack={back}
          onDone={onClose}
        />
      );
    case 'template':
      return (
        <ApplyTemplateSheet
          template={step.template}
          day={day}
          meals={meals}
          mealId={meal.id}
          onBack={back}
          onDone={onClose}
        />
      );
    case 'barcode-entry':
      return (
        <BarcodeEntrySheet
          notice={step.notice}
          onSubmit={(barcode) => {
            setStep({ kind: 'barcode-lookup', barcode });
          }}
          onClose={back}
        />
      );
    case 'barcode-lookup':
      return (
        <BarcodeLookupSheet
          barcode={step.barcode}
          onResult={handleLookup}
          onEnterManually={() => {
            setStep({ kind: 'barcode-entry' });
          }}
          onClose={back}
        />
      );
    case 'barcode-not-found':
      return (
        <BarcodeNotFoundSheet
          barcode={step.barcode}
          onCreate={() => {
            setStep({ kind: 'create', name: query.trim(), barcode: step.barcode });
          }}
          onSearchByName={back}
          onClose={back}
        />
      );
    case 'camera-denied':
      return (
        <CameraDeniedSheet
          onRetry={() => {
            back();
            void scan();
          }}
          onEnterManually={() => {
            setStep({ kind: 'barcode-entry' });
          }}
          onClose={back}
        />
      );
    case 'search':
      break;
  }

  const ready = data.status === 'ready' ? data.data : null;
  const searching = query.trim() !== '';
  const matches: FoodSearchResult[] = searching && results.status === 'ready' ? results.data : [];
  const referenceVersion = matches.find((r) => r.kind === 'reference')?.reference.version;
  const favorites = ready ? ready.foods.filter((food) => food.favorite) : [];
  const pick = (food: Food) => {
    setStep({ kind: 'quantity', food });
  };

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
      icon={food.favorite ? 'star' : undefined}
      onPress={() => {
        pick(food);
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
      disabled={picking !== null}
      onPress={() => {
        pickReference(reference);
      }}
    />
  );

  return (
    <Sheet
      title={t('nutrition.add.title', { meal: mealName(meal, t) })}
      onClose={onClose}
      closeLabel={t('common.close')}
      fill
    >
      <SegmentedControl
        label={t('nutrition.add.kind')}
        options={[
          { value: 'foods', label: t('nutrition.add.foodsTab') },
          { value: 'templates', label: t('nutrition.add.templatesTab') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'foods' ? (
        <>
          <div className={styles.quick}>
            <button type="button" className={styles.chip} onClick={() => void scan()}>
              <Icon name="barcode" size={18} /> {t('nutrition.lookup.scan')}
            </button>
            <button
              type="button"
              className={styles.chip}
              onClick={() => {
                setStep({ kind: 'barcode-entry' });
              }}
            >
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
                  <ListRow
                    title={t('nutrition.add.create')}
                    icon="plus"
                    action
                    onPress={() => {
                      setStep({ kind: 'create', name: query });
                    }}
                  />
                  {matches.map((result) =>
                    result.kind === 'food'
                      ? foodRow(result.food, result.food.id)
                      : referenceRow(result.reference),
                  )}
                </List>
                {results.status === 'ready' && matches.length === 0 ? (
                  <p className={styles.empty}>{t('nutrition.add.noResults')}</p>
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
                  <ListRow
                    title={t('nutrition.add.create')}
                    icon="plus"
                    action
                    onPress={() => {
                      setStep({ kind: 'create', name: query });
                    }}
                  />
                  {ready ? ready.foods.map((food) => foodRow(food, food.id)) : null}
                </List>
                {ready && ready.foods.length === 0 ? (
                  <p className={styles.empty}>{t('nutrition.add.noFoods')}</p>
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
      ) : (
        <div className={styles.scroll}>
          {ready && ready.templates.length > 0 ? (
            <List label={t('nutrition.add.templatesTab')}>
              {ready.templates.map((template) => (
                <ListRow
                  key={template.id}
                  title={template.name}
                  subtitle={t('nutrition.templates.itemCount', { count: template.items.length })}
                  onPress={() => {
                    setStep({ kind: 'template', template });
                  }}
                />
              ))}
            </List>
          ) : ready ? (
            <p className={styles.empty}>{t('nutrition.add.noTemplates')}</p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
