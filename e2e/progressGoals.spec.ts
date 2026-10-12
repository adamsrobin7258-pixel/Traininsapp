import { expect, test } from '@playwright/test';

/**
 * Goals from Einstellungen on the compact Fortschritt (Phase 23): the score rates the areas, the
 * calendar marks met goals only – a running day or a missed goal is never shown as a failure.
 * Runs in every project (390 px light/dark, 320 px) with reduced motion, and again with a large
 * system font.
 */
test('goals from Einstellungen against tracked values on Fortschritt', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Health Connect stand-in: steps today and two days ago, nothing on the other days.
  await page.addInitScript(() => {
    const day = (offset: number) => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
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
      readWeights: () => Promise.resolve([]),
      readDailyTotals: (kind: string) =>
        Promise.resolve(
          kind === 'steps'
            ? [
                { dayStart: day(-2).toISOString(), value: 12_500 },
                { dayStart: day(0).toISOString(), value: 7842 },
              ]
            : [],
        ),
      readWorkouts: () => Promise.resolve([]),
      openSettings: () => Promise.resolve(),
    };
  });
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');
  const tab = (name: string) =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });
  const noHorizontalScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const noFocusedField = () =>
    page.evaluate(() => !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? ''));
  const area = (name: string) =>
    main.getByRole('link', { name: new RegExp(`^${name}: .* – Bereich öffnen$`) });

  // 1. Einstellungen → Ziele.
  await page.goto('/settings');
  await main.getByRole('link', { name: /^Ziele/ }).click();
  await expect(page).toHaveURL(/\/settings\/goals$/);

  // 2.–4. Training, activity and step goal – each chosen from a list, no keyboard.
  for (const [row, option] of [
    [/Trainings pro Woche/, '4× pro Woche'],
    [/Aktive Minuten pro Woche/, '180 min'],
    [/Schrittziel pro Tag/, '10.000 Schritte'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    expect(await noFocusedField()).toBe(true);
    await sheet.getByRole('button', { name: option }).click();
    await expect(sheet).toHaveCount(0);
    await expect(main.getByRole('button', { name: row })).toContainText(option);
  }

  // 5. Nutrition goal: Abnehmen with own values – the calorie goal is a limit.
  await main.getByRole('radio', { name: 'Abnehmen' }).click();
  for (const [row, value] of [
    [/^Kalorienziel/, '2200'],
    [/^Protein/, '160'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    await sheet.getByLabel(/^Eigener Wert/).fill(value);
    await sheet.getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  }
  await main.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();
  await expect(main.getByRole('button', { name: /^Kalorienziel/ })).toContainText('2.200');

  // Health Connect on (steps only come from there).
  await tab('Einstellungen').click();
  await main.getByRole('link', { name: /^App/ }).click();
  await main
    .getByRole('region', { name: 'Gesundheitsdaten' })
    .getByRole('button', { name: /^Health Connect/ })
    .click();
  await sheet.getByRole('button', { name: 'Mit Health Connect verbinden' }).click();
  await expect(sheet.getByRole('status')).toContainText('Verbunden');
  await page.keyboard.press('Escape');

  // Food: 2.100 kcal and 150 g protein today.
  await tab('Ernährung').click();
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  await sheet.getByLabel('Lebensmittel suchen').fill('Tagesessen');
  await sheet.getByRole('button', { name: 'Neues Lebensmittel anlegen' }).click();
  await sheet.getByLabel('Kalorien (kcal)').fill('2100');
  await sheet.getByLabel('Protein (g)').fill('150');
  await sheet.getByLabel('Kohlenhydrate (g)').fill('200');
  await sheet.getByLabel('Fett (g)').fill('70');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(sheet).toHaveCount(0);

  // 6. Fortschritt, Heute: the areas carry their ratings.
  await tab('Fortschritt').click();
  const score = main.getByRole('button', { name: /Kalethra-Score/ });
  await expect(score).toBeVisible();
  await main.getByRole('radio', { name: 'Heute' }).click();
  // Steps 7.842 of 10.000 (Health Connect) rate "Aktivitäten"; nutrition is rated.
  await expect(area('Aktivitäten')).toHaveAccessibleName(/^Aktivitäten: \d+ – /);
  await expect(area('Ernährung')).toHaveAccessibleName(/^Ernährung: \d+ – /);
  await expect(area('Training')).toBeVisible();
  await expect(main.getByRole('progressbar')).toHaveCount(0);
  expect(await noHorizontalScroll()).toBe(true);

  // 7. Calendar: Abnehmen is a limit – today 2.100 of 2.200 is still running, never a miss.
  const calendar = main.getByRole('region', { name: 'Letzte 20 Tage' });
  const today = calendar.locator('[aria-current="date"]');
  await expect(today.locator('[data-mark]')).toHaveCount(0);
  await today.click();
  await expect(sheet.getByText('Der Tag läuft noch – noch nicht bewertet')).toBeVisible();
  await expect(sheet.getByText('Kein abgeschlossenes Training erfasst')).toBeVisible();
  expect(await noFocusedField()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // 8. The period changes the score, the calendar stays the last 20 days.
  await main.getByRole('radio', { name: '30 Tage' }).click();
  await expect(calendar.getByRole('button')).toHaveCount(20);
  await expect(main.getByText(/^0 von/)).toHaveCount(0);

  // 9. An area opens its module, back returns to Fortschritt.
  await area('Aktivitäten').click();
  await expect(page).toHaveURL(/\/training\/activities$/);
  await page.goBack();
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  await area('Training').click();
  await expect(page).toHaveURL(/\/training$/);
  await page.goBack();
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();

  // Large system font: nothing overflows, areas and days stay tappable.
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  await main.getByRole('radio', { name: 'Heute' }).click();
  await expect(calendar.getByRole('button')).toHaveCount(20);
  expect(await noHorizontalScroll()).toBe(true);
  const width = page.viewportSize()?.width ?? 0;
  for (const target of [
    ...(await main.getByRole('list', { name: 'Bereiche des Scores' }).getByRole('link').all()),
    ...(await calendar.getByRole('button').all()),
  ]) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  }
  expect(await noFocusedField()).toBe(true);
});
