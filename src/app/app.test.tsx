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
    expect(within(nav).getByRole('link', { name: 'Fortschritt' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    // The former daily page is gone: no "Heute" anywhere in the navigation.
    expect(within(nav).queryByRole('link', { name: 'Heute' })).not.toBeInTheDocument();
    expect(nav).not.toHaveTextContent('Heute');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fortschritt' }),
    ).toBeInTheDocument();
  });

  it.each([
    ['Training', 'Training'],
    ['Ernährung', 'Ernährung'],
    ['Gesundheit', 'Gesundheit'],
    ['Einstellungen', 'Einstellungen'],
  ])('navigates to %s via the tab bar', async (tab, heading) => {
    await renderApp();
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' });

    await userEvent.click(within(nav).getByRole('link', { name: tab }));

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: tab })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Fortschritt' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('opens areas from the progress main page', async () => {
    await renderApp();
    // The nutrition card (not the tab) opens the area.
    const main = screen.getByRole('main');
    await userEvent.click(await within(main).findByRole('link', { name: /^Ernährung/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Ernährung' })).toBeInTheDocument();
  });

  it('redirects unknown routes to the progress main page', async () => {
    const { router } = await renderApp('/does-not-exist');
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it.each([
    ['/profile', '/settings', 'Einstellungen'],
    ['/nutrition/profile', '/settings/goals', 'Ziele'],
  ])('redirects the old address %s to %s instead of the start page', async (old, path, title) => {
    const { router } = await renderApp(old);
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(path);
    });
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  });

  it('uses the device language on first launch', async () => {
    setDeviceLanguages(['en-US']);
    await renderApp();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
  });

  it('switches the language and persists the choice', async () => {
    const { services } = await renderApp('/settings/app');

    await userEvent.click(await screen.findByRole('radio', { name: 'English' }));

    const nav = within(await screen.findByRole('navigation', { name: 'Main navigation' }));
    expect(nav.getByRole('link', { name: 'Settings' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Nutrition' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Language' })).toBeInTheDocument();
    expect((await services.settings.load()).language).toBe('en');
  });

  it('switches the theme and persists the choice', async () => {
    const { services } = await renderApp('/settings/app');
    expect(document.documentElement.dataset.theme).toBe('light');

    await userEvent.click(await screen.findByRole('radio', { name: 'Dunkel' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect((await services.settings.load()).theme).toBe('dark');
  });

  it('greets the user by the name entered in the profile', async () => {
    await renderApp('/settings/profile');

    await userEvent.type(await screen.findByLabelText('Name'), 'Anna{Enter}');
    await userEvent.click(screen.getByRole('link', { name: 'Fortschritt' }));

    // The greeting stays as the small line above the page title.
    expect(await screen.findByText(/, Anna$/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Fortschritt' })).toBeInTheDocument();
  });
});
