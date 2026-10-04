import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Fortschritt opens on "Heute" (Phase 17.3). Tests about the 7- or 30-day figures choose their
 * period first, exactly as a user would.
 */
export async function showProgressPeriod(label: string) {
  await userEvent.click(await screen.findByRole('radio', { name: label }));
}
