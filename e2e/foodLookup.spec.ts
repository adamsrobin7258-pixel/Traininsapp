import { expect, test, type Page } from '@playwright/test';

/**
 * Open Food Facts (barcode fallback only) and the camera are mocked: no real request leaves the test, and the scanner
 * returns a fixed barcode (the web build reads `window.__kalethraScanBarcode`).
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
  await expect(main.getByRole('heading', { name: 'Mittagessen · 98 kcal' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(requests.every((url) => url.includes('4001234567890'))).toBe(true);

  // Offline: favourites, recently used and the barcode all work from the local database.
  await context.setOffline(true);
  requests.length = 0;
  await main.getByRole('button', { name: 'Abendessen: hinzufügen' }).click();
  await expect(sheet.getByRole('list', { name: 'Zuletzt verwendet' })).toContainText('Skyr Natur');
  await expect(sheet.getByRole('list', { name: 'Favoriten' })).toContainText('Skyr Natur');
  await sheet.getByLabel('Lebensmittel suchen').fill('skyr');
  await expect(sheet.getByRole('list', { name: 'Suchergebnisse' })).toContainText('Skyr Natur');
  await sheet.getByRole('button', { name: 'Barcode scannen' }).click();
  await expect(sheet.getByLabel('Menge', { exact: true })).toBeVisible();
  await expect(sheet.getByText('Skyr Natur')).toBeVisible();
  expect(requests).toEqual([]);
  await context.setOffline(false);
});

test('the food search is offline and never asks Open Food Facts', async ({ page }) => {
  const requests = await mockOpenFoodFacts(page);
  await page.goto('/nutrition');
  await page.locator('main').getByRole('button', { name: 'Snacks: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Lebensmittel suchen').fill('apfel');
  await sheet.getByLabel('Lebensmittel suchen').press('Enter');
  const results = sheet.getByRole('list', { name: 'Suchergebnisse' });
  // Real BLS 4.0 data, bundled with the app: the raw apple comes first.
  await expect(results.getByRole('button').nth(1)).toContainText('Apfel roh');
  await expect(results.getByRole('button').nth(1)).toContainText('BLS 4.0');
  await expect(sheet.getByText(/Max Rubner-Institut \(2025\)/)).toBeVisible();
  await expect(sheet.getByText(/Online suchen/)).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Using it stores the reference once and logs it like any food.
  await results.getByRole('button').nth(1).click();
  await sheet.getByLabel('Menge', { exact: true }).fill('150');
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(
    page.locator('main').getByRole('heading', { name: /^Snacks · \d+ kcal$/ }),
  ).toBeVisible();
  expect(requests).toEqual([]);
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
