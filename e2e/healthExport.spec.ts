import { expect, test, type Page } from './fixtures';

/**
 * Settings → App → Health Connect: the optional export of Kalethra's own workouts. Health
 * Connect exists only on Android; the web build writes to a fake store from
 * `window.__kalethraHealthExport` (src/core/platform/health/export.ts), defined here before the
 * app starts. The real system dialog is covered by the device checklist.
 */
async function installFakeExport(page: Page, { grant = true } = {}) {
  await page.addInitScript((grantOnRequest) => {
    // Like the real store, permission and sessions outlive a reload of the app.
    const load = () =>
      JSON.parse(localStorage.getItem('fakeHealthExport') ?? '{"granted":false,"sessions":{}}') as {
        granted: boolean;
        sessions: Record<string, unknown>;
      };
    const save = (state: ReturnType<typeof load>) => {
      localStorage.setItem('fakeHealthExport', JSON.stringify(state));
    };
    const store = {
      count: () => Object.keys(load().sessions).length,
      availability: () => Promise.resolve({ kind: 'available', platform: 'healthConnect' }),
      checkWriteAccess: () => Promise.resolve(load().granted),
      requestWriteAccess: () => {
        save({ ...load(), granted: grantOnRequest });
        return Promise.resolve(grantOnRequest);
      },
      writeExerciseSession: (session: { clientRecordId: string }) => {
        const state = load();
        if (!state.granted) {
          return Promise.reject(Object.assign(new Error('x'), { code: 'permission' }));
        }
        state.sessions[session.clientRecordId] = session;
        save(state);
        return Promise.resolve();
      },
    };
    (window as unknown as { __kalethraHealthExport: unknown }).__kalethraHealthExport = store;
  }, grant);
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

const sessionCount = (page: Page) =>
  page.evaluate(() =>
    (
      window as unknown as { __kalethraHealthExport: { count: () => number } }
    ).__kalethraHealthExport.count(),
  );

test('without Health Connect the export setting is not shown', async ({ page }) => {
  await page.goto('/settings/app');
  await expect(page.getByRole('region', { name: 'Gesundheitsdaten' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Health Connect' })).toHaveCount(0);
});

test('off by default; on after the permission; a finished workout is written once', async ({
  page,
}) => {
  await installFakeExport(page);
  await page.goto('/settings/app');
  const section = page.getByRole('region', { name: 'Health Connect' });
  const toggle = section.getByRole('switch', { name: 'Mit Health Connect synchronisieren' });
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(section.getByText('Verbunden')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // A workout: start, finish – it reaches the store once, the app carries on as usual.
  await page.goto('/training');
  await page.getByRole('button', { name: 'Training starten' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Freies Training/ })
    .click();
  await expect(page.getByText('Laufendes Training')).toBeVisible();
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Training beenden' }).click();
  await expect(page).toHaveURL(/\/training\/workouts\//);
  await expect.poll(() => sessionCount(page)).toBe(1);

  // Reload (restart): the setting stays on, nothing is written twice.
  await page.goto('/settings/app');
  await expect(
    page.getByRole('region', { name: 'Health Connect' }).getByRole('switch'),
  ).toHaveAttribute('aria-checked', 'true');
  expect(await sessionCount(page)).toBe(1);
});

test('a refused permission keeps it off with a calm note', async ({ page }) => {
  await installFakeExport(page, { grant: false });
  await page.goto('/settings/app');
  const section = page.getByRole('region', { name: 'Health Connect' });
  await section.getByRole('switch').click();
  await expect(
    section.getByText(/Ohne Berechtigung kann Kalethra nichts übertragen/),
  ).toBeVisible();
  await expect(section.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const { name, width, height, largeText } of [
  { name: 'Xiaomi 15 Ultra', width: 412, height: 915, largeText: false },
  { name: '320 px, large text', width: 320, height: 568, largeText: true },
]) {
  test(`the setting fits – ${name}`, async ({ page }) => {
    await installFakeExport(page);
    await page.setViewportSize({ width, height });
    await page.goto('/settings/app');
    if (largeText) await page.addStyleTag({ content: 'html { font-size: 130%; }' });
    const section = page.getByRole('region', { name: 'Health Connect' });
    await section.getByRole('switch').click();
    await expect(section.getByText('Verbunden')).toBeVisible();
    await section
      .getByRole('button', { name: 'Health-Connect-Berechtigungen verwalten' })
      .scrollIntoViewIfNeeded();
    await expect(
      section.getByRole('button', { name: 'Health-Connect-Berechtigungen verwalten' }),
    ).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
  });
}
