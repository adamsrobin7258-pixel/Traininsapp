import { expect, test, type Page } from '@playwright/test';

function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });
}

function sheet(page: Page) {
  return page.getByRole('dialog');
}

async function pickExercise(page: Page, search: string, name: RegExp) {
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await sheet(page).getByRole('searchbox').fill(search);
  await sheet(page).getByRole('button', { name }).click();
  await expect(sheet(page)).toHaveCount(0);
}

async function startFreeWorkout(page: Page) {
  await page.getByRole('button', { name: 'Training starten' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Freies Training/ })
    .click();
  await expect(page.getByText('Laufendes Training')).toBeVisible();
}

async function createPlan(page: Page, name: string, day: string) {
  await page.goto('/training');
  await page.getByRole('link', { name: /^Pläne/ }).click();
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill(name);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('button', { name: 'Trainingstag hinzufügen' }).click();
  await page.getByLabel('Name des Trainingstags').fill(day);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet(page)).toHaveCount(0);
}

/** True when a field that would bring up the on-screen keyboard has focus. */
function textFieldFocused(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return (
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement && !['button', 'checkbox'].includes(active.type))
    );
  });
}

function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

test('plan, workout, history and reopening a finished workout', async ({ page }) => {
  // Create a plan with one day and one exercise (plan management).
  await createPlan(page, 'Oberkörper', 'Tag A');
  await pickExercise(page, 'bank', /^Bankdrücken/);

  // Start the workout from the plan and log two sets.
  await page.getByRole('button', { name: 'Starten' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tag A' })).toBeVisible();
  await page.getByLabel('Satz 1: Gewicht').fill('60');
  await page.getByLabel('Satz 1: Wdh.').fill('10');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await expect(page.getByRole('button', { name: 'Satz 1 wieder öffnen' })).toBeVisible();
  await page.getByRole('button', { name: 'Satz hinzufügen', exact: true }).click();
  await expect(page.getByLabel('Satz 2: Gewicht')).toHaveValue('60');
  await page.getByLabel('Satz 2: Wdh.').fill('8');
  await page.getByRole('button', { name: 'Satz 2 abschließen' }).click();
  await expect(page.getByRole('button', { name: 'Satz 2 wieder öffnen' })).toBeVisible();

  // The active workout survives a reload.
  await page.reload();
  await expect(page.getByLabel('Satz 2: Wdh.')).toHaveValue('8');

  // Finish: 60 × 10 + 60 × 8 = 1.080 kg.
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await sheet(page).getByRole('button', { name: 'Training beenden' }).click();
  await expect(page.getByText('1.080 kg')).toBeVisible();

  // History lists it; reopening shows the stored sets.
  await tab(page, 'Training').click();
  await page.getByRole('link', { name: /Tag A/ }).click();
  await expect(page.getByText('60 kg × 10')).toBeVisible();
  await expect(page.getByText('60 kg × 8')).toBeVisible();

  // Next start from the plan pre-fills "last time".
  await tab(page, 'Training').click();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Aus Plan starten/ })
    .click();
  await sheet(page)
    .getByRole('button', { name: /^Tag A/ })
    .click();
  await expect(page.getByText('Letztes Mal: 60 kg × 10 · 60 kg × 8')).toBeVisible();
});

