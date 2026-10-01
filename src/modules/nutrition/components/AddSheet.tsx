import { useEffect, useId, useRef, useState } from 'react';
import { useI18n, type TranslateFn } from '@/core/i18n';
import {
  matchesFoodSearch,
  useNutrition,
  useNutritionData,
  type BarcodeLookup,
  type ExternalProduct,
  type Food,
  type MealSlot,
  type OnlineResult,
  type SavedMeal,
} from '@/core/nutrition';
import { scanBarcode } from '@/core/platform';
import {
  dismissKeyboard,
  Icon,
  List,
  ListRow,
  registerBackHandler,
  SegmentedControl,
  Sheet,
} from '@/ui';
import { describeNutritionError, formatQuantity, mealName } from '../domain/format';
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

type Online =
  | { status: 'idle' }
  | { status: 'loading'; query: string }
  | { status: 'done'; query: string; results: OnlineResult[] }
  | { status: 'error'; query: string; message: string };

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
 * Adding to a meal. Quick access first (recently used, favourites), then the saved foods, an
 * explicit online search and the barcode (scan or type). Every step's back action returns to
 * the search, so the system back gesture never discards more than the current step.
 * Online requests only start on an explicit tap – never while typing.
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
  const { services, profileId } = useNutrition();
  const searchId = useId();
  const [tab, setTab] = useState<Tab>('foods');
  const [query, setQuery] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'search' });
  const [online, setOnline] = useState<Online>({ status: 'idle' });
  const onlineRequest = useRef<AbortController | null>(null);
  const data = useNutritionData(
    async (s, id) => ({
      foods: await s.foods.list(id),
      recent: await s.foods.recent(id, RECENT_SHOWN),
      templates: await s.meals.listSavedMeals(id),
    }),
    [],
  );
  const back = () => {
    setStep({ kind: 'search' });
  };

  function cancelOnline() {
    onlineRequest.current?.abort();
    onlineRequest.current = null;
    setOnline({ status: 'idle' });
  }

  // While online results are shown, system back returns to the local search first.
  const onlineOpen = online.status !== 'idle' && step.kind === 'search';
  useEffect(() => {
    if (!onlineOpen) return;
    return registerBackHandler(() => {
      onlineRequest.current?.abort();
      onlineRequest.current = null;
      setOnline({ status: 'idle' });
    });
  }, [onlineOpen]);

  useEffect(
    () => () => {
      onlineRequest.current?.abort();
    },
    [],
  );

  function searchOnline() {
    const text = query.trim();
    if (text.length < 2 || online.status === 'loading') return;
    dismissKeyboard();
    const controller = new AbortController();
    onlineRequest.current = controller;
    setOnline({ status: 'loading', query: text });
    services.lookup.searchOnline(profileId, text, { locale, signal: controller.signal }).then(
      (results) => {
        if (!controller.signal.aborted) setOnline({ status: 'done', query: text, results });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setOnline({ status: 'error', query: text, message: describeNutritionError(error, t) });
        }
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
  const matches = ready ? ready.foods.filter((food) => matchesFoodSearch(food, query)) : [];
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
        food.source === 'custom'
          ? t('nutrition.add.own')
          : food.source === 'external'
            ? t('nutrition.lookup.onlineTitle')
            : null,
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
              if (online.status !== 'idle') cancelOnline();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') searchOnline();
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

            <section aria-label={t('nutrition.lookup.allFoods')}>
              <h3 className={styles.listTitle}>
                {searching ? t('nutrition.lookup.localResults') : t('nutrition.lookup.allFoods')}
              </h3>
              <List label={t('nutrition.add.foodsTab')}>
                <ListRow
                  title={t('nutrition.add.create')}
                  icon="plus"
                  action
                  onPress={() => {
                    setStep({ kind: 'create', name: query });
                  }}
                />
                {matches.map((food) => foodRow(food, food.id))}
              </List>
              {ready && matches.length === 0 ? (
                <p className={styles.empty}>
                  {ready.foods.length === 0
                    ? t('nutrition.add.noFoods')
                    : t('nutrition.add.noResults')}
                </p>
              ) : null}
            </section>
            {data.status === 'error' ? (
              <p className={styles.error} role="alert">
                {t('nutrition.errors.loadFailed')}
              </p>
            ) : null}

            {searching && query.trim().length >= 2 ? (
              <section aria-label={t('nutrition.lookup.onlineTitle')}>
                <h3 className={styles.listTitle}>{t('nutrition.lookup.onlineTitle')}</h3>
                {online.status === 'idle' ? (
                  <List label={t('nutrition.lookup.onlineTitle')}>
                    <ListRow
                      title={t('nutrition.lookup.onlineSearch', { query: query.trim() })}
                      icon="search"
                      action
                      onPress={searchOnline}
                    />
                  </List>
                ) : null}
                {online.status === 'loading' ? (
                  <div className={styles.stack}>
                    <p className={styles.notice} role="status">
                      {t('nutrition.lookup.onlineLoading')}
                    </p>
                    <button type="button" className={styles.todayLink} onClick={cancelOnline}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : null}
                {online.status === 'error' ? (
                  <div className={styles.stack}>
                    <p className={styles.warning} role="alert">
                      {online.message}
                    </p>
                    <button type="button" className={styles.todayLink} onClick={searchOnline}>
                      {t('nutrition.lookup.retry')}
                    </button>
                  </div>
                ) : null}
                {online.status === 'done' ? (
                  online.results.length > 0 ? (
                    <List label={t('nutrition.lookup.onlineTitle')}>
                      {online.results.map(({ product, local }) => (
                        <ListRow
                          key={product.externalId}
                          title={product.name}
                          subtitle={[
                            product.brand,
                            local
                              ? t('nutrition.lookup.alreadySaved')
                              : product.missing.length > 0
                                ? t('nutrition.lookup.incomplete')
                                : per100(product.nutrients, product.reference, t, locale),
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                          onPress={() => {
                            if (local) pick(local);
                            else setStep({ kind: 'import', product });
                          }}
                        />
                      ))}
                    </List>
                  ) : (
                    <p className={styles.empty}>{t('nutrition.lookup.onlineEmpty')}</p>
                  )
                ) : null}
                <p className={styles.empty}>
                  {t('nutrition.lookup.onlineHint')} {t('nutrition.lookup.attribution')}
                </p>
              </section>
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
