import { expect, test, type Page } from '@playwright/test';

/** Height of the title row and of the title itself on the main page. */
const header = (page: Page) =>
  page.evaluate(() => {
    const title = document.querySelector('main h1');
    const row = title?.parentElement;
    const mark = row?.querySelector<SVGElement>('[data-brand="symbol"]');
    const box = (element: Element | null | undefined) => element?.getBoundingClientRect();
    return {
      title: box(title)?.height ?? 0,
      row: box(row)?.height ?? 0,
      markHeight: box(mark)?.height ?? 0,
      markVisible: Boolean(mark && mark.getBoundingClientRect().width > 0),
      titleTop: box(title)?.top ?? 0,
      markTop: box(mark)?.top ?? 0,
      contentTop: box(document.querySelector('main > div'))?.top ?? 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

test('brand mark on the main page: one title line high, the header keeps its layout', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  const withMark = await header(page);
  expect(withMark.markVisible).toBe(true);
  // Not taller than the title line, within the row, the row as high as the title.
  expect(withMark.markHeight).toBeLessThanOrEqual(withMark.title + 0.5);
  expect(withMark.row).toBeCloseTo(withMark.title, 0);
  expect(withMark.markTop).toBeGreaterThanOrEqual(withMark.titleTop - 0.5);
  expect(withMark.overflow).toBe(false);

  // Same layout as without the mark: content starts at the same place.
  await page.addStyleTag({ content: 'main [data-brand="symbol"] { display: none !important; }' });
  const without = await header(page);
  expect(without.contentTop).toBeCloseTo(withMark.contentTop, 0);
  expect(without.row).toBeCloseTo(withMark.row, 0);

  // No request for brand images: the mark is inline.
  expect(requests.filter((url) => /brand|logo|symbol/i.test(url))).toEqual([]);
});

test('brand mark is hidden, not squeezed, with a very large system font', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const large = await header(page);
  expect(large.markVisible).toBe(false);
  // The title keeps one row of its own; nothing wraps below it.
  expect(large.row).toBeCloseTo(large.title, 0);
});

test('logo with symbol and wordmark under "Über Kalethra"', async ({ page }) => {
  await page.goto('/settings/app');
  const logo = page.getByRole('img', { name: 'Kalethra' });
  await logo.scrollIntoViewIfNeeded();
  await expect(logo).toBeVisible();
  await expect(logo.locator('[data-brand="symbol"]')).toBeVisible();
  await expect(logo.locator('[data-brand="wordmark"]')).toBeVisible();
  const favicon = await page.locator('link[rel="icon"]').getAttribute('href');
  expect(favicon).toBe('/favicon.svg');
  const response = await page.request.get('/favicon.svg');
  expect(response.ok()).toBe(true);
  expect(await response.text()).toContain('<path fill="#f3efe6"');
});
