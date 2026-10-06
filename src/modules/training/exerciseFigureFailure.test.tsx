import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/renderApp';

/** The 3D chunk cannot be loaded (or 3D fails to start): the details stay fully usable. */
vi.mock('./figure/environment', () => ({
  supportsWebGL: () => true,
  prefersReducedMotion: () => false,
  readFigurePalette: () => ({}),
}));
vi.mock('./figure/figureRenderer', () => {
  throw new Error('3D asset missing');
});

describe('3D exercise visuals – failure', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('hides the figure without an error when the 3D part cannot load', async () => {
    await renderApp('/settings/content/exercises');
    await userEvent.type(await screen.findByRole('searchbox'), 'langhantel-bankdrücken');
    await userEvent.click(screen.getByRole('button', { name: /^Langhantel-Bankdrücken/ }));
    const details = within(screen.getByRole('dialog'));
    await waitFor(() => {
      expect(details.queryByRole('button', { name: '3D-Ansicht öffnen' })).not.toBeInTheDocument();
    });
    expect(details.getByText('Trizeps, Schultern')).toBeInTheDocument();
    expect(details.queryByRole('alert')).not.toBeInTheDocument();
  });
});
