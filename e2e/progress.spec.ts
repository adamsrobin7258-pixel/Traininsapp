import { expect, test, type Page } from '@playwright/test';

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** Local day key (YYYY-MM-DD) of today plus `offset` days, in the browser's time zone. */
const dayKey = (page: Page, offset = 0) =>
  page.evaluate((days) => {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + days);
    return `${String(day.getFullYear())}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  }, offset);

/**
 * Days of the calendar up to today: Monday two weeks ago … today (14 + weekday from Monday on).
 * The calendar shows the current week and the two before; later days are still to come.
 */
const daysUntilToday = (page: Page) =>
  page.evaluate(() => 14 + ((new Date().getDay() + 6) % 7) + 1);

test('Fortschritt is the compact, read-only main page: score, areas, calendar', async ({
  page,
}) => {
  await page.goto('/');
  const main = page.locator('main');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Fortschritt' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  // There is no "Heute" tab any more.
  await expect(nav.getByRole('link')).toHaveText([
    'Fortschritt',
    'Training',
    'Ernährung',
    'Gesundheit',
    'Einstellungen',
  ]);
  await expect(main.locator('input, textarea, select')).toHaveCount(0);
  // Controls: the period, the score (opens its explanation), four areas and 20 days.
  await expect(main.getByRole('radio')).toHaveCount(3);
  const score = main.getByRole('button', { name: /Kalethra-Score/ });
  await expect(score).toHaveAccessibleName(/Details zum Kalethra-Score$/);
  const areas = main.getByRole('list', { name: 'Bereiche des Scores' }).getByRole('link');
  await expect(areas).toHaveCount(4);
  const calendar = main.getByRole('region', { name: 'Die letzten Tage' });
  // Three whole weeks; the days up to today can be opened.
  await expect(calendar.locator('[data-date]')).toHaveCount(21);
  await expect(calendar.getByRole('button')).toHaveCount(await daysUntilToday(page));
  await expect(calendar.getByRole('list', { name: 'Legende' })).toContainText(
    'TrainingKalorienziel erreicht',
  );
  // The five former cards are gone.
  for (const name of [/^Gewicht/, /^Schritte/]) {
    await expect(main.getByRole('link', { name })).toHaveCount(0);
  }
  await expect(main.getByText('Noch keine Trainingsdaten.')).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);

  // Order: score, areas, calendar – the calendar is the last block of the page.
  const scoreBox = await score.boundingBox();
  const areaBox = await areas.first().boundingBox();
  const calendarBox = await calendar.boundingBox();
  expect(scoreBox?.y ?? 0).toBeLessThan(areaBox?.y ?? 0);
  expect(areaBox?.y ?? 0).toBeLessThan(calendarBox?.y ?? 0);

  // The score card: ring and words stay inside the card, nothing is cut off.
  const ringBox = await score.locator('svg[viewBox="0 0 120 120"]').boundingBox();
  expect(ringBox?.x ?? -1).toBeGreaterThanOrEqual(scoreBox?.x ?? 0);
  expect((ringBox?.x ?? 0) + (ringBox?.width ?? 0)).toBeLessThanOrEqual(
    (scoreBox?.x ?? 0) + (scoreBox?.width ?? 0),
  );
  expect(
    await main
      .getByRole('region', { name: 'Kalethra-Score' })
      .evaluate((card) =>
        [...card.querySelectorAll('span')].every(
          (span) => span.scrollWidth <= span.clientWidth + 1,
        ),
      ),
  ).toBe(true);

  // Every area and every day is a comfortable target inside the screen.
  const width = page.viewportSize()?.width ?? 0;
  for (const target of [...(await areas.all()), ...(await calendar.getByRole('button').all())]) {
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(32);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  }

  // Today is marked once; the last cell is today.
  const today = await dayKey(page);
  await expect(calendar.locator('[aria-current="date"]')).toHaveCount(1);
  await expect(calendar.getByRole('button').last()).toHaveAttribute('data-date', today);
  const sinceMonday = (await daysUntilToday(page)) - 1;
  await expect(calendar.getByRole('button').first()).toHaveAttribute(
    'data-date',
    await dayKey(page, -sinceMonday),
  );
  // The last cell is Sunday of this week; later days have no button and no mark.
  await expect(calendar.locator('[data-date]').last()).toHaveAttribute(
    'data-date',
    await dayKey(page, 20 - sinceMonday),
  );
  await expect(calendar.locator('[data-future] [data-mark]')).toHaveCount(0);

  // Each area opens its module; back and forward work.
  for (const [area, url] of [
    ['Ernährung', /\/nutrition$/],
    ['Training', /\/training$/],
    ['Aktivitäten', /\/training\/activities$/],
    ['Regeneration', /\/health$/],
  ] as const) {
    await main.getByRole('link', { name: new RegExp(`^${area}: .* – Bereich öffnen$`) }).click();
    await expect(page).toHaveURL(url);
    await page.goBack();
    await expect(main.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeVisible();
  }
  await page.goForward();
  await expect(page).toHaveURL(/\/health$/);

  // The modules keep their data: weight entered under Gesundheit stays there.
  await page.getByRole('button', { name: 'Gewicht eintragen' }).click();
  await page.getByLabel('Gewicht in kg').fill('91,8');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(main.getByText('91,8 kg').first()).toBeVisible();
});

test('progress over a day: workout and calorie goal in the calendar, day details', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const now = new Date();
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(Math.max(midnight.getTime(), now.getTime() - 46 * 60_000));
    const end = new Date(Math.max(start.getTime() + 60_000, now.getTime() - 60_000));
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
      readDailyTotals: () => Promise.resolve([]),
      readWorkouts: () =>
        Promise.resolve([
          {
            id: 'run',
            type: 'running',
            start: start.toISOString(),
            end: end.toISOString(),
            activeKcal: 500,
            distanceM: 6000,
            source: 'Pixel Watch',
          },
        ]),
      openSettings: () => Promise.resolve(),
    };
  });
  const main = page.locator('main');
  const tab = (name: string) =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name });

  // Own goals: 500 kcal (the lowest allowed – one breakfast meets it), 120 g protein.
  await page.goto('/settings/goals');
  for (const [row, value] of [
    [/^Kalorienziel/, '500'],
    [/^Protein/, '120'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    await page
      .getByRole('dialog')
      .getByLabel(/^Eigener Wert/)
      .fill(value);
    await page.getByRole('dialog').getByRole('button', { name: 'Eigenen Wert verwenden' }).click();
  }
  await main.getByRole('button', { name: 'Hauptziel und Ernährung speichern' }).click();
  await expect(page.getByText(/Ernährungsprofil gespeichert/)).toBeVisible();

  // Fortschritt before anything happened: no marks at all, today neutral.
  await tab('Fortschritt').click();
  const calendar = main.getByRole('region', { name: 'Die letzten Tage' });
  const today = calendar.locator('[aria-current="date"]');
  await expect(calendar.getByRole('button')).toHaveCount(await daysUntilToday(page));
  await expect(calendar.locator('button [data-mark]')).toHaveCount(0);

  // Log 500 kcal: the goal of today is met (no main goal: a range of ±5 %).
  await tab('Ernährung').click();
  await main.getByRole('button', { name: 'Frühstück: hinzufügen' }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByLabel('Lebensmittel suchen').fill('Porridge');
  await sheet.getByRole('button', { name: 'Neues Lebensmittel anlegen' }).click();
  await sheet.getByLabel('Kalorien (kcal)').fill('500');
  await sheet.getByLabel('Protein (g)').fill('13,5');
  await sheet.getByLabel('Kohlenhydrate (g)').fill('58,7');
  await sheet.getByLabel('Fett (g)').fill('7');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await sheet.getByRole('button', { name: 'Eintragen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // A Kalethra workout – start, one set, finish; the summary shows the muscles worked.
  await tab('Training').click();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Freies Training/ })
    .click();
  await page.getByRole('button', { name: 'Übung hinzufügen' }).click();
  await page.getByRole('dialog').getByRole('searchbox').fill('bank');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Langhantel-Bankdrücken/ })
    .click();
  await page.getByLabel('Satz 1: Gewicht').fill('60');
  await page.getByLabel('Satz 1: Wdh.').fill('10');
  await page.getByRole('button', { name: 'Satz 1 abschließen' }).click();
  await page.getByRole('button', { name: 'Training beenden' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Training beenden' }).click();
  const summary = page.getByRole('dialog', { name: 'Training abgeschlossen' });
  await expect(summary.getByText('600 kg')).toBeVisible();
  await expect(summary.getByTestId('muscle-map')).toBeVisible();
  await summary.getByRole('button', { name: 'Training ansehen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Fortschritt: both symbols on today, in green; the legend explains them.
  await tab('Fortschritt').click();
  await expect(today.locator('[data-mark]')).toHaveCount(2);
  await expect(today).toHaveAccessibleName(/, heute, Training, Kalorienziel erreicht$/);
  const markColour = await today
    .locator('[data-mark="training"]')
    .evaluate((mark) => getComputedStyle(mark).color);
  const legendColour = await calendar
    .getByRole('list', { name: 'Legende' })
    .locator('[data-mark="training"]')
    .evaluate((mark) => getComputedStyle(mark).color);
  expect(markColour).toBe(legendColour);
  // Green, not red: the green channel dominates.
  const [r = 0, g = 0] = (markColour.match(/\d+/g) ?? []).map(Number);
  expect(g).toBeGreaterThan(r);

  // Day details.
  await today.click();
  const details = page.getByRole('dialog');
  await expect(details.getByText('Training abgeschlossen')).toBeVisible();
  await expect(details.getByText('Kalorienziel erreicht')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Yesterday without data: neutral, no symbol, no "missed".
  await calendar.locator(`button[data-date="${await dayKey(page, -1)}"]`).click();
  await expect(details.getByText('Kein abgeschlossenes Training erfasst')).toBeVisible();
  await expect(details.getByText('Keine Ernährungseinträge erfasst')).toBeVisible();
  await page.keyboard.press('Escape');

  // Health Connect with a run: an activity, never a training mark of its own.
  await tab('Einstellungen').click();
  await main.getByRole('link', { name: /^App/ }).click();
  await main
    .getByRole('region', { name: 'Gesundheitsdaten' })
    .getByRole('button', { name: /^Health Connect/ })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Mit Health Connect verbinden' })
    .click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Verbunden');
  await page.keyboard.press('Escape');
  await tab('Fortschritt').click();
  await expect(today.locator('[data-mark]')).toHaveCount(2);
  await expect(calendar.locator('button [data-mark="training"]')).toHaveCount(1);

  // Scroll to the very end: the legend is fully reachable above the tab bar.
  const legend = calendar.getByRole('list', { name: 'Legende' });
  await expect(async () => {
    await page.mouse.wheel(0, 5000);
    await expect(legend).toBeInViewport({ ratio: 1, timeout: 500 });
  }).toPass({ timeout: 10_000 });
  const legendBox = await legend.boundingBox();
  const tabBarBox = await page.getByRole('navigation', { name: 'Hauptnavigation' }).boundingBox();
  expect((legendBox?.y ?? 0) + (legendBox?.height ?? 0)).toBeLessThanOrEqual(tabBarBox?.y ?? 0);
  expect(await noHorizontalScroll(page)).toBe(true);
});

/** Bottom of the legend and top of the tab bar, and how far the page could scroll. */
const fit = (page: Page) =>
  page.evaluate(() => {
    const legend = document.querySelector('main ul[aria-label="Legende"]');
    const nav = document.querySelector('nav[aria-label="Hauptnavigation"]');
    return {
      legendBottom: legend?.getBoundingClientRect().bottom ?? Infinity,
      navTop: nav?.getBoundingClientRect().top ?? 0,
      scroll: document.documentElement.scrollHeight - window.innerHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

test('the whole overview fits the screen without scrolling (390 px and Xiaomi 15 Ultra)', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === 'w320-light', 'Too short for one screen – see next test');
  await page.goto('/');
  const main = page.locator('main');
  await expect(main.locator('[aria-current="date"]')).toBeVisible();
  await expect(main.locator('[aria-busy]')).toHaveCount(0);
  // 390 × 844 without system bars: everything above the tab bar, nothing scrolled.
  let result = await fit(page);
  expect(result.legendBottom).toBeLessThanOrEqual(result.navTop);
  expect(result.overflowX).toBe(false);

  // Xiaomi 15 Ultra (412 × 915 CSS px), app edge to edge: status bar 40 px, gesture bar 24 px.
  await page.setViewportSize({ width: 412, height: 915 });
  await page.addStyleTag({
    content: 'html { --safe-area-inset-top: 40px; --safe-area-inset-bottom: 24px; }',
  });
  result = await fit(page);
  expect(result.legendBottom).toBeLessThanOrEqual(result.navTop);
  expect(result.scroll).toBeLessThanOrEqual(0);
  // Order kept: score, areas, calendar, legend – and every part fully on the screen.
  for (const part of [
    main.getByRole('button', { name: /Kalethra-Score/ }),
    main.getByRole('list', { name: 'Bereiche des Scores' }),
    main.getByRole('region', { name: 'Die letzten Tage' }),
    main.getByRole('list', { name: 'Legende' }),
  ]) {
    await expect(part).toBeInViewport({ ratio: 1 });
  }
  for (const target of await main.getByRole('link').all()) {
    expect((await target.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
});

test('small screen or large font: the page scrolls instead of cutting anything off', async ({
  page,
}) => {
  await page.goto('/');
  const main = page.locator('main');
  await expect(main.locator('[aria-current="date"]')).toBeVisible();
  // 130 % system font on the Xiaomi does not fit one screen – it must stay complete and usable.
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  const width = page.viewportSize()?.width ?? 0;
  expect((await fit(page)).overflowX).toBe(false);
  const targets = [
    ...(await main.getByRole('list', { name: 'Bereiche des Scores' }).getByRole('link').all()),
    ...(await main.getByRole('region', { name: 'Die letzten Tage' }).getByRole('button').all()),
  ];
  expect(targets).toHaveLength(4 + (await daysUntilToday(page)));
  for (const target of targets) {
    // Centred, so no sub-pixel edge and never under the tab bar.
    await target.evaluate((element) => {
      element.scrollIntoView({ block: 'center' });
    });
    await expect(target).toBeInViewport({ ratio: 1 });
    const box = await target.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
  }
  // The legend is reachable above the tab bar; no text is cut off in the score card.
  const legend = main.getByRole('list', { name: 'Legende' });
  await expect(async () => {
    await page.mouse.wheel(0, 5000);
    await expect(legend).toBeInViewport({ ratio: 1, timeout: 500 });
  }).toPass({ timeout: 10_000 });
  expect(
    await main
      .getByRole('region', { name: 'Kalethra-Score' })
      .evaluate((card) =>
        [...card.querySelectorAll('span')].every(
          (span) => span.scrollWidth <= span.clientWidth + 1,
        ),
      ),
  ).toBe(true);
});
