import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/renderApp';

/** Phase 17.4: the workout in progress is a mode of its own. */

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

const nav = () => screen.queryByRole('navigation', { name: 'Hauptnavigation' });
const dialog = () => within(screen.getByRole('dialog'));

async function closedDialog() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

async function startFreeWorkout() {
  await userEvent.click(await screen.findByRole('button', { name: 'Training starten' }));
  await userEvent.click(dialog().getByRole('button', { name: /^Freies Training/ }));
  await closedDialog();
  await screen.findByText('Laufendes Training');
}

describe('active workout mode', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('hides the tab bar during the workout and brings it back outside', async () => {
    const { router } = await renderApp('/training');
    expect(nav()).toBeInTheDocument();
    await startFreeWorkout();
    expect(router.state.location.pathname).toBe('/training/workout');
    expect(nav()).not.toBeInTheDocument();

    // Back to Training: the workout keeps running, the navigation is there again.
    await userEvent.click(screen.getByRole('link', { name: 'Training' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/training');
    });
    expect(nav()).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Fortsetzen' })).toBeInTheDocument();
  });

  it('offers finishing in the header and discarding only behind "Mehr" with a confirmation', async () => {
    const { services } = await renderApp('/training');
    await startFreeWorkout();
    const header = within(screen.getByRole('banner'));
    // The primary action sits next to the title; no destructive button on the screen itself.
    expect(header.getByRole('button', { name: 'Training beenden' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Training verwerfen' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Titel und Notizen' })).not.toBeInTheDocument();

    await userEvent.click(header.getByRole('button', { name: 'Mehr' }));
    expect(dialog().getByRole('button', { name: 'Titel und Notizen' })).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Training verwerfen' }));
    // Still a confirmation – cancelling keeps the workout.
    expect(dialog().getByRole('heading', { name: /verwerfen/i })).toBeInTheDocument();
    await userEvent.click(dialog().getByRole('button', { name: 'Abbrechen' }));
    await closedDialog();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    expect(await services.training.workouts.getActive(profileId)).not.toBeNull();

    await userEvent.click(header.getByRole('button', { name: 'Mehr' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Training verwerfen' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Training verwerfen' }));
    await screen.findByRole('heading', { level: 1, name: 'Training' });
    expect(await services.training.workouts.getActive(profileId)).toBeNull();
    expect(nav()).toBeInTheDocument();
  });

  it('opens title and notes from "Mehr"', async () => {
    await renderApp('/training');
    await startFreeWorkout();
    await userEvent.click(screen.getByRole('button', { name: 'Mehr' }));
    await userEvent.click(dialog().getByRole('button', { name: 'Titel und Notizen' }));
    expect(await screen.findByRole('dialog', { name: 'Titel und Notizen' })).toBeInTheDocument();
  });

  it('names the second start option "Anderes Training" next to the next workout', async () => {
    await renderApp('/training', {
      prepare: async (services, profileId) => {
        await services.training.exercises.ensureCatalog();
        const plan = await services.training.plans.createPlan(profileId, 'Plan');
        await services.training.plans.addDay(profileId, plan.id, 'Push');
      },
    });
    expect(await screen.findByText('Push · Plan')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Starten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anderes Training' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Training starten' })).not.toBeInTheDocument();
  });
});
