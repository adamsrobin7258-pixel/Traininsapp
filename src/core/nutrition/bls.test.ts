import { createServices } from '@/app/services';
import { migrate, migrations } from '@/core/database';
import { openSqlJsDriver } from '@/core/database/drivers/sqlJs';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { externalProduct, FakeFoodProvider } from '@/test/fakeFoodProvider';
import { createTestReferenceCatalog, TEST_BLS_DATA } from '@/test/testReferenceCatalog';
import { BlsCatalog, createBlsCatalog, parseBlsData, type BlsDataFile } from './bls';
import { blsCategory, foodCategory } from './category';
import { NutritionError } from './errors';
import type { FoodSearchResult } from './foodLookupService';
import { bestScore, normalizeSearchText, searchKey, searchWords } from './search';

let now = new Date(2026, 9, 3, 12, 0);
const clock = () => now;

async function setup() {
  now = new Date(2026, 9, 3, 12, 0);
  const db = await createTestDatabase();
  const provider = new FakeFoodProvider();
  const catalog = createTestReferenceCatalog();
  const services = createServices(
    { driver: db, security: ENCRYPTED_TEST_SECURITY },
    clock,
    provider,
    catalog,
  );
  const profile = await services.profile.ensureLocalProfile();
  await services.nutrition.meals.ensureDefaults(profile.id);
  const [breakfast] = await services.nutrition.meals.listActive(profile.id);
  return {
    db,
    provider,
    catalog,
    n: services.nutrition,
    profileId: profile.id,
    mealId: breakfast?.id ?? '',
  };
}

const names = (results: FoodSearchResult[]) =>
  results.map((r) =>
    r.kind === 'food' ? `${r.food.source}:${r.food.name}` : `bls:${r.reference.name}`,
  );

const own = {
  reference: { amount: 100, unit: 'g' as const },
  nutrients: {
    energyKcal: 100,
    proteinG: 1,
    carbsG: 20,
    fatG: 1,
    fiberG: null,
    sugarG: null,
    saturatedFatG: null,
  },
};

describe('search text', () => {
  it('ignores case, accents, umlaut spellings, ß and punctuation', () => {
    expect(normalizeSearchText('Äpfel')).toBe('apfel');
    expect(normalizeSearchText('Aepfel')).toBe('apfel');
    expect(normalizeSearchText('HÄHNCHEN Brust')).toBe('hahnchen brust');
    expect(normalizeSearchText('Joghurt-Dip')).toBe('joghurtdip');
    expect(normalizeSearchText('Weißkohl')).toBe('weisskohl');
    expect(normalizeSearchText('Apfel, roh')).toBe('apfel roh');
    expect(normalizeSearchText('  ')).toBe('');
  });
});

describe('search ranking', () => {
  const rank = (query: string, names: string[][]) =>
    names
      .map((n) => ({
        name: n[0] ?? '',
        score: bestScore(
          n.map((x) => searchKey(x)),
          searchWords(query),
        ),
      }))
      .filter((m) => m.score !== null)
      .sort((a, b) => (a.score ?? 0) - (b.score ?? 0) || a.name.length - b.name.length)
      .map((m) => m.name);

  it('puts basic foods before compounds and finds names written apart', () => {
    expect(rank('milch', [['Milchschokolade'], ['Milch fettarm, frisch'], ['Kuhmilch']])).toEqual([
      'Milch fettarm, frisch',
      'Milchschokolade',
      'Kuhmilch',
    ]);
    expect(rank('joghurt', [['Joghurt-Dip'], ['Joghurt mild, 3,5 % Fett']])).toEqual([
      'Joghurt mild, 3,5 % Fett',
      'Joghurt-Dip',
    ]);
    expect(rank('haferflocken', [['Haferflockenplätzchen'], ['Hafer Flocken']])).toEqual([
      'Hafer Flocken',
      'Haferflockenplätzchen',
    ]);
  });

  it('ranks matches on the English name after every German match', () => {
    expect(
      rank('butter', [
        ['Joghurtbutter', 'Butter with yogurt'],
        ['Butter gesalzen', 'Butter salted'],
        ['Halbfettbutter', 'Half-fat butter'],
      ]),
    ).toEqual(['Butter gesalzen', 'Joghurtbutter', 'Halbfettbutter']);
  });
});

