import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeHealthPlatform, localIso } from '@/test/fakeHealthPlatform';
import { renderApp } from '@/test/renderApp';

const NOW = new Date(2026, 9, 3, 10, 0);

function section() {
  return within(screen.getByRole('region', { name: 'Gesundheitsdaten' }));
}

function dialog() {
  return within(screen.getByRole('dialog'));
}

function filled() {
  const platform = new FakeHealthPlatform();
  platform.weights = [
    { id: 'a', measuredAt: localIso(2026, 10, 2, 8, 2), kg: 92.4, source: 'Waage' },
    { id: 'b', measuredAt: localIso(2026, 10, 2, 18, 10), kg: 93.1, source: 'Waage' },
  ];
  platform.steps = [{ dayStart: localIso(2026, 10, 3), value: 6543 }];
  platform.activeEnergy = [{ dayStart: localIso(2026, 10, 3), value: 321 }];
  return platform;
}

async function openConnection() {
  await userEvent.click(await section().findByRole('button', { name: /^Health Connect/ }));
  return dialog();
}

describe('Health Connect settings', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is not connected by default and explains everything before the system dialog', async () => {
    const platform = filled();
    await renderApp('/profile', { healthPlatform: platform });
    expect(await section().findByText('Nicht verbunden')).toBeInTheDocument();

    const sheet = await openConnection();
    expect(sheet.getByText(/ausschließlich für deine persönliche Übersicht/)).toBeVisible();
    expect(sheet.getByText('Kalethra schreibt nichts in Health Connect.')).toBeVisible();
    expect(sheet.getByText(/an keinen Server/)).toBeVisible();
    expect(
      sheet.getByText(/Ernährungsziele richten sich weiter nur nach deinen eigenen/),
    ).toBeVisible();
    for (const kind of ['Gewicht', 'Schritte', 'Aktive Kalorien', 'Trainings']) {
      expect(sheet.getByText(kind)).toBeInTheDocument();
    }
    expect(sheet.getByText(/wird noch nicht importiert/)).toBeInTheDocument();
    // Nothing was asked from Health Connect yet.
    expect(platform.calls.request).toBe(0);

    await userEvent.click(sheet.getByRole('button', { name: 'Mit Health Connect verbinden' }));
    expect(platform.calls.request).toBe(1);
    expect(await dialog().findByText('Verbunden')).toBeInTheDocument();
    expect(dialog().getByText(/Zuletzt aktualisiert:/)).toBeInTheDocument();
    expect(dialog().getAllByText('Aktiv')).toHaveLength(3);
    expect(section().getByText('Verbunden')).toBeInTheDocument();
  });

  it('explains a denied permission and stays disconnected', async () => {
    const platform = filled();
    platform.grantOnRequest = [];
    await renderApp('/profile', { healthPlatform: platform });
    const sheet = await openConnection();
    await userEvent.click(sheet.getByRole('button', { name: 'Mit Health Connect verbinden' }));
    expect(
      await dialog().findByText(/Ohne Freigabe kann Kalethra keine Daten lesen/),
    ).toBeVisible();
    expect(section().getByText('Nicht verbunden')).toBeInTheDocument();
  });

  it('explains when Health Connect is not available or not installed', async () => {
    const platform = filled();
    platform.available = { kind: 'needsInstall' };
    const view = await renderApp('/profile', { healthPlatform: platform });
    expect(await section().findByText('Nicht installiert')).toBeInTheDocument();
    expect((await openConnection()).getByText(/aus dem Google Play Store/)).toBeVisible();
    view.unmount();

    await renderApp('/profile');
    expect(await section().findByText('Nicht verfügbar')).toBeInTheDocument();
    expect(
      (await openConnection()).getByText(/Auf diesem Gerät gibt es Health Connect nicht/),
    ).toBeVisible();
  });

  it('shows "syncing" while a manual sync runs, then the last sync', async () => {
    const platform = filled();
    await renderApp('/profile', {
      healthPlatform: platform,
      prepare: async (services, profileId) => {
        await services.healthSync.connect(profileId);
      },
    });
    const sheet = await openConnection();
    expect(await sheet.findByText('Verbunden')).toBeInTheDocument();

    let release: () => void = () => undefined;
    platform.gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await userEvent.click(sheet.getByRole('button', { name: 'Jetzt synchronisieren' }));
    expect(await sheet.findByRole('button', { name: 'Wird synchronisiert …' })).toBeDisabled();
    expect(sheet.getByRole('status')).toHaveTextContent('Synchronisierung läuft');
    platform.gate = null;
    release();
    expect(await sheet.findByRole('button', { name: 'Jetzt synchronisieren' })).toBeEnabled();
    expect(sheet.getByRole('status')).toHaveTextContent(/Verbunden.*Zuletzt aktualisiert/);
  });

  it('shows a failed sync without hiding the existing data', async () => {
    const platform = filled();
    await renderApp('/profile', {
      healthPlatform: platform,
      prepare: async (services, profileId) => {
        await services.healthSync.connect(profileId);
        const { HealthPlatformError } = await import('@/core/platform/health');
        platform.failures.set('steps', new HealthPlatformError('failed'));
        await services.healthSync.sync(profileId, { manual: true });
      },
    });
    expect(await section().findByText('Letzte Aktualisierung fehlgeschlagen')).toBeInTheDocument();
    const sheet = await openConnection();
    expect(sheet.getByText(/bisher importierten Werte bleiben unverändert erhalten/)).toBeVisible();
  });

  it('asks before disconnecting, with deleting pre-selected', async () => {
    const platform = filled();
    const { db } = await renderApp('/profile', {
      healthPlatform: platform,
      prepare: async (services, profileId) => {
        await services.healthSync.connect(profileId);
      },
    });
    const sheet = await openConnection();
    await userEvent.click(await sheet.findByRole('button', { name: 'Verbindung trennen' }));
    const confirm = dialog();
    expect(confirm.getByRole('heading', { name: 'Verbindung trennen?' })).toBeInTheDocument();
    const checkbox = confirm.getByRole('checkbox', {
      name: 'Importierte Daten aus Health Connect löschen',
    });
    expect(checkbox).toBeChecked();
    expect(
      confirm.getByText(/eigenen Gewichtseinträge, Trainings und Ernährungsdaten bleiben/),
    ).toBeVisible();
    await userEvent.click(confirm.getByRole('button', { name: 'Trennen' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await section().findByText('Nicht verbunden')).toBeInTheDocument();
    expect(await db.query('SELECT * FROM imported_weights')).toEqual([]);
  });

  it('keeps the imported data when deleting is unticked', async () => {
    const platform = filled();
    const { db } = await renderApp('/profile', {
      healthPlatform: platform,
      prepare: async (services, profileId) => {
        await services.healthSync.connect(profileId);
      },
    });
    const sheet = await openConnection();
    await userEvent.click(await sheet.findByRole('button', { name: 'Verbindung trennen' }));
    await userEvent.click(dialog().getByRole('checkbox'));
    await userEvent.click(dialog().getByRole('button', { name: 'Trennen' }));
    expect(await section().findByText('Nicht verbunden')).toBeInTheDocument();
    expect(await db.query('SELECT value FROM imported_weights')).toEqual([{ value: 92.4 }]);
  });
});

