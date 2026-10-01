import { expect, test } from '@playwright/test';

test('Today is a read-only overview that opens the areas', async ({ page }) => {
  await page.goto('/');
  const main = page.locator('main');
  await expect(main.getByRole('link', { name: /^Training/ })).toBeVisible();
  await expect(main.locator('input, textarea, select')).toHaveCount(0);
  await expect(main.getByRole('button')).toHaveCount(0);
  await expect(main.getByText('Noch nichts eingetragen')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  // Weight entered under Health shows up on Today.
  await main.getByRole('link', { name: /^Gesundheit/ }).click();
  await expect(page).toHaveURL(/\/health$/);
  await page.getByRole('button', { name: 'Gewicht eintragen' }).click();
  await page.getByLabel('Gewicht in kg').fill('91,8');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Heute' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page
      .locator('main')
      .getByRole('link', { name: /^Gesundheit/ })
      .getByText('91,8 kg'),
  ).toBeVisible();

  await page
    .locator('main')
    .getByRole('link', { name: /^Ernährung/ })
    .click();
  await expect(page).toHaveURL(/\/nutrition$/);
});
