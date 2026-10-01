import { createServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { externalProduct, FakeFoodProvider } from '@/test/fakeFoodProvider';
import { barcodeVariants, normalizeBarcode } from './barcode';
import { NutritionError } from './errors';
import { RECENT_FOODS_LIMIT } from './food';
import { FoodProviderError } from './provider';

let now = new Date(2026, 9, 3, 12, 0);
const clock = () => now;

async function setup() {
  now = new Date(2026, 9, 3, 12, 0);
  const db = await createTestDatabase();
  const provider = new FakeFoodProvider();
  const services = createServices(
    { driver: db, security: ENCRYPTED_TEST_SECURITY },
    clock,
    provider,
  );
  const profile = await services.profile.ensureLocalProfile();
  await services.nutrition.meals.ensureDefaults(profile.id);
  const [breakfast] = await services.nutrition.meals.listActive(profile.id);
  return {
    db,
    provider,
    services,
    n: services.nutrition,
    profileId: profile.id,
    mealId: breakfast?.id ?? '',
  };
}

const reviewed = {
  name: 'Skyr Natur',
  brand: 'Milbona',
  barcode: '4001234567890',
  reference: { amount: 100, unit: 'g' as const },
  nutrients: {
    energyKcal: 63,
    proteinG: 11,
    carbsG: 4,
    fatG: 0.2,
    fiberG: null,
    sugarG: 4,
    saturatedFatG: 0.1,
  },
};

describe('barcodes', () => {
  it('accepts plausible food barcodes and nothing else', () => {
    expect(normalizeBarcode(' 4001 2345-67890 ')).toBe('4001234567890');
    expect(normalizeBarcode('96385074')).toBe('96385074'); // EAN-8 / UPC-E
    expect(normalizeBarcode('036000291452')).toBe('036000291452'); // UPC-A
    expect(normalizeBarcode('1234567')).toBeNull();
    expect(normalizeBarcode('123456789012345')).toBeNull();
    expect(normalizeBarcode('40012345abc')).toBeNull();
    expect(barcodeVariants('036000291452')).toEqual(['036000291452', '0036000291452']);
    expect(barcodeVariants('0036000291452')).toEqual(['0036000291452', '036000291452']);
  });
});

describe('barcode lookup', () => {
  it('answers a known barcode locally without asking the provider', async () => {
    const { n, provider, profileId } = await setup();
    const own = await n.foods.create(profileId, { ...reviewed, name: 'Mein Skyr' });
    const result = await n.lookup.lookupBarcode(profileId, '4001234567890');
    expect(result).toMatchObject({ kind: 'local', food: { id: own.id } });
    expect(provider.calls).toEqual([]);
    // UPC-A scanned as 12 digits finds the stored 13-digit code.
    await n.foods.create(profileId, { ...reviewed, name: 'Cola', barcode: '0036000291452' });
    expect(await n.lookup.lookupBarcode(profileId, '036000291452')).toMatchObject({
      kind: 'local',
      food: { name: 'Cola' },
    });
    expect(provider.calls).toEqual([]);
  });

  it('asks the provider for unknown barcodes and reports not found', async () => {
    const { n, provider, profileId } = await setup();
    provider.products = [externalProduct()];
    expect(await n.lookup.lookupBarcode(profileId, '4001234567890')).toMatchObject({
      kind: 'external',
      product: { name: 'Skyr Natur' },
    });
    expect(await n.lookup.lookupBarcode(profileId, '4009999999999')).toEqual({
      kind: 'not-found',
      barcode: '4009999999999',
    });
    expect(provider.calls).toEqual([
      { method: 'barcode', value: '4001234567890' },
      { method: 'barcode', value: '4009999999999' },
    ]);
  });

  it('rejects invalid input and passes provider failures on', async () => {
    const { n, provider, profileId } = await setup();
    await expect(n.lookup.lookupBarcode(profileId, 'abc')).rejects.toEqual(
      new NutritionError('invalid-barcode'),
    );
    provider.failWith = 'offline';
    await expect(n.lookup.lookupBarcode(profileId, '4001234567890')).rejects.toBeInstanceOf(
      FoodProviderError,
    );
    // Local foods stay usable while the provider is unreachable.
    await n.foods.create(profileId, reviewed);
    expect((await n.lookup.lookupBarcode(profileId, '4001234567890')).kind).toBe('local');
  });
});

describe('importing', () => {
  it('stores a reviewed product as a local food, usable offline afterwards', async () => {
    const { n, provider, profileId, mealId } = await setup();
    provider.products = [externalProduct()];
    const lookup = await n.lookup.lookupBarcode(profileId, '4001234567890');
    if (lookup.kind !== 'external') throw new Error('external expected');
    // The user corrects a value before saving.
    const food = await n.foods.saveImported(
      profileId,
      { provider: lookup.product.provider, externalId: lookup.product.externalId },
      { ...reviewed, nutrients: { ...reviewed.nutrients, energyKcal: 65 } },
    );
    expect(food).toMatchObject({
      source: 'external',
      provider: 'openfoodfacts',
      externalId: '4001234567890',
    });

    // Offline: the provider fails, but the food is found locally and can be logged.
    provider.failWith = 'offline';
    provider.calls.length = 0;
    expect(await n.lookup.lookupBarcode(profileId, '4001234567890')).toMatchObject({
      kind: 'local',
      food: { id: food.id },
    });
    expect((await n.foods.list(profileId)).map((f) => f.name)).toEqual(['Skyr Natur']);
    const entry = await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId,
      foodId: food.id,
      amount: 150,
      unit: 'g',
    });
    expect(entry.nutrients.energyKcal).toBe(97.5);
    expect(provider.calls).toEqual([]);
  });

  it('does not create duplicates and keeps logged days unchanged', async () => {
    const { n, profileId, mealId, db } = await setup();
    const origin = { provider: 'openfoodfacts', externalId: '4001234567890' };
    const first = await n.foods.saveImported(profileId, origin, {
      ...reviewed,
      nutrients: { ...reviewed.nutrients, energyKcal: 200 },
    });
    await n.diary.addFood(profileId, {
      localDate: '2026-10-01',
      mealId,
      foodId: first.id,
      amount: 100,
      unit: 'g',
    });
    const second = await n.foods.saveImported(profileId, origin, {
      ...reviewed,
      nutrients: { ...reviewed.nutrients, energyKcal: 190 },
    });
    expect(second.id).toBe(first.id);
    expect(await db.query('SELECT COUNT(*) AS n FROM foods')).toEqual([{ n: 1 }]);
    const day = await n.diary.getDay(profileId, '2026-10-01');
    expect(day.entries[0]?.nutrients.energyKcal).toBe(200);
  });

  it('marks online results that already exist locally', async () => {
    const { n, provider, profileId } = await setup();
    provider.products = [
      externalProduct(),
      externalProduct({ externalId: '4002', barcode: '4000000000022', name: 'Skyr Vanille' }),
    ];
    await n.foods.saveImported(
      profileId,
      { provider: 'openfoodfacts', externalId: '4001234567890' },
      reviewed,
    );
    const results = await n.lookup.searchOnline(profileId, 'skyr', { locale: 'de' });
    expect(results.map((r) => [r.product.name, r.local?.name ?? null])).toEqual([
      ['Skyr Natur', 'Skyr Natur'],
      ['Skyr Vanille', null],
    ]);
  });

  it('refuses incomplete imports instead of assuming 0', async () => {
    const { n, profileId } = await setup();
    await expect(
      n.foods.saveImported(
        profileId,
        { provider: 'openfoodfacts', externalId: '1' },
        // @ts-expect-error – a missing value is not allowed through
        { ...reviewed, nutrients: { ...reviewed.nutrients, fatG: null } },
      ),
    ).rejects.toEqual(new NutritionError('invalid-value'));
  });

  it('validates barcodes of foods', async () => {
    const { n, profileId } = await setup();
    await expect(n.foods.create(profileId, { ...reviewed, barcode: '12' })).rejects.toEqual(
      new NutritionError('invalid-barcode'),
    );
    expect(
      (await n.foods.create(profileId, { ...reviewed, barcode: ' 4001234 567890 ' })).barcode,
    ).toBe('4001234567890');
  });
});

