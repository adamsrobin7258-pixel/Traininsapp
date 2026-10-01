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

describe('adding foods: quick access, online search and barcode', () => {
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

  it('searches online only on request and labels the source', async () => {
    const provider = new FakeFoodProvider();
    provider.products = [
      externalProduct(),
      externalProduct({
        externalId: '4002',
        barcode: '4000000000022',
        name: 'Skyr Vanille',
        nutrients: { ...externalProduct().nutrients, fatG: null },
        missing: ['fatG'],
      }),
    ];
    await renderApp('/nutrition', { foodProvider: provider });
    await openAdd();
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'skyr');
    expect(provider.calls).toEqual([]);

    await userEvent.click(dialog().getByRole('button', { name: 'Online suchen: „skyr“' }));
    const results = within(await screen.findByRole('list', { name: 'Open Food Facts' }));
    expect(await results.findByText('Skyr Natur')).toBeInTheDocument();
    expect(results.getByText('Milbona · 63 kcal pro 100 g')).toBeInTheDocument();
    expect(results.getByText('Milbona · Nährwerte unvollständig')).toBeInTheDocument();
    expect(provider.calls).toEqual([{ method: 'search', value: 'skyr' }]);
    expect(dialog().getByText(/Gesendet wird nur dein Suchbegriff/)).toBeInTheDocument();
  });

  it('keeps local foods usable when Open Food Facts cannot be reached', async () => {
    const provider = new FakeFoodProvider();
    provider.failWith = 'offline';
    await renderApp('/nutrition', { prepare: withFoods, foodProvider: provider });
    await openAdd();
    await userEvent.type(dialog().getByLabelText('Lebensmittel suchen'), 'hafer');
    await userEvent.click(dialog().getByRole('button', { name: /Online suchen/ }));
    expect(await dialog().findByRole('alert')).toHaveTextContent(
      'Keine Verbindung zu Open Food Facts. Deine gespeicherten Lebensmittel sind weiterhin verfügbar.',
    );
    const local = within(dialog().getByRole('list', { name: 'Lebensmittel' }));
    expect(local.getByText('Haferflocken')).toBeInTheDocument();
    await userEvent.click(local.getByRole('button', { name: /Haferflocken/ }));
    expect(await dialog().findByLabelText('Menge')).toBeInTheDocument();
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
    expect(await screen.findByText('Produkt wurde nicht gefunden.')).toBeInTheDocument();
    expect(
      dialog().getByText('Du kannst es selbst anlegen oder nach dem Namen suchen.'),
    ).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Selbst anlegen' }));
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
