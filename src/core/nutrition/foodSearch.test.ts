import { createServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { externalProduct, FakeFoodProvider } from '@/test/fakeFoodProvider';
import { createBlsCatalog } from './bls';
import { blsCategory } from './category';
import type { FoodSearchResult } from './foodLookupService';
import { ONLINE_SEARCH, SEARCH_RESULTS_LIMIT } from './foodLookupService';
import {
  analyzeQuery,
  assessMatch,
  compareRanked,
  prepareName,
  relevance,
  usageBonus,
  BONUS,
  STRONG_MATCH,
} from './foodRanking';
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
  result.kind === 'food'
    ? result.food.name
    : result.kind === 'reference'
      ? result.reference.name
      : result.product.name;
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

describe('automatic online search, one ranking for all sources (Phase 28)', () => {
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
  const milbonaGouda = externalProduct({
    externalId: '4056489000010',
    barcode: '4056489000010',
    name: 'Gouda jung',
    brand: 'Milbona',
    categories: ['dairies', 'cheeses', 'gouda'],
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 356,
      proteinG: 24,
      carbsG: 0,
      fatG: 29,
    },
  });

  it('the local search alone never asks the provider', async () => {
    const { n, provider, profileId } = await setup();
    await n.lookup.search(profileId, 'Quark Lidl');
    expect(provider.calls).toEqual([]);
    expect(n.lookup.canSearchOnline).toBe(true);
  });

  it('sends only the search text; repeats from memory; throttles before the provider limit', async () => {
    const { n, provider } = await setup();
    provider.searchResults = [lidlQuark];
    expect(await n.lookup.onlineProducts(' Quark Lidl ')).toEqual([lidlQuark]);
    expect(provider.calls).toEqual([
      { method: 'search', value: 'Quark Lidl', limit: ONLINE_SEARCH.limit },
    ]);
    await n.lookup.onlineProducts('quark lidl');
    expect(provider.calls).toHaveLength(1);
    expect(n.lookup.cachedOnlineProducts('Quark Lidl')).toEqual([lidlQuark]);
    for (let i = 1; i < ONLINE_SEARCH.perMinute; i += 1) {
      await n.lookup.onlineProducts(`Quark ${String(i)}`);
    }
    expect(provider.calls).toHaveLength(ONLINE_SEARCH.perMinute);
    await expect(n.lookup.onlineProducts('Joghurt')).rejects.toEqual(
      new FoodProviderError('rate-limited'),
    );
    expect(provider.calls).toHaveLength(ONLINE_SEARCH.perMinute);
    // A minute later the next search is sent again.
    now = new Date(now.getTime() + 61_000);
    await n.lookup.onlineProducts('Joghurt');
    expect(provider.calls).toHaveLength(ONLINE_SEARCH.perMinute + 1);
  });

  it('remembered answers expire; nothing is sent for a text that is too short', async () => {
    const { n, provider } = await setup();
    provider.searchResults = [lidlQuark];
    await n.lookup.onlineProducts('Quark');
    now = new Date(now.getTime() + ONLINE_SEARCH.cacheMs + 1000);
    expect(n.lookup.cachedOnlineProducts('Quark')).toBeNull();
    await n.lookup.onlineProducts('Quark');
    expect(provider.calls).toHaveLength(2);
    expect(await n.lookup.onlineProducts('ei')).toEqual([]);
    expect(provider.calls).toHaveLength(2);
  });

  it.each(['offline', 'timeout', 'unavailable', 'invalid-response'] as const)(
    'provider error "%s": passed on, the local search works on',
    async (code) => {
      const { n, provider, profileId } = await setup();
      provider.failWith = code;
      await expect(n.lookup.onlineProducts('Quark')).rejects.toEqual(new FoodProviderError(code));
      expect((await n.lookup.search(profileId, 'Quark')).length).toBeGreaterThan(0);
    },
  );

  it('offline, a search answered before still comes from memory', async () => {
    const { n, provider, profileId } = await setup();
    provider.searchResults = [lidlQuark];
    const products = await n.lookup.onlineProducts('Quark Lidl');
    provider.failWith = 'offline';
    expect(await n.lookup.onlineProducts('Quark Lidl')).toEqual(products);
    const results = await n.lookup.search(profileId, 'Quark Lidl', { online: products });
    expect(results[0]).toMatchObject({
      kind: 'product',
      product: { name: 'Speisequark Magerstufe' },
    });
  });

  it('an online product can rank first – the match decides, not the source', async () => {
    const { n, provider, profileId } = await setup();
    // An own food that only shares the word "Käse", used often.
    await n.foods.create(profileId, {
      name: 'Käse',
      reference: { amount: 100, unit: 'g' },
      nutrients: { ...complete(milbonaGouda) },
    });
    provider.searchResults = [milbonaGouda];
    const online = await n.lookup.onlineProducts('Milbona Käse');
    const results = await n.lookup.search(profileId, 'Milbona Käse', { online });
    expect(results[0]).toMatchObject({ kind: 'product', product: { name: 'Gouda jung' } });
    const own = results.find((r) => r.kind === 'food' && r.food.name === 'Käse');
    // Phase 29: the own "Käse" lacks the brand – a partial match, below every full match.
    expect(results[0]?.decision).toBe('match');
    expect(own?.decision).toBe('partial');
  });

  it('a poor online match never pushes a clear local match down', async () => {
    const { n, provider, profileId } = await setup();
    provider.searchResults = [otherQuark];
    const online = await n.lookup.onlineProducts('Quark');
    const results = await n.lookup.search(profileId, 'Quark', { online });
    expect(nameOf(results[0] as FoodSearchResult)).toMatch(/^Speisequark/);
    const creme = results.findIndex((r) => r.kind === 'product');
    expect(creme).toBeGreaterThan(4);
    // A product without any relation to the query is left out entirely.
    const unrelated = externalProduct({
      externalId: '4000000000099',
      barcode: '4000000000099',
      name: 'Cola Zero',
    });
    const mixed = await n.lookup.search(profileId, 'Quark', { online: [unrelated] });
    expect(mixed.some((r) => r.kind === 'product')).toBe(false);
  });

  it('retailer matches rank first among the online products', async () => {
    const { n, profileId } = await setup();
    const results = await n.lookup.search(profileId, 'Quark Lidl', {
      online: [otherQuark, lidlQuark],
    });
    expect(results[0]).toMatchObject({
      kind: 'product',
      product: { name: 'Speisequark Magerstufe' },
    });
    const creme = results.findIndex(
      (r) => r.kind === 'product' && r.product.name === 'Quarkcreme Vanille',
    );
    expect(creme).toBeGreaterThan(0);
  });

  it('a saved product appears once, as the stored food (same record or same barcode)', async () => {
    const { n, profileId } = await setup();
    const saved = await n.foods.saveImported(
      profileId,
      { provider: lidlQuark.provider, externalId: lidlQuark.externalId },
      { ...lidlQuark, nutrients: complete(lidlQuark) },
    );
    const twin = { ...lidlQuark, externalId: 'other-record' };
    const results = await n.lookup.search(profileId, 'Speisequark Magerstufe', {
      online: [lidlQuark, twin],
    });
    expect(results.filter((r) => r.kind === 'product')).toEqual([]);
    expect(results.filter((r) => r.kind === 'food' && r.food.id === saved.id)).toHaveLength(1);
  });

  it('poor records are hidden, limited ones rank behind good ones of the same relevance', async () => {
    const { n, profileId } = await setup();
    const good = externalProduct({ externalId: '1', barcode: '40000001', name: 'Skyr Natur' });
    const limited = externalProduct({
      externalId: '2',
      barcode: '40000002',
      name: 'Skyr Natur',
      nutrients: { ...good.nutrients, fatG: null },
      missing: ['fatG'],
    });
    const poor = externalProduct({
      externalId: '3',
      barcode: '40000003',
      name: 'Skyr Natur',
      nutrients: { ...good.nutrients, energyKcal: null },
      missing: ['energyKcal'],
    });
    const results = (
      await n.lookup.search(profileId, 'Skyr Natur', { online: [limited, poor, good] })
    ).flatMap((r) => (r.kind === 'product' ? [r.product.externalId] : []));
    expect(results).toEqual(['1', '2']);
  });

  it('results stay bounded across all sources', async () => {
    const { n, profileId } = await setup();
    const many = Array.from({ length: 30 }, (_, i) =>
      externalProduct({
        externalId: `x${String(i)}`,
        barcode: `4000000001${String(i).padStart(3, '0')}`,
        name: `Eier Bio ${String(i)}`,
      }),
    );
    const results = await n.lookup.search(profileId, 'Eier', { online: many });
    expect(results).toHaveLength(SEARCH_RESULTS_LIMIT);
    // Products named "Eier …" are eggs as well: they compete with the BLS eggs on equal terms.
    expect(results.slice(0, 20).every((r) => r.kind === 'product' || groupOf(r) === 'egg')).toBe(
      true,
    );
  });
});

