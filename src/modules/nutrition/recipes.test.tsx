import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { ZERO_NUTRIENTS, type FoodInput } from '@/core/nutrition';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

const oats: FoodInput = {
  name: 'Haferflocken',
  reference: { amount: 100, unit: 'g' },
  nutrients: { ...ZERO_NUTRIENTS, energyKcal: 370, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
};
const milk: FoodInput = {
  name: 'Milch',
  reference: { amount: 100, unit: 'ml' },
  nutrients: { ...ZERO_NUTRIENTS, energyKcal: 64, proteinG: 3.4, carbsG: 4.8, fatG: 3.5 },
};
const berries: FoodInput = {
  name: 'Beeren',
  reference: { amount: 100, unit: 'g' },
  nutrients: { ...ZERO_NUTRIENTS, energyKcal: 40, proteinG: 1, carbsG: 8, fatG: 0 },
};

const main = () => within(screen.getByRole('main'));
const dialog = () => within(screen.getByRole('dialog'));
const nav = () => within(screen.getByRole('navigation', { name: 'Hauptnavigation' }));

async function closed() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

/** True when a field that brings up the on-screen keyboard has focus. */
function textFieldFocused() {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && active.type !== 'checkbox')
  );
}

async function foods(services: AppServices, profileId: string) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  return {
    n,
    meals: await n.meals.listActive(profileId),
    oats: await n.foods.create(profileId, oats),
    milk: await n.foods.create(profileId, milk),
    berries: await n.foods.create(profileId, berries),
  };
}

async function onlyFoods(services: AppServices, profileId: string) {
  await foods(services, profileId);
}

/** Picks a food in the shared food selection (opened from a recipe or a template). */
async function pick(name: RegExp) {
  await userEvent.click(await dialog().findByRole('button', { name }));
}

