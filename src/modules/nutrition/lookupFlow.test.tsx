import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { ZERO_NUTRIENTS } from '@/core/nutrition';
import type { BarcodeScanOutcome } from '@/core/platform';
import { externalProduct, FakeFoodProvider } from '@/test/fakeFoodProvider';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

type ScanWindow = Window & { __kalethraScanBarcode?: () => Promise<BarcodeScanOutcome> };

function simulateScan(outcome: BarcodeScanOutcome) {
  (window as ScanWindow).__kalethraScanBarcode = () => Promise.resolve(outcome);
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closed() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

async function openAdd() {
  await userEvent.click(await screen.findByRole('button', { name: 'Frühstück: hinzufügen' }));
}

function noKeyboard() {
  expect(document.activeElement?.tagName).not.toBe('INPUT');
}

const oats = {
  name: 'Haferflocken',
  reference: { amount: 100, unit: 'g' as const },
  nutrients: { ...ZERO_NUTRIENTS, energyKcal: 370, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
};

async function withFoods(services: AppServices, profileId: string) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [breakfast] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, { ...oats, barcode: '4000540000108' });
  const milk = await n.foods.create(profileId, { ...oats, name: 'Milch' });
  await n.foods.setFavorite(profileId, milk.id, true);
  await n.diary.addFood(profileId, {
    localDate: '2026-10-02',
    mealId: breakfast?.id ?? '',
    foodId: food.id,
    amount: 50,
    unit: 'g',
  });
}

