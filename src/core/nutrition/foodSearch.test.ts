import { createServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { externalProduct, FakeFoodProvider } from '@/test/fakeFoodProvider';
import { createBlsCatalog } from './bls';
import { blsCategory } from './category';
import type { FoodSearchResult } from './foodLookupService';
import { ONLINE_SEARCH } from './foodLookupService';
import { analyzeQuery, prepareName, relevance, usageBonus, BONUS } from './foodRanking';
import type { Nutrients } from './nutrients';
import { FoodProviderError, type ExternalProduct } from './provider';

/** The fake products state every main value – stored as complete nutrients. */
const complete = (product: ExternalProduct): Nutrients => ({
  ...product.nutrients,
  energyKcal: product.nutrients.energyKcal ?? 0,
  proteinG: product.nutrients.proteinG ?? 0,
  carbsG: product.nutrients.carbsG ?? 0,
  fatG: product.nutrients.fatG ?? 0,
});

/**
 * Phase 27 – the food search ranks by meaning. These tests use the real bundled BLS 4.0 data,
 * so they guard the ranking users actually see.
 */
let now = new Date(2026, 9, 14, 12, 0);
const clock = () => now;
const catalog = createBlsCatalog();

async function setup() {
  now = new Date(2026, 9, 14, 12, 0);
  const provider = new FakeFoodProvider();
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    clock,
    provider,
    catalog,
  );
  const profile = await services.profile.ensureLocalProfile();
  await services.nutrition.meals.ensureDefaults(profile.id);
  const [breakfast] = await services.nutrition.meals.listActive(profile.id);
  return { n: services.nutrition, provider, profileId: profile.id, mealId: breakfast?.id ?? '' };
}

const nameOf = (result: FoodSearchResult) =>
  result.kind === 'food' ? result.food.name : result.reference.name;
const groupOf = (result: FoodSearchResult) =>
  result.kind === 'reference' ? blsCategory(result.reference.code) : null;

async function search(query: string, lang: 'de' | 'en' = 'de') {
  const { n, profileId } = await setup();
  return n.lookup.search(profileId, query, { lang });
}