describe('favourites and recently used', () => {
  it('marks and unmarks favourites persistently', async () => {
    const { n, profileId } = await setup();
    const food = await n.foods.create(profileId, reviewed);
    await n.foods.setFavorite(profileId, food.id, true);
    expect((await n.foods.list(profileId, { favoritesOnly: true })).map((f) => f.id)).toEqual([
      food.id,
    ]);
    await n.foods.setFavorite(profileId, food.id, false);
    expect(await n.foods.list(profileId, { favoritesOnly: true })).toEqual([]);
  });

  it('orders by last use, moves re-used foods up and respects the limit', async () => {
    const { n, profileId, mealId } = await setup();
    const make = (name: string) => n.foods.create(profileId, { ...reviewed, barcode: null, name });
    const [a, b, c] = [await make('A'), await make('B'), await make('C')];
    const log = async (foodId: string, minute: number) => {
      now = new Date(2026, 9, 3, 12, minute);
      await n.diary.addFood(profileId, {
        localDate: '2026-10-03',
        mealId,
        foodId,
        amount: 50,
        unit: 'g',
      });
    };
    await log(a.id, 1);
    await log(b.id, 2);
    await log(c.id, 3);
    await log(a.id, 4);
    expect((await n.foods.recent(profileId)).map((f) => f.name)).toEqual(['A', 'C', 'B']);
    expect((await n.foods.recent(profileId, 2)).map((f) => f.name)).toEqual(['A', 'C']);
    // Hidden foods are not offered.
    await n.foods.setActive(profileId, c.id, false);
    expect((await n.foods.recent(profileId)).map((f) => f.name)).toEqual(['A', 'B']);
    expect(RECENT_FOODS_LIMIT).toBe(30);
  });
});

