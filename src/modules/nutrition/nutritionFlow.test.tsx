import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { ZERO_NUTRIENTS, type FoodInput } from '@/core/nutrition';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

const oats: FoodInput = {
  name: 'Haferflocken',
  brand: 'Kölln',
  reference: { amount: 100, unit: 'g' },
  nutrients: { ...ZERO_NUTRIENTS, energyKcal: 370, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
  servings: [{ unit: 'serving', amount: 40, amountUnit: 'g', label: null }],
};

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closed() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

/** Default meals plus a food; returns the meal ids by default key. */
async function prepareBasics(services: AppServices, profileId: string) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const meals = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, oats);
  const byKey = Object.fromEntries(meals.map((m) => [m.defaultKey ?? m.id, m.id]));
  return { n, food, meals: byKey as Record<string, string> };
}

/** Sets an own value for a goal on the nutrition profile page. */
async function setOwnValue(row: RegExp, value: string) {
  await userEvent.click(await screen.findByRole('button', { name: row }));
  const field = dialog().getByLabelText(/^Eigener Wert/);
  await userEvent.clear(field);
  await userEvent.type(field, value);
  await userEvent.click(dialog().getByRole('button', { name: 'Eigenen Wert verwenden' }));
  await closed();
}

function section(name: RegExp) {
  const heading = screen.getByRole('heading', { level: 2, name });
  const element = heading.closest('section');
  if (!element) throw new Error(`no section ${String(name)}`);
  return within(element);
}

