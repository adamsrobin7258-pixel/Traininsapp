import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AppServices } from '@/app/services';
import { addDays, toLocalDateKey } from '@/shared/lib/date';

/**
 * Fortschritt opens on "Heute" (Phase 17.3). Tests about the 7- or 30-day figures choose their
 * period first, exactly as a user would.
 */
export async function showProgressPeriod(label: string) {
  await userEvent.click(await screen.findByRole('radio', { name: label }));
}

/** The last `count` local days ending on `today` (YYYY-MM-DD), oldest first. */
export function lastDays(today: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    toLocalDateKey(addDays(today, index - (count - 1))),
  );
}

/**
 * The progress figures of the last `count` days as the progress service computes them. Since
 * Phase 23 Fortschritt no longer shows them as cards; tests of the calculation read it here.
 */
export async function progressGoalsOver(services: AppServices, today: Date, count: number) {
  const profileId = (await services.profile.ensureLocalProfile()).id;
  return services.progress.calculate(profileId, lastDays(today, count), {
    today: toLocalDateKey(today),
  });
}
