import { expect, test, type Page } from '@playwright/test';

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** The visible part of an element lies inside the visual viewport (not under the keyboard). */
async function inViewport(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;
    const box = element.getBoundingClientRect();
    const height = window.visualViewport?.height ?? window.innerHeight;
    return box.top >= 0 && box.bottom <= height + 1;
  }, selector);
}

test('log a new food, edit it, water and goals', async ({ page }) => {
  await page.goto('/nutrition');
  const main = page.locator('main');
  await expect(main.getByRole('heading', { level: 1, name: 'Ernährung' })).toBeVisible();
  await expect(main.getByText('Noch keine Ziele festgelegt')).toBeVisible();

  // Add flow: search → create → amount → save.
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Lebensmittel suchen').fill('Haferflocken mit einem sehr langen Namen');
  await sheet.getByRole('button', { name: 'Neues Lebensmittel anlegen' }).click();
  await sheet.getByLabel('Kalorien (kcal)').fill('370');
  await sheet.getByLabel('Protein (g)').fill('13,5');
  await sheet.getByLabel('Kohlenhydrate (g)').fill('58,7');
  await sheet.getByLabel('Fett (g)').fill('7');
  await sheet.getByRole('button', { name: 'Speichern' }).click();

  const amount = sheet.getByLabel('Menge', { exact: true });
  await expect(amount).toHaveValue('100');
  await amount.fill('80');
  await expect(sheet.getByRole('group', { name: 'Nährwerte für diese Menge' })).toContainText(
    '296 kcal',
  );
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(main.getByRole('heading', { name: 'Frühstück · 296 kcal' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Edit the entry.
  await main.getByRole('button', { name: /Haferflocken mit einem sehr langen Namen/ }).click();
  await page.getByRole('dialog').getByLabel('Menge', { exact: true }).fill('100');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(main.getByRole('heading', { name: 'Frühstück · 370 kcal' })).toBeVisible();

  // Goals.
  // Goals: own values in the nutrition profile (no personal data entered).
  await main.getByRole('link', { name: 'Ernährungsprofil einrichten' }).click();
  for (const [row, value] of [
    [/^Kalorienziel/, '2000'],
    [/^Protein/, '120'],
  ] as const) {
    await page.locator('main').getByRole('button', { name: row }).click();
    await page
      .getByRole('dialog')
      .getByLabel(/^Eigener Wert/)
      .fill(value);
    await page.getByRole('dialog').getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  }
  await page.getByLabel('Wasserziel (ml, optional)').fill('2000');
  await page.locator('main').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();
  await page.locator('main').getByRole('link', { name: 'Ernährung' }).click();
  const overview = main.getByRole('region', { name: 'Tagesübersicht' });
  await expect(overview.getByText('1.630 kcal')).toBeVisible();

  // Water.
  await main.getByRole('button', { name: '500 ml Wasser hinzufügen' }).click();
  await expect(main.getByText('500 ml von 2 l')).toBeVisible();
  await expect(overview.getByText('370', { exact: true })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Today shows calories as the big number with their progress.
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Heute' })
    .click();
  const card = page.locator('main').getByRole('link', { name: /^Ernährung/ });
  await expect(card.getByText('370', { exact: true })).toBeVisible();
  await expect(card.getByRole('progressbar', { name: 'Kalorien' })).toBeVisible();
  await expect(card.getByRole('progressbar', { name: 'Protein' })).toBeVisible();
});

test('days: back to yesterday, never into the future', async ({ page }) => {
  await page.goto('/nutrition');
  const main = page.locator('main');
  await expect(main.getByRole('button', { name: 'Nächster Tag' })).toBeDisabled();
  await main.getByRole('button', { name: 'Vorheriger Tag' }).click();
  await expect(page).toHaveURL(/\?day=\d{4}-\d{2}-\d{2}$/);
  await expect(main.getByLabel(/Datum wählen: Gestern/)).toBeVisible();
  await main.getByRole('button', { name: 'Zu heute' }).click();
  await expect(main.getByLabel(/Datum wählen: Heute/)).toBeVisible();
  await page.goto('/nutrition?day=2999-01-01');
  await expect(main.getByLabel(/Datum wählen: Heute/)).toBeVisible();
});

test('the food form stays usable with the keyboard on small screens', async ({ page }) => {
  await page.goto('/nutrition/foods');
  await page.getByRole('button', { name: 'Neues Lebensmittel' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet.getByRole('alert')).toHaveText('Bitte prüfe die markierten Felder.');
  await sheet.getByLabel('Name').fill('Skyr');
  for (const [label, value] of [
    ['Kalorien (kcal)', '63'],
    ['Protein (g)', '11'],
    ['Kohlenhydrate (g)', '4'],
    ['Fett (g)', '0,2'],
  ] as const) {
    await sheet.getByLabel(label).fill(value);
  }
  // The save button can be reached by scrolling inside the sheet.
  const save = sheet.getByRole('button', { name: 'Speichern' });
  await save.scrollIntoViewIfNeeded();
  expect(await inViewport(page, '[role="dialog"] button[type="submit"]')).toBe(true);
  await save.click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('main').getByText('Skyr')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('manage meals and system back closes sheets first', async ({ page }) => {
  await page.goto('/nutrition/meals');
  await page.getByRole('button', { name: 'Mahlzeit hinzufügen' }).click();
  await page.getByRole('dialog').getByLabel('Name der Mahlzeit').fill('Spätmahlzeit');
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.locator('main').getByRole('button', { name: 'Spätmahlzeit' })).toBeVisible();

  await page.getByRole('link', { name: 'Ernährung' }).first().click();
  await expect(page).toHaveURL(/\/nutrition$/);
  await expect(
    page.locator('main').getByRole('heading', { name: 'Spätmahlzeit · 0 kcal' }),
  ).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('nutrition profile: personal data, goal and calculation', async ({ page }) => {
  // Weight comes from the health area.
  await page.goto('/health');
  await page.getByRole('button', { name: 'Gewicht eintragen' }).click();
  await page.getByLabel('Gewicht in kg').fill('90');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/nutrition/profile');
  const main = page.locator('main');
  await expect(main.getByText(/fehlen noch Angaben/)).toBeVisible();
  // Opening the page never opens the keyboard.
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('INPUT');

  await main.getByRole('radio', { name: 'Männlich' }).click();
  await main.getByLabel('Geburtsdatum').fill('1990-05-01');
  await main.getByLabel('Körpergröße (cm)').fill('180');
  await main.getByRole('radio', { name: /^Moderat aktiv/ }).click();
  await main.getByRole('radio', { name: 'Abnehmen' }).click();
  await main.getByLabel('Wunschgewicht (kg, optional)').fill('82');
  await expect(main.getByText('82,0 kg Zielgewicht · 8,0 kg verbleibend')).toBeVisible();
  await expect(
    main
      .getByRole('list', { name: 'Deine Tagesziele' })
      .getByRole('button', { name: /^Kalorienziel/ }),
  ).toContainText(/\d\.\d{3} kcal/);
  await expect(main.getByText(/fehlen noch Angaben/)).toHaveCount(0);
  await expect(main.getByText(/Die Werte sind Schätzungen/)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  await main.getByRole('button', { name: 'Speichern' }).click();
  await expect(main.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();

  // Changing the goal asks first and shows old and new.
  await main.getByRole('radio', { name: 'Muskelaufbau' }).click();
  await main.getByRole('button', { name: 'Speichern' }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText(/^Abnehmen – Moderat/)).toBeVisible();
  await expect(sheet.getByText(/^Muskelaufbau – Moderat/)).toBeVisible();
  await sheet.getByRole('button', { name: 'Ziel ändern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Today uses the profile's goals.
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Heute' })
    .click();
  const card = page.locator('main').getByRole('link', { name: /^Ernährung/ });
  await expect(card.getByText(/^von \d\.\d{3} kcal/)).toBeVisible();
});
