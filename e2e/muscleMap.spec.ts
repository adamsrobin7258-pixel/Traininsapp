import { expect, test, type Page } from '@playwright/test';

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const sheet = (page: Page) => page.getByRole('dialog');

async function openExercise(page: Page, search: string, row: RegExp) {
  await page.goto('/settings/content/exercises');
  await page.getByRole('searchbox').fill(search);
  await page.getByRole('button', { name: row }).first().click();
}

/** Region ids marked with a level in a map, e.g. { "pectoralis-major": "primary" }. */
const levels = (page: Page, testId = 'muscle-map') =>
  page.getByTestId(testId).evaluate((map) => {
    const result: Record<string, string> = {};
    for (const path of map.querySelectorAll<SVGElement>('[data-region][data-level]')) {
      result[path.dataset.region ?? ''] = path.dataset.level ?? '';
    }
    return result;
  });

test('muscle map: small in the details, large with the profile body and back again', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openExercise(page, 'langhantel-bankdrücken', /^Langhantel-Bankdrücken/);

  const section = sheet(page).getByRole('region', { name: 'Beanspruchte Muskeln' });
  const open = section.getByRole('button', { name: 'Muskelkarte vergrößern' });
  await expect(open).toBeVisible();
  await expect(sheet(page).getByText('Trizeps, Schultern')).toBeVisible();
  // Two drawings, rendered (not empty), the worked muscles in coral.
  await expect(section.locator('svg')).toHaveCount(2);
  const box = await section.locator('svg').first().boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(150);
  expect(await levels(page)).toMatchObject({
    'pectoralis-major': 'primary',
    'triceps-brachii': 'secondary',
  });
  const coral = await section
    .locator('[data-region="pectoralis-major"]')
    .first()
    .evaluate((path) => getComputedStyle(path).fill);
  const neutral = await section
    .locator('[data-region="rectus-abdominis"]')
    .first()
    .evaluate((path) => getComputedStyle(path).fill);
  expect(coral).not.toBe(neutral);
  expect(await noHorizontalScroll(page)).toBe(true);

  await open.click();
  const large = page.getByRole('dialog', { name: 'Langhantel-Bankdrücken' });
  await expect(large.getByRole('img')).toHaveAccessibleName(/Primär: Brust/);
  // The body comes from the profile (none set: the male fallback) – no switch (Phase 23).
  await expect(large.getByTestId('muscle-map')).toHaveAttribute('data-variant', 'male');
  await expect(large.getByRole('radio')).toHaveCount(0);
  expect(await levels(page)).toMatchObject({ 'pectoralis-major': 'primary' });
  expect(await noHorizontalScroll(page)).toBe(true);

  await page.keyboard.press('Escape');
  await expect(sheet(page).getByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeVisible();
  // No WebGL any more in the training views.
  await expect(page.locator('canvas')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('muscle map: every exercise has one, also without the former 3D visual', async ({ page }) => {
  await openExercise(page, 'liegestütze', /^Liegestütze/);
  await expect(sheet(page).getByText('Hauptmuskeln')).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: 'Muskelkarte vergrößern' })).toBeVisible();
  expect(await levels(page)).toMatchObject({ 'pectoralis-major': 'primary' });
});

test('workout summary: muscles worked open large and return to the summary', async ({ page }) => {
  await page.goto('/training');
  await page.getByRole('button', { name: 'Training starten' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Freies Training/ })
    .click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await sheet(page).getByRole('searchbox').fill('latzug');
  await sheet(page)
    .getByRole('button', { name: /^Latzug/ })
    .first()
    .click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByLabel('Satz 1: Gewicht').fill('50');
  await page.getByLabel('Satz 1: Wdh.').fill('10');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await sheet(page).getByRole('button', { name: 'Training beenden' }).click();

  const summary = page.getByRole('dialog', { name: 'Training abgeschlossen' });
  const muscles = summary.getByRole('region', { name: 'Beanspruchte Muskeln' });
  await expect(muscles).toContainText('Latissimus');
  expect(await levels(page)).toEqual({
    'latissimus-dorsi': 'primary',
    'biceps-brachii': 'secondary',
    trapezius: 'secondary',
    'erector-spinae': 'secondary',
  });
  await muscles.getByRole('button', { name: 'Muskelkarte vergrößern' }).click();
  const large = page.getByRole('dialog', { name: 'Beanspruchte Muskeln' });
  await expect(large.getByRole('img')).toHaveAccessibleName(/Primär: Latissimus/);
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(summary).toBeVisible();
  await expect(summary.getByRole('region', { name: 'Beanspruchte Muskeln' })).toBeVisible();
});

test('muscle map follows the profile: "Weiblich" shows the female body everywhere', async ({
  page,
}) => {
  await page.goto('/settings/profile');
  const main = page.locator('main');
  await main.getByRole('radio', { name: 'Weiblich' }).click();
  await main.getByRole('button', { name: 'Persönliche Daten speichern' }).click();
  await expect(main.getByText(/Gespeichert/)).toBeVisible();

  await openExercise(page, 'langhantel-bankdrücken', /^Langhantel-Bankdrücken/);
  const section = sheet(page).getByRole('region', { name: 'Beanspruchte Muskeln' });
  await expect(section.getByTestId('muscle-map')).toHaveAttribute('data-variant', 'female');
  await section.getByRole('button', { name: 'Muskelkarte vergrößern' }).click();
  const large = page.getByRole('dialog', { name: 'Langhantel-Bankdrücken' });
  await expect(large.getByTestId('muscle-map')).toHaveAttribute('data-variant', 'female');
  await expect(large.getByRole('radio')).toHaveCount(0);
  expect(await levels(page)).toMatchObject({ 'pectoralis-major': 'primary' });
  expect(await noHorizontalScroll(page)).toBe(true);
});