describe('ranking rules (Phase 28)', () => {
  const rank = (
    name: string,
    query: string,
    extra: Partial<Parameters<typeof relevance>[0]> = {},
  ) => relevance({ names: [prepareName(name)], ...extra }, analyzeQuery(query)) ?? -Infinity;

  it('exact name, word start, word boundaries and parts of words in that order', () => {
    expect(rank('Quark', 'Quark')).toBeGreaterThan(rank('Quark mager', 'Quark'));
    expect(rank('Quark mager', 'Quark')).toBeGreaterThan(rank('Magerquark', 'Quark') - 30);
    expect(rank('Magerquark', 'Quark')).toBeGreaterThan(rank('Quarkkuchen', 'Quark'));
    expect(rank('Quarkkuchen', 'Quark')).toBeGreaterThan(rank('Kuchen mit Quark', 'Quark'));
    expect(rank('Hähnchenbrust', 'Hähnchen')).toBeGreaterThan(
      rank('Reis mit Hähnchen', 'Hähnchen'),
    );
  });

  it('several words are judged together – all must match', () => {
    expect(rank('Eier gekocht', 'Eier gekocht')).toBeGreaterThan(rank('Eier roh', 'Eier gekocht'));
    expect(rank('Eier roh', 'Eier gekocht')).toBe(-Infinity);
  });

  it('brand plus kind: "Milbona Gouda" is a match, "Gouda Käse" and an own "Käse" are not', () => {
    const query = analyzeQuery('Milbona Käse');
    const judge = (name: string, brands: string[] = [], bonus = 0) =>
      assessMatch({ names: [prepareName(name)], brands, bonus }, query);
    const milbona = judge('Milbona Gouda', ['milbona']);
    expect(milbona.decision).toBe('match');
    // Only the kind, another brand: partial – whatever its score.
    expect(judge('Gouda Käse', ['andere']).decision).toBe('partial');
    // An own "Käse", used very often: partial, ranked below every match.
    const own = judge('Käse', [], BONUS.custom + BONUS.usageMax);
    expect(own.decision).toBe('partial');
    expect(compareRanked({ ...milbona, name: 'a' }, { ...own, name: 'b' })).toBeLessThan(0);
    // Käse only as an ingredient of a dish: weak at most.
    expect(judge('Nudeln mit Käse').decision).toBe('weak');
  });

  it('a brand only mentioned later in the name is no brand match', () => {
    const query = analyzeQuery('Milbona Quark');
    const real = assessMatch({ names: [prepareName('Milbona Magerquark')] }, query);
    const mention = assessMatch({ names: [prepareName('Quarkspeise mit Milbona Quark')] }, query);
    expect(real.decision).toBe('match');
    expect(real.diagnosis.brand.source).toBe('name');
    expect(mention.decision).not.toBe('match');
    expect(mention.diagnosis.brand.met).toBe(false);
  });

  it('a category only hints at the kind – never a match on its own', () => {
    const query = analyzeQuery('Käse');
    const withCategory = assessMatch(
      { names: [prepareName('Le Rustique')], categories: ['fresh cheeses', 'cheeses'] },
      query,
    );
    expect(withCategory.decision).toBe('partial');
    expect(withCategory.diagnosis.kind.categoryOnly).toBe(true);
    // Only the last word names the kind: "egg pasta" is pasta, not an egg.
    expect(
      relevance({ names: [prepareName('Spätzle')], categories: ['egg pasta'] }, analyzeQuery('Ei')),
    ).toBeNull();
  });

  it('typing slips are found, but below the correct spelling', () => {
    expect(rank('Banane roh', 'Bananne')).toBeGreaterThan(0);
    expect(rank('Banane roh', 'Banane')).toBeGreaterThan(rank('Banane roh', 'Bananne'));
  });

  it('the source is a small factor only: a clear match from any source beats a weak own food', () => {
    const query = analyzeQuery('Quark');
    const weakOwn = relevance(
      { names: [prepareName('Kuchen mit Quark')], bonus: BONUS.custom + BONUS.usageMax },
      query,
    );
    const clearOnline = relevance({ names: [prepareName('Speisequark')] }, query);
    expect(clearOnline ?? 0).toBeGreaterThan(weakOwn ?? 0);
  });
});

