import { createServices } from '@/app/services';
import { createTestDatabase, ENCRYPTED_TEST_SECURITY } from '@/test/database';
import { externalProduct, FakeFoodProvider } from '@/test/fakeFoodProvider';
import { createBlsCatalog } from './bls';
import { blsCategory } from './category';
import type { FoodSearchResult } from './foodLookupService';
import { analyzeQuery, assessMatch, prepareName } from './foodRanking';
import { kindOfNameWord, TAXONOMY_VERSION } from './foodTaxonomy';
import type { Nutrients } from './nutrients';
import type { ExternalProduct } from './provider';

/**
 * Phase 29 – understand the query, exclude what does not fit, then sort. Controlled products
 * (never live Open Food Facts data) and the real bundled BLS 4.0.
 */
const catalog = createBlsCatalog();
const now = new Date(2026, 9, 14, 12, 0);

async function setup() {
  const provider = new FakeFoodProvider();
  const services = createServices(
    { driver: await createTestDatabase(), security: ENCRYPTED_TEST_SECURITY },
    () => now,
    provider,
    catalog,
  );
  const profile = await services.profile.ensureLocalProfile();
  await services.nutrition.meals.ensureDefaults(profile.id);
  const [breakfast] = await services.nutrition.meals.listActive(profile.id);
  return { n: services.nutrition, profileId: profile.id, mealId: breakfast?.id ?? '' };
}

const complete = (product: ExternalProduct): Nutrients => ({
  ...product.nutrients,
  energyKcal: product.nutrients.energyKcal ?? 0,
  proteinG: product.nutrients.proteinG ?? 0,
  carbsG: product.nutrients.carbsG ?? 0,
  fatG: product.nutrients.fatG ?? 0,
});

const nameOf = (result: FoodSearchResult) =>
  result.kind === 'food'
    ? result.food.name
    : result.kind === 'reference'
      ? result.reference.name
      : result.product.name;
const groupOf = (result: FoodSearchResult) =>
  result.kind === 'reference' ? blsCategory(result.reference.code) : null;

let code = 4056489100000;
/** A controlled product with plausible values; a new barcode each time. */
function product(name: string, change: Partial<ExternalProduct> = {}): ExternalProduct {
  code += 1;
  return externalProduct({
    externalId: String(code),
    barcode: String(code),
    name,
    brand: 'Milbona',
    nutrients: {
      energyKcal: 350,
      proteinG: 25,
      carbsG: 1,
      fatG: 27,
      fiberG: null,
      sugarG: 1,
      saturatedFatG: 17,
    },
    ...change,
  });
}

const dessert = { energyKcal: 110, proteinG: 3, carbsG: 17, fatG: 3 } as const;

/** The controlled "Milbona Käse" answer of the online search. */
const CHEESE_SEARCH = {
  gouda: product('Gouda jung', { categories: ['dairies', 'cheeses'] }),
  edamer: product('Edamer am Stück', { categories: ['cheeses'] }),
  slices: product('Scheibenkäse Butterkäse', { categories: ['cheeses'] }),
  burger: product('Burger', {
    brand: 'Grillmeister',
    categories: ['cheeses'],
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 250,
      proteinG: 13,
      carbsG: 22,
      fatG: 12,
    },
  }),
  cheeseburger: product('Cheeseburger', {
    categories: ['cheeses', 'burgers'],
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 250,
      proteinG: 13,
      carbsG: 22,
      fatG: 12,
    },
  }),
  pudding: product('Pudding Vanille', {
    nutrients: { ...externalProduct().nutrients, ...dessert },
  }),
  noodles: product('Nudeln mit Käse', {
    brand: 'Chef Select',
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 160,
      proteinG: 7,
      carbsG: 22,
      fatG: 5,
    },
  }),
  described: product('Snack Mix', {
    brand: 'Snackhaus',
    description: 'Cracker mit Milbona Käse',
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 480,
      proteinG: 10,
      carbsG: 60,
      fatG: 22,
    },
  }),
};

async function searchCheese(extra: ExternalProduct[] = []) {
  const { n, profileId } = await setup();
  const online = [...Object.values(CHEESE_SEARCH), ...extra];
  const results = await n.lookup.search(profileId, 'Milbona Käse', { online });
  const diagnosis = await n.lookup.diagnose(profileId, 'Milbona Käse', { online });
  return { results, diagnosis, n, profileId };
}

