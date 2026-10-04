import { expect, test, type Page } from '@playwright/test';

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** True when a field that brings up the on-screen keyboard has focus. */
const textFieldFocused = (page: Page) =>
  page.evaluate(() => {
    const active = document.activeElement;
    return (
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement && active.type !== 'checkbox')
    );
  });

/** No word of the open sheet or page is split over two lines (e.g. "Zutat-en"). */
const noBrokenWords = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('[role="dialog"]') ?? document.querySelector('main');
    if (!root) return false;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    const broken: string[] = [];
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of (node.textContent ?? '').matchAll(/\S+/g)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const lines = new Set([...range.getClientRects()].map((rect) => Math.round(rect.top)));
        if (lines.size > 1) broken.push(match[0]);
      }
    }
    return broken.length === 0 || broken;
  });

function nav(page: Page) {
  return page.getByRole('navigation', { name: 'Hauptnavigation' });
}

/** Creates an own food from the shared food selection ("Neues Lebensmittel anlegen"). */
async function newFood(page: Page, name: string, values: [string, string, string, string]) {
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Lebensmittel suchen').fill(name);
  await sheet.getByRole('button', { name: 'Neues Lebensmittel anlegen' }).click();
  await expect(sheet.getByLabel('Name')).toHaveValue(name);
  const labels = ['Kalorien (kcal)', 'Protein (g)', 'Kohlenhydrate (g)', 'Fett (g)'];
  for (const [index, label] of labels.entries())
    await sheet.getByLabel(label).fill(values[index] ?? '');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
}

