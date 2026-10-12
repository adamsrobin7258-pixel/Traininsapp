import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlsCatalog } from '@/core/nutrition/bls';
import { renderApp } from '@/test/renderApp';
import { TEST_BLS_DATA } from '@/test/testReferenceCatalog';

describe('data sources', () => {
  beforeEach(() => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['de-DE']);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the Kalethra logo (symbol and wordmark) under "About"', async () => {
    await renderApp('/settings/app');
    const about = within(await screen.findByRole('region', { name: 'Über Kalethra' }));
    const logo = about.getByRole('img', { name: 'Kalethra' });
    expect(logo.querySelector('[data-brand="symbol"]')).not.toBeNull();
    expect(logo.querySelector('[data-brand="wordmark"]')).not.toBeNull();
  });

  it('credits the BLS and Open Food Facts under "About" – the 3D body is no longer shipped', async () => {
    await renderApp('/settings/app');
    await userEvent.click(await screen.findByRole('button', { name: 'Datenquellen' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Datenquellen' }));
    expect(
      await sheet.findByText(
        /Max Rubner-Institut \(MRI\), Bundeslebensmittelschlüssel \(BLS\), Version 4\.0/,
      ),
    ).toBeInTheDocument();
    expect(sheet.getByText(/kostenfrei nutzbar, mit Angabe der Quelle/)).toBeInTheDocument();
    expect(sheet.getByText('6 Lebensmittel · importiert am 01.10.2026')).toBeInTheDocument();
    expect(sheet.getByText(/Open Database License \(ODbL\)/)).toBeInTheDocument();
    expect(sheet.getByText(/Gesendet wird ausschließlich der Barcode/)).toBeInTheDocument();
    expect(sheet.getByText(/Nur lesend: Gewicht, Schritte/)).toBeInTheDocument();
    // Since 0.36.0 the 3D bodies are not in the app any more (vite.config.ts) – no credit for
    // content that is not shipped; the attribution stays with the files in the repository.
    expect(sheet.queryByText('3D-Körper')).not.toBeInTheDocument();
    expect(sheet.queryByText(/Proxy Human base Mesh|sphere_joe|CC BY/)).not.toBeInTheDocument();
    expect(sheet.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'Datenquellen',
      'Bundeslebensmittelschlüssel (BLS)',
      'Open Food Facts',
      'Health Connect',
    ]);
  });

  it('says so when no BLS data is bundled', async () => {
    await renderApp('/settings/app', {
      referenceCatalog: new BlsCatalog(() =>
        Promise.resolve({ ...TEST_BLS_DATA, meta: null, foods: [] }),
      ),
    });
    await userEvent.click(await screen.findByRole('button', { name: 'Datenquellen' }));
    expect(
      await screen.findByText('In dieser Version sind noch keine BLS-Daten enthalten.'),
    ).toBeInTheDocument();
  });
});
