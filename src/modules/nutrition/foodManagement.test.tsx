import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { ZERO_NUTRIENTS } from '@/core/nutrition';
import type { BarcodeScanOutcome } from '@/core/platform';
import { externalProduct, FakeFoodProvider } from '@/test/fakeFoodProvider';
import { renderApp } from '@/test/renderApp';

/**
 * Phase 15: the one food management (Einstellungen → Meine Inhalte → Lebensmittel) with search
 * (own foods and the BLS) and barcode – the same flow as logging, no second food system.
 */
const NOW = new Date(2026, 9, 3, 10);
type ScanWindow = Window & { __kalethraScanBarcode?: () => Promise<BarcodeScanOutcome> };
const simulateScan = (outcome: BarcodeScanOutcome) => {
  (window as ScanWindow).__kalethraScanBarcode = () => Promise.resolve(outcome);
};
const dialog = () => within(screen.getByRole('dialog'));
const closed = () =>
  waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

const oats = {
  name: 'Haferflocken kernig',
  reference: { amount: 100, unit: 'g' as const },
  nutrients: { ...ZERO_NUTRIENTS, energyKcal: 370, proteinG: 13.5, carbsG: 58.7, fatG: 7 },
};

/** An own food with a barcode, logged on 2 October. */
async function withLoggedFood(services: AppServices, profileId: string) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [breakfast] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, { ...oats, barcode: '4000540000108' });
  await n.diary.addFood(profileId, {
    localDate: '2026-10-02',
    mealId: breakfast?.id ?? '',
    foodId: food.id,
    amount: 100,
    unit: 'g',
  });
}

