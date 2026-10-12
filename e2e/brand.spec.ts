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

/** Header metrics of a sub page: back row, title row, mark. */
const subHeader = (page: Page) =>
  page.evaluate(() => {
    const header = document.querySelector('main > header');
    const back = header?.querySelector('a');
    const row = back?.parentElement;
    const mark = header?.querySelector<SVGElement>('[data-brand="symbol"]');
    const box = (element: Element | null | undefined) => element?.getBoundingClientRect();
    return {
      marks: header?.querySelectorAll('[data-brand]').length ?? 0,
      inBackRow: Boolean(mark && row?.contains(mark)),
      markVisible: Boolean(mark && mark.getBoundingClientRect().width > 0),
      markRight: box(mark)?.right ?? 0,
      headerRight: box(header)?.right ?? 0,
      backRight: box(back)?.right ?? 0,
      markLeft: box(mark)?.left ?? 0,
      row: box(row)?.height ?? 0,
      back: box(back)?.height ?? 0,
      contentTop: box(document.querySelector('main > div'))?.top ?? 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

for (const path of ['/settings/profile', '/settings/goals', '/training/activities']) {
  test(`brand mark on the sub page ${path}: top right, the header keeps its layout`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    const withMark = await subHeader(page);
    expect(withMark.marks).toBe(1);
    expect(withMark.inBackRow).toBe(true);
    expect(withMark.markVisible).toBe(true);
    // Right edge of the header, clear of the back link.
    expect(withMark.markRight).toBeCloseTo(withMark.headerRight, 0);
    expect(withMark.markLeft).toBeGreaterThan(withMark.backRight);
    // The row is as high as the back link's tap target.
    expect(withMark.row).toBeCloseTo(withMark.back, 0);
    expect(withMark.overflow).toBe(false);
    await page.addStyleTag({
      content: 'main [data-brand="symbol"] { display: none !important; }',
    });
    const without = await subHeader(page);
    expect(without.contentTop).toBeCloseTo(withMark.contentTop, 0);
  });
}

test('active workout: the controls keep their place; the mark only where there is room', async ({
  page,
}) => {
  await page.goto('/training');
  await page.getByRole('button', { name: 'Training starten' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Freies Training/ })
    .click();
  const finish = page.getByRole('button', { name: 'Training beenden' });
  await expect(finish).toBeVisible();
  const header = await subHeader(page);
  expect(header.inBackRow).toBe(true);
  expect(header.overflow).toBe(false);
  const controls = async () => {
    const title = await page.locator('main h1').boundingBox();
    const end = await finish.boundingBox();
    const more = await page.getByRole('button', { name: 'Mehr' }).boundingBox();
    return { title, end, more };
  };
  const before = await controls();
  // Controls stay inside the screen, below the mark's row.
  const width = page.viewportSize()?.width ?? 0;
  const markBottom = await page
    .locator('main > header [data-brand="symbol"]')
    .evaluate((mark) => mark.getBoundingClientRect().bottom);
  for (const box of [before.end, before.more]) {
    expect(box?.height ?? 0).toBeGreaterThan(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    expect(box?.y ?? 0).toBeGreaterThanOrEqual(markBottom);
  }
  // Without the mark nothing moves: it never pushes the controls.
  await page.addStyleTag({ content: 'main [data-brand="symbol"] { display: none !important; }' });
  expect(await controls()).toEqual(before);
  await finish.click();
  await expect(page.getByRole('dialog', { name: 'Training beenden?' })).toBeVisible();
});

test('sub page with a very large system font: the mark gives way, the back link stays', async ({
  page,
}) => {
  await page.goto('/settings/profile');
  await expect(page.locator('main h1')).toBeVisible();
  await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
  const large = await subHeader(page);
  expect(large.markVisible).toBe(false);
  expect(large.overflow).toBe(false);
  await expect(page.locator('main').getByRole('link', { name: 'Einstellungen' })).toBeVisible();
});
