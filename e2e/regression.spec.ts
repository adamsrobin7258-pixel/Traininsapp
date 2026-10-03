import { expect, test, type Page } from '@playwright/test';

/**
 * Regression sweep (phase 12) over every main page and Einstellungen page, in each project
 * (390 px light/dark, 320 px): no horizontal scroll – also with a large system font (text
 * sizes are rem-based, so a larger root size stands in for Android's font scale) – no text
 * field focused on its own (no keyboard opens), and list rows large enough to tap.
 */
const PAGES = [
  '/',
  '/training',
  '/training/activities',
  '/nutrition',
  '/health',
  '/settings',
  '/settings/profile',
  '/settings/goals',
  '/settings/app',
  '/settings/content',
  '/settings/content/foods',
  '/settings/content/meals',
  '/settings/content/templates',
  '/settings/content/recipes',
  '/settings/content/plans',
  '/settings/content/exercises',
];

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const focusedField = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
      ? (active.getAttribute('aria-label') ?? active.name)
      : null;
  });

test('every page: no horizontal scroll (also with large text), no keyboard, tappable rows', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  for (const largeText of [false, true]) {
    for (const path of PAGES) {
      await page.goto(path);
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible();
      if (largeText) await page.addStyleTag({ content: 'html { font-size: 130%; }' });
      expect(await noHorizontalScroll(page), `${path} ${largeText ? '(large text)' : ''}`).toBe(
        true,
      );
      expect(await focusedField(page), path).toBeNull();
      if (!largeText) {
        for (const row of await main.getByRole('listitem').getByRole('link').all()) {
          const box = await row.boundingBox();
          if (box) expect(box.height, `${path} row`).toBeGreaterThanOrEqual(44);
        }
      }
    }
  }
});

test('Ziele: every target is chosen from a list – the keyboard never opens', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  await page.goto('/settings/goals');
  for (const row of [/Trainings pro Woche/, /Aktive Minuten pro Woche/, /Schrittziel pro Tag/]) {
    await main.getByRole('button', { name: row }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    expect(await focusedField(page)).toBeNull();
    for (const option of await sheet.getByRole('button').all()) {
      const box = await option.boundingBox();
      if (box) expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
  }
  // The switch is a large touch target and keeps its state after a reload (versioned target).
  const counting = main.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' });
  const box = await counting.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(24);
  const row = main
    .getByRole('listitem')
    .filter({ has: page.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' }) });
  expect((await row.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await counting.click();
  await expect(counting).toHaveAttribute('aria-checked', 'true');
  await page.reload();
  await expect(main.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await main.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' }).click();
  await expect(main.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(await noHorizontalScroll(page)).toBe(true);
});
