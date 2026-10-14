import { expect, test, type Page } from './fixtures';

/**
 * Open Food Facts and the camera are mocked: no real request leaves the test, and the scanner
 * returns a fixed barcode (the web build reads `window.__kalethraScanBarcode`). The product
 * search answers nothing here (aborted) unless a test mocks it (`mockSearch`).
 */
const SKYR = {
  code: '4001234567890',
  product_name: 'Skyr Natur',
  brands: 'Milbona',
  quantity: '500 g',
  nutriments: {
    'energy-kcal_100g': 63,
    proteins_100g: 11,
    carbohydrates_100g: 4,
    sugars_100g: 4,
  },
};

async function mockOpenFoodFacts(page: Page) {
  const requests: string[] = [];
  await page.route(/openfoodfacts\.org/, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.href);
    if (url.pathname.startsWith('/api/v2/product/4001234567890')) {
      await route.fulfill({ json: { status: 1, product: SKYR } });
    } else if (url.pathname.startsWith('/api/v2/product/')) {
      await route.fulfill({ status: 404, json: { status: 0 } });
    } else {
      await route.abort();
    }
  });
  await page.addInitScript(() => {
    (window as unknown as { __kalethraScanBarcode: () => Promise<unknown> }).__kalethraScanBarcode =
      () => Promise.resolve({ kind: 'scanned', code: '4001234567890' });
  });
  return requests;
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('scan, review, save, log – and find the product again offline', async ({ page, context }) => {
  const requests = await mockOpenFoodFacts(page);
  await page.goto('/nutrition');
  const main = page.locator('main');

  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Barcode scannen' }).click();

  // Review: imported values, missing fat left empty (not 0).
  await expect(page.getByRole('dialog', { name: 'Produkt prüfen' })).toBeVisible();
  await expect(sheet.getByText(/Aus Open Food Facts übernommen/)).toBeVisible();
  await expect(sheet.getByLabel('Name')).toHaveValue('Skyr Natur');
  await expect(sheet.getByLabel('Fett (g)')).toHaveValue('');
  await sheet.getByLabel('Fett (g)').fill('0,2');
  await sheet.getByLabel('Kalorien (kcal)').fill('65');
  await sheet.getByRole('button', { name: 'Speichern' }).click();

  // Amount and meal.
  await sheet.getByLabel('Menge', { exact: true }).fill('150');
  await sheet.getByLabel('Mahlzeit').selectOption({ label: 'Mittagessen' });
  await sheet.getByRole('button', { name: 'Als Favorit markieren' }).click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(main.getByRole('button', { name: 'Mittagessen · 98 kcal' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(requests.every((url) => url.includes('4001234567890'))).toBe(true);

  // Offline: favourites, recently used and the barcode all work from the local database.
  await context.setOffline(true);
  requests.length = 0;
  const barcodeRequests = () => requests.filter((url) => url.includes('/api/v2/product/'));
  await main.getByRole('button', { name: 'Abendessen: hinzufügen' }).click();
  await expect(sheet.getByRole('list', { name: 'Zuletzt verwendet' })).toContainText('Skyr Natur');
  // Each food is listed once: a favourite that was just used stays under "Zuletzt verwendet".
  await expect(sheet.getByRole('list', { name: 'Favoriten' })).toHaveCount(0);
  await sheet.getByLabel('Lebensmittel suchen').fill('skyr');
  await expect(sheet.getByRole('list', { name: 'Suchergebnisse' })).toContainText('Skyr Natur');
  await sheet.getByRole('button', { name: 'Barcode scannen' }).click();
  await expect(sheet.getByLabel('Menge', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Skyr Natur')).toBeVisible();
  expect(barcodeRequests()).toEqual([]);
  await context.setOffline(false);
});

test('local results at once; offline the online search stays a quiet note', async ({ page }) => {
  const requests = await mockOpenFoodFacts(page);
  await page.goto('/nutrition');
  await page.locator('main').getByRole('button', { name: 'Snacks: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Lebensmittel suchen').fill('apfel');
  await sheet.getByLabel('Lebensmittel suchen').press('Enter');
  const results = sheet.getByRole('list', { name: 'Suchergebnisse' });
  // Real BLS 4.0 data, bundled with the app: the raw apple comes first.
  await expect(results.getByRole('button').first()).toContainText('Apfel roh');
  await expect(results.getByRole('button').first()).toContainText('BLS 4.0');
  await expect(sheet.getByText(/Max Rubner-Institut \(2025\)/)).toBeVisible();
  // The online search ran after the pause (Phase 28); unreachable here, it only says so quietly.
  await expect(sheet.getByTestId('online-status')).toContainText(
    'Offline – du siehst die Ergebnisse auf deinem Gerät',
  );
  await expect(sheet.getByRole('alert')).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Using it stores the reference once and logs it like any food.
  await results.getByRole('button').first().click();
  await sheet.getByLabel('Menge', { exact: true }).fill('150');
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('main').getByRole('button', { name: /^Snacks · \d+ kcal$/ }),
  ).toBeVisible();
  // Only the search text went out – one search for "apfel", no barcode, nothing else.
  expect(requests.map((url) => new URL(url).searchParams.get('q'))).toEqual(['apfel']);
});

test('unknown barcode typed by hand leads to creating the food', async ({ page }) => {
  await mockOpenFoodFacts(page);
  await page.goto('/nutrition');
  await page.locator('main').getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Barcode eingeben' }).click();
  await sheet.getByLabel('Barcode (EAN oder UPC)').fill('4009999999999');
  await sheet.getByRole('button', { name: 'Produkt suchen' }).click();
  await expect(sheet.getByText('Produkt nicht gefunden.')).toBeVisible();
  await sheet.getByRole('button', { name: 'Eigenes Lebensmittel anlegen' }).click();
  await expect(sheet.getByLabel('Barcode (optional)')).toHaveValue('4009999999999');
});

/** Phase 27: the search ranks by meaning – real BLS 4.0 data of the production build. */
test('meaningful ranking: eggs for "Ei", plain quark for "Quark", the raw salmon for "Lachs"', async ({
  page,
}) => {
  const requests = await mockOpenFoodFacts(page);
  await page.goto('/nutrition');
  await page.locator('main').getByRole('button', { name: 'Snacks: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  const field = sheet.getByLabel('Lebensmittel suchen');
  const first = sheet.getByRole('list', { name: 'Suchergebnisse' }).getByRole('button').first();
  for (const [query, expected] of [
    ['Ei', 'Hühnerei roh'],
    ['Quark', 'Speisequark'],
    ['Lachs', 'Lachs roh'],
    ['Banane', 'Banane roh'],
  ] as const) {
    await field.fill(query);
    await expect(first).toContainText(expected);
  }
  // A dish that only contains an egg is no clear match for "Ei".
  await field.fill('Ei');
  await expect(sheet.getByRole('heading', { name: 'Passende Lebensmittel' })).toBeVisible();
  await expect(
    sheet.getByRole('list', { name: 'Suchergebnisse' }).getByText('Kalbshirn gebraten mit Ei'),
  ).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
  // Only search requests (aborted here) – the barcode service was never asked.
  expect(requests.every((url) => url.startsWith('https://search.openfoodfacts.org/'))).toBe(true);
});

/** Answers the product search with `hits`; records every Open Food Facts request. */
async function mockSearch(page: Page, hits: unknown[]) {
  const requests: URL[] = [];
  await page.route(/openfoodfacts\.org/, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    if (url.hostname === 'search.openfoodfacts.org') await route.fulfill({ json: { hits } });
    else await route.abort();
  });
  return requests;
}

const MILBONA_GOUDA = {
  code: '4056489000010',
  product_name: 'Gouda jung',
  brands: 'Milbona',
  quantity: '400 g',
  stores: 'Lidl',
  categories_tags: ['en:dairies', 'en:cheeses'],
  completeness: 0.8,
  states_tags: ['en:nutrition-facts-completed'],
  nutriments: {
    'energy-kcal_100g': 356,
    proteins_100g: 24,
    carbohydrates_100g: 0.1,
    fat_100g: 29,
  },
};

/** Phase 28: one ranking for all sources, Open Food Facts asked automatically after a pause. */
test('automatic online search: one request after the pause, the best match first, reviewed before saving', async ({
  page,
}) => {
  const requests = await mockSearch(page, [
    MILBONA_GOUDA,
    // A duplicate record of the same barcode and one without calories: both never shown.
    { ...MILBONA_GOUDA, completeness: 0.2 },
    { ...MILBONA_GOUDA, code: '4056489000099', product_name: 'Gouda Scheiben', nutriments: {} },
  ]);
  await page.goto('/nutrition');
  await page.locator('main').getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  const field = sheet.getByLabel('Lebensmittel suchen');
  await field.pressSequentially('Milbona Käse', { delay: 40 });
  const results = sheet.getByRole('list', { name: 'Suchergebnisse' });
  // The product found online is the best match – it comes first, ahead of every BLS cheese.
  await expect(results.getByRole('button').first()).toContainText('Gouda jung');
  await expect(results.getByRole('button', { name: /Gouda jung/ })).toHaveCount(1);
  await expect(results.getByRole('button', { name: /Gouda Scheiben/ })).toHaveCount(0);
  await expect(field).toBeFocused();
  await expect(field).toHaveValue('Milbona Käse');
  // One request for the whole text, not one per keystroke – and nothing but the text.
  expect(requests).toHaveLength(1);
  expect([...(requests[0]?.searchParams.keys() ?? [])].sort()).toEqual([
    'fields',
    'langs',
    'page_size',
    'q',
  ]);
  expect(requests[0]?.searchParams.get('q')).toBe('Milbona Käse');
  await expect(
    sheet.getByText(/Open Food Facts \(openfoodfacts\.org\), Lizenz ODbL/),
  ).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await results.getByRole('button', { name: /Gouda jung/ }).click();
  await expect(page.getByRole('dialog', { name: 'Produkt prüfen' })).toBeVisible();
  await expect(sheet.getByLabel('Name')).toHaveValue('Gouda jung');
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('online search offline: a quiet note, the local search keeps working', async ({ page }) => {
  await page.route(/openfoodfacts\.org/, (route) => route.abort('internetdisconnected'));
  await page.goto('/nutrition');
  await page.locator('main').getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Lebensmittel suchen').fill('Quark');
  const results = sheet.getByRole('list', { name: 'Suchergebnisse' });
  await expect(results.getByRole('button').first()).toContainText('Speisequark');
  await expect(sheet.getByTestId('online-status')).toContainText('Offline');
  await expect(sheet.getByRole('alert')).toHaveCount(0);
  // The local search still answers new queries, and a food can be logged.
  await sheet.getByLabel('Lebensmittel suchen').fill('Banane');
  await expect(results.getByRole('button').first()).toContainText('Banane roh');
  await results.getByRole('button').first().click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

/** Results arriving later must not break the layout: phone sizes, both themes, large text. */
for (const { name, width, height, largeText } of [
  { name: 'Xiaomi 15 Ultra', width: 412, height: 915, largeText: false },
  { name: 'Xiaomi 15 Ultra, large text', width: 412, height: 915, largeText: true },
  { name: '390 px', width: 390, height: 844, largeText: false },
  { name: '320 px, large text', width: 320, height: 568, largeText: true },
]) {
  test(`online results join the list without layout problems – ${name}`, async ({ page }) => {
    await mockSearch(page, [
      MILBONA_GOUDA,
      {
        ...MILBONA_GOUDA,
        code: '4056489000020',
        product_name: 'Bergkäse würzig, am Stück gereift, besonders lange Bezeichnung',
        brands: 'Milbona',
      },
    ]);
    await page.setViewportSize({ width, height });
    await page.goto('/nutrition');
    if (largeText) await page.addStyleTag({ content: 'html { font-size: 130%; }' });
    await page.locator('main').getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
    const sheet = page.getByRole('dialog');
    const field = sheet.getByLabel('Lebensmittel suchen');
    await field.pressSequentially('Milbona Käse', { delay: 30 });
    const results = sheet.getByRole('list', { name: 'Suchergebnisse' });
    await expect(results.getByRole('button', { name: /Gouda jung/ })).toBeVisible();
    await expect(field).toBeFocused();
    expect(await noHorizontalScroll(page)).toBe(true);
    // Every row stays inside the sheet; the long name wraps or ends with an ellipsis.
    const sheetBox = await sheet.boundingBox();
    for (const row of await results.getByRole('button').all()) {
      const box = await row.boundingBox();
      expect(box && sheetBox && box.x >= sheetBox.x - 1).toBe(true);
      expect(box && sheetBox && box.x + box.width <= sheetBox.x + sheetBox.width + 1).toBe(true);
    }
    // The status line sits below the list and is fully readable.
    const status = sheet.getByTestId('online-status');
    await status.scrollIntoViewIfNeeded();
    await expect(status).toBeVisible();
  });
}