function group(name: string) {
  return within(screen.getByRole('group', { name }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('recipes in Meine Inhalte', () => {
  it('starts empty with a way to create one', async () => {
    await renderApp('/settings/content/recipes');
    expect(await screen.findByRole('heading', { level: 1, name: 'Rezepte' })).toBeInTheDocument();
    expect(await screen.findByText('Noch keine Rezepte')).toBeInTheDocument();
    expect(main().getByRole('button', { name: 'Neues Rezept' })).toBeInTheDocument();
    // No search field while there is nothing to search.
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('creates a recipe from several foods with nutrients from the core – no keyboard on open', async () => {
    const { db } = await renderApp('/settings/content/recipes', { prepare: onlyFoods });
    await userEvent.click(await main().findByRole('button', { name: 'Neues Rezept' }));
    expect(dialog().getByRole('heading', { name: 'Neues Rezept' })).toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);

    await userEvent.type(dialog().getByLabelText('Name'), 'Porridge');
    await userEvent.clear(dialog().getByLabelText('Portionen'));
    await userEvent.type(dialog().getByLabelText('Portionen'), '2');
    await userEvent.click(dialog().getByRole('button', { name: 'Zutat hinzufügen' }));
    // The shared food selection, also without the keyboard.
    expect(dialog().getByRole('heading', { name: 'Zutat hinzufügen' })).toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);
    await pick(/^Haferflocken/);
    await userEvent.click(await dialog().findByRole('button', { name: 'Zutat hinzufügen' }));
    await pick(/^Milch/);

    const amount = (name: string) => dialog().getByLabelText(`${name}: Menge`);
    expect(amount('Haferflocken')).toHaveValue('100');
    expect(dialog().getByLabelText('Milch: Einheit')).toHaveValue('ml');
    await userEvent.clear(amount('Milch'));
    await userEvent.type(amount('Milch'), '300');
    await userEvent.type(dialog().getByLabelText('Haferflocken: Hinweis'), 'kernig');
    // 370 kcal (oats) + 192 kcal (300 ml milk) = 562 kcal; per serving 281 kcal.
    expect(group('Ganzes Rezept').getByText('562 kcal')).toBeInTheDocument();
    expect(group('Pro Portion').getByText('281 kcal')).toBeInTheDocument();
    expect(group('Pro Portion').getByText('11,9 g')).toBeInTheDocument(); // (13,5 + 10,2) / 2

    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(await screen.findByRole('status')).toHaveTextContent('Rezept „Porridge“ gespeichert.');
    expect(
      main().getByRole('button', {
        name: /^Porridge2 Portionen · 2 Zutaten · 281 kcal pro Portion$/,
      }),
    ).toBeInTheDocument();
    expect(
      await db.query(
        'SELECT amount, unit, position, note FROM recipe_ingredients ORDER BY position',
      ),
    ).toEqual([
      { amount: 100, unit: 'g', position: 0, note: 'kernig' },
      { amount: 300, unit: 'ml', position: 1, note: null },
    ]);
  });

  it('validates name, servings and amounts and saves nothing invalid', async () => {
    const { db } = await renderApp('/settings/content/recipes', { prepare: onlyFoods });
    await userEvent.click(await main().findByRole('button', { name: 'Neues Rezept' }));
    await userEvent.clear(dialog().getByLabelText('Portionen'));
    await userEvent.type(dialog().getByLabelText('Portionen'), '0');
    await userEvent.click(dialog().getByRole('button', { name: 'Zutat hinzufügen' }));
    await pick(/^Haferflocken/);
    await userEvent.clear(await dialog().findByLabelText('Haferflocken: Menge'));
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    expect(dialog().getByRole('alert')).toHaveTextContent('Bitte prüfe die markierten Felder.');
    expect(dialog().getByText('Bitte einen Namen eingeben.')).toBeInTheDocument();
    expect(dialog().getByText(/Portionenzahl über 0 und höchstens 100/)).toBeInTheDocument();
    expect(dialog().getByText('Bitte ausfüllen.')).toBeInTheDocument();
    expect(await db.query('SELECT id FROM recipes')).toEqual([]);
  });

  it('edits amounts, removes and adds ingredients and servings; logged days keep their values', async () => {
    const { db } = await renderApp('/settings/content/recipes', {
      prepare: async (services, profileId) => {
        const { n, meals, oats: o, milk: m } = await foods(services, profileId);
        const recipe = await n.recipes.create(profileId, {
          name: 'Porridge',
          servings: 2,
          ingredients: [
            { foodId: o.id, amount: 100, unit: 'g' },
            { foodId: m.id, amount: 300, unit: 'ml' },
          ],
        });
        await n.diary.addRecipe(profileId, {
          recipeId: recipe.id,
          servings: 1,
          localDate: '2026-10-02',
          mealId: meals[0]?.id ?? '',
        });
      },
    });
    const logged = await db.query('SELECT name, amount, energy_kcal FROM food_entries');
    expect(logged).toEqual([{ name: 'Porridge', amount: 1, energy_kcal: 281 }]);

    await userEvent.click(await main().findByRole('button', { name: /^Porridge/ }));
    expect(dialog().getByRole('heading', { name: 'Rezept bearbeiten' })).toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);
    expect(await dialog().findByLabelText('Haferflocken: Menge')).toHaveValue('100');
    await userEvent.clear(dialog().getByLabelText('Haferflocken: Menge'));
    await userEvent.type(dialog().getByLabelText('Haferflocken: Menge'), '200');
    await userEvent.click(dialog().getByRole('button', { name: 'Milch entfernen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Zutat hinzufügen' }));
    await pick(/^Beeren/);
    await userEvent.clear(await dialog().findByLabelText('Portionen'));
    await userEvent.type(dialog().getByLabelText('Portionen'), '4');
    // 740 kcal (200 g oats) + 40 kcal (100 g berries) = 780 kcal; per serving 195 kcal.
    expect(group('Ganzes Rezept').getByText('780 kcal')).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();

    expect(
      await main().findByRole('button', { name: /^Porridge4 Portionen · 2 Zutaten · 195 kcal/ }),
    ).toBeInTheDocument();
    // The logged day is a snapshot and stays exactly as it was.
    expect(await db.query('SELECT name, amount, energy_kcal FROM food_entries')).toEqual(logged);
  });

  it('deletes a recipe after asking; logged days stay', async () => {
    const { db } = await renderApp('/settings/content/recipes', {
      prepare: async (services, profileId) => {
        const { n, meals, oats: o } = await foods(services, profileId);
        const recipe = await n.recipes.create(profileId, {
          name: 'Porridge',
          servings: 1,
          ingredients: [{ foodId: o.id, amount: 100, unit: 'g' }],
        });
        await n.diary.addRecipe(profileId, {
          recipeId: recipe.id,
          servings: 1,
          localDate: '2026-10-01',
          mealId: meals[0]?.id ?? '',
        });
      },
    });
    await userEvent.click(await main().findByRole('button', { name: /^Porridge/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Rezept löschen' }));
    expect(dialog().getByText(/Eingetragene Tage bleiben unverändert/)).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));
    await closed();
    expect(await screen.findByRole('status')).toHaveTextContent('Rezept „Porridge“ gelöscht.');
    expect(await screen.findByText('Noch keine Rezepte')).toBeInTheDocument();
    expect(await db.query('SELECT name, recipe_id, energy_kcal FROM food_entries')).toEqual([
      { name: 'Porridge', recipe_id: null, energy_kcal: 370 },
    ]);
  });

  it('searches the recipes', async () => {
    await renderApp('/settings/content/recipes', {
      prepare: async (services, profileId) => {
        const { n, oats: o } = await foods(services, profileId);
        for (const name of ['Porridge', 'Overnight Oats', 'Müsli'])
          await n.recipes.create(profileId, {
            name,
            servings: 1,
            ingredients: [{ foodId: o.id, amount: 50, unit: 'g' }],
          });
      },
    });
    await main().findByRole('button', { name: /^Porridge/ });
    await userEvent.type(screen.getByRole('searchbox', { name: 'Rezepte suchen' }), 'musli');
    expect(main().getByRole('button', { name: /^Müsli/ })).toBeInTheDocument();
    expect(main().queryByRole('button', { name: /^Porridge/ })).not.toBeInTheDocument();
    await userEvent.clear(screen.getByRole('searchbox'));
    await userEvent.type(screen.getByRole('searchbox'), 'pizza');
    expect(main().getByText('Kein Rezept passt zu dieser Suche.')).toBeInTheDocument();
  });

  it('keeps a hidden ingredient and marks it instead of replacing it', async () => {
    await renderApp('/settings/content/recipes', {
      prepare: async (services, profileId) => {
        const { n, oats: o } = await foods(services, profileId);
        await n.recipes.create(profileId, {
          name: 'Porridge',
          servings: 1,
          ingredients: [{ foodId: o.id, amount: 100, unit: 'g' }],
        });
        await n.foods.remove(profileId, o.id); // in use → only hidden
      },
    });
    await userEvent.click(await main().findByRole('button', { name: /^Porridge/ }));
    const ingredients = within(await dialog().findByRole('list', { name: 'Zutaten' }));
    expect(await ingredients.findByText('Haferflocken')).toBeInTheDocument();
    expect(ingredients.getByText('Ausgeblendet – bleibt erhalten')).toBeInTheDocument();
    expect(group('Ganzes Rezept').getByText('370 kcal')).toBeInTheDocument();
  });
});

describe('recipes in the diary', () => {
  it('logs servings of a recipe from the add sheet', async () => {
    const { db } = await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, oats: o, milk: m } = await foods(services, profileId);
        await n.recipes.create(profileId, {
          name: 'Porridge',
          servings: 4,
          ingredients: [
            { foodId: o.id, amount: 200, unit: 'g' },
            { foodId: m.id, amount: 600, unit: 'ml' },
          ],
        });
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.click(dialog().getByRole('radio', { name: 'Rezepte' }));
    expect(textFieldFocused()).toBe(false);
    // 1124 kcal for 4 servings → 281 kcal per serving.
    await userEvent.click(
      await dialog().findByRole('button', { name: /^Porridge4 Portionen · 2 Zutaten · 281 kcal/ }),
    );
    expect(dialog().getByRole('heading', { name: '„Porridge“ eintragen' })).toBeInTheDocument();
    expect(dialog().getByText('Das Rezept ergibt 4 Portionen.')).toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);
    const servings = dialog().getByLabelText('Portionen');
    await userEvent.clear(servings);
    await userEvent.type(servings, '0,5');
    const preview = group('Nährwerte für diese Menge');
    expect(await preview.findByText('141 kcal')).toBeInTheDocument(); // 140,5 kcal, shown rounded
    await userEvent.click(dialog().getByRole('button', { name: 'Eintragen' }));
    await closed();

    expect(
      await screen.findByRole('heading', { level: 2, name: /^Frühstück · 141 kcal/ }),
    ).toBeInTheDocument();
    expect(main().getByText('Porridge')).toBeInTheDocument();
    expect(
      await db.query('SELECT name, amount, unit, energy_kcal, local_date FROM food_entries'),
    ).toEqual([
      {
        name: 'Porridge',
        amount: 0.5,
        unit: 'serving',
        energy_kcal: 140.5,
        local_date: '2026-10-03',
      },
    ]);
  });

  it('creates a new recipe from the add sheet with the same form and logs it right away', async () => {
    const { db } = await renderApp('/nutrition', { prepare: onlyFoods });
    await userEvent.click(await screen.findByRole('button', { name: 'Mittagessen: hinzufügen' }));
    await userEvent.click(dialog().getByRole('radio', { name: 'Rezepte' }));
    expect(dialog().getByText('Noch keine Rezepte')).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Neues Rezept anlegen' }));
    // Same recipe form as in Meine Inhalte.
    expect(dialog().getByRole('heading', { name: 'Neues Rezept' })).toBeInTheDocument();
    await userEvent.type(dialog().getByLabelText('Name'), 'Beerenquark');
    await userEvent.click(dialog().getByRole('button', { name: 'Zutat hinzufügen' }));
    await pick(/^Beeren/);
    await userEvent.click(await dialog().findByRole('button', { name: 'Speichern' }));

    expect(
      await dialog().findByRole('heading', { name: '„Beerenquark“ eintragen' }),
    ).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Eintragen' }));
    await closed();
    expect(await db.query('SELECT name, energy_kcal FROM food_entries')).toEqual([
      { name: 'Beerenquark', energy_kcal: 40 },
    ]);

    // The recipe is now in Meine Inhalte as well.
    await userEvent.click(nav().getByRole('link', { name: 'Einstellungen' }));
    await userEvent.click(await main().findByRole('link', { name: /^Meine Inhalte/ }));
    await userEvent.click(await main().findByRole('link', { name: /^Rezepte/ }));
    expect(await main().findByRole('button', { name: /^Beerenquark/ })).toBeInTheDocument();
  });

  it('a food created while logging can be picked for recipes and templates', async () => {
    await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, oats: o } = await foods(services, profileId);
        await n.meals.saveMeal(profileId, {
          name: 'Frühstück klassisch',
          items: [{ foodId: o.id, amount: 60, unit: 'g' }],
        });
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'Skyr');
    await userEvent.click(dialog().getByRole('button', { name: 'Neues Lebensmittel anlegen' }));
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '63');
    await userEvent.type(dialog().getByLabelText('Protein (g)'), '11');
    await userEvent.type(dialog().getByLabelText('Kohlenhydrate (g)'), '4');
    await userEvent.type(dialog().getByLabelText('Fett (g)'), '0,2');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await screen.findByLabelText('Menge');
    await userEvent.keyboard('{Escape}');
    await screen.findByLabelText('Lebensmittel suchen');
    await userEvent.keyboard('{Escape}');
    await closed();

    // Recipe editor.
    await userEvent.click(nav().getByRole('link', { name: 'Einstellungen' }));
    await userEvent.click(await main().findByRole('link', { name: /^Meine Inhalte/ }));
    await userEvent.click(await main().findByRole('link', { name: /^Rezepte/ }));
    await userEvent.click(await main().findByRole('button', { name: 'Neues Rezept' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Zutat hinzufügen' }));
    expect(await dialog().findByRole('button', { name: /^Skyr/ })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    await closed();

    // Template editor.
    await userEvent.click(main().getByRole('link', { name: 'Meine Inhalte' }));
    await userEvent.click(await main().findByRole('link', { name: /^Vorlagen/ }));
    await userEvent.click(await main().findByRole('link', { name: /^Frühstück klassisch/ }));
    await userEvent.click(await main().findByRole('button', { name: 'Lebensmittel hinzufügen' }));
    expect(await dialog().findByRole('button', { name: /^Skyr/ })).toBeInTheDocument();
  });
});

describe('editing templates', () => {
  it('changes an amount, removes and adds a food; logged days stay, the next use takes the change', async () => {
    const { db, router } = await renderApp('/settings/content/templates', {
      prepare: async (services, profileId) => {
        const { n, meals, oats: o, milk: m } = await foods(services, profileId);
        const template = await n.meals.saveMeal(profileId, {
          name: 'Frühstück klassisch',
          mealId: meals[0]?.id ?? null,
          items: [
            { foodId: o.id, amount: 60, unit: 'g' },
            { foodId: m.id, amount: 250, unit: 'ml' },
          ],
        });
        await n.diary.addSavedMeal(profileId, {
          savedMealId: template.id,
          localDate: '2026-10-02',
          mealId: meals[0]?.id ?? '',
        });
      },
    });
    const before = await db.query(
      'SELECT id, name, amount, energy_kcal FROM food_entries ORDER BY name',
    );

    await userEvent.click(await main().findByRole('link', { name: /^Frühstück klassisch/ }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Frühstück klassisch' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toMatch(/^\/settings\/content\/templates\/[^/]+$/);
    expect(textFieldFocused()).toBe(false);
    expect(screen.getByLabelText('Mahlzeit')).toHaveValue(
      (await db.query<{ meal_id: string }>('SELECT meal_id FROM saved_meals'))[0]?.meal_id,
    );

    await userEvent.clear(screen.getByLabelText('Haferflocken: Menge'));
    await userEvent.type(screen.getByLabelText('Haferflocken: Menge'), '40');
    await userEvent.click(screen.getByRole('button', { name: 'Milch entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lebensmittel hinzufügen' }));
    expect(textFieldFocused()).toBe(false);
    await pick(/^Beeren/);
    await closed();
    await userEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Vorlage gespeichert.');

    // Reopen: the change is stored.
    await userEvent.click(main().getByRole('link', { name: 'Vorlagen' }));
    expect(
      await main().findByRole('link', {
        name: /^Frühstück klassischHaferflocken \(40 g\), Beeren \(100 g\)$/,
      }),
    ).toBeInTheDocument();
    await userEvent.click(main().getByRole('link', { name: /^Frühstück klassisch/ }));
    expect(await screen.findByLabelText('Haferflocken: Menge')).toHaveValue('40');
    expect(screen.queryByLabelText('Milch: Menge')).not.toBeInTheDocument();

    // The logged day is unchanged …
    expect(
      await db.query('SELECT id, name, amount, energy_kcal FROM food_entries ORDER BY name'),
    ).toEqual(before);

    // … and applying the template now uses the new version.
    await userEvent.click(nav().getByRole('link', { name: 'Ernährung' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.click(dialog().getByRole('radio', { name: 'Vorlagen' }));
    await userEvent.click(dialog().getByRole('button', { name: /^Frühstück klassisch/ }));
    await userEvent.click(await dialog().findByRole('button', { name: 'Eintragen' }));
    await closed();
    expect(
      await db.query(
        "SELECT name, amount, energy_kcal FROM food_entries WHERE local_date = '2026-10-03' ORDER BY name",
      ),
    ).toEqual([
      { name: 'Beeren', amount: 100, energy_kcal: 40 },
      { name: 'Haferflocken', amount: 40, energy_kcal: 148 },
    ]);
  });

  it('needs at least one food and marks a hidden food instead of replacing it', async () => {
    const { db } = await renderApp('/settings/content/templates', {
      prepare: async (services, profileId) => {
        const { n, oats: o } = await foods(services, profileId);
        await n.meals.saveMeal(profileId, {
          name: 'Haferbrei',
          items: [{ foodId: o.id, amount: 60, unit: 'g' }],
        });
        await n.foods.remove(profileId, o.id); // in use → only hidden
      },
    });
    await userEvent.click(await main().findByRole('link', { name: /^Haferbrei/ }));
    expect(await screen.findByText('Ausgeblendet – bleibt erhalten')).toBeInTheDocument();
    expect(screen.getByLabelText('Mahlzeit')).toHaveValue('');
    await userEvent.click(screen.getByRole('button', { name: 'Haferflocken entfernen' }));
    await userEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Eine Vorlage braucht mindestens ein Lebensmittel.',
    );
    expect(await db.query('SELECT amount FROM saved_meal_items')).toEqual([{ amount: 60 }]);
  });

  it('shows a clear message for a template that no longer exists', async () => {
    await renderApp('/settings/content/templates/does-not-exist');
    expect(await screen.findByRole('alert')).toHaveTextContent('Diese Vorlage gibt es nicht mehr.');
    expect(main().getByRole('link', { name: 'Vorlagen' })).toHaveAttribute(
      'href',
      '/settings/content/templates',
    );
  });
});
