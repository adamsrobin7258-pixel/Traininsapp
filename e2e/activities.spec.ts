import { expect, test } from '@playwright/test';

test('manual activity: log, adjust, edit, delete and count towards the daily goal', async ({
  page,
}) => {
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');
  const tab = (name: string) =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });
  const noHorizontalScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const noFocusedField = () =>
    page.evaluate(() => !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? ''));
  const estimate = sheet.getByRole('region', { name: 'Geschätzter Energieverbrauch' });

  // Preparation: body weight 84,6 kg and an own calorie goal of 2.000 kcal.
  await page.goto('/health');
  await page.getByRole('button', { name: 'Gewicht eintragen' }).click();
  await page.getByLabel('Gewicht in kg').fill('84,6');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);
  await page.goto('/settings/goals');
  await main.getByRole('button', { name: /^Kalorienziel/ }).click();
  await sheet.getByLabel(/^Eigener Wert/).fill('2000');
  await sheet.getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  await main.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();

  // 1. Open Fortschritt.
  await page.goto('/');
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();

  // 2. Training → Aktivitäten.
  await tab('Training').click();
  await main.getByRole('link', { name: /^Aktivitäten/ }).click();
  await expect(page).toHaveURL(/\/training\/activities$/);
  await expect(main.getByText('Noch keine Aktivitäten')).toBeVisible();

  // 3. Aktivität erfassen – no keyboard on open.
  const record = main.getByRole('button', { name: 'Aktivität erfassen' });
  expect((await record.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await record.click();
  await expect(sheet).toHaveAccessibleName('Sportart wählen');
  expect(await noFocusedField()).toBe(true);

  // 4. Joggen.
  await sheet.getByRole('searchbox').fill('jogg');
  const jog = sheet.getByRole('button', { name: 'Joggen' });
  expect((await jog.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  await jog.click();
  await expect(sheet).toHaveAccessibleName('Aktivität erfassen');
  expect(await noFocusedField()).toBe(true);

  // 5. Duration and distance.
  await sheet.getByLabel('Dauer (Minuten)').fill('48');
  await sheet.getByLabel('Distanz in km (optional)').fill('7,2');

  // 6. Calculated: 9,0 km/h → 9.8 MET → 625 kcal at 84,6 kg.
  await expect(estimate.getByText('625 kcal')).toBeVisible();
  await expect(estimate.getByText(/Körpergewicht \(84,6 kg\)/)).toBeVisible();

  // 7. Change the calories.
  await estimate.getByRole('button', { name: 'Kalorien anpassen' }).click();
  await estimate.getByLabel('Eigener Wert in kcal').fill('650');
  await expect(estimate.getByText('Manuell angepasst · automatisch 625 kcal')).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);

  // 8. Save.
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);

  // 9. In the list, with its source.
  const list = main.getByRole('list', { name: 'Aktivitäten' });
  const row = list.getByRole('button', { name: /Joggen/ });
  await expect(row).toContainText('48 min · 7,2 km · 650 kcal');
  await expect(row).toContainText('Manuell erfasst');

  // 10. Open it.
  await row.click();
  await expect(sheet).toHaveAccessibleName('Aktivität bearbeiten');
  expect(await noFocusedField()).toBe(true);

  // 11. Edit: 60 minutes instead of 48 – the calculated value follows.
  await sheet.getByLabel('Dauer (Minuten)').fill('60');
  // 7,2 km in 60 min = 7,2 km/h → 8.3 MET (5 mph band) → 648 kcal.
  await expect(estimate.getByText('Manuell angepasst · automatisch 648 kcal')).toBeVisible();

  // 12. Change the calories again.
  await estimate.getByLabel('Eigener Wert in kcal').fill('500');

  // 13. Save.
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(row).toContainText('1 h 00 min · 7,2 km · 500 kcal');

  // 14. Delete, with confirmation.
  await row.click();
  await sheet.getByRole('button', { name: 'Aktivität löschen' }).click();
  await expect(sheet).toHaveAccessibleName('Aktivität löschen?');
  await sheet.getByRole('button', { name: 'Löschen' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(main.getByText('Noch keine Aktivitäten')).toBeVisible();

  // A second activity for the daily goal: yoga, 30 min, own value 300 kcal.
  await main.getByRole('button', { name: 'Aktivität erfassen' }).click();
  await sheet.getByRole('searchbox').fill('yoga');
  await sheet.getByRole('button', { name: 'Yoga' }).click();
  await sheet.getByLabel('Dauer (Minuten)').fill('30');
  await estimate.getByRole('button', { name: 'Kalorien anpassen' }).click();
  await estimate.getByLabel('Eigener Wert in kcal').fill('300');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);
  await expect(list.getByRole('button', { name: /Yoga/ })).toContainText('30 min · 300 kcal');

  // 15. The activity card on Fortschritt.
  await tab('Fortschritt').click();
  const activities = main.getByRole('link', { name: /^Aktivitäten/ });
  await expect(activities.getByText('1 Aktivität', { exact: true })).toBeVisible();
  await expect(activities.getByText('300 aktive kcal')).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);

  // Off (default): information only, the goal stays 2.000 kcal.
  await tab('Ernährung').click();
  const overview = main.getByRole('region', { name: 'Tagesübersicht' });
  await expect(overview.getByText('Nicht auf das Tagesziel angerechnet')).toBeVisible();
  await expect(overview.getByText('Basisziel')).toHaveCount(0);

  // 16. Count activity calories (Einstellungen → Ziele).
  await tab('Einstellungen').click();
  await main.getByRole('link', { name: /^Ziele/ }).click();
  const toggle = page.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');

  // 17. The daily goal: 2.000 kcal + 300 kcal = 2.300 kcal; the base goal stays.
  await tab('Ernährung').click();
  await expect(overview.getByText('Basisziel')).toBeVisible();
  await expect(overview.getByText('2.000 kcal')).toBeVisible();
  await expect(overview.getByText('+300 kcal')).toBeVisible();
  await expect(overview.getByText('2.300 kcal').first()).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);
});
