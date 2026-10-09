import { expect, test, type Page } from '@playwright/test';

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const sheet = (page: Page) => page.getByRole('dialog');

async function openBenchPress(page: Page) {
  await page.goto('/settings/content/exercises');
  await page.getByRole('searchbox').fill('langhantel-bankdrücken');
  await page.getByRole('button', { name: /^Langhantel-Bankdrücken/ }).click();
}

test('3D figure: small in the details, large with motion, turning and back again', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openBenchPress(page);

  // Small and still beside the facts; the facts stay complete.
  const open = sheet(page).getByRole('button', { name: '3D-Ansicht öffnen' });
  await expect(open).toBeVisible();
  await expect(page.locator('canvas[data-ready="true"]')).toHaveCount(1);
  await expect(sheet(page).getByText('Trizeps, Schultern')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Large view replaces the details: one figure, described in words.
  await open.click();
  const large = page.getByRole('dialog', { name: 'Langhantel-Bankdrücken' });
  await expect(large.getByRole('img')).toHaveAccessibleName(/Primär: Brust/);
  await expect(page.locator('canvas[data-ready="true"]')).toHaveCount(1);
  await large.getByRole('button', { name: 'Animation anhalten' }).click();
  await expect(large.getByRole('button', { name: 'Animation abspielen' })).toBeVisible();
  await large.getByRole('button', { name: 'Rückseite zeigen' }).click();
  await expect(large.getByRole('button', { name: 'Vorderseite zeigen' })).toBeVisible();
  const canvas = page.locator('canvas[data-ready="true"]');
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 });
    await page.mouse.up();
  }
  expect(await noHorizontalScroll(page)).toBe(true);

  // Closing returns to the details; the WebGL view is gone.
  await page.keyboard.press('Escape');
  await expect(sheet(page).getByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeVisible();
  await expect(page.locator('canvas[data-ready="true"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('3D figure: with reduced motion the loop does not start on its own', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openBenchPress(page);
  await sheet(page).getByRole('button', { name: '3D-Ansicht öffnen' }).click();
  const large = page.getByRole('dialog', { name: 'Langhantel-Bankdrücken' });
  await expect(large.getByRole('button', { name: 'Animation abspielen' })).toBeVisible();
});

test('exercises without a 3D visual keep their details unchanged', async ({ page }) => {
  await page.goto('/settings/content/exercises');
  await page.getByRole('searchbox').fill('liegestütze');
  await page
    .getByRole('button', { name: /^Liegestütze/ })
    .first()
    .click();
  await expect(sheet(page).getByText('Hauptmuskeln')).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: '3D-Ansicht öffnen' })).toHaveCount(0);
  await expect(page.locator('canvas')).toHaveCount(0);
});

test('3D figure: animation and turning together, front/back, theme – no errors', async ({
  page,
}) => {
  // Every drag step and click waits for a frame, and CI renders WebGL in software (SwiftShader,
  // ~0.3 s per frame of the large view): already 22–28 s of the default 30 s before 0.29.0.
  test.slow();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openBenchPress(page);
  // The modelled Kalethra body (bundled GLB) is shown, not the technical fallback; without a
  // stated sex the fixed default variant.
  const ready = page.locator('canvas[data-ready="true"]');
  await expect(ready).toHaveAttribute('data-figure-source', 'asset');
  await expect(ready).toHaveAttribute('data-figure-variant', 'male');
  await sheet(page).getByRole('button', { name: '3D-Ansicht öffnen' }).click();
  const large = page.getByRole('dialog', { name: 'Langhantel-Bankdrücken' });
  const canvas = page.locator('canvas[data-ready="true"]');
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  // Turn while the motion plays, then switch sides several times.
  if (box) {
    for (const dx of [140, -260, 90]) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2, { steps: 8 });
      await page.mouse.up();
    }
  }
  for (const label of ['Rückseite zeigen', 'Vorderseite zeigen', 'Rückseite zeigen']) {
    await large.getByRole('button', { name: label }).click();
  }
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.emulateMedia({ colorScheme: 'light' });
  await page.keyboard.press('Escape');
  await expect(sheet(page).getByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeVisible();
  expect(errors).toEqual([]);
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
  await muscles.getByRole('button', { name: '3D-Ansicht öffnen' }).click();
  const large = page.getByRole('dialog', { name: 'Beanspruchte Muskeln' });
  await expect(large.getByRole('img')).toHaveAccessibleName(/Primär: Latissimus/);
  await large.getByRole('button', { name: 'Rückseite zeigen' }).click();
  await page.keyboard.press('Escape');
  await expect(summary).toBeVisible();
  await expect(summary.getByRole('region', { name: 'Beanspruchte Muskeln' })).toBeVisible();
});