describe('query analysis (local, deterministic)', () => {
  it.each([
    ['Milbona Käse', ['milbona'], ['cheese'], []],
    ['Milbona', ['milbona'], [], []],
    ['Lidl Quark', ['lidl'], ['quark'], []],
    ['Milbona Magerquark', ['milbona'], ['quark'], ['mager']],
    ['Coca Cola Zero', ['coca cola'], [null], ['zero']],
    ['Barilla Spaghetti', ['barilla'], ['pasta'], []],
    ['Ei', [], ['egg'], []],
    ['Hähnchenbrust', [], ['poultry'], ['brust']],
  ] as const)('"%s" → brands %j, kinds %j, variants %j', (query, brands, kinds, variants) => {
    const analysis = analyzeQuery(query);
    expect(analysis.brands).toEqual(brands);
    expect(analysis.kinds.map((kind) => kind.kind)).toEqual(kinds);
    expect(analysis.variants).toEqual(variants);
    expect(analysis.taxonomy).toBe(TAXONOMY_VERSION);
  });

  it('the retailer brings its own brands, but not every Lidl product is Milbona', () => {
    const analysis = analyzeQuery('Lidl Quark');
    expect(analysis.retailers).toEqual(['lidl']);
    expect(analysis.brandTargets).toContain('milbona');
    // A Lidl product of another brand only counts through the shop it is sold in.
    const other = assessMatch(
      { names: [prepareName('Magerquark')], brands: ['andere'], stores: ['lidl'] },
      analysis,
    );
    expect(other.diagnosis.brand.source).toBe('store');
    const nowhere = assessMatch(
      { names: [prepareName('Magerquark')], brands: ['andere'] },
      analysis,
    );
    expect(nowhere.decision).toBe('partial');
  });

  it('a quantity is understood, never required', () => {
    const analysis = analyzeQuery('Magerquark 500 g');
    expect(analysis.quantity).toBe('500g');
    expect(analysis.foodWords).toEqual(['magerquark']);
    const sized = assessMatch(
      { names: [prepareName('Magerquark')], packageSize: '500 g' },
      analysis,
    );
    const other = assessMatch(
      { names: [prepareName('Magerquark')], packageSize: '250 g' },
      analysis,
    );
    expect(sized.decision).toBe('match');
    expect(other.decision).toBe('match');
    expect(sized.score).toBeGreaterThan(other.score);
  });

  it('uncertain readings stay conservative and are noted', () => {
    const analysis = analyzeQuery('Cola Zero');
    expect(analysis.notes.some((note) => note.includes('cola'))).toBe(true);
  });
});

describe('taxonomy: no wrong synonyms', () => {
  it.each([
    ['gouda', 'cheese'],
    ['edamer', 'cheese'],
    ['scheibenkase', 'cheese'],
    ['leberkase', null],
    ['fleischkase', null],
    ['cheeseburger', 'other:burger'],
    ['kasekuchen', 'other:kuchen'],
    ['magerquark', 'quark'],
    ['huhnerei', 'egg'],
    ['eierlikor', 'other:likor'],
    ['brei', null],
    ['hahnchenbrust', 'poultry'],
    ['lachs', 'fish'],
    ['bananenchips', 'other:chips'],
  ])('"%s" is %s', (word, kind) => {
    expect(kindOfNameWord(word)).toBe(kind);
  });
});