describe('privacy', () => {
  it('sends only the barcode or the search text – nothing personal', async () => {
    const { services, n, provider, profileId, mealId } = await setup();
    const profile = await services.profile.ensureLocalProfile();
    await services.profile.updateBodyData(profile, {
      sex: 'female',
      birthDate: '1988-03-14',
      heightCm: 171,
    });
    await services.weight.save(profileId, '2026-10-03', 77.7);
    await n.goals.saveProfile(profileId, {
      params: {
        goalType: 'lose',
        goalLevel: 'moderate',
        activityLevel: 'light',
        includeTraining: true,
        targetWeightKg: 66.6,
      },
      overrides: { proteinG: 155 },
      waterMl: 2345,
    });
    const food = await n.foods.create(profileId, {
      ...reviewed,
      barcode: null,
      name: 'Geheimes Frühstück',
    });
    await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId,
      foodId: food.id,
      amount: 123,
      unit: 'g',
    });

    await n.lookup.lookupBarcode(profileId, '4009999999999');
    await n.lookup.searchOnline(profileId, 'haferflocken', { locale: 'de' });

    expect(provider.calls).toEqual([
      { method: 'barcode', value: '4009999999999' },
      { method: 'search', value: 'haferflocken' },
    ]);
    const sent = JSON.stringify(provider.calls);
    for (const secret of [
      '77.7',
      '171',
      '1988',
      'female',
      '66.6',
      '155',
      '2345',
      'Geheimes',
      '123',
      profileId,
    ]) {
      expect(sent).not.toContain(secret);
    }
  });
});
