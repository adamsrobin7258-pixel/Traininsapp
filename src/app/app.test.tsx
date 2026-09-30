import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '@/test/renderApp';
import { appModules } from './modules';

function setDeviceLanguages(languages: string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
}

describe('app shell', () => {
  beforeEach(() => {
    setDeviceLanguages(['de-DE']);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete document.documentElement.dataset.theme;
  });

  it('shows one tab per registered module', async () => {
    await renderApp();
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });
    expect(within(nav).getAllByRole('link')).toHaveLength(appModules.length);
    expect(within(nav).getByRole('link', { name: 'Heute' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it.each([
    ['Training', 'Training'],
    ['Ernährung', 'Ernährung'],
    ['Gesundheit', 'Gesundheit'],
    ['Profil', 'Profil'],
  ])('navigates to %s via the tab bar', async (tab, heading) => {
    await renderApp();
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });

    await userEvent.click(within(nav).getByRole('link', { name: tab }));

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Heute' })).not.toHaveAttribute('aria-current');
  });

  it('opens areas from the dashboard', async () => {
    await renderApp();
    await userEvent.click(screen.getByRole('link', { name: /Mahlzeiten und Nährstoffe/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ernährung' })).toBeInTheDocument();
  });

  it('redirects unknown routes to the dashboard', async () => {
    const { router } = await renderApp('/does-not-exist');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('uses the device language on first launch', async () => {
    setDeviceLanguages(['en-US']);
    await renderApp();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches the language and persists the choice', async () => {
    const { services } = await renderApp('/profile');

    await userEvent.click(screen.getByRole('radio', { name: 'English' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nutrition' })).toBeInTheDocument();
    expect((await services.settings.load()).language).toBe('en');
  });

  it('switches the theme and persists the choice', async () => {
    const { services } = await renderApp('/profile');
    expect(document.documentElement.dataset.theme).toBe('light');

    await userEvent.click(screen.getByRole('radio', { name: 'Dunkel' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect((await services.settings.load()).theme).toBe('dark');
  });

  it('greets the user by the name entered in the profile', async () => {
    await renderApp('/profile');

    await userEvent.type(screen.getByLabelText('Name'), 'Anna{Enter}');
    await userEvent.click(screen.getByRole('link', { name: 'Heute' }));

    expect(await screen.findByRole('heading', { level: 1, name: /, Anna$/ })).toBeInTheDocument();
  });
});
