import { expect, test } from '@playwright/test';

test('Today is a read-only overview that opens the areas', async ({ page }) => {
  await page.goto('/');
  const main = page.locator('main');
  await expect(main.getByRole('link', { name: /^Training/ }).first()).toBeVisible();
  await expect(main.locator('input, textarea, select')).toHaveCount(0);
  await expect(main.getByRole('button')).toHaveCount(0);
  // The only control: the period of "Dein Fortschritt".
  await expect(main.getByRole('radio')).toHaveCount(2);
  await expect(main.getByText('Noch nichts eingetragen')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );

  // Weight entered under Health shows up in "Dein Fortschritt" on Today.
  const progress = main.getByRole('region', { name: 'Dein Fortschritt' });
  await expect(progress.getByText('Noch keine Gewichtsdaten.')).toBeVisible();
  await progress.getByRole('link', { name: /^Gewicht/ }).click();
  await expect(page).toHaveURL(/\/health$/);
  await page.getByRole('button', { name: 'Gewicht eintragen' }).click();
  await page.getByLabel('Gewicht in kg').fill('91,8');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Heute' })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page
      .locator('main')
      .getByRole('region', { name: 'Dein Fortschritt' })
      .getByRole('link', { name: /^Gewicht/ })
      .getByText('91,8 kg'),
  ).toBeVisible();

  await page
    .locator('main')
    .getByRole('link', { name: /^Ernährung/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/nutrition$/);
});

test('a day on Today: food, workout, activity calories and progress by period', async ({
  page,
}) => {
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

  // 1–2: open the app on Today.
  await page.goto('/');
  await expect(main.getByText('Heute kein Training geplant')).toBeVisible();

  // Own goals: 2.000 kcal, 120 g protein.
  await page.goto('/nutrition/profile');
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
  await main.getByRole('button', { name: 'Speichern' }).click();
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
  await expect(page.getByText('600 kg')).toBeVisible();

  // 5–7: Today and "Dein Fortschritt".
  await tab('Heute').click();
  await expect(main.getByText('Heute abgeschlossen')).toBeVisible();
  const nutrition = main.getByRole('link', { name: /^Ernährung/ }).first();
  await expect(nutrition.getByText('370', { exact: true })).toBeVisible();
  await expect(nutrition.getByText('von 2.000 kcal · noch 1.630 kcal')).toBeVisible();
  const progress = main.getByRole('region', { name: 'Dein Fortschritt' });
  await expect(progress.getByRole('radio', { name: 'Woche' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(progress.getByText('1 Einheit')).toBeVisible();
  await expect(progress.getByText('600 kg Volumen')).toBeVisible();
  await expect(progress.getByText('Ø 370 kcal / Tag')).toBeVisible();
  await expect(progress.getByText('An 1 von 7 Tagen erfasst')).toBeVisible();
  await progress.getByRole('radio', { name: 'Monat' }).click();
  await expect(progress.getByText('An 1 von 30 Tagen erfasst')).toBeVisible();
  await expect(progress.getByText('1 Einheit')).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);

  // 8: Health Connect with a run – shown, kept apart from Kalethra workouts.
  await tab('Profil').click();
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
  await tab('Heute').click();
  await expect(main.getByRole('link', { name: /^Aktivitäten heute/ })).toContainText('Laufen ·');
  await expect(progress.getByText('1 Aktivität', { exact: true })).toBeVisible();
  await expect(progress.getByText('1 Einheit')).toBeVisible();
  // Off (default): the goal stays, the calories are information only.
  await expect(nutrition.getByText('von 2.000 kcal · noch 1.630 kcal')).toBeVisible();
  await expect(
    nutrition.getByText('Aktivitätskalorien 500 kcal · Nicht auf das Tagesziel angerechnet'),
  ).toBeVisible();

  // 9–10: count activity calories → the day's budget grows, the base goal stays.
  await tab('Profil').click();
  await page.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' }).click();
  await tab('Heute').click();
  await expect(nutrition.getByText('von 2.500 kcal · noch 2.130 kcal')).toBeVisible();
  await expect(
    nutrition.getByText('Basisziel 2.000 kcal · Aktivitätskalorien +500 kcal'),
  ).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);
});
