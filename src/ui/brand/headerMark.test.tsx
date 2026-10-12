import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TRAINING_LINKS } from '@/app/routes';
import { renderApp } from '@/test/renderApp';

/**
 * The Kalethra symbol at the top right of every normal page (Phase 23): one shared header
 * (`Screen`), decorative, never a second logo, never in the way of back links and actions.
 */
const NOW = new Date(2026, 9, 3, 10);

/** The brand marks in the page header (not in the content). */
function headerMarks() {
  return [...document.querySelectorAll('main > header [data-brand="symbol"]')];
}

describe('brand mark in the page header', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    ['/', 'Fortschritt'],
    ['/training', 'Training'],
    ['/nutrition', 'Ernährung'],
    ['/health', 'Gesundheit'],
    ['/settings', 'Einstellungen'],
  ])('top-level page %s: at the end of the title row, once', async (path, title) => {
    await renderApp(path);
    const heading = await screen.findByRole('heading', { level: 1, name: title });
    const marks = headerMarks();
    expect(marks).toHaveLength(1);
    expect(marks[0]?.closest('div')).toBe(heading.parentElement);
    // The last element of the row: right of the title.
    expect(heading.parentElement?.lastElementChild).toContainElement(marks[0] as HTMLElement);
    expect(marks[0]).toHaveAttribute('aria-hidden', 'true');
    expect(marks[0]?.closest('a, button')).toBeNull();
    expect(document.querySelectorAll('[data-brand]')).toHaveLength(1);
  });

  it.each([
    ['/settings/profile', 'Profil', 'Einstellungen'],
    ['/settings/goals', 'Ziele', 'Einstellungen'],
    ['/settings/content', 'Meine Inhalte', 'Einstellungen'],
    ['/training/activities', 'Aktivitäten', 'Training'],
  ])(
    'sub page %s: right of the back link, the back link still works',
    async (path, title, back) => {
      const { router } = await renderApp(path);
      await screen.findByRole('heading', { level: 1, name: title });
      const marks = headerMarks();
      expect(marks).toHaveLength(1);
      const link = within(screen.getByRole('main')).getByRole('link', { name: back });
      // Same row as the back link, after it.
      expect(link.parentElement).toContainElement(marks[0] as HTMLElement);
      expect(
        link.compareDocumentPosition(marks[0] as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      // Not part of the link: tapping the mark does nothing, the link is unchanged.
      expect(link).not.toContainElement(marks[0] as HTMLElement);
      expect(link).toHaveAccessibleName(back);
      await userEvent.click(link);
      expect(router.state.location.pathname).not.toBe(path);
    },
  );

  it('is not shown twice: Einstellungen → App has the full logo under "Über Kalethra"', async () => {
    await renderApp('/settings/app');
    await screen.findByRole('heading', { level: 1, name: 'App' });
    expect(headerMarks()).toHaveLength(0);
    const about = within(await screen.findByRole('region', { name: 'Über Kalethra' }));
    expect(about.getByRole('img', { name: 'Kalethra' })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-brand="symbol"]')).toHaveLength(1);
  });

  it('active workout: in the back row, never between the title and its controls', async () => {
    await renderApp(TRAINING_LINKS.activeWorkout, {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        await services.training.workouts.startFree(profileId);
      },
    });
    const heading = await screen.findByRole('heading', { level: 1 });
    const finish = await screen.findByRole('button', { name: 'Training beenden' });
    const more = screen.getByRole('button', { name: 'Mehr' });
    const marks = headerMarks();
    expect(marks).toHaveLength(1);
    // The title row holds only the title and the workout controls – the mark is above it.
    const row = heading.parentElement;
    expect(row).toContainElement(finish);
    expect(row).toContainElement(more);
    expect(row).not.toContainElement(marks[0] as HTMLElement);
    expect(
      within(screen.getByRole('main')).getByRole('link', { name: 'Training' }).parentElement,
    ).toContainElement(marks[0] as HTMLElement);
    // The controls work as before.
    await userEvent.click(finish);
    expect(await screen.findByRole('dialog', { name: 'Training beenden?' })).toBeInTheDocument();
  });
});