describe('BLS catalog', () => {
  it('finds foods by word start, inside words and across umlaut spellings', async () => {
    const catalog = createTestReferenceCatalog();
    const search = async (q: string) => (await catalog.search(q, 50)).map((f) => f.name);
    expect(await search('apfel')).toEqual(['Apfel, roh', 'Bratäpfel, gegart']);
    expect(await search('Äpfel')).toEqual(['Apfel, roh', 'Bratäpfel, gegart']);
    expect(await search('bratapfel')).toEqual(['Bratäpfel, gegart']);
    for (const q of ['hähnchen', 'hahnchen', 'HAEHNCHEN', 'brust', 'hähnchen roh']) {
      expect(await search(q), q).toEqual(['Hähnchenbrust, roh']);
    }
    expect(await search('moh')).toEqual(['Möhre, roh']);
    expect(await search('weisskohl')).toEqual(['Weißkohl, gegart']);
    expect(await search('chicken')).toEqual(['Hähnchenbrust, roh']); // English name
    expect(await search('roh')).toEqual(['Apfel, roh', 'Möhre, roh', 'Hähnchenbrust, roh']);
    expect(await search('')).toEqual([]);
    expect(await search('xyz')).toEqual([]);
    expect(await catalog.search('a', 2)).toHaveLength(2);
  });

  it('keeps unknown detail values unknown – never 0', async () => {
    const food = await createTestReferenceCatalog().get('T100002');
    expect(food?.nutrients).toEqual({
      energyKcal: 80,
      proteinG: 0.4,
      carbsG: 17,
      fatG: 0.3,
      fiberG: 2.4,
      sugarG: null,
      saturatedFatG: null,
    });
    expect(food?.version).toBe('4.0');
  });

  it('skips records without all main values and rejects a different file layout', () => {
    const data: BlsDataFile = {
      ...TEST_BLS_DATA,
      foods: [
        ['X1', 'Ohne Fett', null, 50, 1, 10, null, null, null, null],
        ['X2', 'Vollständig', null, 50, 1, 10, 0, null, null, null],
      ],
    };
    expect([...parseBlsData(data).byCode.keys()]).toEqual(['X2']);
    expect(() => parseBlsData({ ...data, fields: ['code', 'name'] })).toThrow(NutritionError);
  });

  it('reports no dataset when nothing is bundled', async () => {
    const empty = new BlsCatalog(() =>
      Promise.resolve({ meta: null, fields: TEST_BLS_DATA.fields, foods: [] }),
    );
    expect(await empty.info()).toBeNull();
    expect(await empty.search('apfel', 10)).toEqual([]);
  });

  it('retries after a failed load', async () => {
    let calls = 0;
    const catalog = new BlsCatalog(() => {
      calls += 1;
      return calls === 1 ? Promise.reject(new Error('chunk')) : Promise.resolve(TEST_BLS_DATA);
    });
    await expect(catalog.search('apfel', 5)).rejects.toThrow('chunk');
    expect((await catalog.search('apfel', 5)).map((f) => f.code)).toEqual(['T100001', 'T100002']);
  });

  it('loads the bundled data file with its attribution', async () => {
    const info = await createBlsCatalog().info();
    // Before the official file is imported the bundled data is empty (see docs/BLS.md).
    if (info) {
      expect(info).toMatchObject({ name: 'BLS', version: '4.0' });
      expect(info.attribution).toBe(
        'Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0. Karlsruhe.',
      );
      expect(info.count).toBe(7137);
      expect(info.count).toBeGreaterThan(1000);
    }
  });
});

