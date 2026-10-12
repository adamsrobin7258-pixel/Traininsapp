import { expect, test } from '@playwright/test';

/**
 * Gesundheit → Gewicht in one card (Phase 24): value, chart, "Gewicht eintragen" and the entries
 * in a sheet to correct them – no separate "Verlauf" or "Entwicklung" sections.
 */
test('weight: record, see the chart, correct an entry – all in one card', async ({ page }) => {
  await page.goto('/health');
  const main = page.locator('main');
  const weight = main.getByRole('region', { name: 'Gewicht' });
  const sheet = page.getByRole('dialog');
  await expect(weight.getByText('Noch kein Gewicht eingetragen.')).toBeVisible();
  await expect(weight.getByRole('button', { name: 'Einträge bearbeiten' })).toHaveCount(0);

  // Today's weight.
  await weight.getByRole('button', { name: 'Gewicht eintragen' }).click();
  await sheet.getByLabel('Gewicht in kg').fill('82,4');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(weight.getByText('82,4 kg')).toBeVisible();

  // An earlier day (the existing link to a day's entry): then the chart has two points.
  const yesterday = await page.evaluate(() => {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return `${String(day.getFullYear())}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  });
  await page.goto(`/health?add=${yesterday}`);
  await sheet.getByLabel('Gewicht in kg').fill('83');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(weight.getByRole('img', { name: /^Gewichtsverlauf vom / })).toBeVisible();

  // Only one weight section; no repeated course below the chart.
  await expect(main.getByRole('heading', { level: 2 })).toHaveText(['Gewicht', 'Regeneration']);
  await expect(main.getByText('83,0 kg')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  // Correct yesterday's value from the entry list; back in the list afterwards.
  await weight.getByRole('button', { name: 'Einträge bearbeiten' }).click();
  const entries = page.getByRole('dialog', { name: 'Gewichtseinträge' });
  await entries.getByRole('button', { name: /83,0 kg/ }).click();
  await sheet.getByLabel('Gewicht in kg').fill('83,4');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(entries.getByRole('button', { name: /83,4 kg/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  await expect(weight.getByText('82,4 kg')).toBeVisible();
});
