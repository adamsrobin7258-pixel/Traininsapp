import { test as base } from '@playwright/test';

export { expect, type Page } from '@playwright/test';

/**
 * Every end-to-end test starts without Open Food Facts: the food search asks it automatically
 * after a pause in typing (Phase 28), and a test must never reach the real service – that
 * would be slow, change the results and burden a free service. A test that needs answers
 * registers its own route; Playwright tries the newest route first.
 */
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.route(/openfoodfacts\.org/, (route) => route.abort('internetdisconnected'));
    await provide(page);
  },
});