describe('A. "Milbona Käse" – brand and kind together', () => {
  it('Milbona Gouda, Edamer and Scheibenkäse are the passende Lebensmittel, at the top', async () => {
    const { results } = await searchCheese();
    const matches = results.filter((r) => r.strong).map(nameOf);
    expect(matches).toEqual(
      expect.arrayContaining(['Gouda jung', 'Edamer am Stück', 'Scheibenkäse Butterkäse']),
    );
    expect(matches).toHaveLength(3);
    expect(results.slice(0, 3).map(nameOf).sort()).toEqual(
      ['Edamer am Stück', 'Gouda jung', 'Scheibenkäse Butterkäse'].sort(),
    );
  });

  it('a burger, a pudding, a dish with cheese and a mere description never count as passend', async () => {
    const { results, diagnosis } = await searchCheese();
    const strong = results.filter((r) => r.strong).map(nameOf);
    for (const name of [
      'Burger',
      'Cheeseburger',
      'Pudding Vanille',
      'Nudeln mit Käse',
      'Snack Mix',
    ]) {
      expect(strong).not.toContain(name);
    }
    const judged = (name: string) => diagnosis.candidates.find((c) => c.name === name);
    // The burger of another brand is cheese only by its (wrong) category: not shown at all.
    expect(judged('Burger')).toMatchObject({
      shown: false,
      diagnosis: {
        decision: 'excluded',
        kind: { product: 'other:burger', conflict: 'other:burger' },
      },
    });
    // The Milbona cheeseburger and pudding carry the brand, not the kind: further results.
    expect(judged('Cheeseburger')?.diagnosis).toMatchObject({
      decision: 'partial',
      brand: { met: true },
      kind: { conflict: 'other:burger', met: false },
    });
    expect(judged('Pudding Vanille')?.diagnosis).toMatchObject({
      decision: 'partial',
      kind: { product: 'other:pudding', met: false },
    });
    // Käse only as an addition of a dish, another brand: weak – online not shown at all.
    expect(judged('Nudeln mit Käse')).toMatchObject({
      shown: false,
      diagnosis: { decision: 'weak' },
    });
    // Milbona and Käse only in the description: no requirement met.
    expect(judged('Snack Mix')).toMatchObject({
      shown: false,
      diagnosis: { decision: 'excluded' },
    });
  });

  it('partial matches follow every full match, the BLS cheeses among them', async () => {
    const { results } = await searchCheese();
    const lastMatch = results.map((r) => r.strong).lastIndexOf(true);
    const firstPartial = results.findIndex((r) => !r.strong);
    expect(lastMatch).toBeLessThan(firstPartial);
    expect(results.slice(firstPartial).some((r) => r.kind === 'reference')).toBe(true);
    expect(results.slice(firstPartial).every((r) => r.decision !== 'match')).toBe(true);
  });

  it('an often used own "Käse" without the brand stays below the rarely used exact match', async () => {
    const { n, profileId, mealId } = await setup();
    const own = await n.foods.create(profileId, {
      name: 'Käse',
      reference: { amount: 100, unit: 'g' },
      nutrients: complete(CHEESE_SEARCH.gouda),
    });
    for (let day = 1; day <= 9; day += 1) {
      await n.diary.addFood(profileId, {
        localDate: `2026-10-0${String(day)}`,
        mealId,
        foodId: own.id,
        amount: 30,
        unit: 'g',
      });
    }
    const results = await n.lookup.search(profileId, 'Milbona Käse', {
      online: [CHEESE_SEARCH.gouda],
    });
    expect(nameOf(results[0] as FoodSearchResult)).toBe('Gouda jung');
    const ownIndex = results.findIndex((r) => r.kind === 'food' && r.food.id === own.id);
    expect(ownIndex).toBeGreaterThan(0);
    expect(results[ownIndex]?.decision).toBe('partial');
  });

  it('nothing fits: no partial result is ever called passend', async () => {
    const { n, profileId } = await setup();
    const results = await n.lookup.search(profileId, 'Milbona Käse', {
      online: [CHEESE_SEARCH.pudding, CHEESE_SEARCH.burger],
    });
    expect(results.filter((r) => r.strong)).toEqual([]);
    expect(results.length).toBeGreaterThan(0); // the plain BLS cheeses as further results
  });
});

