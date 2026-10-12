import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { EMPTY_SET_VALUES } from '@/core/training';
import { showProgressPeriod } from '@/test/progressPeriod';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

function main() {
  return within(screen.getByRole('main'));
}

/** Completes a workout on a given day (the clock is moved there and back). */
async function completedWorkout(services: AppServices, profileId: string, day: Date, minutes = 45) {
  vi.setSystemTime(day);
  const workout = await services.training.workouts.startFree(profileId);
  const exercise = await services.training.workouts.addExercise(
    profileId,
    workout.id,
    'sys.bench-press',
  );
  const detail = await services.training.workouts.getDetail(profileId, workout.id);
  const set = detail.exercises.find((e) => e.id === exercise)?.sets[0];
  if (!set) throw new Error('set expected');
  await services.training.workouts.updateSet(
    profileId,
    set.id,
    { ...EMPTY_SET_VALUES, weightKg: 80, reps: 8 },
    true,
  );
  vi.setSystemTime(new Date(day.getTime() + minutes * 60_000));
  await services.training.workouts.finish(profileId, workout.id);
  vi.setSystemTime(NOW);
}

/** A food with 100 kcal and 10 g protein per 100 g, eaten in grams on the given days. */
async function eat(services: AppServices, profileId: string, days: [string, number][]) {
  const n = services.nutrition;
  await n.meals.ensureDefaults(profileId);
  const [meal] = await n.meals.listActive(profileId);
  const food = await n.foods.create(profileId, {
    name: 'Testessen',
    reference: { amount: 100, unit: 'g' },
    nutrients: {
      energyKcal: 100,
      proteinG: 10,
      carbsG: 10,
      fatG: 2,
      fiberG: null,
      sugarG: null,
      saturatedFatG: null,
    },
  });
  for (const [localDate, grams] of days) {
    await n.diary.addFood(profileId, {
      localDate,
      mealId: meal?.id ?? '',
      foodId: food.id,
      amount: grams,
      unit: 'g',
    });
  }
}

/** Saves a calorie goal as if it had been chosen on 1 September (goals apply from that day). */
async function calorieGoal(
  services: AppServices,
  profileId: string,
  energyKcal: number,
  goalType: 'maintain' | 'lose' | 'gain' = 'maintain',
) {
  vi.setSystemTime(new Date(2026, 8, 1, 9));
  await services.nutrition.goals.save(profileId, {
    goalType,
    targets: {
      energyKcal: { auto: null, manual: energyKcal },
      proteinG: { auto: null, manual: 160 },
    },
  });
  vi.setSystemTime(NOW);
}

function calendar() {
  return within(main().getByRole('region', { name: 'Die letzten Tage' }));
}

/** The calendar cell of a local day (YYYY-MM-DD). */
function dayCell(date: string): HTMLElement {
  const cell = screen
    .getByRole('region', { name: 'Die letzten Tage' })
    .querySelector<HTMLElement>(`button[data-date="${date}"]`);
  if (!cell) throw new Error(`no cell for ${date}`);
  return cell;
}

const marks = (date: string) =>
  [...dayCell(date).querySelectorAll<HTMLElement>('[data-mark]')].map((mark) => mark.dataset.mark);

/** Waits until the calendar has its data (the cells exist from the start). */
async function calendarReady() {
  await waitFor(() => {
    expect(
      screen.getByRole('region', { name: 'Die letzten Tage' }).querySelector('[aria-busy]'),
    ).toBeNull();
  });
}

