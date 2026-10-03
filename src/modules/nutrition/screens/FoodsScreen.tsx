import { useDeferredValue, useId, useState } from 'react';
import { SETTINGS_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import {
  matchesFoodSearch,
  useNutrition,
  useNutritionData,
  type Food,
  type ReferenceFood,
} from '@/core/nutrition';
import { EmptyState, FoodArt, Icon, List, ListRow, Screen, Section } from '@/ui';
import { FoodFormSheet } from '../components/FoodFormSheet';
import { FavoriteMark, FoodThumb } from '../components/FoodThumb';
import { useBarcodeFlow } from '../components/useBarcodeFlow';
import { describeNutritionError, foodSourceLabel, formatQuantity } from '../domain/format';
import styles from '../components/Nutrition.module.css';

/**
 * The one food management (Einstellungen → Meine Inhalte → Lebensmittel): own foods, saved
 * products and BLS foods used before. Own foods can be corrected, hidden or deleted (a food in
 * use is only hidden – logged days keep their snapshot); BLS foods open read-only (edit as own
 * copy). The search also finds BLS foods not used yet. A barcode (scan or type) uses the same
 * flow as logging: a known code opens its food, an unknown one is looked up at Open Food Facts
 * and reviewed in the food form before it is stored.
 */
export function FoodsScreen() {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const { mutate } = useNutrition();
  const barcode = useBarcodeFlow({
    onLocal: (food) => {
      setNotice(t('nutrition.foods.barcodeFound', { name: food.name }));
      setEditing(food);
    },
    onSaved: (food) => {
      setNotice(t('nutrition.foods.saved', { name: food.name }));
    },
    createName: () => query.trim(),
  });
  // BLS foods not used yet – the offline search of the lookup (stored foods are listed below).
  const searchQuery = useDeferredValue(query.trim());
  const references = useNutritionData(
    async (s, profileId) =>
      searchQuery === ''
        ? []
        : (await s.lookup.search(profileId, searchQuery)).flatMap((result) =>
            result.kind === 'reference' ? [result.reference] : [],
          ),
    [searchQuery],
  );
  /** A BLS food is stored when it is opened (like on first use), then shown read-only. */
  function openReference(reference: ReferenceFood) {
    if (opening) return;
    setOpening(reference.code);
    setFailure(null);
    mutate((s) => s.lookup.useReference(reference)).then(
      (food) => {
        setOpening(null);
        setNotice(null);
        setEditing(food);
      },
      (error: unknown) => {
        setOpening(null);
        setFailure(describeNutritionError(error, t));
      },
    );
  }
  const foods = useNutritionData(
    (s, profileId) => s.foods.list(profileId, { includeInactive: true }),
    [],
  );

  const matches =
    foods.status === 'ready' ? foods.data.filter((food) => matchesFoodSearch(food, query)) : [];
  const active = matches.filter((food) => food.active);
  const favorites = active.filter((food) => food.favorite);
  const hidden = matches.filter((food) => !food.active);
  const kcal = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const subtitle = (food: Food) =>
    [
      food.brand,
      foodSourceLabel(food, t),
      t('nutrition.add.perReference', {
        kcal: kcal.format(food.nutrients.energyKcal),
        amount: formatQuantity(food.reference.amount, food.reference.unit, t, locale),
      }),
    ]
      .filter(Boolean)
      .join(' · ');

  return (
    <Screen
      title={t('nutrition.foods.title')}
      back={{ to: SETTINGS_LINKS.content, label: t('settings.content.title') }}
    >
      <div className={`${styles.quick} ${styles.quickWide}`}>
        <button
          type="button"
          className={styles.chip}
          onClick={() => {
            setNotice(null);
            void barcode.scan();
          }}
        >
          <Icon name="barcode" size={18} /> {t('nutrition.lookup.scan')}
        </button>
        <button
          type="button"
          className={styles.chip}
          onClick={() => {
            setNotice(null);
            barcode.enter();
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
        }}
      />
      {failure ? (
        <p className={styles.error} role="alert">
          {failure}
        </p>
      ) : null}
      {foods.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      {favorites.length > 0 ? (
        <Section title={t('nutrition.lookup.favorites')}>
          <List label={t('nutrition.lookup.favorites')}>
            {favorites.map((food) => (
              <ListRow
                key={food.id}
                title={food.name}
                subtitle={subtitle(food)}
                leading={<FoodThumb food={food} />}
                onPress={() => {
                  setNotice(null);
                  setEditing(food);
                }}
              />
            ))}
          </List>
        </Section>
      ) : null}
      <Section title={t('nutrition.foods.own')}>
        <List label={t('nutrition.foods.own')}>
          <ListRow
            title={t('nutrition.foods.create')}
            icon="plus"
            action
            onPress={() => {
              setNotice(null);
              setEditing('new');
            }}
          />
          {active.map((food) => (
            <ListRow
              key={food.id}
              title={food.name}
              subtitle={subtitle(food)}
              leading={<FoodThumb food={food} />}
              trailing={food.favorite ? <FavoriteMark /> : undefined}
              onPress={() => {
                setNotice(null);
                setEditing(food);
              }}
            />
          ))}
        </List>
        {foods.status === 'ready' && active.length === 0 ? (
          query.trim() ? (
            <EmptyState
              art={<FoodArt name="food" size={48} />}
              title={t('nutrition.add.noResults')}
              body={t('nutrition.add.noResultsBody')}
            />
          ) : (
            <EmptyState
              art={<FoodArt name="fruit" size={48} />}
              title={t('nutrition.foods.empty')}
              body={t('nutrition.foods.emptyBody')}
            />
          )
        ) : null}
      </Section>
      {references.status === 'ready' && references.data.length > 0 ? (
        <Section
          title={t('nutrition.foods.reference')}
          footer={`${t('nutrition.foods.referenceHint')} ${t('nutrition.sources.blsAttribution', {
            version: references.data[0]?.version ?? '',
          })}`}
        >
          <List label={t('nutrition.foods.reference')}>
            {references.data.map((reference) => (
              <ListRow
                key={`bls-${reference.code}`}
                title={reference.name}
                subtitle={t('nutrition.sources.bls', { version: reference.version })}
                leading={<FoodThumb food={reference} />}
                disabled={opening !== null}
                onPress={() => {
                  openReference(reference);
                }}
              />
            ))}
          </List>
        </Section>
      ) : null}
      {hidden.length > 0 ? (
        <Section title={t('nutrition.foods.hidden')} footer={t('nutrition.foods.hiddenHint')}>
          <List label={t('nutrition.foods.hidden')}>
            {hidden.map((food) => (
              <ListRow
                key={food.id}
                title={food.name}
                subtitle={subtitle(food)}
                leading={<FoodThumb food={food} />}
                onPress={() => {
                  setNotice(null);
                  setEditing(food);
                }}
              />
            ))}
          </List>
        </Section>
      ) : null}

      {barcode.overlay}
      {editing ? (
        <FoodFormSheet
          food={editing === 'new' ? undefined : editing}
          initialName={editing === 'new' ? query.trim() : ''}
          onSaved={() => {
            setEditing(null);
          }}
          onRemoved={(result, food) => {
            setEditing(null);
            setNotice(
              t(result === 'deleted' ? 'nutrition.foods.deleted' : 'nutrition.foods.deactivated', {
                name: food.name,
              }),
            );
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
