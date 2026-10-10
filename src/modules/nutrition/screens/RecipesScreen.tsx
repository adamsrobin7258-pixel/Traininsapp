import { useId, useState } from 'react';
import { SETTINGS_LINKS } from '@/app/routes';
import { useI18n } from '@/core/i18n';
import type { Recipe } from '@/core/nutrition';
import { EmptyState, ICON_FOR, List, ListRow, Screen, Section } from '@/ui';
import { RecipeFormSheet } from '../components/RecipeFormSheet';
import { matchesRecipe, useRecipes } from '../components/useRecipes';
import { recipeSubtitle } from '../domain/recipes';
import styles from '../components/Nutrition.module.css';

/**
 * Einstellungen → Meine Inhalte → Rezepte: create, open, edit and delete recipes. The same
 * recipe form is the quick access when logging. Deleting a recipe never changes logged days.
 */
export function RecipesScreen() {
  const { t, locale } = useI18n();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const recipes = useRecipes();
  const list = recipes.status === 'ready' ? recipes.data : [];
  const matches = list.filter(({ recipe }) => matchesRecipe(recipe, query));

  return (
    <Screen
      title={t('nutrition.recipes.title')}
      back={{ to: SETTINGS_LINKS.content, label: t('settings.content.title') }}
    >
      {list.length > 0 ? (
        <>
          <label htmlFor={searchId} className="visually-hidden">
            {t('nutrition.recipes.search')}
          </label>
          <input
            id={searchId}
            className={styles.search}
            type="search"
            value={query}
            placeholder={t('nutrition.recipes.searchPlaceholder')}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => {
              setQuery(event.target.value);
            }}
          />
        </>
      ) : null}
      {recipes.status === 'error' ? (
        <p className={styles.error} role="alert">
          {t('nutrition.errors.loadFailed')}
        </p>
      ) : null}
      {notice ? (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      ) : null}
      <Section footer={t('nutrition.recipes.listHint')}>
        <List label={t('nutrition.recipes.title')}>
          <ListRow
            title={t('nutrition.recipes.create')}
            icon="plus"
            action
            onPress={() => {
              setNotice(null);
              setEditing('new');
            }}
          />
          {matches.map(({ recipe, kcalPerServing }) => (
            <ListRow
              key={recipe.id}
              title={recipe.name}
              subtitle={recipeSubtitle(recipe, kcalPerServing, t, locale)}
              onPress={() => {
                setNotice(null);
                setEditing(recipe);
              }}
            />
          ))}
        </List>
        {recipes.status === 'ready' && list.length === 0 ? (
          <EmptyState
            icon={ICON_FOR.recipe}
            title={t('nutrition.recipes.empty')}
            body={t('nutrition.recipes.emptyBody')}
          />
        ) : recipes.status === 'ready' && matches.length === 0 ? (
          <EmptyState
            icon="search"
            title={t('nutrition.add.noResults')}
            body={t('nutrition.recipes.noResultsBody')}
          />
        ) : null}
      </Section>

      {editing ? (
        <RecipeFormSheet
          recipe={editing === 'new' ? undefined : editing}
          onSaved={(recipe) => {
            setEditing(null);
            setNotice(t('nutrition.recipes.saved', { name: recipe.name }));
          }}
          onRemoved={(recipe) => {
            setEditing(null);
            setNotice(t('nutrition.recipes.deleted', { name: recipe.name }));
          }}
          onClose={() => {
            setEditing(null);
          }}
        />
      ) : null}
    </Screen>
  );
}
