import { expect, test, type Page } from '@playwright/test';

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/**
 * No word inside the main content is split over two lines (e.g. "Trainingsplä-ne"): a word
 * that is broken renders as more than one line box.
 */
const noBrokenWords = (page: Page) =>
  page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return false;
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const broken: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? '';
      for (const match of text.matchAll(/\S+/g)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        if (lines.size > 1) broken.push(match[0]);
      }
    }
    return broken.length === 0 || broken;
  });

test('Meine Inhalte: overview, content pages, old addresses and back', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });

  // Overview: nutrition and training content, clearly separated, large touch targets.
  await page.goto('/settings');
  await main.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Meine Inhalte' })).toBeVisible();
  const nutrition = main.getByRole('list', { name: 'Ernährung' });
  const training = main.getByRole('list', { name: 'Training' });
  await expect(nutrition.getByRole('link')).toHaveCount(4);
  await expect(training.getByRole('link')).toHaveCount(2);
  await expect(nutrition.getByRole('link', { name: /^Mahlzeiten des Tages/ })).toBeVisible();
  for (const link of await main.getByRole('listitem').getByRole('link').all()) {
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await expect(nutrition.getByRole('link', { name: /^Rezepte/ })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await noBrokenWords(page)).toBe(true);

  // A plan: created in the plan list, edited on its page – without a start button.
  await training.getByRole('link', { name: /^Trainingspläne/ }).click();
  await expect(page).toHaveURL(/\/settings\/content\/plans$/);
  await main.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill('Oberkörper Push');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Oberkörper Push' })).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/content\/plans\/[^/]+$/);
  const planUrl = page.url();
  const planId = planUrl.split('/').pop() ?? '';
  await main.getByRole('button', { name: 'Trainingstag hinzufügen' }).click();
  await page.getByLabel('Name des Trainingstags').fill('Brust und Schultern');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(main.getByRole('heading', { level: 2, name: 'Brust und Schultern' })).toBeVisible();
  await expect(main.getByRole('button', { name: 'Starten' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Einstellungen' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await noBrokenWords(page)).toBe(true);
  for (const button of await main.getByRole('button').all()) {
    const box = await button.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(40);
  }

  // Browser history: plan → plans → Meine Inhalte → Einstellungen.
  await main.getByRole('link', { name: 'Trainingspläne' }).click();
  await expect(page).toHaveURL(/\/settings\/content\/plans$/);
  await main.getByRole('link', { name: 'Meine Inhalte' }).click();
  await expect(page).toHaveURL(/\/settings\/content$/);
  await main.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/content$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/content\/plans$/);
  await page.goBack();
  await expect(page).toHaveURL(planUrl);

  // Old addresses redirect without leaving an entry behind; the plan id is kept.
  for (const [from, to] of [
    ['/nutrition/foods', /\/settings\/content\/foods$/],
    ['/nutrition/meals', /\/settings\/content\/meals$/],
    ['/nutrition/templates', /\/settings\/content\/templates$/],
    ['/training/plans', /\/settings\/content\/plans$/],
    ['/training/exercises', /\/settings\/content\/exercises$/],
  ] as const) {
    await page.goto(from);
    await expect(page).toHaveURL(to);
    expect(await noHorizontalScroll(page)).toBe(true);
  }
  await page.goto(`/training/plans/${planId}`);
  await expect(page).toHaveURL(new RegExp(`/settings/content/plans/${planId}$`));
  await expect(main.getByRole('heading', { level: 1, name: 'Oberkörper Push' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/content\/exercises$/);

  // Training only tracks: no plan or exercise management, the plan day starts from here.
  await nav.getByRole('link', { name: 'Training' }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Training' })).toBeVisible();
  await expect(main.getByRole('link', { name: /Pläne|Übungen/ })).toHaveCount(0);
  await main.getByRole('button', { name: 'Anderes Training' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Aus Plan starten/ })
    .click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: /^Brust und Schultern/ }),
  ).toBeVisible();

  // Ernährung only tracks as well: no "Verwalten" section any more.
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await nav.getByRole('link', { name: 'Ernährung' }).click();
  await expect(main.getByRole('button', { name: 'Frühstück: hinzufügen' })).toBeVisible();
  await expect(main.getByRole('heading', { name: 'Verwalten' })).toHaveCount(0);
  await expect(main.getByRole('link', { name: /verwalten/ })).toHaveCount(0);
});