describe('B. brand and product searches', () => {
  const quark = product('Magerquark', {
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 67,
      proteinG: 12,
      carbsG: 4,
      fatG: 0.2,
    },
  });
  const speisequark = product('Speisequark Magerstufe', { nutrients: quark.nutrients });
  const skyr = product('Skyr Natur', { nutrients: externalProduct().nutrients });
  const yogurt = product('Joghurt mild', {
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 70,
      proteinG: 4,
      carbsG: 5,
      fatG: 3.8,
    },
  });
  const otherQuark = product('Magerquark', {
    brand: 'Andere Molkerei',
    stores: ['Rewe'],
    nutrients: quark.nutrients,
  });
  const cola = product('Coca-Cola Zero Sugar', {
    brand: 'Coca-Cola',
    nutrients: { ...externalProduct().nutrients, energyKcal: 0.3, proteinG: 0, carbsG: 0, fatG: 0 },
  });
  const colaClassic = product('Coca-Cola Original', {
    brand: 'Coca-Cola',
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 42,
      proteinG: 0,
      carbsG: 10.6,
      fatG: 0,
    },
  });
  const spaghetti = product('Spaghetti n.5', {
    brand: 'Barilla',
    nutrients: {
      ...externalProduct().nutrients,
      energyKcal: 359,
      proteinG: 12.5,
      carbsG: 71,
      fatG: 2,
    },
  });
  const penne = product('Penne Rigate', { brand: 'Barilla', nutrients: spaghetti.nutrients });
  const online = [
    quark,
    speisequark,
    skyr,
    yogurt,
    otherQuark,
    cola,
    colaClassic,
    spaghetti,
    penne,
  ];

  async function strongFor(query: string) {
    const { n, profileId } = await setup();
    const results = await n.lookup.search(profileId, query, { online });
    return { strong: results.filter((r) => r.strong).map(nameOf), results };
  }

  it('"Milbona" lists the products of that brand only', async () => {
    const { strong, results } = await strongFor('Milbona');
    expect(strong.sort()).toEqual(
      ['Joghurt mild', 'Magerquark', 'Skyr Natur', 'Speisequark Magerstufe'].sort(),
    );
    expect(results.every((r) => r.kind === 'product' && r.product.brand === 'Milbona')).toBe(true);
  });

  it('"Milbona Quark" and "Milbona Magerquark": Milbona quark only, Speisequark Magerstufe included', async () => {
    expect((await strongFor('Milbona Quark')).strong.sort()).toEqual(
      ['Magerquark', 'Speisequark Magerstufe'].sort(),
    );
    expect((await strongFor('Milbona Magerquark')).strong.sort()).toEqual(
      ['Magerquark', 'Speisequark Magerstufe'].sort(),
    );
  });

  it('"Milbona Skyr" is the skyr, not the yogurt', async () => {
    expect((await strongFor('Milbona Skyr')).strong).toEqual(['Skyr Natur']);
  });

  it('"Lidl Quark": Lidl\'s own brand – another brand only when sold at Lidl', async () => {
    const { strong } = await strongFor('Lidl Quark');
    expect(strong.sort()).toEqual(['Magerquark', 'Speisequark Magerstufe'].sort());
  });

  it('"Coca Cola Zero": the brand and the variant', async () => {
    const { strong } = await strongFor('Coca Cola Zero');
    expect(strong).toEqual(['Coca-Cola Zero Sugar']);
  });

  it('"Barilla Spaghetti": spaghetti of that brand, the penne only as a further result', async () => {
    const { strong, results } = await strongFor('Barilla Spaghetti');
    expect(strong).toEqual(['Spaghetti n.5']);
    expect(results.find((r) => nameOf(r) === 'Penne Rigate')?.decision).toBe('partial');
  });
});

describe('C. plain foods – real BLS data', () => {
  async function search(query: string) {
    const { n, profileId } = await setup();
    return n.lookup.search(profileId, query);
  }

  it.each([
    ['Ei', 'egg'],
    ['Eier', 'egg'],
    ['Hähnchen', 'poultry'],
    ['Lachs', 'fish'],
  ])('"%s": the plain food first, all clear matches of its group', async (query, group) => {
    const results = await search(query);
    expect(results.slice(0, 8).every((r) => groupOf(r) === group && r.strong)).toBe(true);
    const firstDish = results.findIndex((r) => groupOf(r) === 'dishes');
    expect(firstDish === -1 || firstDish >= 8).toBe(true);
  });

  it.each([
    ['Käse', /käse/i],
    ['Gouda', /^Gouda/],
    ['Quark', /^Speisequark/],
    ['Magerquark', /Magerquark|Magerstufe/],
    ['Skyr', /^Skyr/],
    ['Hähnchen Brust', /^Hähnchen Brust/],
    ['Lachsfilet', /Lachs/],
    ['Haferflocken', /Hafer/],
    ['Banane', /^Banane/],
  ])('"%s" finds a plain food first', async (query, expected) => {
    const results = await search(query);
    expect(nameOf(results[0] as FoodSearchResult)).toMatch(expected);
    expect(results[0]?.strong).toBe(true);
  });

  it('"Bananne" still finds the banana – as a weaker result', async () => {
    const results = await search('Bananne');
    expect(nameOf(results[0] as FoodSearchResult)).toBe('Banane roh');
    expect(results[0]?.decision).not.toBe('match');
  });

  it('"Käse": no meat loaf, no cheese cake among the passende Lebensmittel', async () => {
    const strong = (await search('Käse')).filter((r) => r.strong).map(nameOf);
    expect(strong.length).toBeGreaterThan(5);
    expect(strong.some((name) => /leberkäse|fleischkäse|kuchen|torte/i.test(name))).toBe(false);
  });

  it('"Ei" is not dominated by dishes with egg', async () => {
    const results = await search('Ei');
    const strong = results.filter((r) => r.strong);
    expect(strong.every((r) => groupOf(r) === 'egg')).toBe(true);
    expect(results.find((r) => nameOf(r) === 'Kalbshirn gebraten mit Ei')?.strong ?? false).toBe(
      false,
    );
  });
});