describe('food search with BLS', () => {
  it('lists own foods, then saved products, then BLS – offline and without requests', async () => {
    const { n, provider, profileId } = await setup();
    provider.failWith = 'offline';
    await n.foods.create(profileId, { ...own, name: 'Apfelkuchen von Oma' });
    await n.foods.saveImported(
      profileId,
      { provider: 'openfoodfacts', externalId: '4001' },
      { ...own, name: 'Apfelmus', brand: 'Marke', barcode: '4000000000015' },
    );
    expect(names(await n.lookup.search(profileId, 'apfel'))).toEqual([
      'custom:Apfelkuchen von Oma',
      'external:Apfelmus',
      'bls:Apfel, roh',
      'bls:Bratäpfel, gegart',
    ]);
    expect(provider.calls).toEqual([]);
    expect(await n.lookup.search(profileId, '  ')).toEqual([]);
  });

  it('keeps stored foods searchable when the BLS data cannot be read', async () => {
    const db = await createTestDatabase();
    const services = createServices(
      { driver: db, security: ENCRYPTED_TEST_SECURITY },
      clock,
      new FakeFoodProvider(),
      new BlsCatalog(() => Promise.reject(new Error('unreadable'))),
    );
    const profile = await services.profile.ensureLocalProfile();
    await services.nutrition.foods.create(profile.id, { ...own, name: 'Apfelmus' });
    expect(names(await services.nutrition.lookup.search(profile.id, 'apfel'))).toEqual([
      'custom:Apfelmus',
    ]);
  });

  it('shows a used BLS food once, as stored food', async () => {
    const { n, catalog, profileId } = await setup();
    const apple = await catalog.get('T100001');
    if (!apple) throw new Error('missing');
    const stored = await n.lookup.useReference(apple);
    expect(names(await n.lookup.search(profileId, 'apfel'))).toEqual([
      'local:Apfel, roh',
      'bls:Bratäpfel, gegart',
    ]);
    // Using it again reuses the same row.
    expect((await n.lookup.useReference(apple)).id).toBe(stored.id);
  });
});

describe('BLS foods as reference data', () => {
  async function usedApple() {
    const context = await setup();
    const apple = await context.catalog.get('T100001');
    if (!apple) throw new Error('missing');
    const food = await context.n.lookup.useReference(apple);
    return { ...context, apple, food };
  }

  it('stores the reference with its origin, unchanged values and no owner', async () => {
    const { food } = await usedApple();
    expect(food).toMatchObject({
      profileId: null,
      source: 'local',
      provider: null,
      externalId: null,
      name: 'Apfel, roh',
      reference: { amount: 100, unit: 'g' },
      origin: { dataset: 'bls', code: 'T100001', version: '4.0' },
      copiedFromId: null,
    });
    expect(food.nutrients).toEqual({
      energyKcal: 52,
      proteinG: 0.3,
      carbsG: 11.4,
      fatG: 0.2,
      fiberG: 2,
      sugarG: 10.3,
      saturatedFatG: 0,
    });
  });

  it('cannot be edited, hidden or deleted – but can be a favourite', async () => {
    const { n, profileId, food } = await usedApple();
    const notOwned = new NutritionError('not-found');
    await expect(n.foods.update(profileId, food.id, { ...own, name: 'Anders' })).rejects.toEqual(
      notOwned,
    );
    await expect(n.foods.setActive(profileId, food.id, false)).rejects.toEqual(notOwned);
    await expect(n.foods.remove(profileId, food.id)).rejects.toEqual(notOwned);

    await n.foods.setFavorite(profileId, food.id, true);
    expect((await n.foods.list(profileId, { favoritesOnly: true })).map((f) => f.name)).toEqual([
      'Apfel, roh',
    ]);
    const stored = await n.foods.get(profileId, food.id);
    expect(stored.nutrients).toEqual(food.nutrients);
    expect(stored.name).toBe('Apfel, roh');
  });

  it('logs entries with a snapshot and appears under recently used', async () => {
    const { n, profileId, mealId, food } = await usedApple();
    await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId,
      foodId: food.id,
      amount: 150,
      unit: 'g',
    });
    const day = await n.diary.getDay(profileId, '2026-10-03');
    expect(day.entries[0]?.nutrients.energyKcal).toBe(78);
    expect((await n.foods.recent(profileId)).map((f) => f.id)).toEqual([food.id]);
  });

  it('edits as a marked copy; the reference stays unchanged', async () => {
    const { n, profileId, food } = await usedApple();
    const copy = await n.foods.create(
      profileId,
      {
        ...food,
        name: 'Apfel, roh (mein Apfel)',
        nutrients: { ...food.nutrients, energyKcal: 60 },
      },
      { copiedFromId: food.id },
    );
    expect(copy).toMatchObject({
      source: 'custom',
      profileId,
      copiedFromId: food.id,
      origin: null,
    });
    expect((await n.foods.get(profileId, copy.id)).copiedFromId).toBe(food.id);
    expect((await n.foods.get(profileId, food.id)).nutrients.energyKcal).toBe(52);
    await expect(
      n.foods.create(profileId, { ...own, name: 'X' }, { copiedFromId: 'missing' }),
    ).rejects.toEqual(new NutritionError('not-found'));
  });

  it('takes newer dataset values without changing logged days', async () => {
    const { n, profileId, mealId, food, apple } = await usedApple();
    await n.diary.addFood(profileId, {
      localDate: '2026-10-03',
      mealId,
      foodId: food.id,
      amount: 100,
      unit: 'g',
    });
    const updated = await n.foods.ensureReference({
      ...apple,
      version: '4.1',
      nutrients: { ...apple.nutrients, energyKcal: 54 },
    });
    expect(updated.id).toBe(food.id);
    expect((await n.foods.get(profileId, food.id)).nutrients.energyKcal).toBe(54);
    expect((await n.foods.get(profileId, food.id)).origin?.version).toBe('4.1');
    const day = await n.diary.getDay(profileId, '2026-10-03');
    expect(day.entries[0]?.nutrients.energyKcal).toBe(52);
  });
});

