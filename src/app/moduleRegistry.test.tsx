import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { I18nProvider } from '@/core/i18n';
import { TabBar } from './layout/TabBar';
import { MAX_TABS, type AppModule } from './moduleTypes';
import { appModules } from './modules';
import { createRoutes } from './router';

describe('module registry', () => {
  it('has unique ids and paths', () => {
    const ids = appModules.map((m) => m.id);
    const paths = appModules.map((m) => m.path);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it(`never exceeds ${MAX_TABS} tabs`, () => {
    expect(appModules.filter((m) => m.tab).length).toBeLessThanOrEqual(MAX_TABS);
  });

  it('creates a route for every module', () => {
    const [layout] = createRoutes();
    const paths = layout?.children?.map((route) => route.path) ?? [];
    for (const module of appModules) expect(paths).toContain(module.path);
  });
});

describe('TabBar', () => {
  it('shows only modules that declare a tab', () => {
    const Screen = () => null;
    const modules: AppModule[] = [
      { id: 'progress', path: '/', Screen, tab: { labelKey: 'nav.progress', icon: 'progress' } },
      { id: 'training', path: '/training', Screen },
      {
        id: 'settings',
        path: '/settings',
        Screen,
        tab: { labelKey: 'nav.settings', icon: 'settings' },
      },
    ];
    render(
      <I18nProvider locale="en">
        <MemoryRouter>
          <TabBar modules={modules} />
        </MemoryRouter>
      </I18nProvider>,
    );
    const links = within(screen.getByRole('navigation')).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual(['Progress', 'Settings']);
    expect(screen.getByRole('list')).toHaveStyle({ '--tab-count': '2' });
  });
});
