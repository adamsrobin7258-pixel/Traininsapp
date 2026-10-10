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

/** Plans are managed in Einstellungen → Meine Inhalte → Trainingspläne. */
async function createPlan(page: Page, name: string, day: string) {
  await page.goto('/settings');
  await page
    .locator('main')
    .getByRole('link', { name: /^Meine Inhalte/ })
    .click();
  await page
    .locator('main')
    .getByRole('link', { name: /^Trainingspläne/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Trainingspläne' })).toBeVisible();
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill(name);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  await page.getByRole('button', { name: 'Trainingstag hinzufügen' }).click();
  await page.getByLabel('Name des Trainingstags').fill(day);
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet(page)).toHaveCount(0);
}

/** Workouts start in the training area – the plan page has no start button. */
async function startPlanDay(page: Page, day: RegExp) {
  await expect(page.getByRole('button', { name: 'Starten' })).toHaveCount(0);
  await tab(page, 'Training').click();
  // With a plan the next workout has its own button; this one is "Anderes Training".
  await page.getByRole('button', { name: 'Anderes Training' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Aus Plan starten/ })
    .click();
  await sheet(page).getByRole('button', { name: day }).click();
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
  await pickExercise(page, 'bank', /^Langhantel-Bankdrücken/);

  // Start the workout from the plan (in the training area) and log two sets.
  await startPlanDay(page, /^Tag A/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tag A' })).toBeVisible();
  await page.getByLabel('Satz 1: Gewicht').fill('60');
  await page.getByLabel('Satz 1: Wdh.').fill('10');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await expect(
    page.getByRole('button', { name: 'Satz 1: 60 kg × 10, abgeschlossen' }),
  ).toBeVisible();
  // Nothing open any more: one more set only when asked for.
  await expect(page.getByText('Alle Sätze sind erledigt.')).toBeVisible();
  await page.getByRole('button', { name: 'Satz hinzufügen', exact: true }).click();
  await expect(page.getByLabel('Satz 2: Gewicht')).toHaveValue('60');
  await page.getByLabel('Satz 2: Wdh.').fill('8');
  await page.getByRole('button', { name: 'Satz 2 abschließen' }).click();
  await expect(
    page.getByRole('button', { name: 'Satz 2: 60 kg × 8, abgeschlossen' }),
  ).toBeVisible();

  // The active workout survives a reload.
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'Satz 2: 60 kg × 8, abgeschlossen' }),
  ).toBeVisible();

  // Finish: first the summary – 60 × 10 + 60 × 8 = 1.080 kg – then the workout.
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await sheet(page).getByRole('button', { name: 'Training beenden' }).click();
  const summary = page.getByRole('dialog', { name: 'Training abgeschlossen' });
  await expect(summary.getByText('1.080 kg')).toBeVisible();
  await summary.getByRole('button', { name: 'Training ansehen' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByText('1.080 kg')).toBeVisible();

  // History lists it; reopening shows the stored sets.
  await tab(page, 'Training').click();
  await page.getByRole('link', { name: /Tag A/ }).click();
  await expect(page.getByText('60 kg × 10')).toBeVisible();
  await expect(page.getByText('60 kg × 8')).toBeVisible();

  // Next start from the plan pre-fills "last time".
  await tab(page, 'Training').click();
  // With a plan the next workout has its own button; this one is "Anderes Training".
  await page.getByRole('button', { name: 'Anderes Training' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Aus Plan starten/ })
    .click();
  await sheet(page)
    .getByRole('button', { name: /^Tag A/ })
    .click();
  const last = page.getByRole('region', { name: 'Werte vom letzten Training' });
  await expect(last.getByRole('listitem')).toHaveText(['60 kg × 10', '60 kg × 8']);
});

