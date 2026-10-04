import { expect, test } from '@playwright/test';

test('Kalethra score: top of Fortschritt, periods, recovery, targets, main goal and details', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');
  const tab = (name: string) =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });
  const noHorizontalScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const noFocusedField = () =>
    page.evaluate(() => !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? ''));
  const score = main.getByRole('button', { name: /Kalethra-Score/ });

  // Without any data: the score is there, without a number.
  await page.goto('/');
  await expect(score).toBeVisible();
  await expect(score).toContainText('Noch keine Daten für diesen Zeitraum.');
  // It is the first content after the period switch, above the four cards.
  const scoreBox = await score.boundingBox();
  const trainingBox = await main.getByRole('link', { name: /^Training/ }).boundingBox();
  expect(scoreBox?.y ?? 0).toBeLessThan(trainingBox?.y ?? 0);
  expect(scoreBox?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(await noHorizontalScroll()).toBe(true);

  // Main goal "Allgemeine Fitness" with an own calorie and protein goal.
  await page.goto('/settings/goals');
  await main.getByRole('radio', { name: 'Allgemeine Fitness' }).click();
  for (const [row, value] of [
    [/^Kalorienziel/, '2000'],
    [/^Protein/, '120'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    await sheet.getByLabel(/^Eigener Wert/).fill(value);
    await sheet.getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  }
  await main.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();

  // Food on target today.
  await tab('Ernährung').click();
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  await sheet.getByLabel('Lebensmittel suchen').fill('Tagesessen');
  await sheet.getByRole('button', { name: 'Neues Lebensmittel anlegen' }).click();
  await sheet.getByLabel('Kalorien (kcal)').fill('2000');
  await sheet.getByLabel('Protein (g)').fill('120');
  await sheet.getByLabel('Kohlenhydrate (g)').fill('200');
  await sheet.getByLabel('Fett (g)').fill('70');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(sheet).toHaveCount(0);

  // Recovery today: well recovered, rest day – no keyboard.
  await tab('Gesundheit').click();
  await expect(page.getByText('Wie erholt fühlst du dich heute?')).toBeVisible();
  expect(await noFocusedField()).toBe(true);
  const good = page.getByRole('button', { name: 'Gut erholt' });
  expect((await good.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await good.click();
  await expect(good).toHaveAttribute('aria-pressed', 'true');
  const rest = page.getByRole('switch', { name: 'Ruhetag' });
  await rest.click();
  await expect(rest).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Für heute gespeichert.')).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);

  // Weekly targets in Einstellungen → Ziele – chosen from a list.
  await tab('Einstellungen').click();
  await main.getByRole('link', { name: /^Ziele/ }).click();
  await expect(main.getByRole('radio', { name: 'Allgemeine Fitness' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await main.getByRole('button', { name: /Trainings pro Woche/ }).click();
  expect(await noFocusedField()).toBe(true);
  await sheet.getByRole('button', { name: '3× pro Woche' }).click();
  await expect(sheet).toHaveCount(0);
  await main.getByRole('button', { name: /Aktive Minuten pro Woche/ }).click();
  await sheet.getByRole('button', { name: '150 min' }).click();
  await expect(main.getByRole('button', { name: /Aktive Minuten pro Woche/ })).toContainText(
    '150 min',
  );

  // Fortschritt opens on Heute (Phase 17.3); 7 days: a number, marked preliminary (only one
  // documented day).
  await tab('Fortschritt').click();
  await expect(main.getByRole('radio', { name: 'Heute' })).toHaveAttribute('aria-checked', 'true');
  await main.getByRole('radio', { name: '7 Tage' }).click();
  await expect(score).toContainText('Vorläufig');
  await expect(score).toContainText('Noch nicht alle Daten für diesen Zeitraum sind vorhanden.');
  await expect(score).toHaveAccessibleName(/^Kalethra-Score \d+ von 100, /);

  // Today: nutrition on target, recovery good, a rest day – no workout is no minus.
  await main.getByRole('radio', { name: 'Heute' }).click();
  await expect(score).toHaveAccessibleName(/^Kalethra-Score 100 von 100, Sehr gut unterwegs\./);
  await expect(score).toHaveAccessibleName(/Training: Ohne Bewertung\./);

  // Details on tap.
  await score.click();
  await expect(sheet).toHaveAccessibleName('Kalethra-Score');
  expect(await noFocusedField()).toBe(true);
  await expect(sheet.getByText('Hauptziel: Allgemeine Fitness')).toBeVisible();
  await expect(sheet.getByText('Ernährung 30 %')).toBeVisible();
  await expect(
    sheet.getByText('Heute noch kein Training – das zählt nicht als Minus.'),
  ).toBeVisible();
  await expect(sheet.getByText('Deine dokumentierte Erholung war überwiegend gut.')).toBeVisible();
  await expect(sheet.getByText(/nichts Medizinisches/)).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // 30 days, then back – the cards below stay and open their areas.
  await main.getByRole('radio', { name: '30 Tage' }).click();
  await expect(score).toContainText('Vorläufig');
  await main.getByRole('radio', { name: '7 Tage' }).click();
  await main.getByRole('link', { name: /^Ernährung/ }).click();
  await expect(page).toHaveURL(/\/nutrition$/);
});
