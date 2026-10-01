import { FoodProviderError } from '../provider';
import {
  mapOpenFoodFactsProduct,
  OpenFoodFactsProvider,
  type JsonHttpClient,
} from './openFoodFacts';

type Reply = Awaited<ReturnType<JsonHttpClient['getJson']>>;

/** Records every request and answers with the given replies in order. */
function client(...replies: Reply[]) {
  const requests: { url: URL; headers: Record<string, string> }[] = [];
  const http: JsonHttpClient = {
    getJson: (url, options) => {
      requests.push({ url: new URL(url), headers: options.headers });
      const reply = replies.shift();
      if (!reply) throw new Error('unexpected request');
      return Promise.resolve(reply);
    },
  };
  return { http, requests };
}

const ok = (data: unknown): Reply => ({ ok: true, status: 200, data });

const NUTELLA = {
  code: '3017624010701',
  product_name: 'Nutella',
  product_name_de: 'Nutella Nuss-Nougat-Creme',
  brands: 'Ferrero, Nutella',
  quantity: '400 g',
  serving_quantity: '15',
  serving_size: '15 g',
  nutriments: {
    'energy-kcal_100g': 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: '30.9',
    fiber_100g: 0,
    sugars_100g: 56.3,
    'saturated-fat_100g': 10.6,
  },
};

const UA = 'Kalethra/0.5.0 (android)';

describe('Open Food Facts mapping', () => {
  it('maps names, brand, reference, nutrients and serving size', () => {
    expect(mapOpenFoodFactsProduct(NUTELLA, 'de')).toEqual({
      provider: 'openfoodfacts',
      externalId: '3017624010701',
      name: 'Nutella Nuss-Nougat-Creme',
      brand: 'Ferrero',
      barcode: '3017624010701',
      reference: { amount: 100, unit: 'g' },
      nutrients: {
        energyKcal: 539,
        proteinG: 6.3,
        carbsG: 57.5,
        fatG: 30.9,
        fiberG: 0,
        sugarG: 56.3,
        saturatedFatG: 10.6,
      },
      servings: [{ unit: 'serving', amount: 15, amountUnit: 'g', label: '15 g' }],
      missing: [],
    });
  });

  it('keeps missing values missing – never 0', () => {
    const product = mapOpenFoodFactsProduct(
      {
        code: '4000000000001',
        product_name: 'Unvollständig',
        nutriments: { 'energy-kcal_100g': 120, proteins_100g: 3 },
      },
      'de',
    );
    expect(product?.nutrients).toEqual({
      energyKcal: 120,
      proteinG: 3,
      carbsG: null,
      fatG: null,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
    });
    expect(product?.missing).toEqual(['carbsG', 'fatG']);
    const none = mapOpenFoodFactsProduct({ code: '4000000000001', product_name: 'Leer' }, 'de');
    expect(none?.missing).toEqual(['energyKcal', 'proteinG', 'carbsG', 'fatG']);
  });

  it('converts kJ to kcal and ignores impossible or broken values', () => {
    const product = mapOpenFoodFactsProduct(
      {
        code: '4000000000001',
        product_name: 'Nur kJ',
        nutriments: {
          'energy-kj_100g': 418.4,
          proteins_100g: -2,
          fat_100g: 'abc',
          carbohydrates_100g: 250,
        },
      },
      'de',
    );
    expect(product?.nutrients.energyKcal).toBe(100);
    expect(product?.nutrients.proteinG).toBeNull();
    expect(product?.nutrients.fatG).toBeNull();
    expect(product?.nutrients.carbsG).toBeNull();
  });

  it('uses 100 ml for drinks and the right serving unit', () => {
    const drink = mapOpenFoodFactsProduct(
      {
        code: '5449000000996',
        product_name: 'Cola',
        brands: ['Coca-Cola'],
        quantity: '1,5 l',
        serving_quantity: 250,
        serving_quantity_unit: 'ml',
        nutriments: {
          'energy-kcal_100g': 42,
          proteins_100g: 0,
          carbohydrates_100g: 10.6,
          fat_100g: 0,
        },
      },
      'de',
    );
    expect(drink?.reference).toEqual({ amount: 100, unit: 'ml' });
    expect(drink?.brand).toBe('Coca-Cola');
    expect(drink?.servings).toEqual([
      { unit: 'serving', amount: 250, amountUnit: 'ml', label: null },
    ]);
  });

  it('rejects entries without a usable barcode and falls back for names', () => {
    expect(mapOpenFoodFactsProduct({ product_name: 'Ohne Code' }, 'de')).toBeNull();
    expect(mapOpenFoodFactsProduct('kaputt', 'de')).toBeNull();
    expect(
      mapOpenFoodFactsProduct({ code: '4000000000001', product_name_en: 'Bread' }, 'de')?.name,
    ).toBe('Bread');
    expect(mapOpenFoodFactsProduct({ code: '4000000000001' }, 'de')?.name).toBe('');
  });
});

