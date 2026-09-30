import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toKg } from '@/core/health';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

async function weightRows(db: Awaited<ReturnType<typeof renderApp>>['db']) {
  return db.query<{ date: string; value: number }>(
    'SELECT date, value FROM weight_entries ORDER BY date',
  );
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

describe('weight tracking', () => {
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

  it('adds today’s weight and shows it everywhere', async () => {
    const { db } = await renderApp('/health');
    expect(await screen.findByText('Noch kein Gewicht eingetragen.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Gewicht eintragen' }));
    expect(dialog().getByText('Samstag, 3. Oktober')).toBeInTheDocument();
    await userEvent.type(dialog().getByLabelText('Gewicht in kg'), '82,4');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findAllByText('82,4 kg')).toHaveLength(2); // overview + history
    expect(await weightRows(db)).toEqual([{ date: '2026-10-03', value: 82.4 }]);
  });

  it.each([
    ['', 'Bitte gib ein Gewicht ein.'],
    ['abc', 'Bitte gib eine gültige Zahl ein, zum Beispiel 82,4.'],
    ['82,45', 'Bitte höchstens eine Nachkommastelle eingeben.'],
    ['0', 'Bitte einen Wert zwischen 20 und 400 kg eingeben.'],
    ['500', 'Bitte einen Wert zwischen 20 und 400 kg eingeben.'],
  ])('rejects %j with a clear message', async (input, message) => {
    const { db } = await renderApp('/health');
    await userEvent.click(await screen.findByRole('button', { name: 'Gewicht eintragen' }));
    const field = dialog().getByLabelText('Gewicht in kg');
    if (input) await userEvent.type(field, input);
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));

    expect(dialog().getByRole('alert')).toHaveTextContent(message);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(await weightRows(db)).toEqual([]);
  });

  it('replaces the value of a day instead of duplicating it', async () => {
    const { db } = await renderApp('/health', {
      prepare: async (services, profileId) => {
        await services.weight.save(profileId, '2026-10-03', 82.4);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Gewicht eintragen' }));
    expect(dialog().getByText(/bereits 82,4 kg eingetragen/)).toBeInTheDocument();
    const field = dialog().getByLabelText('Gewicht in kg');
    expect(field).toHaveValue('82,4');

    await userEvent.clear(field);
    await userEvent.type(field, '81,9');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));

    await waitFor(async () => {
      expect(await weightRows(db)).toEqual([{ date: '2026-10-03', value: 81.9 }]);
    });
  });

  it('edits and deletes entries from the history after confirmation', async () => {
    const { db } = await renderApp('/health', {
      prepare: async (services, profileId) => {
        await services.weight.save(profileId, '2026-10-01', 83);
        await services.weight.save(profileId, '2026-10-02', 82.7);
      },
    });
    const history = within(await screen.findByRole('list', { name: 'Verlauf' }));
    const rows = history.getAllByRole('button');
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('82,7 kg'),
      expect.stringContaining('83,0 kg'),
    ]);

    await userEvent.click(history.getByRole('button', { name: /83,0 kg/ }));
    expect(dialog().getByRole('heading', { name: 'Gewicht bearbeiten' })).toBeInTheDocument();
    await userEvent.clear(dialog().getByLabelText('Gewicht in kg'));
    await userEvent.type(dialog().getByLabelText('Gewicht in kg'), '83,5');
    await userEvent.click(dialog().getByRole('button', { name: 'Speichern' }));
    expect(await screen.findByRole('button', { name: /83,5 kg/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /83,5 kg/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Gewicht löschen' }));
    expect(
      dialog().getByText('83,5 kg vom Donnerstag, 1. Oktober wird dauerhaft gelöscht.'),
    ).toBeVisible();
    await userEvent.click(dialog().getByRole('button', { name: 'Löschen' }));

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /83,5 kg/ })).not.toBeInTheDocument();
    });
    expect(await weightRows(db)).toEqual([{ date: '2026-10-02', value: 82.7 }]);
  });

  it('keeps the entry when deletion is cancelled', async () => {
    const { db } = await renderApp('/health', {
      prepare: async (services, profileId) => {
        await services.weight.save(profileId, '2026-10-02', 82.7);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: /82,7 kg/ }));
    await userEvent.click(dialog().getByRole('button', { name: 'Gewicht löschen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }));
    expect(dialog().getByRole('heading', { name: 'Gewicht bearbeiten' })).toBeInTheDocument();
    expect(await weightRows(db)).toHaveLength(1);
  });

  it('draws a chart once the period has two entries', async () => {
    await renderApp('/health', {
      prepare: async (services, profileId) => {
        await services.weight.save(profileId, '2026-09-20', 84);
        await services.weight.save(profileId, '2026-10-03', 82.4);
      },
    });
    expect(
      await screen.findByRole('img', { name: /Gewichtsverlauf vom Sonntag, 20\. September/ }),
    ).toBeInTheDocument();
    expect(screen.getByText(/−1,6 kg|-1,6 kg/)).toBeInTheDocument();
  });

  it('works in English with pounds', async () => {
    const { db } = await renderApp('/health', {
      prepare: async (services) => {
        await services.settings.update('language', 'en');
        await services.settings.update('weightUnit', 'lb');
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Add weight' }));
    await userEvent.type(dialog().getByLabelText('Weight in lb'), '181.7');
    await userEvent.click(dialog().getByRole('button', { name: 'Save' }));

    expect(await screen.findAllByText('181.7 lb')).toHaveLength(2);
    const [row] = await weightRows(db);
    expect(row?.value).toBeCloseTo(toKg(181.7, 'lb'), 10);
  });

  it('states truthfully whether weight data is encrypted', async () => {
    await renderApp('/health');
    expect(
      await screen.findByText(
        'Gewichtsdaten werden verschlüsselt und nur auf diesem Gerät gespeichert.',
      ),
    ).toBeInTheDocument();
  });

  it('does not claim encryption in the browser development mode', async () => {
    await renderApp('/health', {
      security: { encrypted: false, outcome: 'development-unencrypted', cipherVersion: null },
    });
    expect(await screen.findByText(/Browser-Entwicklungsmodus/)).toBeInTheDocument();
    expect(screen.queryByText(/werden verschlüsselt/)).not.toBeInTheDocument();
  });

  it('renders in dark mode', async () => {
    await renderApp('/health', {
      prepare: async (services) => {
        await services.settings.update('theme', 'dark');
      },
    });
    expect(await screen.findByRole('button', { name: 'Gewicht eintragen' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('weight entry links', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('never opens an entry for a future day from a link', async () => {
    await renderApp('/health?add=2026-10-10');
    expect(await screen.findByRole('button', { name: 'Gewicht eintragen' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
