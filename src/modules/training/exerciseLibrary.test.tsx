import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/renderApp';

const NOW = new Date(2026, 9, 3, 10);

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closedDialog() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

function textFieldFocused() {
  const active = document.activeElement;
  return (
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLInputElement && !['button', 'checkbox', 'radio'].includes(active.type))
  );
}

function resultNames() {
  return within(dialog().getByRole('list', { name: /^(Alle Übungen|Ergebnisse)$/ }))
    .getAllByRole('button')
    .map((row) => row.textContent);
}

describe('exercise library', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function openPicker() {
    await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
    await userEvent.click(dialog().getByRole('button', { name: /^Freies Training/ }));
    await closedDialog();
    await userEvent.click(await screen.findByRole('button', { name: 'Übung hinzufügen' }));
  }

  it('filters by muscle group and equipment without opening the keyboard', async () => {
    await renderApp('/training');
    await openPicker();
    expect(textFieldFocused()).toBe(false);

    const muscles = within(dialog().getByRole('group', { name: 'Nach Muskelgruppe filtern' }));
    const equipment = within(dialog().getByRole('group', { name: 'Nach Ausrüstung filtern' }));
    await userEvent.click(muscles.getByRole('button', { name: 'Brust' }));
    expect(muscles.getByRole('button', { name: 'Brust' })).toHaveAttribute('aria-pressed', 'true');
    // Tapping a chip never focuses the search field.
    expect(textFieldFocused()).toBe(false);
    const chest = resultNames();
    expect(chest.length).toBeGreaterThan(15);
    expect(chest).toEqual(expect.arrayContaining([expect.stringContaining('Brustpresse')]));

    await userEvent.click(equipment.getByRole('button', { name: 'Kurzhantel' }));
    const both = resultNames();
    expect(both.length).toBeGreaterThan(3);
    expect(both.length).toBeLessThan(chest.length);
    expect(both.every((name) => name.includes('Kurzhantel'))).toBe(true);

    await userEvent.type(dialog().getByRole('searchbox'), 'schräg');
    expect(resultNames().every((name) => /Schräg/i.test(name))).toBe(true);

    // Nothing found: a single tap resets search and filters.
    await userEvent.type(dialog().getByRole('searchbox'), 'xyz');
    expect(dialog().getByText('Keine passende Übung gefunden.')).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Filter zurücksetzen' }));
    expect(dialog().getByRole('searchbox')).toHaveValue('');
    expect(muscles.getByRole('button', { name: 'Alle Muskeln' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('finds exercises by alias and adds them to the workout', async () => {
    await renderApp('/training');
    await openPicker();
    await userEvent.type(dialog().getByRole('searchbox'), 'RDL');
    expect(resultNames()[0]).toMatch(/^Rumänisches Kreuzheben/);
    await userEvent.click(
      dialog().getByRole('button', { name: /^Rumänisches KreuzhebenLanghantel/ }),
    );
    await closedDialog();
    expect(
      await screen.findByRole('article', { name: 'Rumänisches Kreuzheben' }),
    ).toBeInTheDocument();
  });

  it('marks favourites in the library and lists them first in the picker', async () => {
    await renderApp('/settings/content/exercises');
    await userEvent.type(await screen.findByRole('searchbox'), 'face pull');
    await userEvent.click(screen.getByRole('button', { name: /^Face PullsKabelzug/ }));

    // Detail view: names, muscles, equipment, description – no images.
    expect(dialog().getByRole('heading', { name: 'Face Pulls' })).toBeInTheDocument();
    expect(dialog().getByText('Schultern')).toBeInTheDocument();
    expect(dialog().getByText('Rücken')).toBeInTheDocument();
    expect(dialog().getByText('Kabelzug')).toBeInTheDocument();
    expect(dialog().getByText(/Seil zum Gesicht/)).toBeInTheDocument();
    expect(dialog().queryByRole('img')).not.toBeInTheDocument();
    expect(textFieldFocused()).toBe(false);

    await userEvent.click(dialog().getByRole('button', { name: 'Als Favorit markieren' }));
    expect(dialog().getByRole('button', { name: 'Favorit entfernen' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.keyboard('{Escape}');
    await closedDialog();
    expect(
      await screen.findByRole('button', { name: /^Face PullsKabelzug.*Favorit$/ }),
    ).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole('navigation', { name: 'Hauptnavigation' })).getByRole('link', {
        name: 'Training',
      }),
    );
    await openPicker();
    const favorites = within(await dialog().findByRole('list', { name: 'Favoriten' }));
    expect(favorites.getAllByRole('button').map((row) => row.textContent)).toEqual([
      expect.stringMatching(/^Face Pulls/),
    ]);
  });

  it('shows library exercises as read-only and keeps own exercises editable', async () => {
    await renderApp('/settings/content/exercises');
    await userEvent.type(await screen.findByRole('searchbox'), 'latzug');
    await userEvent.click(screen.getByRole('button', { name: /^LatzugKabelzug/ }));
    expect(
      dialog().getByText(/Übung aus der Bibliothek\. Sie kann nicht bearbeitet werden/),
    ).toBeInTheDocument();
    expect(dialog().queryByRole('textbox')).not.toBeInTheDocument();
  });
});
