import { useId, useState } from 'react';
import { ROUTES } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import { matchesFoodSearch, useNutritionData, type Food } from '@/core/nutrition';
import { List, ListRow, Screen, Section } from '@/ui';
import { FoodFormSheet } from '../components/FoodFormSheet';
import { formatQuantity } from '../domain/format';
import styles from '../components/Nutrition.module.css';

/** The user's own foods: search, create, correct, hide or delete. */
export function FoodsScreen() {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Food | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
      food.source === 'external' ? t('nutrition.lookup.onlineTitle') : null,
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
      back={{ to: ROUTES.nutrition, label: t('nutrition.back') }}
    >
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
                icon="star"
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
              onPress={() => {
                setNotice(null);
                setEditing(food);
              }}
            />
          ))}
        </List>
        {foods.status === 'ready' && active.length === 0 ? (
          <p className={styles.empty}>
            {query.trim() ? t('nutrition.add.noResults') : t('nutrition.foods.empty')}
          </p>
        ) : null}
      </Section>
      {hidden.length > 0 ? (
        <Section title={t('nutrition.foods.hidden')} footer={t('nutrition.foods.hiddenHint')}>
          <List label={t('nutrition.foods.hidden')}>
            {hidden.map((food) => (
              <ListRow
                key={food.id}
                title={food.name}
                subtitle={subtitle(food)}
                onPress={() => {
                  setNotice(null);
                  setEditing(food);
                }}
              />
            ))}
          </List>
        </Section>
      ) : null}

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
