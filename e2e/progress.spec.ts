import { expect, test } from '@playwright/test';

test('Fortschritt is the read-only main page that opens the areas', async ({ page }) => {
  await page.goto('/');
  const main = page.locator('main');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Fortschritt' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // There is no "Heute" tab any more.
  await expect(nav.getByRole('link')).toHaveText([
    'Fortschritt',
    'Training',
    'Ernährung',
    'Gesundheit',
    'Einstellungen',
  ]);
  await expect(main.locator('input, textarea, select')).toHaveCount(0);
  // The only controls: the period and the Kalethra score (opens its explanation).
  await expect(main.getByRole('button')).toHaveCount(1);
  await expect(main.getByRole('button')).toHaveAccessibleName(/Details zum Kalethra-Score$/);
  await expect(main.getByRole('radio')).toHaveCount(3);
  await expect(main.getByText('Noch keine Trainingsdaten.')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  // Every card is one large target (at least 44 px high) that opens its area.
  for (const name of [/^Training/, /^Ernährung/, /^Gewicht/]) {
    const box = await main.getByRole('link', { name }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }

  // Weight entered under Health shows up here.
  await main.getByRole('link', { name: /^Gewicht/ }).click();
  await expect(page).toHaveURL(/\/health$/);
  await page.getByRole('button', { name: 'Gewicht eintragen' }).click();
  await page.getByLabel('Gewicht in kg').fill('91,8');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await nav.getByRole('link', { name: 'Fortschritt' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(main.getByRole('link', { name: /^Gewicht/ }).getByText('91,8 kg')).toBeVisible();

  // Back and forward between the main page and an area.
  await main.getByRole('link', { name: /^Training/ }).click();
  await expect(page).toHaveURL(/\/training$/);
  await page.goBack();
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(/\/training$/);
  await page.goBack();

  await main.getByRole('link', { name: /^Ernährung/ }).click();
  await expect(page).toHaveURL(/\/nutrition$/);
});

test('progress over a day: food, workout, activity calories and period', async ({ page }) => {
  // Health Connect stand-in (see healthConnect.spec.ts) with one run that just ended.
  await page.addInitScript(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(Math.max(midnight.getTime(), now.getTime() - 46 * 60_000));
    const end = new Date(Math.max(start.getTime() + 60_000, now.getTime() - 60_000));
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
      readWeights: () => Promise.resolve([]),
      readDailyTotals: () => Promise.resolve([]),
      readWorkouts: () =>
        Promise.resolve([
          {
            id: 'run',
            type: 'running',
            start: start.toISOString(),
            end: end.toISOString(),
            activeKcal: 500,
            distanceM: 6000,
            source: 'Pixel Watch',
          },
        ]),
      openSettings: () => Promise.resolve(),
    };
  });
  const main = page.locator('main');
  const tab = (name: string) =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });
  const noHorizontalScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

  // Open the app on Fortschritt.
  await page.goto('/');
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();

  // Own goals: 2.000 kcal, 120 g protein.
  await page.goto('/settings/goals');
  for (const [row, value] of [
    [/^Kalorienziel/, '2000'],
    [/^Protein/, '120'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    await page
      .getByRole('dialog')
      .getByLabel(/^Eigener Wert/)
      .fill(value);
    await page.getByRole('dialog').getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  }
  await main.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();

  // 3: log food.
  await tab('Ernährung').click();
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Lebensmittel suchen').fill('Porridge');
  await sheet.getByRole('button', { name: 'Neues Lebensmittel anlegen' }).click();
  await sheet.getByLabel('Kalorien (kcal)').fill('370');
  await sheet.getByLabel('Protein (g)').fill('13,5');
  await sheet.getByLabel('Kohlenhydrate (g)').fill('58,7');
  await sheet.getByLabel('Fett (g)').fill('7');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // 4: a Kalethra workout – start, one set, finish.
  await tab('Training').click();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Freies Training/ })
    .click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByRole('dialog').getByRole('searchbox').fill('bank');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Langhantel-Bankdrücken/ })
    .click();
  await page.getByLabel('Satz 1: Gewicht').fill('60');
  await page.getByLabel('Satz 1: Wdh.').fill('10');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Training beenden' }).click();
  // The summary shows the volume; "Training ansehen" leads to the finished workout.
  const summary = page.getByRole('dialog', { name: 'Training abgeschlossen' });
  await expect(summary.getByText('600 kg')).toBeVisible();
  await summary.getByRole('button', { name: 'Training ansehen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('600 kg')).toBeVisible();

  // Fortschritt: the workout and the logged day, by period (week is the default).
  await tab('Fortschritt').click();
  const nutrition = main.getByRole('link', { name: /^Ernährung/ });
  await expect(main.getByRole('radio', { name: '7 Tage' })).toHaveAttribute('aria-checked', 'true');
  await expect(main.getByText('1 Einheit')).toBeVisible();
  await expect(main.getByText('600 kg Volumen')).toBeVisible();
  await expect(nutrition.getByText('Ø 370 kcal / Tag')).toBeVisible();
  await expect(nutrition.getByText('Tagesziel Ø 2.000 kcal · 120 g Protein')).toBeVisible();
  await expect(nutrition.getByText('An 1 von 7 Tagen erfasst')).toBeVisible();
  await main.getByRole('radio', { name: '30 Tage' }).click();
  await expect(nutrition.getByText('An 1 von 30 Tagen erfasst')).toBeVisible();
  await expect(main.getByText('1 Einheit')).toBeVisible();
  await main.getByRole('radio', { name: '7 Tage' }).click();
  await expect(nutrition.getByText('An 1 von 7 Tagen erfasst')).toBeVisible();
  // No daily content on the main page.
  await expect(main.getByText('Training fortsetzen')).toHaveCount(0);
  await expect(main.getByRole('progressbar')).toHaveCount(0);
  expect(await noHorizontalScroll()).toBe(true);

  // Health Connect with a run – shown, kept apart from Kalethra workouts.
  await tab('Einstellungen').click();
  await main.getByRole('link', { name: /^App/ }).click();
  await main
    .getByRole('region', { name: 'Gesundheitsdaten' })
    .getByRole('button', { name: /^Health Connect/ })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Mit Health Connect verbinden' })
    .click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Verbunden');
  await page.keyboard.press('Escape');
  await tab('Fortschritt').click();
  const activities = main.getByRole('link', { name: /^Aktivitäten/ });
  await expect(activities.getByText('1 Aktivität', { exact: true })).toBeVisible();
  await expect(main.getByText('1 Einheit')).toBeVisible();
  // Off (default): the daily goal stays the base goal.
  await expect(nutrition.getByText('Tagesziel Ø 2.000 kcal · 120 g Protein')).toBeVisible();
  await activities.click();
  await expect(page).toHaveURL(/\/training\/activities$/);
  await expect(main.getByText('Laufen')).toBeVisible();

  // Count activity calories → the goal of the logged day grows; the base goal stays.
  await tab('Einstellungen').click();
  await main.getByRole('link', { name: /^Ziele/ }).click();
  await page.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' }).click();
  await tab('Fortschritt').click();
  await expect(nutrition.getByText('Tagesziel Ø 2.500 kcal · 120 g Protein')).toBeVisible();
  await tab('Ernährung').click();
  await expect(main.getByText('Basisziel')).toBeVisible();
  await expect(main.getByText('+500 kcal')).toBeVisible();

  // Scroll to the very end: the last card is fully reachable above the tab bar.
  await tab('Fortschritt').click();
  await expect(activities.getByText('1 Aktivität', { exact: true })).toBeVisible();
  // The cards load one after another and can still grow the page after a single wheel on a slow
  // runner, so scroll to the end again until the last card has settled.
  await expect(async () => {
    await page.mouse.wheel(0, 5000);
    await expect(activities).toBeInViewport({ ratio: 1, timeout: 500 });
  }).toPass({ timeout: 10_000 });
  const cardBox = await activities.boundingBox();
  const tabBarBox = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox();
  expect((cardBox?.y ?? 0) + (cardBox?.height ?? 0)).toBeLessThanOrEqual(tabBarBox?.y ?? 0);
  expect(await noHorizontalScroll()).toBe(true);
});
