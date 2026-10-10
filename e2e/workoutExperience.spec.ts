import { expect, test, type Page } from '@playwright/test';

/** Phase 13: next workout, last values, suggestions, rest timer, replace, summary, editing. */

function tab(page: Page, name: string) {
  return page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });
}

function sheet(page: Page) {
  return page.getByRole('dialog');
}

function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

function textFieldFocused(page: Page) {
  return page.evaluate(() => {
    const active = document.activeElement;
    return (
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLInputElement && !['button', 'checkbox'].includes(active.type))
    );
  });
}

/** Plan "Push Pull" with Push (bench press 3 × 8) and Pull (dumbbell row 2 × 10). */
async function createPlan(page: Page) {
  await page.goto('/settings/content/plans');
  await page.getByRole('button', { name: 'Neuer Plan' }).click();
  await page.getByLabel('Name des Plans').fill('Push Pull');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Push Pull' })).toBeVisible();
  for (const [day, search, exercise, sets, reps] of [
    ['Push', 'langhantel bank', /^Langhantel-Bankdrücken/, '3', '8'],
    ['Pull', 'kurzhantelrudern', /^Einarmiges Kurzhantelrudern/, '2', '10'],
  ] as const) {
    await page.getByRole('button', { name: 'Trainingstag hinzufügen' }).click();
    await page.getByLabel('Name des Trainingstags').fill(day);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(sheet(page)).toHaveCount(0);
    const card = page.getByRole('region', { name: day, exact: true });
    await card.getByRole('button', { name: 'Übung hinzufügen' }).click();
    await sheet(page).getByRole('searchbox').fill(search);
    await sheet(page).getByRole('button', { name: exercise }).click();
    await expect(sheet(page)).toHaveCount(0);
    await card
      .getByRole('button', { name: new RegExp(`${exercise.source.slice(1)}\\s*Vorgabe`) })
      .click();
    await page.getByLabel('Arbeitssätze').fill(sets);
    await page.getByLabel('Wiederholungen').fill(reps);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(sheet(page)).toHaveCount(0);
  }
}

async function startDay(page: Page, day: RegExp) {
  await tab(page, 'Training').click();
  // With a plan the next workout has its own button; this one is "Anderes Training".
  await page.getByRole('button', { name: 'Anderes Training' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Aus Plan starten/ })
    .click();
  await sheet(page).getByRole('button', { name: day }).click();
  await expect(page.getByLabel('Satz 1: Gewicht')).toBeVisible();
}

/** Fills and completes the working sets of the first exercise, then finishes. */
async function trainAndFinish(page: Page, sets: readonly [string, string][]) {
  for (const [index, [kg, reps]] of sets.entries()) {
    const n = index + 1;
    await page.getByLabel(`Satz ${n}: Gewicht`).fill(kg);
    await page.getByLabel(`Satz ${n}: Wdh.`).fill(reps);
    await page.getByRole('button', { name: `Satz ${n} abschließen` }).tap();
    await expect(
      page.getByRole('button', { name: new RegExp(`^Satz ${n}: .*abgeschlossen$`) }),
    ).toBeVisible();
  }
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await sheet(page).getByRole('button', { name: 'Training beenden' }).click();
  await expect(page.getByRole('dialog', { name: 'Training abgeschlossen' })).toBeVisible();
}

async function setRestTime(page: Page, label: string) {
  await page.goto('/settings/app');
  await page.getByRole('button', { name: /^Pausenzeit/ }).click();
  expect(await textFieldFocused(page)).toBe(false);
  await sheet(page).getByRole('button', { name: label, exact: true }).click();
  await expect(sheet(page)).toHaveCount(0);
}

