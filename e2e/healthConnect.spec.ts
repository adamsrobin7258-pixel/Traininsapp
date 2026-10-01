import { expect, test, type Page } from '@playwright/test';

/**
 * Health Connect exists only on Android devices. The web build reads a fake health store from
 * `window.__kalethraHealth` (see src/core/platform/health/unavailable.ts), defined here before
 * the app starts. Device behaviour (system dialog, revoking) is covered by the device checklist.
 */
async function installFakeHealthConnect(page: Page) {
  await page.addInitScript(() => {
    const day = (offset: number, hour = 0, minute = 0) => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour, minute);
    };
    let granted: string[] = [];
    const access = (kinds: string[]) => ({
      granted: kinds.filter((k) => granted.includes(k)),
      denied: kinds.filter((k) => !granted.includes(k)),
    });
    (window as unknown as { __kalethraHealth: unknown }).__kalethraHealth = {
      availability: () => Promise.resolve({ kind: 'available', platform: 'healthConnect' }),
      checkAccess: (kinds: string[]) => Promise.resolve(access(kinds)),
      requestAccess: (kinds: string[]) => {
        granted = [...kinds];
        return Promise.resolve(access(kinds));
      },
      readWeights: () =>
        Promise.resolve([
          { id: 'a', measuredAt: day(-1, 8, 2).toISOString(), kg: 92.4, source: 'Waage' },
          { id: 'b', measuredAt: day(-1, 18, 10).toISOString(), kg: 93.1, source: 'Waage' },
        ]),
      readDailyTotals: (kind: string) =>
        Promise.resolve([{ dayStart: day(0).toISOString(), value: kind === 'steps' ? 6543 : 321 }]),
      openSettings: () => Promise.resolve(),
    };
  });
}

function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

test('connects Health Connect after an explanation, shows the data and disconnects', async ({
  page,
}) => {
  await installFakeHealthConnect(page);
  await page.goto('/profile');
  const section = page.getByRole('region', { name: 'Gesundheitsdaten' });
  await expect(section.getByText('Nicht verbunden')).toBeVisible();

  await section.getByRole('button', { name: /^Health Connect/ }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText(/ausschließlich für deine persönliche Übersicht/)).toBeVisible();
  await expect(sheet.getByText('Kalethra schreibt nichts in Health Connect.')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await sheet.getByRole('button', { name: 'Mit Health Connect verbinden' }).click();
  await expect(sheet.getByRole('status')).toContainText('Verbunden');
  await expect(sheet.getByRole('status')).toContainText('Zuletzt aktualisiert');
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(section.getByText('Verbunden')).toBeVisible();

  // Health shows the imported values apart from the own weight.
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Gesundheit' })
    .click();
  const imported = page.getByRole('region', { name: 'Aus Health Connect' });
  await expect(imported.getByText('6.543 Schritte')).toBeVisible();
  await expect(imported.getByText('321 kcal')).toBeVisible();
  await expect(imported.getByText(/92,4 kg/)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Disconnect: deleting the imported data is pre-selected.
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Profil' })
    .click();
  await section.getByRole('button', { name: /^Health Connect/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Verbindung trennen' }).click();
  const confirm = page.getByRole('dialog');
  await expect(
    confirm.getByRole('checkbox', { name: 'Importierte Daten aus Health Connect löschen' }),
  ).toBeChecked();
  expect(await noHorizontalScroll(page)).toBe(true);
  await confirm.getByRole('button', { name: 'Trennen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(section.getByText('Nicht verbunden')).toBeVisible();
});

test('explains that Health Connect is not available in the browser', async ({ page }) => {
  await page.goto('/profile');
  const section = page.getByRole('region', { name: 'Gesundheitsdaten' });
  await expect(section.getByText('Nicht verfügbar')).toBeVisible();
  await section.getByRole('button', { name: /^Health Connect/ }).click();
  await expect(
    page.getByRole('dialog').getByText(/Auf diesem Gerät gibt es Health Connect nicht/),
  ).toBeVisible();
});

test('the connected Health Connect sheet scrolls to its last action on a small screen', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await installFakeHealthConnect(page);
  await page.goto('/profile');
  const section = page.getByRole('region', { name: 'Gesundheitsdaten' });
  await section.getByRole('button', { name: /^Health Connect/ }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Mit Health Connect verbinden' }).click();
  await expect(sheet.getByRole('status')).toContainText('Verbunden');

  // Every permission row keeps its full height – nothing is squeezed or clipped.
  const list = sheet.getByRole('list', { name: 'Was Kalethra liest' });
  const rows = list.getByRole('listitem');
  await expect(rows).toHaveCount(4);
  for (const row of await rows.all()) {
    const box = await row.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  const listBox = await list.evaluate((el) => ({
    client: el.clientHeight,
    scroll: el.scrollHeight,
  }));
  expect(listBox.scroll).toBeLessThanOrEqual(listBox.client + 1);

  // The sheet itself scrolls: the content is taller than the visible sheet …
  const panel = await sheet.evaluate((el) => ({
    client: el.clientHeight,
    scroll: el.scrollHeight,
  }));
  expect(panel.scroll).toBeGreaterThan(panel.client);
  // … and the last permission and the last action can be reached.
  await sheet.getByText('Trainings', { exact: true }).scrollIntoViewIfNeeded();
  await expect(sheet.getByText('Trainings', { exact: true })).toBeInViewport();
  const disconnect = sheet.getByRole('button', { name: 'Verbindung trennen' });
  await disconnect.scrollIntoViewIfNeeded();
  await expect(disconnect).toBeInViewport({ ratio: 1 });
  await disconnect.click();
  await expect(
    page.getByRole('dialog').getByRole('heading', { name: 'Verbindung trennen?' }),
  ).toBeVisible();
});
