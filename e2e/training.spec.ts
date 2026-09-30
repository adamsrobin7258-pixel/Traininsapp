import { expect, test, type Page } from '@playwright/test';

async function pickExercise(page: Page, search: string, name: RegExp) {
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByRole('dialog').getByRole('searchbox').fill(search);
  await page.getByRole('dialog').getByRole('button', { name }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });
}

test('plan, workout, history and reopening a finished workout', async ({ page }) => {
  await page.goto('/training');
  await expect(page.getByRole('heading', { level: 1, name: 'Training' })).toBeVisible();

  // Create a plan with one day and one exercise.
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill('Oberkörper');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Oberkörper' })).toBeVisible();
  await page.getByRole('button', { name: 'Trainingstag hinzufügen' }).click();
  await page.getByLabel('Name des Trainingstags').fill('Tag A');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await pickExercise(page, 'bank', /^Bankdrücken/);

  // Start the workout from the plan and log two sets.
  await page.getByRole('button', { name: 'Starten' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tag A' })).toBeVisible();
  await page.getByLabel('Satz 1: Gewicht').fill('60');
  await page.getByLabel('Satz 1: Wdh.').fill('10');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await expect(page.getByRole('button', { name: 'Satz 1 wieder öffnen' })).toBeVisible();
  await page.getByRole('button', { name: 'Satz hinzufügen' }).click();
  await expect(page.getByLabel('Satz 2: Gewicht')).toHaveValue('60');
  await page.getByLabel('Satz 2: Wdh.').fill('8');
  await page.getByRole('button', { name: 'Satz 2 abschließen' }).click();
  await expect(page.getByRole('button', { name: 'Satz 2 wieder öffnen' })).toBeVisible();

  // The active workout survives a reload.
  await page.reload();
  await expect(page.getByLabel('Satz 2: Wdh.')).toHaveValue('8');

  // Finish: 60 × 10 + 60 × 8 = 1.080 kg.
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Training beenden' }).click();
  await expect(page.getByText('1.080 kg')).toBeVisible();

  // History lists it; reopening shows the stored sets.
  await tab(page, 'Training').click();
  await page.getByRole('link', { name: /Tag A/ }).click();
  await expect(page.getByText('60 kg × 10')).toBeVisible();
  await expect(page.getByText('60 kg × 8')).toBeVisible();

  // Next start from the plan pre-fills "last time".
  await tab(page, 'Training').click();
  await page.getByRole('button', { name: 'Training starten' }).first().click();
  await expect(page.getByText('Letztes Mal: 60 kg × 10 · 60 kg × 8')).toBeVisible();
});

test('does not scroll horizontally on a 320 px screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/training');
  await page.getByRole('button', { name: 'Training starten' }).click();
  await pickExercise(page, 'trizeps', /^Trizepsdrücken am Kabel/);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
