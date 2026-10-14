import { expect, test } from './fixtures';

/**
 * Phase 25 – natural premium design: scenes and depth stay local and never cost layout. Every
 * page loads only from the app itself (no remote images, fonts or CDNs), nothing scrolls sideways,
 * and the five tabs stay on screen with a large system font.
 */
const PAGES = ['/', '/training', '/nutrition', '/health', '/settings', '/settings/app'];

test('pages with scenes load nothing from the network and do not scroll sideways', async ({
  page,
  baseURL,
}) => {
  const foreign: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!url.startsWith(baseURL ?? '') && !url.startsWith('data:') && !url.startsWith('blob:')) {
      foreign.push(url);
    }
  });
  for (const path of PAGES) {
    await page.goto(path);
    await expect(page.locator('main h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      path,
    ).toBe(true);
  }
  // Training and Ernährung carry their scene, Gesundheit none (data first).
  await page.goto('/training');
  await expect(page.locator('main[data-hero="dark"] svg[data-scene="mountains"]')).toBeAttached();
  await page.goto('/nutrition');
  await expect(page.locator('main[data-hero="light"] svg[data-scene="harvest"]')).toBeAttached();
  await page.goto('/health');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.locator('[data-scene]')).toHaveCount(0);
  expect(foreign).toEqual([]);
});

test('the primary action on the training scene stays visible and reachable', async ({ page }) => {
  await page.goto('/training');
  const start = page.getByRole('button', { name: 'Training starten' });
  await expect(start).toBeVisible();
  await expect(start).toBeInViewport({ ratio: 1 });
  // The scene never takes the tap: the topmost element at the button's centre is the button.
  const onTop = await start.evaluate((button) => {
    const box = button.getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return hit !== null && button.contains(hit);
  });
  expect(onTop).toBe(true);
});

test('all five tabs stay on screen with a large system font', async ({ page }) => {
  await page.goto('/');
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  const links = nav.getByRole('link');
  await expect(links).toHaveCount(5);
  const width = page.viewportSize()?.width ?? 0;
  for (const link of await links.all()) {
    const box = await link.boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width + 0.5);
  }
  await expect(nav.getByRole('link', { name: 'Fortschritt' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