describe('Fortschritt – the main page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete document.documentElement.dataset.theme;
  });

  describe('navigation', () => {
    it('is called "Fortschritt" and is the start page; there is no "Heute" tab', async () => {
      const { router } = await renderApp('/');
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Fortschritt' }),
      ).toBeInTheDocument();
      expect(router.state.location.pathname).toBe('/');
      const nav = within(screen.getByRole('navigation', { name: 'Hauptnavigation' }));
      expect(nav.getAllByRole('link').map((link) => link.textContent)).toEqual([
        'Fortschritt',
        'Training',
        'Ernährung',
        'Gesundheit',
        'Einstellungen',
      ]);
      expect(nav.getByRole('link', { name: 'Fortschritt' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      // "Heute" is no tab (Phase 7.1) – only a period of the score.
      expect(nav.queryByRole('link', { name: /Heute/ })).not.toBeInTheDocument();
    });

    it('carries the Kalethra symbol in the title row – decorative, no extra card', async () => {
      await renderApp('/');
      const title = await screen.findByRole('heading', { level: 1, name: 'Fortschritt' });
      const row = title.parentElement;
      const mark = row?.querySelector('[data-brand="symbol"]');
      expect(mark).not.toBeNull();
      expect(mark).toHaveAttribute('aria-hidden', 'true');
      expect(mark).toHaveAttribute('focusable', 'false');
      // Not a control, not a picture with a name: the page still reads "Fortschritt" only.
      expect(mark?.closest('a, button')).toBeNull();
      expect(main().queryByRole('img', { name: /Kalethra/ })).not.toBeInTheDocument();
      expect(main().getAllByRole('heading', { level: 1 })).toHaveLength(1);
      // Exactly one brand mark on the page.
      expect(document.querySelectorAll('[data-brand]')).toHaveLength(1);
    });

    it('is read-only: no inputs – period switch, score details, areas and days', async () => {
      const { container } = await renderApp('/');
      await calendarReady();
      expect(container.querySelectorAll('main input, main textarea, main select')).toHaveLength(0);
      // Buttons: the explanation of the Kalethra score and one per calendar day.
      const buttons = main().getAllByRole('button');
      expect(buttons[0]).toHaveAccessibleName(/Details zum Kalethra-Score$/);
      expect(buttons.slice(1)).toHaveLength(20);
      // Links: the four areas of the score.
      expect(main().getAllByRole('link')).toHaveLength(4);
      expect(
        main()
          .getAllByRole('radio')
          .map((radio) => radio.textContent),
      ).toEqual(['Heute', '7 Tage', '30 Tage']);
    });

    it('works in English and dark mode', async () => {
      vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-US']);
      await renderApp('/', {
        prepare: async (s) => {
          await s.settings.update('theme', 'dark');
        },
      });
      await showProgressPeriod('7 days');
      expect(document.documentElement.dataset.theme).toBe('dark');
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Progress' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: '7 days' })).toHaveAttribute('aria-checked', 'true');
      expect(await main().findByText('Kalethra score')).toBeInTheDocument();
      const days = within(main().getByRole('region', { name: 'Recent days' }));
      expect(days.getByText('Workout')).toBeInTheDocument();
      expect(days.getByText('Calorie goal met')).toBeInTheDocument();
      const nav = within(screen.getByRole('navigation', { name: 'Main navigation' }));
      expect(nav.queryByRole('link', { name: /Today/ })).not.toBeInTheDocument();
    });
  });

  describe('period', () => {
    it('opens on Heute and switches to 7 and 30 days and back', async () => {
      await renderApp('/');
      const today = await main().findByRole('radio', { name: 'Heute' });
      expect(today).toHaveAttribute('aria-checked', 'true');
      expect(main().getByRole('radio', { name: '7 Tage' })).toHaveAttribute(
        'aria-checked',
        'false',
      );
      expect(main().getByText('03.10.')).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '7 Tage' }));
      expect(main().getByRole('radio', { name: '7 Tage' })).toHaveAttribute('aria-checked', 'true');
      expect(main().getByText(/27\.09\. – 03\.10\./)).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: '30 Tage' }));
      expect(main().getByRole('radio', { name: '30 Tage' })).toHaveAttribute(
        'aria-checked',
        'true',
      );
      expect(main().getByText(/04\.09\. – 03\.10\./)).toBeInTheDocument();

      await userEvent.click(main().getByRole('radio', { name: 'Heute' }));
      expect(main().getByText('03.10.')).toBeInTheDocument();
    });

    it('changes the score, never the calendar: always the same three weeks', async () => {
      await renderApp('/');
      await calendarReady();
      expect(calendar().getByText('14.09. – 04.10.')).toBeInTheDocument();
      await showProgressPeriod('30 Tage');
      expect(calendar().getByText('14.09. – 04.10.')).toBeInTheDocument();
      expect(calendar().getAllByRole('button')).toHaveLength(20);
    });
  });

  describe('compact layout (Phase 23)', () => {
    it('shows score, its areas, the calendar and its legend – in this order', async () => {
      await renderApp('/');
      await calendarReady();
      const score = main().getByRole('region', { name: 'Kalethra-Score' });
      const areas = within(score).getByRole('list', { name: 'Bereiche des Scores' });
      const days = main().getByRole('region', { name: 'Die letzten Tage' });
      const legend = within(days).getByRole('list', { name: 'Legende' });
      const order = [score.querySelector('button'), areas, days.querySelector('button'), legend];
      for (const [index, element] of order.entries()) {
        const next = order[index + 1];
        if (!element || !next) continue;
        expect(
          element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
        ).toBeTruthy();
      }
      // Nothing comes after the calendar: no further cards or text blocks.
      expect(days.nextElementSibling).toBeNull();
    });

    it('no longer shows the five cards Training, Ernährung, Gewicht, Aktivitäten, Schritte', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await completedWorkout(services, profileId, new Date(2026, 9, 2, 18));
          await eat(services, profileId, [['2026-10-03', 500]]);
          await services.weight.save(profileId, '2026-10-03', 80);
        },
      });
      await calendarReady();
      expect(main().queryByRole('list', { name: 'Fortschritt' })).not.toBeInTheDocument();
      for (const name of [/^Gewicht/, /^Schritte/]) {
        expect(main().queryByRole('link', { name })).not.toBeInTheDocument();
      }
      for (const text of [
        /Einheiten?$/,
        /kcal \/ Tag/,
        /von .* kcal/,
        /80,0 kg/,
        'Noch keine Aktivitäten.',
        'Noch keine Schrittdaten.',
      ]) {
        expect(main().queryByText(text)).not.toBeInTheDocument();
      }
      // The area links are the score's own areas (name and rating), not the old cards.
      expect(
        main()
          .getAllByRole('link')
          .map((link) => link.getAttribute('aria-label')),
      ).toEqual([
        expect.stringMatching(/^Ernährung: .* – Bereich öffnen$/),
        expect.stringMatching(/^Training: .* – Bereich öffnen$/),
        expect.stringMatching(/^Aktivitäten: .* – Bereich öffnen$/),
        expect.stringMatching(/^Regeneration: .* – Bereich öffnen$/),
      ]);
    });

    it('keeps the areas and their data: the modules still show what was recorded', async () => {
      const { router } = await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await completedWorkout(services, profileId, new Date(2026, 9, 2, 18));
          await services.weight.save(profileId, '2026-10-03', 80);
        },
      });
      await calendarReady();
      await act(() => router.navigate('/training'));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Training' }),
      ).toBeInTheDocument();
      expect(await screen.findByText('Letzte Trainings')).toBeInTheDocument();
      expect(screen.queryByText('Noch keine abgeschlossenen Trainings.')).not.toBeInTheDocument();
      await act(() => router.navigate('/health'));
      expect((await screen.findAllByText(/80,0 kg/)).length).toBeGreaterThan(0);
    });
  });

  describe('score areas', () => {
    it.each([
      ['Ernährung', '/nutrition'],
      ['Training', '/training'],
      ['Aktivitäten', '/training/activities'],
      ['Regeneration', '/health'],
    ])('"%s" opens its area, and back returns here', async (area, path) => {
      const { router } = await renderApp('/');
      await userEvent.click(
        await main().findByRole('link', { name: new RegExp(`^${area}: .* – Bereich öffnen$`) }),
      );
      await waitFor(() => {
        expect(router.state.location.pathname).toBe(path);
      });
      await act(() => router.navigate(-1));
      await waitFor(() => {
        expect(router.state.location.pathname).toBe('/');
      });
      expect(
        await screen.findByRole('heading', { level: 1, name: 'Fortschritt' }),
      ).toBeInTheDocument();
    });

    it('shows each area with its rating from the score – "–" without one', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await calorieGoal(services, profileId, 2000);
          await eat(services, profileId, [['2026-10-02', 2000]]);
        },
      });
      await showProgressPeriod('7 Tage');
      const nutrition = await main().findByRole('link', {
        name: /^Ernährung: \d+ – Bereich öffnen$/,
      });
      const value = nutrition.getAttribute('aria-label')?.match(/\d+/)?.[0];
      expect(within(nutrition).getByText(value ?? '')).toBeInTheDocument();
      const training = main().getByRole('link', {
        name: 'Training: Ohne Bewertung – Bereich öffnen',
      });
      expect(within(training).getByText('–')).toBeInTheDocument();
    });
  });

  describe('calendar: the current week and the two before', () => {
    /** All 21 day cells of the grid (tappable days and days still to come), in grid order. */
    const dayCells = () => [
      ...screen
        .getByRole('region', { name: 'Die letzten Tage' })
        .querySelectorAll<HTMLElement>('[data-date]'),
    ];
    const key = (day: Date) =>
      `${String(day.getFullYear())}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

    it('shows three whole weeks, Monday to Sunday, today included', async () => {
      await renderApp('/');
      await calendarReady();
      expect(calendar().getByRole('heading', { name: 'Die letzten Tage' })).toBeInTheDocument();
      expect(screen.queryByText(/20 Tage/)).not.toBeInTheDocument();
      const cells = dayCells();
      // Saturday, 3 October: Monday 14 September to Sunday 4 October – 21 days, no gaps.
      expect(cells.map((cell) => cell.dataset.date)).toEqual(
        Array.from({ length: 21 }, (_, index) => key(new Date(2026, 8, 14 + index))),
      );
      const grid = cells[0]?.parentElement;
      const children = [...(grid?.children ?? [])];
      expect(children.slice(0, 7).map((cell) => cell.textContent)).toEqual([
        'Mo',
        'Di',
        'Mi',
        'Do',
        'Fr',
        'Sa',
        'So',
      ]);
      // No blank cells: the first day sits right under "Mo", every day under its weekday.
      expect(children[7]).toBe(cells[0]);
      for (const cell of cells) {
        const date = new Date(`${cell.dataset.date ?? ''}T12:00:00`);
        expect((children.indexOf(cell) - 7) % 7).toBe((date.getDay() + 6) % 7);
      }
      // Up to today the days can be opened; Sunday is still to come.
      const buttons = calendar().getAllByRole('button');
      expect(buttons).toHaveLength(20);
      expect(buttons.at(-1)).toHaveAttribute('data-date', '2026-10-03');
      expect(buttons[0]).toHaveAccessibleName(/^Montag, 14\. September/);
    });

    it('keeps the days still to come neutral: no mark, nothing to open', async () => {
      // Wednesday, 30 September: Thursday to Sunday are still to come.
      vi.setSystemTime(new Date(2026, 8, 30, 9));
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await calorieGoal(services, profileId, 2000);
          await completedWorkout(services, profileId, new Date(2026, 8, 30, 7));
          vi.setSystemTime(new Date(2026, 8, 30, 9));
        },
      });
      await calendarReady();
      const future = dayCells().filter((cell) => cell.dataset.future === 'true');
      expect(future.map((cell) => cell.dataset.date)).toEqual([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
        '2026-10-04',
      ]);
      for (const cell of future) {
        expect(cell.tagName).toBe('SPAN');
        expect(cell.querySelector('[data-mark]')).toBeNull();
        expect(cell).not.toHaveAttribute('aria-current');
      }
      expect(future[0]).toHaveTextContent('Donnerstag, 1. Oktober, liegt in der Zukunft');
      await userEvent.click(future[0] as HTMLElement);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      // Today keeps its mark and is the last day that can be opened.
      expect(marks('2026-09-30')).toEqual(['training']);
      expect(calendar().getAllByRole('button').at(-1)).toHaveAttribute('aria-current', 'date');
    });

    it('crosses the turn of the year: weeks from December into January', async () => {
      // Friday, 1 January 2027 → Monday, 14 December 2026 to Sunday, 3 January 2027.
      vi.setSystemTime(new Date(2027, 0, 1, 10));
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await completedWorkout(services, profileId, new Date(2026, 11, 31, 18));
          vi.setSystemTime(new Date(2027, 0, 1, 10));
        },
      });
      await calendarReady();
      const cells = dayCells();
      expect(cells[0]).toHaveAttribute('data-date', '2026-12-14');
      expect(cells.at(-1)).toHaveAttribute('data-date', '2027-01-03');
      expect(new Set(cells.map((cell) => cell.dataset.date)).size).toBe(21);
      expect(calendar().getByText('14.12. – 03.01.')).toBeInTheDocument();
      expect(marks('2026-12-31')).toEqual(['training']);
      expect(dayCell('2027-01-01')).toHaveAttribute('aria-current', 'date');
      expect(calendar().getAllByRole('button')).toHaveLength(19);
    });

    it('uses local days: a workout at 23:30 and the first minutes of the new day', async () => {
      // 00:10 on 3 October: the workout from 23:30 to 23:55 belongs to 2 October.
      vi.setSystemTime(new Date(2026, 9, 3, 0, 10));
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await completedWorkout(services, profileId, new Date(2026, 9, 2, 23, 30), 25);
          vi.setSystemTime(new Date(2026, 9, 3, 0, 10));
        },
      });
      await calendarReady();
      expect(marks('2026-10-02')).toEqual(['training']);
      expect(marks('2026-10-03')).toEqual([]);
      expect(dayCell('2026-10-03')).toHaveAttribute('aria-current', 'date');
    });

    it('marks today clearly and only today', async () => {
      await renderApp('/');
      await calendarReady();
      const current = calendar()
        .getAllByRole('button')
        .filter((cell) => cell.getAttribute('aria-current') === 'date');
      expect(current).toEqual([dayCell('2026-10-03')]);
      expect(dayCell('2026-10-03')).toHaveAttribute('data-today', 'true');
      expect(dayCell('2026-10-03')).toHaveAccessibleName('Samstag, 3. Oktober, heute');
    });

    it('marks training only for completed workouts – once, however many', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          const workouts = services.training.workouts;
          await services.training.exercises.ensureCatalog();
          await completedWorkout(services, profileId, new Date(2026, 9, 1, 8));
          await completedWorkout(services, profileId, new Date(2026, 9, 1, 18));
          // Discarded on 30 September: never a workout.
          vi.setSystemTime(new Date(2026, 8, 30, 18));
          const discarded = await workouts.startFree(profileId);
          await workouts.discard(profileId, discarded.id);
          // Started today and still running: not completed.
          vi.setSystemTime(NOW);
          await workouts.startFree(profileId);
        },
      });
      await calendarReady();
      expect(marks('2026-10-01')).toEqual(['training']);
      expect(marks('2026-09-30')).toEqual([]);
      expect(marks('2026-10-03')).toEqual([]);
      expect(dayCell('2026-10-01')).toHaveAccessibleName('Donnerstag, 1. Oktober, Training');
    });

    it('marks the calorie goal only when it was met, both symbols on one day', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await calorieGoal(services, profileId, 2000);
          await eat(services, profileId, [
            ['2026-09-29', 2000], // in range
            ['2026-09-30', 2600], // +30 %: not met
            ['2026-10-01', 1990], // in range, and trained
          ]);
          await completedWorkout(services, profileId, new Date(2026, 9, 1, 18));
        },
      });
      await calendarReady();
      expect(marks('2026-09-29')).toEqual(['calories']);
      expect(marks('2026-09-30')).toEqual([]);
      expect(marks('2026-10-01')).toEqual(['training', 'calories']);
      expect(dayCell('2026-10-01')).toHaveAccessibleName(
        'Donnerstag, 1. Oktober, Training, Kalorienziel erreicht',
      );
    });

    it('never marks a miss: no red, no negative symbol for missed goals or missing data', async () => {
      const { container } = await renderApp('/', {
        prepare: async (services, profileId) => {
          await calorieGoal(services, profileId, 2000);
          // Not met, and today still below the goal (open).
          await eat(services, profileId, [
            ['2026-09-30', 3000],
            ['2026-10-03', 500],
          ]);
        },
      });
      await calendarReady();
      const region = screen.getByRole('region', { name: 'Die letzten Tage' });
      // Only the two symbols of the legend – no day carries any mark.
      expect(region.querySelectorAll('button [data-mark]')).toHaveLength(0);
      expect(region.querySelectorAll('[data-mark]')).toHaveLength(2);
      for (const mark of region.querySelectorAll('[data-mark]')) {
        expect(['training', 'calories']).toContain((mark as HTMLElement).dataset.mark);
      }
      expect(container.querySelector('main [data-mark="missed"], main [data-error]')).toBeNull();
      expect(within(region).queryByText(/nicht erreicht|verfehlt|fehlt/)).not.toBeInTheDocument();
    });

    it('explains the green symbols in a legend with the same symbols', async () => {
      await renderApp('/');
      await calendarReady();
      const legend = within(calendar().getByRole('list', { name: 'Legende' }));
      const items = legend.getAllByRole('listitem');
      expect(items.map((item) => item.textContent)).toEqual(['Training', 'Kalorienziel erreicht']);
      expect(items[0]?.querySelector('[data-mark="training"]')).not.toBeNull();
      expect(items[1]?.querySelector('[data-mark="calories"]')).not.toBeNull();
    });

    it('opens the details of a day on tap: date, weekday, training, calorie goal', async () => {
      await renderApp('/', {
        prepare: async (services, profileId) => {
          await services.training.exercises.ensureCatalog();
          await calorieGoal(services, profileId, 2000);
          await eat(services, profileId, [
            ['2026-10-01', 2000],
            ['2026-09-30', 2600],
            ['2026-10-03', 400],
          ]);
          await completedWorkout(services, profileId, new Date(2026, 9, 1, 8));
          await completedWorkout(services, profileId, new Date(2026, 9, 1, 18));
        },
      });
      await calendarReady();

      await userEvent.click(dayCell('2026-10-01'));
      let sheet = within(await screen.findByRole('dialog', { name: 'Donnerstag, 1. Oktober' }));
      expect(sheet.getByText('2 Trainings abgeschlossen')).toBeInTheDocument();
      expect(sheet.getByText('Kalorienziel erreicht')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      // A day without data: neutral, never "missed".
      await userEvent.click(dayCell('2026-09-20'));
      sheet = within(await screen.findByRole('dialog', { name: 'Sonntag, 20. September' }));
      expect(sheet.getByText('Kein abgeschlossenes Training erfasst')).toBeInTheDocument();
      expect(sheet.getByText('Keine Ernährungseinträge erfasst')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');

      // A goal not met is said plainly, in neutral grey – no red, no symbol of failure.
      await userEvent.click(dayCell('2026-09-30'));
      sheet = within(await screen.findByRole('dialog', { name: 'Mittwoch, 30. September' }));
      expect(sheet.getByText('Kalorienziel an diesem Tag nicht erreicht')).toBeInTheDocument();
      expect(screen.getByRole('dialog').querySelector('[data-mark="calories"]')).toHaveAttribute(
        'data-off',
        'true',
      );
      await userEvent.keyboard('{Escape}');

      // Today below the goal is still running.
      await userEvent.click(dayCell('2026-10-03'));
      sheet = within(await screen.findByRole('dialog', { name: 'Samstag, 3. Oktober' }));
      expect(sheet.getByText('Der Tag läuft noch – noch nicht bewertet')).toBeInTheDocument();
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