describe('adding foods: quick access, offline search (BLS) and barcode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete (window as ScanWindow).__kalethraScanBarcode;
  });

  it('offers recently used and favourite foods first, without opening the keyboard', async () => {
    await renderApp('/nutrition', { prepare: withFoods });
    await openAdd();
    const recent = within(await screen.findByRole('list', { name: 'Zuletzt verwendet' }));
    expect(recent.getByText('Haferflocken')).toBeInTheDocument();
    const favorites = within(screen.getByRole('list', { name: 'Favoriten' }));
    expect(favorites.getByText('Milch')).toBeInTheDocument();
    noKeyboard();

    await userEvent.click(favorites.getByRole('button', { name: /Milch/ }));
    expect(await dialog().findByLabelText('Menge')).toBeInTheDocument();
    noKeyboard();
  });

  it('marks favourites from the amount step and keeps them', async () => {
    const { services } = await renderApp('/nutrition', { prepare: withFoods });
    await openAdd();
    await userEvent.click(
      within(await screen.findByRole('list', { name: 'Zuletzt verwendet' })).getByRole('button', {
        name: /Haferflocken/,
      }),
    );
    await userEvent.click(dialog().getByRole('button', { name: 'Als Favorit markieren' }));
    expect(dialog().getByRole('button', { name: 'Favorit entfernen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const profileId = (await services.profile.ensureLocalProfile()).id;
    await waitFor(async () => {
      expect(
        (await services.nutrition.foods.list(profileId, { favoritesOnly: true })).map(
          (f) => f.name,
        ),
      ).toEqual(['Haferflocken', 'Milch']);
    });
  });

  it('searches own foods and the BLS offline – never Open Food Facts – and labels the source', async () => {
    const provider = new FakeFoodProvider();
    provider.products = [externalProduct({ name: 'Haferflocken Online' })];
    await renderApp('/nutrition', { prepare: withFoods, foodProvider: provider });
    await openAdd();
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'hafer');
    const results = within(await screen.findByRole('list', { name: 'Suchergebnisse' }));
    await waitFor(() => {
      expect(results.getAllByRole('button').map((b) => b.textContent)).toEqual([
        'Neues Lebensmittel anlegen',
        'HaferflockenEigenes · 370 kcal pro 100 g',
        'HaferflockenBLS 4.0 · 370 kcal pro 100 g',
      ]);
    });
    expect(
      dialog().getByText(
        /Max Rubner-Institut \(2025\): Bundeslebensmittelschlüssel \(BLS\), Version 4\.0\. Karlsruhe\./,
      ),
    ).toBeInTheDocument();
    expect(dialog().queryByText(/Online suchen/)).not.toBeInTheDocument();
    expect(dialog().queryByText('Haferflocken Online')).not.toBeInTheDocument();
    expect(provider.calls).toEqual([]);
  });

  it('finds BLS foods regardless of umlaut spelling and logs one offline', async () => {
    const provider = new FakeFoodProvider();
    provider.failWith = 'offline';
    const { db } = await renderApp('/nutrition', { foodProvider: provider });
    await openAdd();
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'haehnchen');
    const results = within(await screen.findByRole('list', { name: 'Suchergebnisse' }));
    await userEvent.click(await results.findByRole('button', { name: /Hähnchenbrust, roh/ }));

    const amount = await screen.findByLabelText('Menge');
    expect(dialog().getByText(/Max Rubner-Institut/)).toBeInTheDocument();
    await userEvent.clear(amount);
    await userEvent.type(amount, '150');
    await userEvent.click(dialog().getByRole('button', { name: 'Eintragen' }));
    await closed();
    expect(
      await screen.findByRole('heading', { name: 'Frühstück · 165 kcal' }),
    ).toBeInTheDocument();
    expect(
      await db.query(
        'SELECT source, profile_id, origin_dataset, origin_code, origin_version, energy_kcal FROM foods',
      ),
    ).toEqual([
      {
        source: 'local',
        profile_id: null,
        origin_dataset: 'bls',
        origin_code: 'T100003',
        origin_version: '4.0',
        energy_kcal: 110,
      },
    ]);
    expect(provider.calls).toEqual([]);

    // Used once, it is offered under "recently used" – as the same food, without a duplicate.
    await openAdd();
    const recent = within(await screen.findByRole('list', { name: 'Zuletzt verwendet' }));
    expect(recent.getByText('Hähnchenbrust, roh')).toBeInTheDocument();
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'hähnchen');
    const again = within(await screen.findByRole('list', { name: 'Suchergebnisse' }));
    await waitFor(() => {
      expect(again.getAllByRole('button', { name: /Hähnchenbrust/ })).toHaveLength(1);
    });
  });

  it('shows a BLS food read-only and edits it as an own copy', async () => {
    const { db } = await renderApp('/nutrition/foods', {
      prepare: async (s, profileId) => {
        const [hit] = await s.nutrition.lookup.search(profileId, 'apfel roh');
        if (hit?.kind !== 'reference') throw new Error('reference expected');
        await s.nutrition.lookup.useReference(hit.reference);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: /Apfel, roh/ }));
    expect(
      await screen.findByRole('dialog', { name: 'Lebensmittel aus dem BLS' }),
    ).toBeInTheDocument();
    expect(
      dialog().getByText(/Referenzdaten aus dem Bundeslebensmittelschlüssel/),
    ).toBeInTheDocument();
    expect(dialog().queryByLabelText('Name')).not.toBeInTheDocument();
    expect(
      dialog().queryByRole('button', { name: 'Lebensmittel löschen' }),
    ).not.toBeInTheDocument();

    await userEvent.click(dialog().getByRole('button', { name: 'Als eigene Kopie bearbeiten' }));
    expect(
      await screen.findByRole('dialog', { name: 'Eigene Kopie bearbeiten' }),
    ).toBeInTheDocument();
    expect(dialog().getByText(/Kopie von „Apfel, roh“ \(BLS 4\.0\)/)).toBeInTheDocument();
    expect(dialog().getByLabelText('Name')).toHaveValue('Apfel, roh');
    // Unknown detail values stay empty, never 0.
    expect(dialog().getByLabelText('Kalorien (kcal)')).toHaveValue('52');
    await userEvent.clear(dialog().getByLabelText('Name'));
    await userEvent.type(dialog().getByLabelText('Name'), 'Mein Apfel');
    await userEvent.clear(dialog().getByLabelText('Kalorien (kcal)'));
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '60');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();

    expect(await screen.findByText(/Eigene Kopie · 60 kcal pro 100 g/)).toBeInTheDocument();
    expect(screen.getByText(/BLS 4\.0 · 52 kcal pro 100 g/)).toBeInTheDocument();
    expect(
      await db.query('SELECT name, source, energy_kcal, origin_code FROM foods ORDER BY name'),
    ).toEqual([
      { name: 'Apfel, roh', source: 'local', energy_kcal: 52, origin_code: 'T100001' },
      { name: 'Mein Apfel', source: 'custom', energy_kcal: 60, origin_code: null },
    ]);
  });

  it('imports a scanned product after review and logs it; later it is found offline', async () => {
    const provider = new FakeFoodProvider();
    provider.products = [
      externalProduct({
        nutrients: { ...externalProduct().nutrients, fatG: null },
        missing: ['fatG'],
      }),
    ];
    const { db } = await renderApp('/nutrition', { foodProvider: provider });
    simulateScan({ kind: 'scanned', code: '4001234567890' });
    await openAdd();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode scannen' }));

    expect(await screen.findByRole('dialog', { name: 'Produkt prüfen' })).toBeInTheDocument();
    expect(dialog().getByText(/Aus Open Food Facts übernommen/)).toBeInTheDocument();
    expect(dialog().getByText(/Nicht alle Nährwerte sind angegeben/)).toBeInTheDocument();
    expect(dialog().getByLabelText('Name')).toHaveValue('Skyr Natur');
    expect(dialog().getByLabelText('Barcode (optional)')).toHaveValue('4001234567890');
    expect(dialog().getByLabelText('Kalorien (kcal)')).toHaveValue('63');
    // Missing fat is not taken as 0: the field is empty and must be filled.
    expect(dialog().getByLabelText('Fett (g)')).toHaveValue('');
    noKeyboard();
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    expect(dialog().getByRole('alert')).toHaveTextContent('Bitte prüfe die markierten Felder.');
    await userEvent.type(dialog().getByLabelText('Fett (g)'), '0,2');
    await userEvent.clear(dialog().getByLabelText('Kalorien (kcal)'));
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '65');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));

    const amount = await screen.findByLabelText('Menge');
    await userEvent.clear(amount);
    await userEvent.type(amount, '150');
    await userEvent.click(dialog().getByRole('button', { name: 'Eintragen' }));
    await closed();
    expect(await screen.findByRole('heading', { name: 'Frühstück · 98 kcal' })).toBeInTheDocument();
    expect(
      await db.query('SELECT source, provider, external_id, energy_kcal, fat_g FROM foods'),
    ).toEqual([
      {
        source: 'external',
        provider: 'openfoodfacts',
        external_id: '4001234567890',
        energy_kcal: 65,
        fat_g: 0.2,
      },
    ]);

    // Offline the next day: the scan is answered locally, nothing is sent.
    provider.failWith = 'offline';
    provider.calls.length = 0;
    await openAdd();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode scannen' }));
    expect(await screen.findByLabelText('Menge')).toBeInTheDocument();
    expect(dialog().getByText('Skyr Natur')).toBeInTheDocument();
    expect(provider.calls).toEqual([]);
  });

  it('offers to create an unknown barcode with the code pre-filled', async () => {
    simulateScan({ kind: 'scanned', code: '4009999999999' });
    await renderApp('/nutrition');
    await openAdd();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode scannen' }));
    expect(await screen.findByText('Produkt nicht gefunden.')).toBeInTheDocument();
    expect(dialog().getByText(/der Barcode ist schon eingetragen/)).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Eigenes Lebensmittel anlegen' }));
    expect(await screen.findByLabelText('Barcode (optional)')).toHaveValue('4009999999999');
  });

  it('accepts a typed barcode and rejects implausible ones', async () => {
    const provider = new FakeFoodProvider();
    provider.products = [externalProduct()];
    await renderApp('/nutrition', { foodProvider: provider });
    await openAdd();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode eingeben' }));
    const field = dialog().getByLabelText('Barcode (EAN oder UPC)');
    expect(field).toHaveFocus();
    await userEvent.type(field, '12ab');
    await userEvent.click(dialog().getByRole('button', { name: 'Produkt suchen' }));
    expect(dialog().getByRole('alert')).toHaveTextContent('8 bis 14 Ziffern');
    expect(provider.calls).toEqual([]);
    await userEvent.clear(field);
    await userEvent.type(field, '4001 2345 67890');
    await userEvent.click(dialog().getByRole('button', { name: 'Produkt suchen' }));
    expect(await screen.findByRole('dialog', { name: 'Produkt prüfen' })).toBeInTheDocument();
    expect(provider.calls).toEqual([{ method: 'barcode', value: '4001234567890' }]);
  });

  it('explains refused camera access and offers typing the code', async () => {
    simulateScan({ kind: 'denied' });
    await renderApp('/nutrition');
    await openAdd();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode scannen' }));
    expect(
      await screen.findByText(/Kalethra benötigt Kamerazugriff, um Barcodes zu scannen/),
    ).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode eingeben' }));
    expect(await screen.findByLabelText('Barcode (EAN oder UPC)')).toBeInTheDocument();
  });

  it('falls back to typing when no scanner is available', async () => {
    await renderApp('/nutrition');
    await openAdd();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode scannen' }));
    expect(await screen.findByText(/Der Scanner ist hier nicht verfügbar/)).toBeInTheDocument();
  });

  it('shows provider errors where the barcode was looked up', async () => {
    const provider = new FakeFoodProvider();
    provider.failWith = 'rate-limited';
    simulateScan({ kind: 'scanned', code: '4001234567890' });
    await renderApp('/nutrition', { foodProvider: provider });
    await openAdd();
    await userEvent.click(dialog().getByRole('button', { name: 'Barcode scannen' }));
    expect(await dialog().findByRole('alert')).toHaveTextContent(/zu viele Anfragen/);
    expect(dialog().getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });

  it('lists favourites on the foods page', async () => {
    await renderApp('/nutrition/foods', { prepare: withFoods });
    const favorites = within(await screen.findByRole('list', { name: 'Favoriten' }));
    expect(favorites.getByText('Milch')).toBeInTheDocument();
  });
});
