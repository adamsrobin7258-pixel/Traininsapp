import { expect, test } from '@playwright/test';

test('Einstellungen: profile, goals, content and app – each in one place', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  const noHorizontalScroll = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  const noFocusedField = () =>
    page.evaluate(() => !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName ?? ''));

  // The tab bar: Einstellungen instead of Profil.
  await page.goto('/');
  await expect(nav.getByRole('link')).toHaveText([
    'Fortschritt',
    'Training',
    'Ernährung',
    'Gesundheit',
    'Einstellungen',
  ]);
  await nav.getByRole('link', { name: 'Einstellungen' }).click();
  await expect(page).toHaveURL(/\/settings$/);
  const entries = main.getByRole('list', { name: 'Einstellungen' });
  await expect(entries.getByRole('link')).toHaveCount(4);
  for (const link of await entries.getByRole('link').all()) {
    expect((await link.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(await noHorizontalScroll()).toBe(true);

  // Profil: name and personal data; weight only shown.
  await entries.getByRole('link', { name: /^Profil/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  expect(await noFocusedField()).toBe(true);
  await main.getByLabel('Name').fill('Anna');
  await main.getByLabel('Name').press('Enter');
  await main.getByRole('radio', { name: 'Weiblich' }).click();
  await main.getByLabel('Geburtsdatum').fill('1992-03-14');
  await main.getByLabel('Körpergröße (cm)').fill('168');
  await main.getByRole('button', { name: 'Persönliche Daten speichern' }).click();
  await expect(main.getByText(/Gespeichert/)).toBeVisible();
  await expect(main.getByLabel(/Gewicht in kg/)).toHaveCount(0);
  await expect(main.getByRole('link', { name: 'Gewicht unter Gesundheit erfassen' })).toBeVisible();
  expect(await noHorizontalScroll()).toBe(true);

  // Back to Einstellungen (in-app back link), then Ziele.
  await main.getByRole('link', { name: /Einstellungen/ }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await entries.getByRole('link', { name: /^Ziele/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Ziele' })).toBeVisible();
  expect(await noFocusedField()).toBe(true);
  await expect(main.getByText('Aus deinem Profil')).toBeVisible();
  await main.getByRole('radio', { name: 'Allgemeine Fitness' }).click();
  await main.getByRole('button', { name: /^Kalorienziel/ }).click();
  await sheet.getByLabel(/^Eigener Wert/).fill('2100');
  await sheet.getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  await main.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();
  for (const [row, choice] of [
    [/Trainings pro Woche/, '3× pro Woche'],
    [/Aktive Minuten pro Woche/, '150 min'],
    [/Schrittziel pro Tag/, '8.000 Schritte'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    expect(await noFocusedField()).toBe(true);
    await sheet.getByRole('button', { name: choice }).click();
    await expect(sheet).toHaveCount(0);
    await expect(main.getByRole('button', { name: row })).toContainText(choice);
  }
  const counting = main.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' });
  await counting.click();
  await expect(counting).toHaveAttribute('aria-checked', 'true');
  expect(await noHorizontalScroll()).toBe(true);

  // Reload: everything stays.
  await page.reload();
  await expect(main.getByRole('radio', { name: 'Allgemeine Fitness' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(main.getByRole('button', { name: /Trainings pro Woche/ })).toContainText('3×');
  await expect(main.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // Browser back returns to Einstellungen; Meine Inhalte lists the own content.
  await page.goBack();
  await expect(page).toHaveURL(/\/settings$/);
  await entries.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Meine Inhalte' })).toBeVisible();
  await expect(main.getByRole('link')).toHaveCount(6); // back link + five content pages
  await page.goBack();

  // App: appearance, water quick buttons, Health Connect, privacy – no goals.
  await entries.getByRole('link', { name: /^App/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'App' })).toBeVisible();
  await expect(main.getByRole('region', { name: 'Gesundheitsdaten' })).toBeVisible();
  await expect(main.getByRole('switch', { name: 'Aktivitätskalorien anrechnen' })).toHaveCount(0);
  await main.getByRole('button', { name: /^Schnellmengen/ }).click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);
  expect(await noHorizontalScroll()).toBe(true);

  // The greeting on Fortschritt uses the name; the old profile address leads to Einstellungen.
  await nav.getByRole('link', { name: 'Fortschritt' }).click();
  await expect(main.getByText(/Anna$/)).toBeVisible();
  await page.goto('/profile');
  await expect(page).toHaveURL(/\/settings$/);
  await page.goto('/nutrition/profile');
  await expect(page).toHaveURL(/\/settings\/goals$/);
});
