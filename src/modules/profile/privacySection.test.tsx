import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/renderApp';

function privacySection() {
  return screen.getByRole('region', { name: 'Datenschutz & Sicherheit' });
}

describe('privacy and security section', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows that data is encrypted and stays on the device', async () => {
    await renderApp('/profile');
    const section = within(privacySection());
    expect(section.getByText('Nur dieses Gerät')).toBeInTheDocument();
    expect(section.getByText('Aktiv')).toBeInTheDocument();
    expect(section.getByText(/verschlüsselt und ausschließlich auf diesem Gerät/)).toBeVisible();
  });

  it('runs the storage check and lists every result', async () => {
    await renderApp('/profile');
    const section = within(privacySection());

    await userEvent.click(section.getByRole('button', { name: 'Speicher prüfen' }));

    expect(await section.findByText('Verschlüsselte Datenbank')).toBeInTheDocument();
    expect(section.getByText('SQLCipher 4.17.0 test')).toBeInTheDocument();
    expect(section.getAllByText('Bestanden')).toHaveLength(4);
    expect(section.getByText('Nach Neustart prüfen')).toBeInTheDocument();
  });

  it('is honest about the unencrypted browser development mode', async () => {
    await renderApp('/profile', {
      encrypted: false,
      outcome: 'development-unencrypted',
      cipherVersion: null,
    });
    const section = within(privacySection());
    expect(section.getByText('Nicht aktiv')).toBeInTheDocument();
    await userEvent.click(section.getByRole('button', { name: 'Speicher prüfen' }));
    expect(await section.findByText('Browser-Entwicklungsmodus')).toBeInTheDocument();
    expect(section.getByText('Fehlgeschlagen')).toBeInTheDocument();
    expect(section.getByText(/Browser-Entwicklungsmodus: Daten liegen/)).toBeInTheDocument();
  });
});