test('A – the set check keeps values, focus and the workout', async ({ page }) => {
  await page.goto('/training');
  await startFreeWorkout(page);
  await pickExercise(page, 'bank', /^Langhantel-Bankdrücken/);
  await page.getByLabel('Satz 1: Gewicht').fill('82,5');
  await page.getByLabel('Satz 1: Wdh.').fill('5');
  // Keyboard is "open": the reps field has focus when the check is tapped.
  expect(await textFieldFocused(page)).toBe(true);
  const scrollBefore = await page.evaluate(() => window.scrollY);

  await page.getByRole('button', { name: 'Satz 1 abschließen' }).tap();

  const done = page.getByRole('button', { name: 'Satz 1: 82,5 kg × 5, abgeschlossen' });
  await expect(done).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await expect(page.getByText('Laufendes Training')).toBeVisible();
  expect(page.url()).toMatch(/\/training\/workout$/);
  // The page does not jump away: the result of the tap is in view.
  await expect(done).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(scrollBefore + 40);

  // The completed set opens again for corrections, still without the keyboard.
  await done.tap();
  await expect(page.getByLabel('Satz 1: Gewicht')).toHaveValue('82,5');
  await expect(page.getByLabel('Satz 1: Wdh.')).toHaveValue('5');
  expect(await textFieldFocused(page)).toBe(false);

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
    for (let step = 0; step < 60; step++) await page.mouse.wheel(0, 400);
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

  await expect(page).toHaveURL(/\/settings\/content\/plans$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Trainingspläne' })).toBeVisible();
  // Create a plan there; the way back leads to Meine Inhalte, the tab back to training.
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill('Beine');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Beine' })).toBeVisible();
  await page.getByRole('link', { name: 'Trainingspläne' }).click();
  await expect(page.getByRole('link', { name: 'Beine' })).toBeVisible();
  await page.locator('main').getByRole('link', { name: 'Meine Inhalte' }).click();
  await expect(page).toHaveURL(/\/settings\/content$/);
  await tab(page, 'Training').click();
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
  await pickExercise(page, 'kniebeug', /^Langhantel-Kniebeugen/);
  await page.getByRole('button', { name: /^Langhantel-Kniebeugen\s*Vorgabe/ }).click();
  await page.getByLabel('Aufwärmsätze').fill('1');
  await page.getByLabel('Arbeitssätze').fill('2');
  await page.getByLabel('Wiederholungen').fill('8');
  await page.getByLabel('Drops nach dem letzten Arbeitssatz').fill('1');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('1 × Aufwärmen · 2 × 8 · 1 Drop')).toBeVisible();

  await startPlanDay(page, /^Tag A/);
  // The focus view begins with the warm-up; set 2 is chosen directly, its drop follows.
  await expect(page.getByLabel('Aufwärmsatz 1: Gewicht')).toBeVisible();
  await page.getByRole('button', { name: /^Satz 2: .*offen$/ }).tap();
  await page.getByLabel('Satz 2: Gewicht', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Satz 2 abschließen', exact: true }).tap();
  await page.getByLabel('Drop 1 zu Satz 2: Gewicht').fill('70');
  await page.getByLabel('Drop 1 zu Satz 2: Wdh.').fill('6');
  await page.getByRole('button', { name: 'Drop 1 zu Satz 2 abschließen' }).tap();
  await expect(
    page.getByRole('button', { name: 'Drop 1 zu Satz 2: 70 kg × 6, abgeschlossen' }),
  ).toBeVisible();
  // Then back to the skipped warm-up of the same exercise.
  await expect(page.getByLabel('Aufwärmsatz 1: Gewicht')).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await expect(page.getByLabel(/RPE/)).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Survives a reload with types and values (the full list shows every set).
  await page.reload();
  await page.getByRole('radio', { name: 'Alle Übungen' }).click();
  await expect(page.getByLabel('Drop 1 zu Satz 2: Gewicht')).toHaveValue('70');
  await expect(page.getByRole('group', { name: 'Aufwärmen' })).toBeVisible();
});

test('exercise library: filters, details and favourites without the keyboard', async ({ page }) => {
  await page.goto('/settings/content');
  await page
    .locator('main')
    .getByRole('link', { name: /^Übungen/ })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Übungen' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);

  // Muscle and equipment filter combine; tapping a chip does not open the keyboard.
  await page
    .getByRole('group', { name: 'Nach Muskelgruppe filtern' })
    .getByRole('button', { name: 'Schultern' })
    .click();
  await page
    .getByRole('group', { name: 'Nach Ausrüstung filtern' })
    .getByRole('button', { name: 'Kabelzug' })
    .click();
  expect(await textFieldFocused(page)).toBe(false);
  const library = page.getByRole('list', { name: 'Übungsbibliothek' });
  await expect(library.getByRole('button', { name: /^Face Pulls/ })).toBeVisible();
  await expect(library.getByRole('button', { name: /Langhantel/ })).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Details and favourite.
  await library.getByRole('button', { name: /^Face Pulls/ }).click();
  await expect(sheet(page).getByRole('heading', { name: 'Face Pulls' })).toBeVisible();
  await expect(sheet(page).getByText(/Seil zum Gesicht/)).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Als Favorit markieren' }).click();
  await expect(sheet(page).getByRole('button', { name: 'Favorit entfernen' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet(page)).toHaveCount(0);

  // The favourite comes first in the picker; an alias finds the renamed exercise.
  await tab(page, 'Training').click();
  await startFreeWorkout(page);
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  expect(await textFieldFocused(page)).toBe(false);
  await expect(sheet(page).getByRole('list', { name: 'Favoriten' })).toContainText('Face Pulls');
  await sheet(page).getByRole('searchbox').fill('bankdrücken');
  await expect(
    sheet(page).getByRole('list', { name: 'Ergebnisse' }).getByRole('button').first(),
  ).toContainText('Langhantel-Bankdrücken');
  await sheet(page)
    .getByRole('button', { name: /^Langhantel-Bankdrücken/ })
    .click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Langhantel-Bankdrücken' })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});
