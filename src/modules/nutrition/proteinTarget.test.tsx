import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { renderApp } from '@/test/renderApp';

// Saturday, 3 October 2026, 10:00 local time
const NOW = new Date(2026, 9, 3, 10);

function dialog() {
  return within(screen.getByRole('dialog'));
}

async function closed() {
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
}

/** 177 cm, the same weight every day of the last week, automatic profile "lose moderately". */
function person(kg: number) {
  return async (services: AppServices, profileId: string) => {
    const profile = await services.profile.ensureLocalProfile();
    await services.profile.updateBodyData(profile, {
      sex: 'male',
      birthDate: '1990-05-01',
      heightCm: 177,
    });
    for (let day = 27; day <= 30; day++)
      await services.weight.save(profileId, `2026-09-${String(day)}`, kg);
    for (let day = 1; day <= 3; day++)
      await services.weight.save(profileId, `2026-10-0${String(day)}`, kg);
    await services.nutrition.goals.saveProfile(profileId, {
      params: {
        goalType: 'lose',
        goalLevel: 'moderate',
        activityLevel: 'moderate',
        includeTraining: false,
        targetWeightKg: null,
      },
      overrides: {},
      waterMl: null,
    });
  };
}

function proteinRow() {
  return within(screen.getByRole('list', { name: 'Deine Tagesziele' })).getByRole('button', {
    name: /^Protein/,
  });
}

describe('protein target', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('explains a capped reference weight without presenting it as the body weight', async () => {
    await renderApp('/nutrition/profile', { prepare: person(92) });
    await screen.findByRole('list', { name: 'Deine Tagesziele' });
    expect(proteinRow()).toHaveAccessibleName(
      /^Protein\s*Automatisch · 1,6 g pro kg Referenzgewicht · 86,2 kg\s*138 g$/,
    );
    expect(
      screen.getByText(
        /Dein Trendgewicht liegt bei 92,0 kg\. Das Referenzgewicht für Protein ist bei BMI 27,5 begrenzt \(86,2 kg\)/,
      ),
    ).toBeVisible();
  });

  it('shows the body weight and no note when nothing is capped', async () => {
    await renderApp('/nutrition/profile', { prepare: person(75) });
    await screen.findByRole('list', { name: 'Deine Tagesziele' });
    expect(proteinRow()).toHaveAccessibleName(
      /^Protein\s*Automatisch · 1,6 g pro kg Körpergewicht · 75,0 kg\s*120 g$/,
    );
    expect(screen.queryByText(/Referenzgewicht für Protein ist bei BMI 27,5 begrenzt/)).toBeNull();
  });

  it('sets a custom target that is saved at once and can be reset to automatic', async () => {
    const { services } = await renderApp('/nutrition/profile', { prepare: person(92) });
    const profileId = (await services.profile.ensureLocalProfile()).id;
    const stored = async () =>
      (await services.nutrition.goals.goalFor(profileId, '2026-10-03'))?.goal.targets.proteinG;

    await userEvent.click(await screen.findByRole('button', { name: /^Protein/ }));
    expect(dialog().getByText(/^Automatisch: Kalethra berechnet dein Protein-Ziel/)).toBeVisible();
    expect(
      dialog().getByText(/Referenzgewicht für Protein ist bei BMI 27,5 begrenzt/),
    ).toBeVisible();
    expect(dialog().getByText('Automatisch: 138 g')).toBeInTheDocument();
    expect(dialog().getByText(/Dein eigener Wert wird sofort gespeichert/)).toBeInTheDocument();
    const field = dialog().getByLabelText('Eigener Wert (g)');
    await userEvent.clear(field);
    await userEvent.type(field, '210');
    await userEvent.click(dialog().getByRole('button', { name: 'Eigenen Wert verwenden' }));
    await closed();

    // Stored without pressing "Speichern".
    expect(await stored()).toEqual({ auto: 138, manual: 210 });
    expect(proteinRow()).toHaveAccessibleName(
      /^Protein\s*Individuell · automatisch wären 138 g\s*210 g$/,
    );
    expect(screen.queryByText(/Referenzgewicht für Protein ist bei BMI 27,5 begrenzt/)).toBeNull();

    await userEvent.click(proteinRow());
    expect(dialog().getByText('Individuelles Ziel: 210 g')).toBeInTheDocument();
    expect(
      dialog().getByText(/^Individuell: Du legst dein persönliches Protein-Ziel/),
    ).toBeVisible();
    await userEvent.click(dialog().getByRole('button', { name: 'Automatisch berechnen' }));
    await closed();
    expect(await stored()).toEqual({ auto: 138, manual: null });
    expect(proteinRow()).toHaveAccessibleName(/^Protein\s*Automatisch.*138 g$/);
  });

  it('allows 250 g but rejects extreme values', async () => {
    const { services } = await renderApp('/nutrition/profile', { prepare: person(92) });
    await userEvent.click(await screen.findByRole('button', { name: /^Protein/ }));
    const field = dialog().getByLabelText('Eigener Wert (g)');
    await userEvent.clear(field);
    await userEvent.type(field, '500');
    await userEvent.click(dialog().getByRole('button', { name: 'Eigenen Wert verwenden' }));
    expect(
      dialog().getByText('Bitte einen Wert zwischen 30 und 400 eingeben.'),
    ).toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, '250');
    await userEvent.click(dialog().getByRole('button', { name: 'Eigenen Wert verwenden' }));
    await closed();
    const profileId = (await services.profile.ensureLocalProfile()).id;
    expect(
      (await services.nutrition.goals.goalFor(profileId, '2026-10-03'))?.effective.proteinG,
    ).toEqual({ value: 250, origin: 'manual' });
  });
});
