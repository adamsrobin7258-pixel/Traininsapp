import { expect, test } from '@playwright/test';

/**
 * Phase 14 – goal attainment on Fortschritt: goals are set in Einstellungen, the areas track,
 * Fortschritt compares both. Runs in every project (390 px light/dark, 320 px) with reduced
 * motion, and again with a large system font.
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
  const card = (name: RegExp) => main.getByRole('link', { name });

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

  // 6. Fortschritt, Heute.
  await tab('Fortschritt').click();
  await expect(main.getByRole('button', { name: /Kalethra-Score/ })).toBeVisible();
  await main.getByRole('radio', { name: 'Heute' }).click();

  // 7. Actual against goal.
  const training = card(/^Training/);
  await expect(training.getByText('Ziel: 4 pro Woche')).toBeVisible();
  // No workout yet today: neutral, no artificial 0 %.
  await expect(training.getByText('Noch keine Trainingsdaten.')).toBeVisible();
  await expect(training.getByText(/%/)).toHaveCount(0);
  const nutrition = card(/^Ernährung/);
  await expect(nutrition.getByText('2.100 von 2.200 kcal')).toBeVisible();
  await expect(nutrition.getByText('Innerhalb des Kalorienlimits')).toBeVisible();
  await expect(nutrition.getByText('150 von 160 g Protein')).toBeVisible();
  await expect(nutrition.getByText('Proteinziel erreicht')).toBeVisible();
  const steps = card(/^Schritte/);
  await expect(steps.getByText('7.842 von 10.000 Schritten')).toBeVisible();
  await expect(steps.getByText('78 %')).toBeVisible();
  const activities = card(/^Aktivitäten/);
  await expect(activities.getByText('Noch keine Aktivitäten.')).toBeVisible();
  await expect(activities.getByText('Ziel: 180 Min. pro Woche')).toBeVisible();
  // The bars are decorative; the main page still has no progressbar role.
  await expect(main.getByRole('progressbar')).toHaveCount(0);
  expect(await noHorizontalScroll()).toBe(true);

  // B: a manual activity raises the active minutes.
  await activities.click();
  await expect(page).toHaveURL(/\/training\/activities$/);
  await main.getByRole('button', { name: 'Aktivität erfassen' }).click();
  await sheet.getByRole('searchbox').fill('yoga');
  await sheet.getByRole('button', { name: 'Yoga' }).click();
  await sheet.getByLabel('Dauer (Minuten)').fill('30');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);
  await tab('Fortschritt').click();
  await main.getByRole('radio', { name: 'Heute' }).click();
  // The weekly goal applies from today: today's share is 180 ÷ 7 ≈ 26 minutes.
  await expect(activities.getByText('30 von 26 aktiven Min.')).toBeVisible();
  await expect(activities.getByText('115 %')).toBeVisible();

  // 8. 7 days: averages only over days with data, the missing days stay missing.
  await main.getByRole('radio', { name: '7 Tage' }).click();
  await expect(nutrition.getByText('Ø 2.100 von 2.200 kcal')).toBeVisible();
  await expect(nutrition.getByText('Kalorienlimit eingehalten an 1 von 1 Tagen')).toBeVisible();
  await expect(nutrition.getByText('An 1 von 7 Tagen erfasst')).toBeVisible();
  await expect(steps.getByText(/An 2 von 7 Tagen mit Daten/)).toBeVisible();
  // The goals were set today: the week is compared from today on, it says since when.
  await expect(activities.getByText(/^Ziel: 180 Min\. pro Woche · gilt seit /)).toBeVisible();

  // 9.–10. 30 days: still no invented zeros.
  await main.getByRole('radio', { name: '30 Tage' }).click();
  await expect(nutrition.getByText('An 1 von 30 Tagen erfasst')).toBeVisible();
  await expect(steps.getByText(/An 2 von 30 Tagen mit Daten/)).toBeVisible();
  await expect(main.getByText(/^0 von/)).toHaveCount(0);
  expect(await noHorizontalScroll()).toBe(true);

  // 11.–12. A card opens its area, back returns to Fortschritt.
  await steps.click();
  await expect(page).toHaveURL(/\/health$/);
  await page.goBack();
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  await card(/^Training/).click();
  await expect(page).toHaveURL(/\/training$/);
  await page.goBack();
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();

  // Large system font: nothing overflows, the cards stay tappable.
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  await main.getByRole('radio', { name: 'Heute' }).click();
  await expect(steps.getByText('7.842 von 10.000 Schritten')).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);
  for (const name of [/^Training/, /^Ernährung/, /^Gewicht/, /^Aktivitäten/, /^Schritte/]) {
    const box = await card(name).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  }
  expect(await noFocusedField()).toBe(true);
});