test('A – the set check keeps values, focus and the workout', async ({ page }) => {
  await page.goto('/training');
  await startFreeWorkout(page);
  await pickExercise(page, 'bank', /^Bankdrücken/);
  await page.getByLabel('Satz 1: Gewicht').fill('82,5');
  await page.getByLabel('Satz 1: Wdh.').fill('5');
  // Keyboard is "open": the reps field has focus when the check is tapped.
  expect(await textFieldFocused(page)).toBe(true);
  const scrollBefore = await page.evaluate(() => window.scrollY);

  await page.getByRole('button', { name: 'Satz 1 abschließen' }).tap();

  await expect(page.getByRole('button', { name: 'Satz 1 wieder öffnen' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await expect(page.getByLabel('Satz 1: Gewicht')).toHaveValue('82,5');
  await expect(page.getByLabel('Satz 1: Wdh.')).toHaveValue('5');
  await expect(page.getByText('Laufendes Training')).toBeVisible();
  expect(page.url()).toMatch(/\/training\/workout$/);
  expect(Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore)).toBeLessThan(40);

  // Without a focused field the check must not focus one either.
  await page.getByRole('button', { name: 'Satz 1 wieder öffnen' }).tap();
  await expect(page.getByRole('button', { name: 'Satz 1 abschließen' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);

  // Values survive a reload, i.e. they were saved.
  await page.reload();
  await expect(page.getByLabel('Satz 1: Gewicht')).toHaveValue('82,5');
  await expect(page.getByLabel('Satz 1: Wdh.')).toHaveValue('5');
});

test('B – every exercise in the picker is reachable, also after the keyboard', async ({ page }) => {
  await createPlan(page, 'Ganzkörper', 'Tag A');
  const viewport = page.viewportSize();
  if (!viewport) throw new Error('viewport required');

  for (const round of [1, 2]) {
    await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
    expect(await textFieldFocused(page)).toBe(false);

    const list = page.getByTestId('exercise-picker-list');
    const rows = list.getByRole('button');
    const total = await rows.count();
    expect(total).toBeGreaterThan(20);

    // More exercises exist than fit on the screen.
    const box = await list.boundingBox();
    if (!box) throw new Error('list not visible');
    let visible = 0;
    for (let index = 0; index < total; index++) {
      const row = await rows.nth(index).boundingBox();
      if (row && row.y + row.height <= box.y + box.height) visible++;
    }
    expect(visible).toBeLessThan(total);

    if (round === 2) {
      // Simulate the keyboard: focus the search and shrink the visible area, then close it.
      await sheet(page).getByRole('searchbox').focus();
      await page.setViewportSize({
        width: viewport.width,
        height: Math.round(viewport.height * 0.55),
      });
      await expect(sheet(page).getByRole('searchbox')).toBeInViewport();
      await page.setViewportSize(viewport);
      await sheet(page).getByRole('searchbox').blur();
    }

    // Scroll the list itself with a touch-like wheel gesture down to the end.
    const target = rows.nth(total - round);
    const name = (await target.locator('span > span').first().textContent()) ?? '';
    await list.hover();
    for (let step = 0; step < 20; step++) await page.mouse.wheel(0, 400);
    await expect(target).toBeInViewport({ ratio: 1 });
    await target.click();
    await expect(sheet(page)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Tag A' }).getByText(name)).toBeVisible();
  }
  expect(await page.getByRole('region', { name: 'Tag A' }).getByRole('listitem').count()).toBe(2);
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('C – the start flow offers only free workout and start from plan', async ({ page }) => {
  await page.goto('/training');
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(sheet(page).getByRole('button', { name: /^Freies Training/ })).toBeVisible();
  await expect(sheet(page).getByRole('button', { name: /^Aus Plan starten/ })).toBeVisible();
  await expect(sheet(page).getByRole('button')).toHaveCount(2);
  await expect(sheet(page).getByText(/Neuen? Plan/)).toHaveCount(0);
  expect(await textFieldFocused(page)).toBe(false);
});

test('D – without plans the start flow leads to the plan management', async ({ page }) => {
  await page.goto('/training');
  await page.getByRole('button', { name: 'Training starten' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Aus Plan starten/ })
    .click();
  await expect(sheet(page).getByText('Noch kein Trainingsplan vorhanden.')).toBeVisible();
  await expect(sheet(page).getByText(/Neuen? Plan/)).toHaveCount(0);
  await sheet(page).getByRole('button', { name: 'Zu Plänen' }).click();

  await expect(page).toHaveURL(/\/training\/plans$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Pläne' })).toBeVisible();
  // Create a plan there; the normal way back leads to the training area.
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill('Beine');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Beine' })).toBeVisible();
  await page.getByRole('link', { name: 'Pläne' }).click();
  await expect(page.getByRole('link', { name: 'Beine' })).toBeVisible();
  await page.getByRole('link', { name: 'Training' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Training' })).toBeVisible();
});

test('does not scroll horizontally in the training area', async ({ page }) => {
  await page.goto('/training');
  expect(await noHorizontalScroll(page)).toBe(true);
  await startFreeWorkout(page);
  await pickExercise(page, 'trizeps', /^Trizepsdrücken am Kabel/);
  expect(await noHorizontalScroll(page)).toBe(true);
  // All controls of the set row are reachable.
  await expect(page.getByRole('button', { name: 'Satz 1 abschließen' })).toBeInViewport();
});

test('warm-ups and drops from the plan into the workout', async ({ page }) => {
  await createPlan(page, 'Beine', 'Tag A');
  await pickExercise(page, 'kniebeug', /^Kniebeugen/);
  await page.getByRole('button', { name: /^Kniebeugen\s*Vorgabe/ }).click();
  await page.getByLabel('Aufwärmsätze').fill('1');
  await page.getByLabel('Arbeitssätze').fill('2');
  await page.getByLabel('Wiederholungen').fill('8');
  await page.getByLabel('Drops nach dem letzten Arbeitssatz').fill('1');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('1 × Aufwärmen · 2 × 8 · 1 Drop')).toBeVisible();

  await page.getByRole('button', { name: 'Starten' }).click();
  await expect(page.getByLabel('Aufwärmsatz 1: Gewicht')).toBeVisible();
  await page.getByLabel('Satz 2: Gewicht', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Satz 2 abschließen', exact: true }).tap();
  await page.getByLabel('Drop 1 zu Satz 2: Gewicht').fill('70');
  await page.getByLabel('Drop 1 zu Satz 2: Wdh.').fill('6');
  await page.getByRole('button', { name: 'Drop 1 zu Satz 2 abschließen' }).tap();
  await expect(page.getByRole('button', { name: 'Drop 1 zu Satz 2 wieder öffnen' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await expect(page.getByLabel(/RPE/)).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Survives a reload with types and values.
  await page.reload();
  await expect(page.getByLabel('Drop 1 zu Satz 2: Gewicht')).toHaveValue('70');
});