describe('D. conflicts and faulty data', () => {
  const query = analyzeQuery('Milbona Käse', ['Milbona']);
  const judge = (
    name: string,
    extra: Parameters<typeof assessMatch>[0] extends infer C ? Partial<C> : never = {},
  ) => assessMatch({ names: [prepareName(name)], ...extra }, query);

  it('a wrong category never overrules the name', () => {
    expect(judge('Burger', { brands: ['milbona'], categories: ['cheeses'] }).decision).toBe(
      'partial',
    );
    expect(judge('Burger', { brands: ['andere'], categories: ['cheeses'] }).decision).toBe(
      'excluded',
    );
  });

  it('a missing brand: only the start of the name may carry it, at half weight', () => {
    const named = judge('Milbona Gouda', { brands: [] });
    expect(named.decision).toBe('match');
    expect(named.diagnosis.brand.source).toBe('name');
    const field = judge('Gouda', { brands: ['milbona'] });
    expect(field.score).toBeGreaterThan(named.score - 25);
  });

  it('a wrong brand in the brand field is no brand match, even with the brand in the name', () => {
    const wrong = judge('Milbona Gouda Art', { brands: ['andere'] });
    expect(wrong.decision).toBe('partial');
    expect(wrong.diagnosis.brand.met).toBe(false);
    expect(wrong.diagnosis.reasons).toContain('another brand in the brand field');
  });

  it('the kind only in a description or ingredient list is no kind', () => {
    expect(judge('Cracker', { brands: ['milbona'] }).diagnosis.kind.met).toBe(false);
    expect(judge('Cracker', { brands: ['andere'] }).decision).toBe('excluded');
  });

  it('exact before fuzzy: "Banane" beats a slip of the pen', () => {
    const banana = analyzeQuery('Banane');
    const exact = assessMatch({ names: [prepareName('Banane')] }, banana);
    const slip = assessMatch({ names: [prepareName('Bananne Chips Art')] }, banana);
    expect(exact.decision).toBe('match');
    expect(slip.decision).not.toBe('match');
  });

  it('incomplete records rank below complete ones of the same match, unusable ones are hidden', async () => {
    const { n, profileId } = await setup();
    const full = product('Gouda mittelalt');
    const limited = product('Gouda mittelalt', {
      nutrients: { ...full.nutrients, fatG: null },
      missing: ['fatG'],
    });
    const broken = product('Gouda alt', {
      nutrients: { ...full.nutrients, energyKcal: null },
      missing: ['energyKcal'],
    });
    const diagnosis = await n.lookup.diagnose(profileId, 'Milbona Käse', {
      online: [limited, broken, full],
    });
    const shown = diagnosis.candidates.filter((c) => c.source === 'online' && c.shown);
    expect(shown.map((c) => c.diagnosis.quality)).toEqual(['A', 'B']);
    expect(diagnosis.candidates.find((c) => c.name === 'Gouda alt')?.diagnosis).toMatchObject({
      decision: 'excluded',
      quality: 'C',
    });
  });

  it('duplicates merge, different package sizes stay', async () => {
    const { n, profileId } = await setup();
    const small = product('Gouda Scheiben', { packageSize: '150 g' });
    const large = product('Gouda Scheiben', { packageSize: '400 g' });
    const twin = { ...small };
    const results = await n.lookup.search(profileId, 'Milbona Gouda', {
      online: [small, twin, large],
    });
    expect(results.filter((r) => r.kind === 'product')).toHaveLength(2);
  });

  it('the diagnosis names what was met and what was not – nothing personal', async () => {
    const { diagnosis } = await searchCheese();
    const gouda = diagnosis.candidates.find((c) => c.name === 'Gouda jung');
    expect(gouda?.diagnosis).toMatchObject({
      decision: 'match',
      brand: { asked: ['milbona'], source: 'field', met: true },
      kind: { asked: ['cheese'], product: 'cheese', conflict: null, met: true },
      missing: [],
      quality: 'A',
    });
    expect(gouda?.diagnosis.met).toEqual(['brand milbona', 'food kase']);
    expect(JSON.stringify(diagnosis)).not.toMatch(/profile|diary|usage/i);
  });
});