test('recipe: create in Meine Inhalte, edit, log a serving, change and delete – the day stays', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');

  // 1–3 Einstellungen → Meine Inhalte → Rezepte.
  await page.goto('/settings');
  await main.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await main.getByRole('link', { name: /^Rezepte/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Rezepte' })).toBeVisible();
  await expect(main.getByText('Noch keine Rezepte')).toBeVisible();

  // 4–7 New recipe from two foods (both created right from the ingredient selection).
  await main.getByRole('button', { name: 'Neues Rezept' }).click();
  expect(await textFieldFocused(page)).toBe(false);
  await sheet.getByLabel('Name').fill('Beerenquark');
  await sheet.getByLabel('Portionen').fill('2');
  await sheet.getByRole('button', { name: 'Zutat hinzufügen' }).click();
  expect(await textFieldFocused(page)).toBe(false);
  await newFood(page, 'Magerquark', ['67', '12', '4', '0,2']);
  await sheet.getByLabel('Magerquark: Menge').fill('500');
  await sheet.getByRole('button', { name: 'Zutat hinzufügen' }).click();
  await newFood(page, 'Heidelbeeren', ['42', '0,6', '7,4', '0,6']);
  await sheet.getByLabel('Heidelbeeren: Menge').fill('200');
  // 335 kcal + 84 kcal = 419 kcal for the whole recipe.
  await expect(sheet.getByRole('group', { name: 'Ganzes Rezept' })).toContainText('419 kcal');
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await noBrokenWords(page)).toBe(true);
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toHaveCount(0);

  // 8 The recipe is listed with its servings and kcal per serving.
  const row = main.getByRole('button', { name: /^Beerenquark/ });
  await expect(row).toContainText('2 Portionen · 2 Zutaten · 210 kcal pro Portion');

  // 9–10 Edit: less quark → 268 + 84 = 352 kcal, 176 kcal per serving.
  await row.click();
  await expect(sheet.getByRole('heading', { name: 'Rezept bearbeiten' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await sheet.getByLabel('Magerquark: Menge').fill('400');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(row).toContainText('176 kcal pro Portion');

  // 11–15 Log one serving in the diary.
  await nav(page).getByRole('link', { name: 'Ernährung' }).click();
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  await sheet.getByRole('radio', { name: 'Rezepte' }).click();
  await sheet.getByRole('button', { name: /^Beerenquark/ }).click();
  await expect(sheet.getByRole('heading', { name: '„Beerenquark“ eintragen' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await expect(sheet.getByLabel('Portionen')).toHaveValue('1');
  await expect(sheet.getByRole('group', { name: 'Nährwerte für diese Menge' })).toContainText(
    '176 kcal',
  );
  expect(await noHorizontalScroll(page)).toBe(true);
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(sheet).toHaveCount(0);
  const breakfast = main.getByRole('heading', { level: 2, name: 'Frühstück · 176 kcal' });
  await expect(breakfast).toBeVisible();
  await expect(main.getByText('Beerenquark')).toBeVisible();

  // 16–17 Change the recipe again: the logged day keeps its values.
  await nav(page).getByRole('link', { name: 'Einstellungen' }).click();
  await main.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await main.getByRole('link', { name: /^Rezepte/ }).click();
  await row.click();
  await sheet.getByLabel('Magerquark: Menge').fill('800');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(row).toContainText('310 kcal pro Portion');
  await nav(page).getByRole('link', { name: 'Ernährung' }).click();
  await expect(breakfast).toBeVisible();

  // 18–19 Delete the recipe: the logged day still has it.
  await nav(page).getByRole('link', { name: 'Einstellungen' }).click();
  await main.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await main.getByRole('link', { name: /^Rezepte/ }).click();
  await row.click();
  await sheet.getByRole('button', { name: 'Rezept löschen' }).click();
  await sheet.getByRole('button', { name: 'Löschen' }).click();
  await expect(main.getByText('Noch keine Rezepte')).toBeVisible();
  await nav(page).getByRole('link', { name: 'Ernährung' }).click();
  await expect(breakfast).toBeVisible();
  await expect(main.getByText('Beerenquark')).toBeVisible();
});

test('template: save from the diary, edit in Meine Inhalte, apply – the older entry stays', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');

  // 1 A logged meal becomes a template.
  await page.goto('/nutrition');
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  await newFood(page, 'Haferflocken', ['370', '13,5', '58,7', '7']);
  await sheet.getByLabel('Menge', { exact: true }).fill('60');
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  const breakfast = main.getByRole('heading', { level: 2, name: 'Frühstück · 222 kcal' });
  await expect(breakfast).toBeVisible();
  await main.getByRole('button', { name: 'Frühstück: weitere Aktionen' }).click();
  await sheet.getByRole('button', { name: 'Als Vorlage speichern' }).click();
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(main.getByRole('status')).toContainText('Vorlage „Frühstück“ gespeichert.');

  // 2–5 Einstellungen → Meine Inhalte → Vorlagen → edit the amount and save.
  await nav(page).getByRole('link', { name: 'Einstellungen' }).click();
  await main.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await main.getByRole('link', { name: /^Vorlagen/ }).click();
  await main.getByRole('link', { name: /^Frühstück/ }).click();
  await expect(main.getByRole('heading', { level: 1, name: 'Frühstück' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await main.getByLabel('Haferflocken: Menge').fill('40');
  await main.getByRole('button', { name: 'Vorlage speichern' }).click();
  await expect(main.getByRole('status')).toHaveText('Vorlage gespeichert.');
  expect(await noHorizontalScroll(page)).toBe(true);
  expect(await noBrokenWords(page)).toBe(true);

  // 6–7 Reopen: the change is stored.
  await main.getByRole('link', { name: 'Vorlagen' }).click();
  await expect(main.getByRole('link', { name: /^Frühstück/ })).toContainText('Haferflocken (40 g)');
  await main.getByRole('link', { name: /^Frühstück/ }).click();
  await expect(main.getByLabel('Haferflocken: Menge')).toHaveValue('40');

  // 8–10 Apply it to another meal: 40 g → 148 kcal; the older breakfast stays at 222 kcal.
  await nav(page).getByRole('link', { name: 'Ernährung' }).click();
  await main.getByRole('button', { name: 'Mittagessen: hinzufügen' }).click();
  await sheet.getByRole('radio', { name: 'Vorlagen' }).click();
  await sheet.getByRole('button', { name: /^Frühstück/ }).click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(sheet).toHaveCount(0);
  const lunch = main.getByRole('heading', { level: 2, name: 'Mittagessen · 148 kcal' });
  await expect(lunch).toBeVisible();
  await expect(breakfast).toBeVisible();

  // Deleting the template (it has items) works and leaves both logged meals alone.
  await nav(page).getByRole('link', { name: 'Einstellungen' }).click();
  await main.getByRole('link', { name: /^Meine Inhalte/ }).click();
  await main.getByRole('link', { name: /^Vorlagen/ }).click();
  await main.getByRole('link', { name: /^Frühstück/ }).click();
  await main.getByRole('button', { name: 'Vorlage löschen' }).click();
  await sheet.getByRole('button', { name: 'Löschen' }).click();
  await expect(page).toHaveURL(/\/settings\/content\/templates$/);
  await expect(main.getByText('Noch keine Vorlagen')).toBeVisible();
  await nav(page).getByRole('link', { name: 'Ernährung' }).click();
  await expect(breakfast).toBeVisible();
  await expect(lunch).toBeVisible();
});