test('1 – next workout, last values, rest timer, finish and summary', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await createPlan(page);
  await setRestTime(page, '30 s');
  await startDay(page, /^Push/);
  await trainAndFinish(page, [
    ['80', '8'],
    ['80', '8'],
    ['77,5', '9'],
  ]);
  await sheet(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(page).toHaveURL(/\/training$/);

  // Next: Pull is suggested, any day can still be chosen.
  await expect(page.getByText('Pull · Push Pull')).toBeVisible();
  await page.getByRole('button', { name: 'Anderes Training' }).click();
  await sheet(page)
    .getByRole('button', { name: /^Aus Plan starten/ })
    .click();
  await expect(sheet(page).getByRole('button', { name: /^Pull.*Als Nächstes/ })).toBeVisible();
  await sheet(page).getByRole('button', { name: /^Push/ }).click();

  // Last values per set, no keyboard.
  const last = page.getByRole('region', { name: 'Werte vom letzten Training' });
  await expect(last.getByRole('listitem')).toHaveText(['80 kg × 8', '80 kg × 8', '77,5 kg × 9']);
  expect(await textFieldFocused(page)).toBe(false);

  // Rest timer after a set: visible, skip possible, the next set stays usable.
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).tap();
  const timer = page.getByRole('timer', { name: 'Pause' });
  await expect(timer).toContainText(/^Pause\s*0:(30|29|28)/);
  await expect(page.getByLabel('Satz 2: Gewicht')).toBeEditable();
  for (const button of await timer.getByRole('button').all()) {
    expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  expect(await noHorizontalScroll(page)).toBe(true);
  await timer.getByRole('button', { name: 'Überspringen' }).click();
  await expect(timer).toHaveCount(0);

  await page.getByRole('button', { name: 'Satz 2 abschließen' }).tap();
  await expect(timer).toBeVisible();
  await timer.getByRole('button', { name: 'Überspringen' }).click();

  await page.getByRole('button', { name: 'Training beenden' }).click();
  await sheet(page).getByRole('button', { name: 'Training beenden' }).click();
  const summary = page.getByRole('dialog', { name: 'Training abgeschlossen' });
  await expect(summary.getByRole('heading', { name: 'Push' })).toBeVisible();
  await expect(summary.getByText(/^2 Sätze · bester Satz 80 kg × 8$/)).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await summary.getByRole('button', { name: 'Training ansehen' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bearbeiten' })).toBeVisible();
});

test('2 – replace an exercise: the plan keeps it, the next workout has it again', async ({
  page,
}) => {
  await createPlan(page);
  await startDay(page, /^Push/);
  await page.getByRole('button', { name: 'Übung ersetzen' }).click();
  const picker = page.getByRole('dialog', { name: 'Übung ersetzen' });
  await expect(
    picker.getByText('Nur in diesem Training – dein Plan bleibt unverändert.'),
  ).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  await picker.getByRole('searchbox').fill('kurzhantel bank');
  await picker.getByRole('button', { name: /^Kurzhantel-Bankdrücken/ }).click();
  await expect(page.getByRole('article', { name: 'Kurzhantel-Bankdrücken' })).toBeVisible();
  await trainAndFinish(page, [
    ['30', '10'],
    ['30', '10'],
    ['30', '10'],
  ]);
  await expect(
    page
      .getByRole('dialog', { name: 'Training abgeschlossen' })
      .getByText('Kurzhantel-Bankdrücken'),
  ).toBeVisible();
  await sheet(page).getByRole('button', { name: 'Schließen' }).click();

  // The plan still has the bench press.
  await page.goto('/settings/content/plans');
  await page.getByRole('link', { name: /^Push Pull/ }).click();
  await expect(
    page.getByRole('region', { name: 'Push', exact: true }).getByText('Langhantel-Bankdrücken'),
  ).toBeVisible();
  await expect(page.getByText('Kurzhantel-Bankdrücken')).toHaveCount(0);

  await startDay(page, /^Push/);
  await expect(page.getByRole('article', { name: 'Langhantel-Bankdrücken' })).toBeVisible();
});

test('3 – edit a finished workout later; history and progress follow', async ({ page }) => {
  await createPlan(page);
  await startDay(page, /^Push/);
  await trainAndFinish(page, [
    ['80', '8'],
    ['80', '8'],
    ['80', '8'],
  ]);
  await sheet(page).getByRole('button', { name: 'Schließen' }).click();

  await page.getByRole('link', { name: /Push/ }).first().click();
  await expect(page.getByText('1.920 kg')).toBeVisible();
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Satz 1: Gewicht').fill('90');
  await page.getByLabel('Satz 1: Wdh.').click();
  // Set 2 is deleted, the former set 3 becomes a drop of set 1.
  await page.getByRole('button', { name: 'Optionen für Satz 2' }).click();
  expect(await textFieldFocused(page)).toBe(false);
  await sheet(page).getByRole('button', { name: 'Satz löschen' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Optionen für Satz 2' }).click();
  await sheet(page).getByRole('button', { name: 'Drop-Satz' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByLabel('Satz 2: Gewicht')).toHaveCount(0);
  await expect(page.getByLabel('Drop 1 zu Satz 1: Gewicht')).toHaveValue('80');
  await page.getByRole('button', { name: /^Titel, Notizen und Dauer/ }).click();
  await sheet(page).getByLabel('Dauer (Minuten)').fill('50');
  await sheet(page).getByLabel('Notizen').fill('Korrigiert');
  await sheet(page).getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet(page)).toHaveCount(0);
  await page.getByRole('button', { name: 'Fertig' }).click();
  // 90 × 8 + 80 × 8 (drop) = 1.360 kg.
  await expect(page.getByText('1.360 kg')).toBeVisible();
  await expect(page.getByText('50 min')).toBeVisible();
  await expect(page.getByText('Korrigiert')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Progress uses the corrected workout.
  await tab(page, 'Fortschritt').click();
  await expect(page.locator('main').getByText('1.360 kg Volumen')).toBeVisible();
});

test('4 – equal sessions lead to a suggestion with more load and fewer reps', async ({ page }) => {
  await createPlan(page);
  for (let session = 0; session < 3; session += 1) {
    await startDay(page, /^Push/);
    await trainAndFinish(page, [
      ['80', '8'],
      ['80', '8'],
      ['80', '8'],
    ]);
    await sheet(page).getByRole('button', { name: 'Schließen' }).click();
  }
  await startDay(page, /^Push/);
  const suggestion = page.getByRole('region', { name: 'Vorschlag' });
  await expect(suggestion.getByText('83,75 kg × 6')).toBeVisible();
  // Not taken over by itself.
  await expect(page.getByLabel('Satz 1: Gewicht')).toHaveValue('80');
  await suggestion.getByRole('button', { name: /^Vorschlag 83,75 kg × 6/ }).click();
  await expect(page.getByLabel('Satz 1: Gewicht')).toHaveValue('83,75');
  await expect(page.getByRole('button', { name: 'Satz 3: 83,75 kg × 6, offen' })).toBeVisible();
  expect(await textFieldFocused(page)).toBe(false);
  // Overwrite freely.
  await page.getByLabel('Satz 1: Gewicht').fill('82,5');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).tap();
  // Saved (the completed set is listed) before the page is left.
  await expect(
    page.getByRole('button', { name: 'Satz 1: 82,5 kg × 6, abgeschlossen' }),
  ).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);

  // Cautious needs four sessions: no suggestion yet.
  await page.goto('/settings/goals');
  await page.getByRole('button', { name: /^Gewichtssteigerung vorschlagen/ }).click();
  await sheet(page)
    .getByRole('button', { name: /^Vorsichtig/ })
    .click();
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Gewichtssteigerung vorschlagen/ })).toContainText(
    'Vorsichtig',
  );
  await page.goto('/training/workout');
  await expect(
    page.getByRole('button', { name: 'Satz 1: 82,5 kg × 6, abgeschlossen' }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Vorschlag' })).toHaveCount(0);
});

test('5 – rest time 0: no timer', async ({ page }) => {
  await createPlan(page);
  await setRestTime(page, 'Aus');
  await startDay(page, /^Push/);
  await page.getByLabel('Satz 1: Gewicht').fill('60');
  await page.getByLabel('Satz 1: Wdh.').fill('8');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).tap();
  await expect(
    page.getByRole('button', { name: 'Satz 1: 60 kg × 8, abgeschlossen' }),
  ).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
});

test('6 – focus flow: plan day, sets in focus, correct in the list, back to focus, finish, history', async ({
  page,
}) => {
  await createPlan(page);
  await setRestTime(page, '60 s');
  await startDay(page, /^Push/);
  expect(await noHorizontalScroll(page)).toBe(true);
  await expect(page.getByRole('radio', { name: 'Fokus' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Übung 1 von 1')).toBeVisible();

  // Set 1 with the large −/+ buttons, set 2 typed; the rest timer follows each set.
  await page.getByLabel('Satz 1: Gewicht').fill('60');
  await page.getByLabel('Satz 1: Wdh.').fill('8');
  const plus = page.getByRole('button', { name: 'Gewicht um 1,25 kg erhöhen' });
  for (const button of [plus, page.getByRole('button', { name: 'Satz 1 abschließen' })]) {
    expect((await button.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
  await plus.tap();
  await plus.tap();
  await expect(page.getByLabel('Satz 1: Gewicht')).toHaveValue('62,5');
  expect(await textFieldFocused(page)).toBe(false);
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).tap();
  await expect(page.getByRole('timer', { name: 'Pause' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Satz 1: 62,5 kg × 8, abgeschlossen' }),
  ).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveAccessibleName(/^Satz 2: /);
  await page.getByLabel('Satz 2: Gewicht').fill('62,5');
  await page.getByLabel('Satz 2: Wdh.').fill('7');
  await page.getByRole('button', { name: 'Satz 2 abschließen' }).tap();
  await expect(
    page.getByRole('button', { name: 'Satz 2: 62,5 kg × 7, abgeschlossen' }),
  ).toBeVisible();

  // The full list: correct set 2, nothing is lost on the way back.
  await page.getByRole('radio', { name: 'Alle Übungen' }).click();
  const card = page.getByRole('article', { name: 'Langhantel-Bankdrücken' });
  await expect(card.getByLabel('Satz 2: Wdh.')).toHaveValue('7');
  await card.getByLabel('Satz 2: Wdh.').fill('6');
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.getByRole('radio', { name: 'Fokus' }).click();
  await expect(
    page.getByRole('button', { name: 'Satz 2: 62,5 kg × 6, abgeschlossen' }),
  ).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveAccessibleName('Satz 3: – × 8, offen');

  // Finishing removes the open set 3; history shows exactly the two sets.
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await sheet(page).getByRole('button', { name: 'Training beenden' }).click();
  const summary = page.getByRole('dialog', { name: 'Training abgeschlossen' });
  await expect(summary.getByText(/^2 Sätze · bester Satz 62,5 kg × 8$/)).toBeVisible();
  await summary.getByRole('button', { name: 'Schließen' }).click();
  await expect(page).toHaveURL(/\/training$/);
  await page.getByRole('link', { name: /Push/ }).first().click();
  // 62,5 × 8 + 62,5 × 6 = 875 kg.
  await expect(page.getByText('875 kg')).toBeVisible();
  await expect(page.getByText('62,5 kg × 8')).toBeVisible();
  await expect(page.getByText('62,5 kg × 6')).toBeVisible();
  await expect(page.getByText('– × 8')).toHaveCount(0);
});
