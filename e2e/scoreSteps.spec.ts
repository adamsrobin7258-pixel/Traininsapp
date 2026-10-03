import { expect, test, type Page } from '@playwright/test';

/**
 * Phase 14 follow-up: steps are a second signal inside the score's "Aktivitäten" (no area of
 * its own, unchanged weights), and the trend reads neutrally ("Gestiegen" / "Gesunken" /
 * "Ungefähr gleich"). Health Connect comes from the usual fake store. The browser clock is
 * fixed (test clock only, no production change), so the goals can be set two days before
 * "today" and yesterday is a fair comparison period.
 */
const TWO_DAYS_AGO = new Date(2026, 9, 1, 9);
const TODAY = new Date(2026, 9, 3, 12);
const at = (day: number, hour: number) => new Date(2026, 9, day, hour).toISOString();

async function fakeHealthConnect(page: Page, yesterdayMin: number, todayMin: number) {
  const walk = (id: string, day: number, hour: number, minutes: number) => ({
    id,
    type: 'walking',
    start: at(day, hour),
    end: new Date(Date.parse(at(day, hour)) + minutes * 60_000).toISOString(),
    activeKcal: null,
    distanceM: null,
    source: 'Pixel Watch',
  });
  const data = {
    workouts: [walk('yesterday', 2, 10, yesterdayMin), walk('today', 3, 9, todayMin)],
    // Daily totals – Health Connect delivers no finer time information for steps.
    steps: [
      { dayStart: at(2, 0), value: 12_000 },
      { dayStart: at(3, 0), value: 12_000 },
    ],
  };
  await page.addInitScript((fake) => {
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
      readDailyTotals: (kind: string) => Promise.resolve(kind === 'steps' ? fake.steps : []),
      readWorkouts: () => Promise.resolve(fake.workouts),
      openSettings: () => Promise.resolve(),
    };
  }, data);
}

async function setUp(page: Page, yesterdayMin: number, todayMin: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await fakeHealthConnect(page, yesterdayMin, todayMin);
  const main = page.locator('main');
  const sheet = page.getByRole('dialog');
  // Goals chosen two days ago – from a list, no keyboard.
  await page.clock.setFixedTime(TWO_DAYS_AGO);
  await page.goto('/settings/goals');
  for (const [row, option] of [
    [/Aktive Minuten pro Woche/, '150 min'],
    [/Schrittziel pro Tag/, '10.000 Schritte'],
  ] as const) {
    await main.getByRole('button', { name: row }).click();
    await sheet.getByRole('button', { name: option }).click();
    await expect(main.getByRole('button', { name: row })).toContainText(option);
  }
  // Today: connect Health Connect (it imports yesterday's and today's data).
  await page.clock.setFixedTime(TODAY);
  await page.goto('/settings/app');
  await main
    .getByRole('region', { name: 'Gesundheitsdaten' })
    .getByRole('button', { name: /^Health Connect/ })
    .click();
  await sheet.getByRole('button', { name: 'Mit Health Connect verbinden' }).click();
  await expect(sheet.getByRole('status')).toContainText('Verbunden');
  await page.keyboard.press('Escape');
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', {
      name: 'Fortschritt',
    })
    .click();
  await main.getByRole('radio', { name: 'Heute' }).click();
  return { main, sheet, score: main.getByRole('button', { name: /Kalethra-Score/ }) };
}

const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('steps inside "Aktivitäten": score, details, periods, large text', async ({ page }) => {
  const { main, sheet, score } = await setUp(page, 10, 30);
  // The steps card keeps showing the real steps.
  await expect(
    main.getByRole('link', { name: /^Schritte/ }).getByText('12.000 von 10.000 Schritten'),
  ).toBeVisible();
  // Today: 30 min ≥ today's share (≈ 21 min) → 100, steps 12.000 ≥ 10.000 → 100.
  await expect(score).toHaveAccessibleName(/^Kalethra-Score 100 von 100, /);
  await expect(score).toHaveAccessibleName(/Aktivitäten: 100\./);

  await score.click();
  await expect(sheet).toHaveAccessibleName('Kalethra-Score');
  await expect(
    sheet.getByText(
      'Schritte außerhalb getrackter Aktivitäten: Ø 12.000 pro Tag (Ziel: 10.000) · Ziel an 1 von 1 Tagen erreicht.',
    ),
  ).toBeVisible();
  await expect(sheet.getByText('Aktive Minuten und Schritte zählen je zur Hälfte.')).toBeVisible();
  // Four areas, unchanged weights (no main goal → "Allgemeine Fitness": activities 25 %).
  await expect(sheet.getByText('Aktivitäten 25 %')).toBeVisible();
  await expect(sheet.getByText(/^Schritte \d+ %$/)).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(sheet).toHaveCount(0);

  // 7 and 30 days: days without step data stay neutral – the area is still rated.
  for (const period of ['7 Tage', '30 Tage']) {
    await main.getByRole('radio', { name: period }).click();
    await expect(score).toHaveAccessibleName(/Aktivitäten: \d+\./);
  }

  // Large system font: nothing overflows.
  await page.addStyleTag({ content: 'html { font-size: 130%; }' });
  await main.getByRole('radio', { name: 'Heute' }).click();
  await expect(score).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await score.click();
  expect(await noHorizontalScroll(page)).toBe(true);
});

for (const { name, yesterday, today, text } of [
  { name: 'up', yesterday: 10, today: 30, text: /^Gestiegen gegenüber gestern · \+26 Punkte$/ },
  { name: 'down', yesterday: 30, today: 10, text: /^Gesunken gegenüber gestern · [-−]26 Punkte$/ },
  { name: 'steady', yesterday: 30, today: 30, text: /^Ungefähr gleich gegenüber gestern/ },
]) {
  test(`trend reads neutrally (${name})`, async ({ page }) => {
    const { score } = await setUp(page, yesterday, today);
    // Yesterday: 10 min of ≈ 21 → 47 and steps 100 → 74; today 30 min → 100 (and reversed).
    await expect(score.getByText(text)).toBeVisible();
    await expect(score.getByText(/Verbessert|Verschlechtert/)).toHaveCount(0);
    expect(await noHorizontalScroll(page)).toBe(true);
  });
}