describe('imported values on the health screen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is hidden when not connected', async () => {
    await renderApp('/health', { healthPlatform: filled() });
    await screen.findByRole('heading', { level: 1, name: 'Gesundheit' });
    expect(screen.queryByRole('region', { name: 'Aus Health Connect' })).not.toBeInTheDocument();
  });

  it('shows steps, active calories and the imported weight apart from the own weight', async () => {
    const platform = filled();
    await renderApp('/health', {
      healthPlatform: platform,
      prepare: async (services, profileId) => {
        await services.healthSync.connect(profileId);
        await services.weight.save(profileId, '2026-10-02', 91.0);
      },
    });
    const region = within(await screen.findByRole('region', { name: 'Aus Health Connect' }));
    expect(await region.findByText('6.543 Schritte')).toBeInTheDocument();
    expect(region.getByText('321 kcal')).toBeInTheDocument();
    expect(region.getByText('92,4 kg · 02.10.')).toBeInTheDocument();
    expect(region.getByText('Dein eigener Eintrag für diesen Tag hat Vorrang')).toBeInTheDocument();
    expect(
      region.getByText(/verändern weder deine Gewichtseinträge noch deine Ernährungsziele/),
    ).toBeVisible();
    // The own weight history is unchanged: only the manual 91,0 kg.
    expect(screen.getAllByText(/91,0 kg/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/93,1 kg/)).not.toBeInTheDocument();
  });
});
