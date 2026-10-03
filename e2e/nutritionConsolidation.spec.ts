import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 15: food management with barcode under Einstellungen → Meine Inhalte, and the nutrition
 * card on Fortschritt with calories by main goal plus protein, carbohydrates and fat. Open Food
 * Facts and the camera are mocked; no real request leaves the test.
 */
async function mockBarcode(page: Page) {
  const requests: string[] = [];
  await page.route(/openfoodfacts\.org/, async (route) => {
    const url = new URL(route.request().url());
    requests.push(url.pathname);
    if (url.pathname.startsWith('/api/v2/product/4001234567890')) {
      await route.fulfill({
        json: {
          status: 1,
          product: {
            code: '4001234567890',
            product_name: 'Skyr Natur',
            brands: 'Milbona',
            nutriments: {
              'energy-kcal_100g': 63,
              proteins_100g: 11,
              carbohydrates_100g: 4,
              fat_100g: 0.2,
            },
          },
        },
      });
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
const noFocusedField = (page: Page) =>
  page.evaluate(() => !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? ''));

test('Meine Inhalte → Lebensmittel: barcode, review, save, found again; back navigation', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests = await mockBarcode(page);
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');

  await page.goto('/settings');
  await main.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await main.getByRole('link', { name: /^Lebensmittel/ }).click();
  await expect(page).toHaveURL(/\/settings\/content\/foods$/);
  expect(await noFocusedField(page)).toBe(true);
  const scan = main.getByRole('button', { name: 'Barcode scannen' });
  expect((await scan.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);

  // Unknown here → Open Food Facts → review and correct → save.
  await scan.click();
  await expect(page.getByRole('dialog', { name: 'Produkt prüfen' })).toBeVisible();
  await expect(sheet.getByText(/Aus Open Food Facts übernommen/)).toBeVisible();
  await expect(sheet.getByLabel('Name')).toHaveValue('Skyr Natur');
  await sheet.getByLabel('Kalorien (kcal)').fill('65');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(main.getByText('„Skyr Natur“ wurde gespeichert.')).toBeVisible();
  await expect(main.getByRole('button', { name: /Skyr Natur/ })).toBeVisible();
  expect(requests).toEqual(['/api/v2/product/4001234567890']);

  // Scanned again: answered locally, the stored food opens – no second request.
  await scan.click();
  await expect(page.getByRole('dialog', { name: 'Lebensmittel bearbeiten' })).toBeVisible();
  await expect(sheet.getByLabel('Kalorien (kcal)')).toHaveValue('65');
  expect(requests).toHaveLength(1);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // The search also finds the BLS.
  await main.getByLabel('Lebensmittel suchen').fill('apfel');
  await expect(main.getByRole('list', { name: 'Aus dem BLS' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Large system font: still no horizontal scroll.
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  expect(await noHorizontalScroll(page)).toBe(true);

  // Back: Lebensmittel → Meine Inhalte.
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/content$/);
});

test('Fortschritt: calories by main goal, protein, carbohydrates and fat', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');
  const tab = (name: string) =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });

  // Abnehmen with own goals for calories and all macros.
  await page.goto('/settings/goals');
  await main.getByRole('radio', { name: 'Abnehmen' }).click();
  for (const [row, value] of [
    [/^Kalorienziel/, '2200'],
    [/^Protein/, '160'],
    [/^Kohlenhydrate/, '250'],
    [/^Fett/, '80'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    await sheet.getByLabel(/^Eigener Wert/).fill(value);
    await sheet.getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  }
  await main.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();

  // Log 2.100 kcal, 150 g protein, 180 g carbohydrates, 65 g fat.
  await tab('Ernährung').click();
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  await sheet.getByLabel('Lebensmittel suchen').fill('Tagesessen');
  await sheet.getByRole('button', { name: 'Neues Lebensmittel anlegen' }).click();
  await sheet.getByLabel('Kalorien (kcal)').fill('2100');
  await sheet.getByLabel('Protein (g)').fill('150');
  await sheet.getByLabel('Kohlenhydrate (g)').fill('180');
  await sheet.getByLabel('Fett (g)').fill('65');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(sheet).toHaveCount(0);

  await tab('Fortschritt').click();
  await main.getByRole('radio', { name: 'Heute' }).click();
  const nutrition = main.getByRole('link', { name: /^Ernährung/ });
  await expect(nutrition.getByText('2.100 von 2.200 kcal')).toBeVisible();
  await expect(nutrition.getByText('Innerhalb des Kalorienlimits')).toBeVisible();
  await expect(nutrition.getByText('150 von 160 g Protein')).toBeVisible();
  await expect(nutrition.getByText('180 von 250 g Kohlenhydraten')).toBeVisible();
  await expect(nutrition.getByText('72 %')).toBeVisible();
  await expect(nutrition.getByText('65 von 80 g Fett')).toBeVisible();
  await expect(nutrition.getByText('81 %')).toBeVisible();
  // Still four score areas – carbohydrates and fat are no score area.
  const score = main.getByRole('button', { name: /Kalethra-Score/ });
  await expect(score).toHaveAccessibleName(/Ernährung: .*Training: .*Aktivitäten: .*Regeneration:/);
  await expect(score).not.toHaveAccessibleName(/Kohlenhydrate|Fett/);
  expect(await noHorizontalScroll(page)).toBe(true);

  // The card opens the diary; back returns to Fortschritt.
  await nutrition.click();
  await expect(page).toHaveURL(/\/nutrition$/);
  await page.goBack();
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
});