describe('Phase 28 target queries – real BLS data', () => {
  it('"Eier": egg products before dishes and compounds such as "Eierlikör"', async () => {
    const results = await search('Eier');
    expect(results.slice(0, 10).every((r) => groupOf(r) === 'egg')).toBe(true);
    const names = results.map(nameOf);
    const liqueur = names.findIndex((name) => name.startsWith('Eierlikör'));
    expect(liqueur === -1 || liqueur > 10).toBe(true);
  });

  it('"Hähnchen": chicken itself before dishes that only contain chicken', async () => {
    const results = await search('Hähnchen');
    const firstDish = results.findIndex((r) => groupOf(r) === 'dishes');
    const lastPoultry = results.map(groupOf).lastIndexOf('poultry');
    expect(firstDish === -1 || firstDish > 10).toBe(true);
    expect(results.slice(0, 10).every((r) => groupOf(r) === 'poultry')).toBe(true);
    expect(lastPoultry).toBeGreaterThan(-1);
  });

  it('"Magerquark": the plain lean quark before herb quark and quark dishes', async () => {
    const names = (await search('Magerquark')).map(nameOf);
    expect(names[0]).toMatch(/Magerquark|Magerstufe/);
    const herb = names.findIndex((name) => /Kräuter/.test(name));
    expect(herb === -1 || herb > 0).toBe(true);
  });

  it('"Käse" lists cheese – Gouda counts as one, Leberkäse does not', async () => {
    const results = await search('Käse');
    expect(results.filter((r) => r.strong).length).toBeGreaterThan(5);
    expect(results.slice(0, 20).some((r) => /^(Leber|Fleisch)käse/.test(nameOf(r)))).toBe(false);
    const query = analyzeQuery('Käse');
    expect(
      relevance({ names: [prepareName('Gouda mind. 40 % Fett i. Tr.')] }, query),
    ).toBeGreaterThan(STRONG_MATCH);
    expect(relevance({ names: [prepareName('Leberkäse')] }, query) ?? 0).toBeLessThan(STRONG_MATCH);
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