describe('OpenFoodFactsProvider', () => {
  it('looks up a barcode with only the barcode and the field list', async () => {
    const { http, requests } = client(ok({ status: 1, product: NUTELLA }));
    const provider = new OpenFoodFactsProvider(http, UA);
    const product = await provider.lookupBarcode('3017624010701');
    expect(product?.name).toBe('Nutella Nuss-Nougat-Creme');
    const [request] = requests;
    expect(request?.url.origin).toBe('https://world.openfoodfacts.org');
    expect(request?.url.pathname).toBe('/api/v2/product/3017624010701');
    expect([...(request?.url.searchParams.keys() ?? [])]).toEqual(['fields']);
    expect(request?.headers).toEqual({ 'User-Agent': UA });
  });

  it('reports unknown barcodes as not found', async () => {
    const provider = new OpenFoodFactsProvider(
      client(
        { ok: true, status: 404, data: { status: 0, status_verbose: 'product not found' } },
        ok({ status: 1 }),
      ).http,
      UA,
    );
    expect(await provider.lookupBarcode('4000000000001')).toBeNull();
    expect(await provider.lookupBarcode('4000000000002')).toBeNull();
  });

  it('never sends an invalid barcode', async () => {
    const { http, requests } = client();
    const provider = new OpenFoodFactsProvider(http, UA);
    expect(await provider.lookupBarcode('12ab')).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it('offers no full-text search – Open Food Facts is only the barcode fallback', () => {
    const { http } = client();
    const provider = new OpenFoodFactsProvider(http, UA);
    expect('search' in provider).toBe(false);
  });

  const failures: [Reply, string][] = [
    [{ ok: false, reason: 'offline' }, 'offline'],
    [{ ok: false, reason: 'timeout' }, 'timeout'],
    [{ ok: false, reason: 'http', status: 503 }, 'rate-limited'],
    [{ ok: false, reason: 'http', status: 429 }, 'rate-limited'],
    [{ ok: false, reason: 'http', status: 500 }, 'unavailable'],
    [{ ok: false, reason: 'invalid' }, 'invalid-response'],
    [ok({ unexpected: true }), 'invalid-response'],
    [ok([1, 2, 3]), 'invalid-response'],
  ];

  it.each(failures)('turns failures into a clear error (%j)', async (reply, code) => {
    const provider = new OpenFoodFactsProvider(client(reply, reply).http, UA);
    const error = await provider.lookupBarcode('4000000000001').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(FoodProviderError);
    expect((error as FoodProviderError).code).toBe(code);
  });

  it('handles a broken barcode answer', async () => {
    const provider = new OpenFoodFactsProvider(client(ok({ foo: 'bar' })).http, UA);
    await expect(provider.lookupBarcode('4000000000001')).rejects.toMatchObject({
      code: 'invalid-response',
    });
  });

  it('reads products by id like barcodes', async () => {
    const provider = new OpenFoodFactsProvider(
      client(ok({ status: 1, product: NUTELLA })).http,
      UA,
    );
    expect((await provider.getProduct('3017624010701'))?.brand).toBe('Ferrero');
  });
});
