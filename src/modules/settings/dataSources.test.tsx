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

  it('credits the BLS and Open Food Facts under "About"', async () => {
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