describe('nutrition diary', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens today with the configured meals and invents no goals', async () => {
    await renderApp('/nutrition');
    expect(await screen.findByRole('heading', { level: 1, name: 'Ernährung' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Datum wählen: Heute/)).toHaveValue('2026-10-03');
    for (const meal of ['Frühstück', 'Mittagessen', 'Abendessen', 'Snacks']) {
      expect(screen.getByRole('button', { name: `${meal} · 0 kcal` })).toBeInTheDocument();
    }
    // An empty meal shows only its one action – no extra "nothing logged" text (Phase 17.4).
    expect(screen.getAllByRole('button', { name: /^.+: hinzufügen$/ })).toHaveLength(4);
    expect(screen.queryByText('Noch nichts eingetragen.')).not.toBeInTheDocument();
    // Without any goal one hint leads to Einstellungen → Ziele (Phase 17.5: "Ziele festlegen").
    expect(screen.getByText('Noch keine Ziele festgelegt')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ziele festlegen' })).toHaveAttribute(
      'href',
      '/settings/goals',
    );
    // Water is shown without an explanation that it does not count as calories.
    expect(screen.queryByText(/zählt nicht zu Kalorien/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText('Noch kein Wasserziel festgelegt.')).toBeInTheDocument();
  });

  it('switches days up to today, never into the future', async () => {
    const { router } = await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, food, meals } = await prepareBasics(services, profileId);
        await n.diary.addFood(profileId, {
          localDate: '2026-10-02',
          mealId: meals.breakfast ?? '',
          foodId: food.id,
          amount: 100,
          unit: 'g',
        });
      },
    });
    const next = await screen.findByRole('button', { name: 'Nächster Tag' });
    expect(next).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: 'Vorheriger Tag' }));
    expect(await screen.findByLabelText(/Datum wählen: Gestern/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Frühstück · 370 kcal' })).toBeInTheDocument();
    expect(router.state.location.search).toBe('?day=2026-10-02');
    // A past day opens its meals in detail as well.
    await userEvent.click(screen.getByRole('button', { name: 'Frühstück · 370 kcal' }));
    expect(dialog().getByText('Haferflocken')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await closed();

    await userEvent.click(screen.getByRole('button', { name: 'Zu heute' }));
    expect(await screen.findByLabelText(/Datum wählen: Heute/)).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Frühstück · 0 kcal' })).toBeInTheDocument();

    // A future day in the address falls back to today.
    await router.navigate('/nutrition?day=2026-10-10');
    expect(await screen.findByLabelText(/Datum wählen: Heute/)).toHaveValue('2026-10-03');
  });

  it('creates a food in the add flow and logs it with live nutrients', async () => {
    const { db } = await renderApp('/nutrition');
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    expect(dialog().getByText(/Noch keine Lebensmittel gespeichert/)).toBeInTheDocument();
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'Skyr');
    await userEvent.click(dialog().getByRole('button', { name: 'Neues Lebensmittel anlegen' }));

    expect(dialog().getByLabelText('Name')).toHaveValue('Skyr');
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '63');
    await userEvent.type(dialog().getByLabelText('Protein (g)'), '11');
    await userEvent.type(dialog().getByLabelText('Kohlenhydrate (g)'), '4');
    await userEvent.type(dialog().getByLabelText('Fett (g)'), '0,2');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));

    // Straight on to the amount, with the reference amount pre-filled.
    const amount = await screen.findByLabelText('Menge');
    expect(amount).toHaveValue('100');
    await userEvent.clear(amount);
    await userEvent.type(amount, '250');
    const preview = dialog().getByRole('group', { name: 'Nährwerte für diese Menge' });
    expect(within(preview).getByText('158 kcal')).toBeInTheDocument();
    expect(within(preview).getByText('27,5 g')).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Eintragen' }));
    await closed();

    // The day shows the meal with its kcal; the food itself is one tap away (Phase 17.5).
    const breakfast = await screen.findByRole('button', { name: 'Frühstück · 158 kcal' });
    expect(screen.queryByText('Skyr')).not.toBeInTheDocument();
    await userEvent.click(breakfast);
    expect(dialog().getByText('Skyr')).toBeInTheDocument();
    expect(dialog().getByText(/^250 g · P 27,5 g/)).toBeInTheDocument();
    const rows = await db.query<{ name: string; energy_kcal: number }>(
      'SELECT name, energy_kcal FROM food_entries',
    );
    expect(rows).toEqual([{ name: 'Skyr', energy_kcal: 157.5 }]);
  });

  it('finds local foods by name or brand and marks own foods', async () => {
    await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n } = await prepareBasics(services, profileId);
        await n.foods.create(profileId, { ...oats, name: 'Joghurt', brand: 'Müller' });
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Mittagessen: hinzufügen' }));
    const list = within(await screen.findByTestId('food-search-list'));
    expect(await list.findByText('Haferflocken')).toBeInTheDocument();
    expect(list.getByText('Kölln · Eigenes · 370 kcal pro 100 g')).toBeInTheDocument();

    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'muller');
    expect(list.getByText('Joghurt')).toBeInTheDocument();
    expect(list.queryByText('Haferflocken')).not.toBeInTheDocument();

    await userEvent.clear(dialog().getByLabelText('Lebensmittel suchen'));
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'pizza');
    expect(list.getByText(/Nichts gefunden/)).toBeInTheDocument();
  });

  it('validates the food form and saves nothing invalid', async () => {
    const { db } = await renderApp('/settings/content/foods');
    await userEvent.click(await screen.findByRole('button', { name: 'Neues Lebensmittel' }));
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '-5');
    await userEvent.type(dialog().getByLabelText('Protein (g)'), 'abc');
    await userEvent.clear(dialog().getByLabelText('Bezugsmenge'));
    await userEvent.type(dialog().getByLabelText('Bezugsmenge'), '0');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));

    expect(dialog().getByRole('alert')).toHaveTextContent('Bitte prüfe die markierten Felder.');
    expect(dialog().getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(dialog().getByText('Der Wert darf nicht negativ sein.')).toBeInTheDocument();
    expect(dialog().getByText('Bitte eine gültige Zahl eingeben.')).toBeInTheDocument();
    expect(dialog().getAllByText('Bitte ausfüllen.')).toHaveLength(3); // name, carbs, fat
    expect(dialog().getByText(/Menge über 0/)).toBeInTheDocument();
    expect(await db.query('SELECT * FROM foods')).toEqual([]);
  });

  it('creates a food with piece size, so it can be logged in pieces', async () => {
    await renderApp('/settings/content/foods');
    await userEvent.click(await screen.findByRole('button', { name: 'Neues Lebensmittel' }));
    await userEvent.type(dialog().getByLabelText('Name'), 'Banane');
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '89');
    await userEvent.type(dialog().getByLabelText('Protein (g)'), '1,1');
    await userEvent.type(dialog().getByLabelText('Kohlenhydrate (g)'), '20');
    await userEvent.type(dialog().getByLabelText('Fett (g)'), '0,3');
    await userEvent.type(dialog().getByLabelText('Ein Stück entspricht'), '120');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(await screen.findByText('Banane')).toBeInTheDocument();

    // The food was created in Meine Inhalte; logging happens in the Ernährung tab.
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', {
        name: 'Ernährung',
      }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Snacks: hinzufügen' }));
    await userEvent.click(await dialog().findByText('Banane'));
    await userEvent.selectOptions(dialog().getByLabelText('Einheit'), 'piece');
    await userEvent.clear(dialog().getByLabelText('Menge'));
    await userEvent.type(dialog().getByLabelText('Menge'), '2');
    const preview = dialog().getByRole('group', { name: 'Nährwerte für diese Menge' });
    expect(within(preview).getByText('214 kcal')).toBeInTheDocument();
  });

  it('edits amount and meal of an entry on a past day and deletes it after asking', async () => {
    const { db } = await renderApp('/nutrition?day=2026-10-01', {
      prepare: async (services, profileId) => {
        const { n, food, meals } = await prepareBasics(services, profileId);
        await n.diary.addFood(profileId, {
          localDate: '2026-10-01',
          mealId: meals.breakfast ?? '',
          foodId: food.id,
          amount: 100,
          unit: 'g',
        });
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück · 370 kcal' }));
    await userEvent.click(dialog().getByRole('button', { name: /Haferflocken/ }));
    const select = dialog().getByLabelText('Einheit');
    expect(
      within(select)
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Gramm', 'Kilogramm']);
    expect(dialog().getByText(/nur innerhalb von Gewicht/)).toBeInTheDocument();
    await userEvent.clear(dialog().getByLabelText('Menge'));
    await userEvent.type(dialog().getByLabelText('Menge'), '50');
    await userEvent.selectOptions(dialog().getByLabelText('Mahlzeit'), 'Abendessen');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();

    expect(
      await screen.findByRole('button', { name: 'Abendessen · 185 kcal' }),
    ).toBeInTheDocument();
    expect(await db.query('SELECT local_date, amount FROM food_entries')).toEqual([
      { local_date: '2026-10-01', amount: 50 },
    ]);

    // Breakfast is empty now, so its details closed; dinner holds the entry.
    expect(screen.getByRole('button', { name: 'Frühstück · 0 kcal' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Abendessen · 185 kcal' }));
    await userEvent.click(dialog().getByRole('button', { name: /Haferflocken/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Eintrag löschen' }));
    expect(dialog().getByText('„Haferflocken“ wird aus diesem Tag entfernt.')).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));
    await closed();
    expect(await db.query('SELECT * FROM food_entries')).toEqual([]);
  });

  it('meal details: adding from them returns to them, the template action is there', async () => {
    await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, food, meals } = await prepareBasics(services, profileId);
        await n.foods.create(profileId, { ...oats, name: 'Skyr', brand: null });
        await n.diary.addFood(profileId, {
          localDate: '2026-10-03',
          mealId: meals.breakfast ?? '',
          foodId: food.id,
          amount: 100,
          unit: 'g',
        });
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück · 370 kcal' }));
    expect(screen.getByRole('dialog', { name: 'Frühstück' })).toBeInTheDocument();
    expect(dialog().getByRole('button', { name: 'Als Vorlage speichern' })).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Frühstück: hinzufügen' }));
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'Skyr');
    await userEvent.click(await dialog().findByRole('button', { name: /^Skyr/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Eintragen' }));
    // Back in the meal's details, now with both foods.
    const details = within(await screen.findByRole('dialog', { name: 'Frühstück' }));
    expect(await details.findByText('Skyr')).toBeInTheDocument();
    expect(details.getByText('Haferflocken')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(screen.getByRole('button', { name: 'Frühstück · 740 kcal' })).toBeInTheDocument();
  });

  it('sets goals and shows remaining and exceeded values neutrally', async () => {
    const { db } = await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, food, meals } = await prepareBasics(services, profileId);
        await n.diary.addFood(profileId, {
          localDate: '2026-10-03',
          mealId: meals.lunch ?? '',
          foodId: food.id,
          amount: 500,
          unit: 'g',
        });
      },
    });
    // Goals are set under Einstellungen → Ziele; without personal data they are manual values.
    await userEvent.click(await screen.findByRole('link', { name: 'Ziele festlegen' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ziele' })).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('radio', { name: 'Muskelaufbau' }));
    await setOwnValue(/^Kalorienziel/, '1500');
    await setOwnValue(/^Protein/, '120');
    await userEvent.type(screen.getByLabelText('Wasserziel (ml, optional)'), '2500');
    await userEvent.click(
      screen.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }),
    );
    expect(await screen.findByText(/Ernährungsprofil gespeichert/)).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', {
        name: 'Ernährung',
      }),
    );

    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    expect(await overview.findByText('1.500 kcal')).toBeInTheDocument();
    // 1850 kcal eaten: shown as "above goal", without warning colours or wording.
    expect(overview.getByText('Über dem Ziel')).toBeInTheDocument();
    expect(overview.getByText('350 kcal')).toBeInTheDocument();
    expect(overview.getByText('67,5 g von 120 g')).toBeInTheDocument();
    // Fat and carbohydrates follow automatically from the manual calories and protein.
    expect(overview.getAllByRole('progressbar')).toHaveLength(4);
    expect(overview.getByText('35 g von 42 g')).toBeInTheDocument();
    // The amount large, the goal quietly next to it.
    expect(section(/^Wasser$/).getByText('0 ml')).toBeInTheDocument();
    expect(section(/^Wasser$/).getByText('von 2,5 l')).toBeInTheDocument();
    expect(
      await db.query('SELECT goal_type, effective_from, energy_kcal_manual FROM nutrition_goals'),
    ).toEqual([{ goal_type: 'gain', effective_from: '2026-10-03', energy_kcal_manual: 1500 }]);
  });

  it('rejects implausible goals', async () => {
    const { db } = await renderApp('/nutrition/profile');
    await userEvent.click(await screen.findByRole('button', { name: /^Kalorienziel/ }));
    await userEvent.type(dialog().getByLabelText('Eigener Wert (kcal)'), '100');
    await userEvent.click(dialog().getByRole('button', { name: 'Eigenen Wert verwenden' }));
    expect(
      dialog().getByText('Bitte einen Wert zwischen 500 und 10.000 eingeben.'),
    ).toBeInTheDocument();
    expect(await db.query('SELECT * FROM nutrition_goals')).toEqual([]);
  });
});

describe('water', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('logs quick and custom amounts, edits and deletes them, never as kcal', async () => {
    const { db } = await renderApp('/nutrition');
    await userEvent.click(await screen.findByRole('button', { name: '250 ml Wasser hinzufügen' }));
    await userEvent.click(screen.getByRole('button', { name: '500 ml Wasser hinzufügen' }));
    const water = () => section(/^Wasser$/);
    expect(await water().findByText('750 ml')).toBeInTheDocument();

    await userEvent.click(water().getByRole('button', { name: 'Andere Menge' }));
    await userEvent.type(dialog().getByLabelText('Menge in ml'), '330');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(await water().findByText('1,08 l')).toBeInTheDocument();

    // The single entries are details: folded away behind their count.
    const toggle = water().getByRole('button', { name: '3 Einträge' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(water().queryByRole('button', { name: /^Wasser\s*250 ml/ })).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(water().getByRole('button', { name: /^Wasser\s*250 ml/ }));
    await userEvent.clear(dialog().getByLabelText('Menge in ml'));
    await userEvent.type(dialog().getByLabelText('Menge in ml'), '6000');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    expect(dialog().getByText(/zwischen 1 und 5000 ml/)).toBeInTheDocument();
    await userEvent.clear(dialog().getByLabelText('Menge in ml'));
    await userEvent.type(dialog().getByLabelText('Menge in ml'), '200');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(await water().findByText('1,03 l')).toBeInTheDocument();

    await userEvent.click(water().getByRole('button', { name: /^Wasser\s*500 ml/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Eintrag löschen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));
    await closed();
    expect(await water().findByText('530 ml')).toBeInTheDocument();

    const overview = within(screen.getByRole('region', { name: 'Tagesübersicht' }));
    // Eaten calories are the big number of the overview (unit shown separately).
    expect(overview.getByText('0')).toBeInTheDocument();
    expect(await db.query('SELECT * FROM food_entries')).toEqual([]);
  });

  it('lets the user choose the quick amounts (Einstellungen → App)', async () => {
    const { router } = await renderApp('/nutrition');
    // Ernährung only links to the setting – the one place to change it is Einstellungen → App.
    await userEvent.click(await screen.findByRole('link', { name: 'Schnellmengen anpassen' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/settings/app');
    });
    await userEvent.click(await screen.findByRole('button', { name: /^Schnellmengen/ }));
    await userEvent.clear(dialog().getByLabelText('Schnellmenge 1 in ml'));
    await userEvent.type(dialog().getByLabelText('Schnellmenge 1 in ml'), '5');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    expect(dialog().getByRole('alert')).toHaveTextContent(/ganze Zahlen zwischen 10 und 5000/);

    await userEvent.clear(dialog().getByLabelText('Schnellmenge 1 in ml'));
    await userEvent.type(dialog().getByLabelText('Schnellmenge 1 in ml'), '330');
    await userEvent.clear(dialog().getByLabelText('Schnellmenge 3 in ml'));
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(screen.getByRole('button', { name: /^Schnellmengen/ })).toHaveTextContent(
      '330 ml · 500 ml',
    );

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', {
        name: 'Ernährung',
      }),
    );
    expect(
      await screen.findByRole('button', { name: '330 ml Wasser hinzufügen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '500 ml Wasser hinzufügen' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '750 ml Wasser hinzufügen' }),
    ).not.toBeInTheDocument();
  });
});

describe('meals, templates and foods', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('adds, renames, reorders and hides meals but keeps one visible', async () => {
    await renderApp('/settings/content/meals');
    await userEvent.click(await screen.findByRole('button', { name: 'Mahlzeit hinzufügen' }));
    await userEvent.type(dialog().getByLabelText('Name der Mahlzeit'), 'Pre-Workout');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();

    await userEvent.click(await screen.findByRole('button', { name: 'Pre-Workout' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Nach oben' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Umbenennen' }));
    await userEvent.clear(dialog().getByLabelText('Name der Mahlzeit'));
    await userEvent.type(dialog().getByLabelText('Name der Mahlzeit'), 'Vor dem Training');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    const list = within(screen.getByRole('list', { name: 'Mahlzeiten des Tages' }));
    await waitFor(() => {
      expect(list.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Frühstück',
        'Mittagessen',
        'Abendessen',
        'Vor dem Training',
        'Snacks',
        'Mahlzeit hinzufügen',
      ]);
    });

    for (const meal of ['Frühstück', 'Mittagessen', 'Abendessen', 'Vor dem Training']) {
      await userEvent.click(list.getByRole('button', { name: meal }));
      await userEvent.click(dialog().getByRole('button', { name: 'Ausblenden' }));
      await closed();
    }
    await userEvent.click(list.getByRole('button', { name: 'Snacks' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Ausblenden' }));
    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'Mindestens eine Mahlzeit muss eingeblendet bleiben.',
    );
  });

  it('saves a meal as template and logs it edited, leaving the template unchanged', async () => {
    const { services, db } = await renderApp('/nutrition?day=2026-10-02', {
      prepare: async (s, profileId) => {
        const { n, food, meals } = await prepareBasics(s, profileId);
        await n.diary.addFood(profileId, {
          localDate: '2026-10-02',
          mealId: meals.breakfast ?? '',
          foodId: food.id,
          amount: 80,
          unit: 'g',
        });
      },
    });
    // A rarer action: in the meal's details.
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück · 296 kcal' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Als Vorlage speichern' }));
    await userEvent.clear(dialog().getByLabelText('Name der Vorlage'));
    await userEvent.type(dialog().getByLabelText('Name der Vorlage'), 'Porridge');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(await screen.findByText('Vorlage „Porridge“ gespeichert.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Zu heute' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Abendessen: hinzufügen' }));
    await userEvent.click(dialog().getByRole('radio', { name: 'Vorlagen' }));
    await userEvent.click(await dialog().findByRole('button', { name: /Porridge/ }));
    const amount = await dialog().findByLabelText('Haferflocken: Menge (g)');
    expect(amount).toHaveValue('80');
    await userEvent.clear(amount);
    await userEvent.type(amount, '120');
    await userEvent.click(dialog().getByRole('button', { name: 'Eintragen' }));
    await closed();

    expect(
      await screen.findByRole('button', { name: 'Abendessen · 444 kcal' }),
    ).toBeInTheDocument();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const [template] = await services.nutrition.meals.listSavedMeals(profileId);
    expect(template?.items.map((i) => i.amount)).toEqual([80]);
    expect(
      await db.query('SELECT local_date, amount FROM food_entries ORDER BY local_date'),
    ).toEqual([
      { local_date: '2026-10-02', amount: 80 },
      { local_date: '2026-10-03', amount: 120 },
    ]);
  });

  it('renames and deletes templates', async () => {
    await renderApp('/settings/content/templates', {
      prepare: async (s, profileId) => {
        const { n, food } = await prepareBasics(s, profileId);
        await n.meals.saveMeal(profileId, {
          name: 'Porridge',
          items: [{ foodId: food.id, amount: 80, unit: 'g' }],
        });
      },
    });
    // A template opens its own page; the name is changed there and saved.
    await userEvent.click(await screen.findByRole('link', { name: /Porridge/ }));
    await userEvent.clear(await screen.findByLabelText('Name der Vorlage'));
    await userEvent.type(screen.getByLabelText('Name der Vorlage'), 'Haferbrei');
    await userEvent.click(screen.getByRole('button', { name: 'Vorlage speichern' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Vorlage gespeichert.');
    await userEvent.click(screen.getByRole('link', { name: 'Vorlagen' }));
    await userEvent.click(await screen.findByRole('link', { name: /Haferbrei/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Vorlage löschen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));
    await closed();
    expect(await screen.findByText(/Noch keine Vorlagen/)).toBeInTheDocument();
  });

  it('corrects foods without changing logged days; deletes unused, hides used ones', async () => {
    const { db } = await renderApp('/settings/content/foods', {
      prepare: async (s, profileId) => {
        const { n, food, meals } = await prepareBasics(s, profileId);
        await n.foods.create(profileId, { ...oats, name: 'Reis', brand: null });
        await n.diary.addFood(profileId, {
          localDate: '2026-10-02',
          mealId: meals.lunch ?? '',
          foodId: food.id,
          amount: 100,
          unit: 'g',
        });
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Haferflocken/ }));
    const kcal = dialog().getByLabelText('Kalorien (kcal)');
    expect(kcal).toHaveValue('370');
    await userEvent.clear(kcal);
    await userEvent.type(kcal, '380');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(await db.query('SELECT energy_kcal FROM food_entries')).toEqual([{ energy_kcal: 370 }]);

    await userEvent.click(await screen.findByRole('button', { name: /Haferflocken/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Lebensmittel löschen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));
    expect(
      await screen.findByText('„Haferflocken“ wird noch verwendet und wurde ausgeblendet.'),
    ).toBeInTheDocument();
    expect(section(/^Ausgeblendet$/).getByText('Haferflocken')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Reis/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Lebensmittel löschen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));
    expect(await screen.findByText('„Reis“ wurde gelöscht.')).toBeInTheDocument();
    expect(await db.query('SELECT name, active FROM foods')).toEqual([
      { name: 'Haferflocken', active: 0 },
    ]);
  });
});

describe('Day overview progress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Formerly on the Today card; since Phase 7.1 the day's progress lives in the diary only.
  it('shows calorie and protein progress when goals are set', async () => {
    await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, food, meals } = await prepareBasics(services, profileId);
        await n.diary.addFood(profileId, {
          localDate: '2026-10-03',
          mealId: meals.breakfast ?? '',
          foodId: food.id,
          amount: 200,
          unit: 'g',
        });
        await n.goals.save(profileId, {
          goalType: 'maintain',
          targets: {
            energyKcal: { auto: null, manual: 2000 },
            proteinG: { auto: null, manual: 100 },
          },
        });
      },
    });
    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    const energy = await overview.findByRole('progressbar', { name: 'Kalorien' });
    const protein = overview.getByRole('progressbar', { name: 'Protein' });
    expect(energy).toHaveAttribute('aria-valuetext', '740 kcal von 2.000 kcal');
    expect(energy).toHaveAttribute('aria-valuenow', '37');
    expect(protein).toHaveAttribute('aria-valuetext', '27 g von 100 g');
    expect(protein).toHaveAttribute('aria-valuenow', '27');
    // Only the goals that are set get a progress line.
    expect(overview.getAllByRole('progressbar')).toHaveLength(2);
  });
  it('shows no fiber on the day – the values stay in the data (Phase 17.5)', async () => {
    const { db } = await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, meals } = await prepareBasics(services, profileId);
        const bread = await n.foods.create(profileId, {
          ...oats,
          name: 'Vollkornbrot',
          brand: null,
          nutrients: { ...oats.nutrients, energyKcal: 210, fiberG: 10 },
        });
        await n.diary.addFood(profileId, {
          localDate: '2026-10-03',
          mealId: meals.breakfast ?? '',
          foodId: bread.id,
          amount: 120,
          unit: 'g',
        });
      },
    });
    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    await overview.findByText('Protein');
    // No fiber row, no meter, no "not known for all foods".
    expect(screen.queryByText('Ballaststoffe')).not.toBeInTheDocument();
    expect(screen.queryByText(/nicht für alle Lebensmittel bekannt/)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar', { name: 'Ballaststoffe' })).not.toBeInTheDocument();
    // The food and the logged entry keep their fiber.
    expect(await db.query("SELECT fiber_g FROM foods WHERE name = 'Vollkornbrot'")).toEqual([
      { fiber_g: 10 },
    ]);
    expect(await db.query('SELECT fiber_g FROM food_entries')).toEqual([{ fiber_g: 12 }]);
  });

  it('shows no fiber when no logged food states it (unknown is not 0 g)', async () => {
    await renderApp('/nutrition', {
      prepare: async (s, profileId) => {
        const { n, food, meals } = await prepareBasics(s, profileId);
        // Oats without fiber (unknown, not 0 g).
        await n.diary.addFood(profileId, {
          localDate: '2026-10-03',
          mealId: meals.breakfast ?? '',
          foodId: food.id,
          amount: 100,
          unit: 'g',
        });
      },
    });
    const overview = within(await screen.findByRole('region', { name: 'Tagesübersicht' }));
    await overview.findByText('Protein');
    expect(overview.queryByText('Ballaststoffe')).not.toBeInTheDocument();
    expect(overview.queryByText('0 g')).not.toBeInTheDocument();
  });
  it('add sheet: the search comes first, barcode is secondary, each food appears once', async () => {
    await renderApp('/nutrition', {
      prepare: async (services, profileId) => {
        const { n, food, meals } = await prepareBasics(services, profileId);
        await n.foods.create(profileId, { ...oats, name: 'Skyr', brand: null });
        // Oats were eaten: they are "recently used"; Skyr is only saved.
        await n.diary.addFood(profileId, {
          localDate: '2026-10-02',
          mealId: meals.breakfast ?? '',
          foodId: food.id,
          amount: 50,
          unit: 'g',
        });
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
    const sheet = dialog();
    const search = sheet.getByRole('searchbox', { name: 'Lebensmittel suchen' });
    // The search field comes before every list; scanning sits right in it.
    const recent = await sheet.findByRole('region', { name: 'Zuletzt verwendet' });
    expect(search.compareDocumentPosition(recent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(sheet.getByRole('button', { name: 'Barcode scannen' })).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Barcode eingeben' })).toBeInTheDocument();

    // Each food once: oats under "recently used", the rest under "Weitere Lebensmittel".
    expect(sheet.getAllByRole('button', { name: /^Haferflocken/ })).toHaveLength(1);
    const others = within(sheet.getByRole('region', { name: 'Gespeicherte Lebensmittel' }));
    expect(others.getByRole('heading', { name: 'Weitere Lebensmittel' })).toBeInTheDocument();
    expect(others.getByRole('button', { name: /^Skyr/ })).toBeInTheDocument();
    expect(others.queryByRole('button', { name: /^Haferflocken/ })).not.toBeInTheDocument();

    // Typing a barcode still works.
    await userEvent.click(sheet.getByRole('button', { name: 'Barcode eingeben' }));
    expect(await screen.findByLabelText('Barcode (EAN oder UPC)')).toBeInTheDocument();
  });
});