describe('food management (Einstellungen → Meine Inhalte → Lebensmittel)', () => {
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

  it('offers barcode scanning and typing next to the search – no keyboard on open', async () => {
    await renderApp('/settings/content/foods');
    for (const name of ['Barcode scannen', 'Barcode eingeben']) {
      expect(await screen.findByRole('button', { name })).toBeInTheDocument();
    }
    expect(document.activeElement?.tagName).not.toBe('INPUT');
  });

  it('a known barcode opens the stored food – answered locally, nothing is sent', async () => {
    const provider = new FakeFoodProvider();
    simulateScan({ kind: 'scanned', code: '4000540000108' });
    await renderApp('/settings/content/foods', {
      foodProvider: provider,
      prepare: withLoggedFood,
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Barcode scannen' }));
    expect(
      await screen.findByRole('dialog', { name: 'Lebensmittel bearbeiten' }),
    ).toBeInTheDocument();
    expect(dialog().getByLabelText('Name')).toHaveValue('Haferflocken kernig');
    expect(screen.getByText('„Haferflocken kernig“ ist bereits gespeichert.')).toBeInTheDocument();
    expect(provider.calls).toEqual([]);
  });

  it('an unknown barcode asks Open Food Facts; the values are reviewed before saving', async () => {
    const provider = new FakeFoodProvider();
    provider.products = [externalProduct()];
    const { db } = await renderApp('/settings/content/foods', { foodProvider: provider });
    await userEvent.click(await screen.findByRole('button', { name: 'Barcode eingeben' }));
    await userEvent.type(dialog().getByLabelText('Barcode (EAN oder UPC)'), '4001234567890');
    await userEvent.click(dialog().getByRole('button', { name: 'Produkt suchen' }));
    expect(await screen.findByRole('dialog', { name: 'Produkt prüfen' })).toBeInTheDocument();
    expect(dialog().getByText(/Aus Open Food Facts übernommen/)).toBeInTheDocument();
    // Nothing is stored before the user confirms.
    expect(await db.query('SELECT name FROM foods')).toEqual([]);
    await userEvent.clear(dialog().getByLabelText('Kalorien (kcal)'));
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '65');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    expect(await screen.findByText('„Skyr Natur“ wurde gespeichert.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Skyr Natur/ })).toBeInTheDocument();
    expect(await db.query('SELECT source, energy_kcal, barcode FROM foods')).toEqual([
      { source: 'external', energy_kcal: 65, barcode: '4001234567890' },
    ]);
    expect(provider.calls).toEqual([{ method: 'barcode', value: '4001234567890' }]);
  });

  it('a barcode nobody knows can be created as an own food with the code filled in', async () => {
    simulateScan({ kind: 'scanned', code: '4009999999999' });
    await renderApp('/settings/content/foods');
    await userEvent.click(await screen.findByRole('button', { name: 'Barcode scannen' }));
    expect(await screen.findByText('Produkt nicht gefunden.')).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Eigenes Lebensmittel anlegen' }));
    expect(await screen.findByLabelText('Barcode (optional)')).toHaveValue('4009999999999');
  });

  it('offline without a local match: the lookup explains it and offers a retry', async () => {
    const provider = new FakeFoodProvider();
    provider.failWith = 'offline';
    simulateScan({ kind: 'scanned', code: '4001234567890' });
    await renderApp('/settings/content/foods', { foodProvider: provider });
    await userEvent.click(await screen.findByRole('button', { name: 'Barcode scannen' }));
    expect(await dialog().findByRole('alert')).toBeInTheDocument();
    expect(dialog().getByRole('button', { name: 'Erneut versuchen' })).toBeInTheDocument();
  });

  it('the search finds own foods and BLS foods; a BLS food opens read-only', async () => {
    const { db } = await renderApp('/settings/content/foods', { prepare: withLoggedFood });
    await userEvent.type(await screen.findByLabelText('Lebensmittel suchen'), 'hafer');
    // Own food (stored) and the BLS entry of the same name.
    expect(await screen.findByRole('button', { name: /Haferflocken kernig/ })).toBeInTheDocument();
    const bls = within(await screen.findByRole('list', { name: 'Aus dem BLS' }));
    await userEvent.click(bls.getByRole('button', { name: /^Haferflocken/ }));
    expect(
      await screen.findByRole('dialog', { name: 'Lebensmittel aus dem BLS' }),
    ).toBeInTheDocument();
    expect(dialog().queryByLabelText('Name')).not.toBeInTheDocument();
    // Opening stores it like a first use – as a reference food, not as an own one.
    expect(await db.query("SELECT source FROM foods WHERE name = 'Haferflocken'")).toEqual([
      { source: 'local' },
    ]);
  });

  it('editing or deleting a logged food never changes the logged day', async () => {
    const { db, services } = await renderApp('/settings/content/foods', {
      prepare: withLoggedFood,
    });
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const before = await services.nutrition.diary.dailyTotalsBetween(
      profileId,
      '2026-10-02',
      '2026-10-02',
    );
    await userEvent.click(await screen.findByRole('button', { name: /Haferflocken kernig/ }));
    await userEvent.clear(dialog().getByLabelText('Kalorien (kcal)'));
    await userEvent.type(dialog().getByLabelText('Kalorien (kcal)'), '500');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    await closed();
    await userEvent.click(await screen.findByRole('button', { name: /Haferflocken kernig/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Lebensmittel löschen' }));
    await userEvent.click(await dialog().findByRole('button', { name: 'Löschen' }));
    // In use → only hidden; the day keeps 370 kcal, 13,5 g protein, 58,7 g carbs, 7 g fat.
    expect(
      await screen.findByText('„Haferflocken kernig“ wird noch verwendet und wurde ausgeblendet.'),
    ).toBeInTheDocument();
    const after = await services.nutrition.diary.dailyTotalsBetween(
      profileId,
      '2026-10-02',
      '2026-10-02',
    );
    expect(after).toEqual(before);
    expect(after[0]).toMatchObject({ energyKcal: 370, proteinG: 13.5, carbsG: 58.7, fatG: 7 });
    expect(await db.query('SELECT active, energy_kcal FROM foods')).toEqual([
      { active: 0, energy_kcal: 500 },
    ]);
  });
});