describe('barcode fallback with BLS', () => {
  it('still asks Open Food Facts only for unknown barcodes', async () => {
    const { n, provider, profileId } = await setup();
    provider.products = [externalProduct()];
    expect((await n.lookup.lookupBarcode(profileId, '4001234567890')).kind).toBe('external');
    expect((await n.lookup.lookupBarcode(profileId, '4000000000099')).kind).toBe('not-found');
    expect(provider.calls.map((c) => c.method)).toEqual(['barcode', 'barcode']);
  });
});

describe('migration 8', () => {
  it('adds the origin columns and keeps every existing row', async () => {
    const db = await openSqlJsDriver();
    await migrate(
      db,
      migrations.filter((m) => m.version <= 7),
    );
    await db.run(
      `INSERT INTO profiles (id, display_name, created_at, updated_at) VALUES ('p', 'A', 'x', 'x')`,
    );
    await db.run(
      `INSERT INTO foods (id, profile_id, source, provider, external_id, name, reference_amount,
         reference_unit, energy_kcal, protein_g, carbs_g, fat_g, favorite, created_at, updated_at)
       VALUES ('f1', 'p', 'custom', NULL, NULL, 'Müsli', 100, 'g', 380, 10, 60, 8, 1, 'x', 'x'),
              ('f2', 'p', 'external', 'openfoodfacts', '4001', 'Skyr', 100, 'g', 63, 11, 4, 0.2, 0, 'x', 'x')`,
    );
    await db.run(
      `INSERT INTO food_entries (id, profile_id, local_date, food_id, name, amount, unit,
         energy_kcal, protein_g, carbs_g, fat_g, created_at, updated_at)
       VALUES ('e1', 'p', '2026-09-01', 'f1', 'Müsli', 50, 'g', 190, 5, 30, 4, 'x', 'x')`,
    );
    expect(await migrate(db, migrations)).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);

    const services = createServices(
      { driver: db, security: ENCRYPTED_TEST_SECURITY },
      clock,
      new FakeFoodProvider(),
      createTestReferenceCatalog(),
    );
    const foods = await services.nutrition.foods.list('p');
    expect(foods.map((f) => [f.name, f.source, f.favorite, f.origin, f.copiedFromId])).toEqual([
      ['Müsli', 'custom', true, null, null],
      ['Skyr', 'external', false, null, null],
    ]);
    const day = await services.nutrition.diary.getDay('p', '2026-09-01');
    expect(day.entries.map((e) => [e.name, e.nutrients.energyKcal])).toEqual([['Müsli', 190]]);
  });
});

describe('food families', () => {
  it('reads the family from the BLS main group letter only', () => {
    expect(blsCategory('F503100')).toBe('fruit');
    expect(blsCategory('C133000')).toBe('grain');
    expect(blsCategory('V413000')).toBe('poultry');
    expect(blsCategory('R100000')).toBeNull(); // spices, sauces: too mixed
    expect(blsCategory('Z000000')).toBeNull();
    expect(foodCategory({ origin: { dataset: 'bls', code: 'T100000', version: '4.0' } })).toBe(
      'fish',
    );
    expect(foodCategory({ dataset: 'bls', code: 'M111300' })).toBe('dairy');
    // Own foods and Open Food Facts products never get a guessed family.
    expect(foodCategory({ origin: null })).toBeNull();
  });
});