describe('ranking by meaning – real BLS data', () => {
  it('"Ei": eggs first, dishes that only contain an egg far behind', async () => {
    const results = await search('Ei');
    expect(nameOf(results[0] as FoodSearchResult)).toBe('Hühnerei roh');
    const top = results.slice(0, 15);
    expect(top.every((result) => groupOf(result) === 'egg')).toBe(true);
    const brain = results.findIndex((result) => nameOf(result) === 'Kalbshirn gebraten mit Ei');
    expect(brain === -1 || (results[brain]?.strong === false && brain > 15)).toBe(true);
    // "Grießbrei" or "Reis" are no eggs: never a clear match.
    expect(results.filter((r) => r.strong).every((r) => groupOf(r) === 'egg')).toBe(true);
  });

  it.each([
    ['Eier', 'Hühnerei roh'],
    ['Hühnerei', 'Hühnerei roh'],
    ['Huehnerei', 'Hühnerei roh'],
    ['Magerquark', 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.'],
    ['Skyr', 'Skyr, Frischkäse < 10 % Fett i. Tr.'],
    ['Banane', 'Banane roh'],
    ['Lachs', 'Lachs roh'],
    ['Haferflocken', 'Hafer Flocken'],
  ])('"%s" finds "%s" first', async (query, expected) => {
    expect(nameOf((await search(query))[0] as FoodSearchResult)).toBe(expected);
  });

  it('"Quark": the plain quark before quark dishes and quark cakes', async () => {
    const results = await search('Quark');
    const names = results.map(nameOf);
    expect(names.slice(0, 5).every((name) => name.startsWith('Speisequark'))).toBe(true);
    const plain = names.findIndex((name) => name.startsWith('Speisequark'));
    const withJam = names.indexOf('Quark (Magerstufe) mit Konfitüre');
    const cake = names.indexOf('Quarkstollen (Rührmasse)');
    expect(plain).toBeLessThan(withJam);
    expect(withJam).toBeLessThan(cake === -1 ? Infinity : cake);
  });

  it('"Lachs" and "Hähnchen": the plain fish and poultry, all clear matches', async () => {
    const salmon = await search('Lachs');
    expect(salmon.slice(0, 10).every((r) => groupOf(r) === 'fish' && r.strong)).toBe(true);
    const chicken = await search('Hähnchen');
    expect(chicken.slice(0, 10).every((r) => groupOf(r) === 'poultry' && r.strong)).toBe(true);
  });

  it('a dish is still found first when it is asked for by name', async () => {
    expect(nameOf((await search('Kartoffelbrei'))[0] as FoodSearchResult)).toBe(
      'Kartoffelbrei mit Milch 3,5 % Fett',
    );
    // A dish ranks after the plain food with the same match, never hidden.
    const egg = await search('Eier gekocht');
    expect(egg.map(nameOf)).toContain('Eier gekocht');
  });

  it('tolerates one slip in longer words, but lists it as a weaker match', async () => {
    const results = await search('Bananne');
    expect(nameOf(results[0] as FoodSearchResult)).toBe('Banane roh');
    expect(results[0]?.strong).toBe(false);
    expect(await search('Bnaane')).not.toEqual([]); // swapped letters
  });

  it('English: "egg" and "chicken breast" with the English name as main name', async () => {
    const eggs = await search('egg', 'en');
    expect(eggs.slice(0, 5).every((r) => groupOf(r) === 'egg')).toBe(true);
    const breast = await search('chicken breast', 'en');
    expect(nameOf(breast[0] as FoodSearchResult)).toMatch(/^Hähnchen Brust/);
  });

  it('many matches stay bounded and ordered; nothing matching gives nothing', async () => {
    const results = await search('ei');
    expect(results.length).toBeLessThanOrEqual(50);
    const firstWeak = results.findIndex((r) => !r.strong);
    expect(results.slice(firstWeak).every((r) => !r.strong)).toBe(true);
    for (let i = 1; i < results.length; i += 1) {
      expect((results[i]?.score ?? 0) <= (results[i - 1]?.score ?? 0)).toBe(true);
    }
    expect(await search('xqzvw')).toEqual([]);
    expect(await search('   ')).toEqual([]);
  });
});

describe('brands, retailers and personal use', () => {
  const magerquark = externalProduct({
    externalId: '4056489000001',
    barcode: '4056489000001',
    name: 'Magerquark',
    brand: 'Milbona',
  });

  async function withSavedQuark() {
    const context = await setup();
    const { n, profileId } = context;
    const food = await n.foods.saveImported(
      profileId,
      { provider: 'openfoodfacts', externalId: magerquark.externalId },
      { ...magerquark, nutrients: complete(magerquark) },
    );
    return { ...context, food };
  }

  it('"Quark Lidl": recognises the retailer and raises its own brand (Milbona)', async () => {
    const { n, profileId } = await withSavedQuark();
    const results = await n.lookup.search(profileId, 'Quark Lidl');
    expect(nameOf(results[0] as FoodSearchResult)).toBe('Magerquark');
    // The plain quark without a brand is still offered, after it.
    expect(results.map(nameOf)).toContain('Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.');
  });

  it('"Milbona" alone lists the products of that brand only', async () => {
    const { n, profileId } = await withSavedQuark();
    const results = await n.lookup.search(profileId, 'Milbona');
    expect(results.map(nameOf)).toEqual(['Magerquark']);
  });

  it('personal use raises a food within bounds – other foods stay findable', async () => {
    const { n, profileId, mealId } = await setup();
    const magerstufe = 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.';
    const before = (await n.lookup.search(profileId, 'Quark')).map(nameOf);
    // Five equal plain quarks: the longest name (Magerstufe) comes last of them.
    expect(before.indexOf(magerstufe)).toBe(4);
    const reference = await catalog.get('M713100');
    if (!reference) throw new Error('missing');
    const food = await n.lookup.useReference(reference);
    for (let day = 1; day <= 6; day += 1) {
      await n.diary.addFood(profileId, {
        localDate: `2026-10-0${String(day)}`,
        mealId,
        foodId: food.id,
        amount: 250,
        unit: 'g',
      });
    }
    const after = (await n.lookup.search(profileId, 'Quark')).map(nameOf);
    expect(after[0]).toBe(magerstufe);
    // The other quarks are still there, right after it.
    expect(after.slice(1, 5).every((name) => name.startsWith('Speisequark'))).toBe(true);
    // An exact name still beats any habit: a food called exactly "Quark" comes first.
    await n.foods.create(profileId, {
      name: 'Quark',
      reference: { amount: 100, unit: 'g' },
      nutrients: { ...reference.nutrients },
    });
    expect((await n.lookup.search(profileId, 'Quark')).map(nameOf)[0]).toBe('Quark');
  });

  it('a saved product of the brand the user buys comes before the plain quark', async () => {
    const { n, profileId } = await withSavedQuark();
    expect((await n.lookup.search(profileId, 'Quark')).map(nameOf)[0]).toBe('Magerquark');
  });

  it('the usage bonus grows slowly and stops at its cap', () => {
    expect(usageBonus(0)).toBe(0);
    expect(usageBonus(1)).toBeGreaterThan(0);
    expect(usageBonus(3)).toBeGreaterThan(usageBonus(1));
    expect(usageBonus(1000)).toBe(BONUS.usageMax);
    expect(usageBonus(Number.NaN)).toBe(0);
    // Even the full bonus never lifts a weak match (start of a word) above a clear one.
    const query = analyzeQuery('ei');
    const weak = relevance({ names: [prepareName('Eierlikör')], bonus: BONUS.usageMax }, query);
    const clear = relevance({ names: [prepareName('Hühnerei roh')] }, query);
    expect(weak ?? 0).toBeLessThan(clear ?? 0);
  });

  it('usage counts are read locally from the diary, for the last 180 days only', async () => {
    const { n, profileId, mealId, food } = await withSavedQuark();
    await n.diary.addFood(profileId, {
      localDate: '2026-01-01',
      mealId,
      foodId: food.id,
      amount: 100,
      unit: 'g',
    });
    expect((await n.foods.usageCounts(profileId)).get(food.id)).toBeUndefined();
    await n.diary.addFood(profileId, {
      localDate: '2026-10-10',
      mealId,
      foodId: food.id,
      amount: 100,
      unit: 'g',
    });
    expect((await n.foods.usageCounts(profileId)).get(food.id)).toBe(1);
  });
});

describe('online extension (optional, explicit)', () => {
  const lidlQuark = externalProduct({
    externalId: '4056489000002',
    barcode: '4056489000002',
    name: 'Speisequark Magerstufe',
    brand: 'Milbona',
    stores: ['Lidl'],
  });
  const otherQuark = externalProduct({
    externalId: '4000000000003',
    barcode: '4000000000003',
    name: 'Quarkcreme Vanille',
    brand: 'Andere Marke',
  });

  it('the local search never asks the provider – online only on request', async () => {
    const { n, provider, profileId } = await setup();
    await n.lookup.search(profileId, 'Quark Lidl');
    expect(provider.calls).toEqual([]);
    expect(n.lookup.canSearchOnline).toBe(true);
  });

  it('sends only the search text, ranks retailer matches first', async () => {
    const { n, provider, profileId } = await setup();
    provider.searchResults = [otherQuark, lidlQuark];
    const results = await n.lookup.searchOnline(profileId, ' Quark Lidl ');
    expect(provider.calls).toEqual([
      { method: 'search', value: 'Quark Lidl', limit: ONLINE_SEARCH.limit },
    ]);
    expect(results[0]).toMatchObject({ kind: 'product', strong: true });
    expect(results.map((r) => (r.kind === 'product' ? r.product.name : r.food.name))).toEqual([
      'Speisequark Magerstufe',
      'Quarkcreme Vanille',
    ]);
  });

  it('repeats a search from memory, throttles before the provider limit', async () => {
    const { n, provider, profileId } = await setup();
    provider.searchResults = [lidlQuark];
    await n.lookup.searchOnline(profileId, 'Quark');
    await n.lookup.searchOnline(profileId, 'quark');
    expect(provider.calls).toHaveLength(1);
    for (let i = 1; i < ONLINE_SEARCH.perMinute; i += 1) {
      await n.lookup.searchOnline(profileId, `Quark ${String(i)}`);
    }
    expect(provider.calls).toHaveLength(ONLINE_SEARCH.perMinute);
    await expect(n.lookup.searchOnline(profileId, 'Joghurt')).rejects.toEqual(
      new FoodProviderError('rate-limited'),
    );
    expect(provider.calls).toHaveLength(ONLINE_SEARCH.perMinute);
  });

  it('offline: the online search fails clearly, the local search works on', async () => {
    const { n, provider, profileId } = await setup();
    provider.failWith = 'offline';
    await expect(n.lookup.searchOnline(profileId, 'Quark')).rejects.toEqual(
      new FoodProviderError('offline'),
    );
    expect((await n.lookup.search(profileId, 'Quark')).length).toBeGreaterThan(0);
  });

  it('a product saved before comes back as the stored food (no duplicate)', async () => {
    const { n, provider, profileId } = await setup();
    const saved = await n.foods.saveImported(
      profileId,
      { provider: lidlQuark.provider, externalId: lidlQuark.externalId },
      { ...lidlQuark, nutrients: complete(lidlQuark) },
    );
    provider.searchResults = [lidlQuark];
    const [result] = await n.lookup.searchOnline(profileId, 'Quark');
    expect(result).toMatchObject({ kind: 'saved', food: { id: saved.id } });
    // Saved, it is found offline afterwards.
    provider.failWith = 'offline';
    const local = await n.lookup.search(profileId, 'Speisequark Magerstufe');
    expect(local.some((r) => r.kind === 'food' && r.food.id === saved.id)).toBe(true);
  });

  it('nothing is sent for a text that is too short', async () => {
    const { n, provider, profileId } = await setup();
    expect(await n.lookup.searchOnline(profileId, 'e')).toEqual([]);
    expect(provider.calls).toEqual([]);
  });
});

describe('barcode guard (Phase 27)', () => {
  it('a known barcode is answered locally – no request, no text search', async () => {
    const { n, provider, profileId } = await setup();
    const product = externalProduct();
    await n.foods.saveImported(
      profileId,
      { provider: product.provider, externalId: product.externalId },
      { ...product, nutrients: complete(product) },
    );
    const result = await n.lookup.lookupBarcode(profileId, product.barcode ?? '');
    expect(result).toMatchObject({ kind: 'local', food: { name: 'Skyr Natur', brand: 'Milbona' } });
    expect(provider.calls).toEqual([]);
  });

  it('an unknown barcode asks only for that barcode and keeps the product data', async () => {
    const { n, provider, profileId } = await setup();
    const product = externalProduct({ stores: undefined });
    provider.products = [product];
    const result = await n.lookup.lookupBarcode(profileId, product.barcode ?? '');
    expect(result).toEqual({ kind: 'external', product });
    expect(provider.calls).toEqual([{ method: 'barcode', value: product.barcode }]);
  });
});
