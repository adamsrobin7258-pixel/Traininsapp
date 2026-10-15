import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FakeHealthExport } from '@/test/fakeHealthExport';
import { renderApp } from '@/test/renderApp';

/** Einstellungen → App → Health Connect: the optional export of own workouts and activities. */
const NOW = new Date(2026, 9, 15, 10, 0);

const exportSection = () => within(screen.getByRole('region', { name: 'Health Connect' }));
const toggle = () =>
  exportSection().getByRole('switch', { name: 'Mit Health Connect synchronisieren' });
const dialog = () => within(screen.getByRole('dialog'));
/** The section appears once Health Connect was checked (asynchronously). */
const shownSection = async () =>
  within(await screen.findByRole('region', { name: 'Health Connect' }));

describe('Health Connect export setting', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is not shown without Health Connect (iOS, web)', async () => {
    await renderApp('/settings/app');
    expect(await screen.findByRole('region', { name: 'Gesundheitsdaten' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Health Connect' })).not.toBeInTheDocument();
  });

  it('is off by default – Health Connect being there turns nothing on', async () => {
    const store = new FakeHealthExport();
    store.granted = true; // even with the permission already granted
    await renderApp('/settings/app', { healthExportPlatform: store });
    expect(
      (await shownSection()).getByText(
        'Trainings und Aktivitäten aus Kalethra mit Health Connect synchronisieren.',
      ),
    ).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(exportSection().getByText(/Kalethra überträgt nichts/)).toBeInTheDocument();
    expect(store.requests).toBe(0);
  });

  it('turning on asks for the permission and shows "Verbunden"; turning off keeps everything', async () => {
    const store = new FakeHealthExport();
    const { services } = await renderApp('/settings/app', { healthExportPlatform: store });
    await userEvent.click(await waitFor(toggle));
    await waitFor(() => {
      expect(toggle()).toHaveAttribute('aria-checked', 'true');
    });
    expect(store.requests).toBe(1);
    expect(exportSection().getByText('Verbunden')).toBeInTheDocument();
    expect(
      exportSection().getByRole('button', { name: 'Health-Connect-Berechtigungen verwalten' }),
    ).toBeInTheDocument();
    await userEvent.click(toggle());
    await waitFor(() => {
      expect(toggle()).toHaveAttribute('aria-checked', 'false');
    });
    expect((await services.healthExport.setting()).enabled).toBe(false);
  });

  it('a refused permission keeps it off with a calm note – nothing blocks', async () => {
    const store = new FakeHealthExport();
    store.grantOnRequest = false;
    await renderApp('/settings/app', { healthExportPlatform: store });
    await userEvent.click(await waitFor(toggle));
    expect(
      await exportSection().findByText(/Ohne Berechtigung kann Kalethra nichts übertragen/),
    ).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('a permission revoked later: "Berechtigung erforderlich" and a way to grant it again', async () => {
    const store = new FakeHealthExport();
    await renderApp('/settings/app', {
      healthExportPlatform: store,
      prepare: async (services, profileId) => {
        await services.healthExport.enable(profileId);
        store.granted = false;
      },
    });
    expect(
      await (await shownSection()).findByText('Berechtigung erforderlich'),
    ).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(exportSection().getByRole('button', { name: 'Berechtigung erteilen' }));
    expect(await exportSection().findByText('Verbunden')).toBeInTheDocument();
  });

  it('sessions granted, calories and distance not: "ohne Kalorien oder Distanz" and a way to allow them', async () => {
    const store = new FakeHealthExport();
    store.grantOnRequest = ['exercise'];
    await renderApp('/settings/app', { healthExportPlatform: store });
    await userEvent.click(await waitFor(toggle));
    expect(
      await exportSection().findByText('Verbunden – ohne Kalorien oder Distanz'),
    ).toBeInTheDocument();
    expect(toggle()).toHaveAttribute('aria-checked', 'true');
    store.grantOnRequest = true;
    await userEvent.click(
      exportSection().getByRole('button', { name: 'Kalorien und Distanz erlauben' }),
    );
    expect(await exportSection().findByText('Verbunden')).toBeInTheDocument();
    expect(store.requests).toBe(2);
  });

  it('finishing a workout writes it once to Health Connect, after it is saved', async () => {
    const store = new FakeHealthExport();
    const { services } = await renderApp('/training', {
      healthExportPlatform: store,
      prepare: async (s, profileId) => {
        await s.healthExport.enable(profileId);
      },
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
    await userEvent.click(dialog().getByRole('button', { name: /^Freies Training/ }));
    await screen.findByText('Laufendes Training');
    vi.setSystemTime(new Date(NOW.getTime() + 45 * 60_000));
    const header = within(screen.getByRole('banner'));
    await userEvent.click(header.getByRole('button', { name: 'Training beenden' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Training beenden' }));
    await waitFor(() => {
      expect(store.sessions.size).toBe(1);
    });
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const [finished] = await services.training.workouts.completedSince(profileId, '2026-10-01');
    expect(finished?.status).toBe('completed');
    expect([...store.sessions.values()][0]).toMatchObject({
      clientRecordId: `kalethra:workout:${finished?.id ?? ''}`,
      exerciseType: 'strengthTraining',
    });
  });

  it('a failing Health Connect never stops finishing a workout', async () => {
    const store = new FakeHealthExport();
    const { services, router } = await renderApp('/training', {
      healthExportPlatform: store,
      prepare: async (s, profileId) => {
        await s.healthExport.enable(profileId);
      },
    });
    store.failWith = 'failed';
    await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
    await userEvent.click(dialog().getByRole('button', { name: /^Freies Training/ }));
    await screen.findByText('Laufendes Training');
    vi.setSystemTime(new Date(NOW.getTime() + 30 * 60_000));
    await userEvent.click(
      within(screen.getByRole('banner')).getByRole('button', { name: 'Training beenden' }),
    );
    await userEvent.click(dialog().getByRole('button', { name: 'Training beenden' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/^\/training\/workouts\//);
    });
    const profileId = (await services.profile.ensureLocalProfile()).id;
    expect(await services.training.workouts.completedSince(profileId, '2026-10-01')).toHaveLength(
      1,
    );
    await waitFor(async () => {
      expect((await services.healthExport.state(profileId)).waiting).toBe(1);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
