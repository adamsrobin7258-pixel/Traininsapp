import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against the production build in a mobile-sized Chromium.
 * The browser build stores data unencrypted in IndexedDB (development mode); each test gets a
 * fresh browser context and therefore an empty database. Native encryption is covered by the
 * device checklist, not here.
 */
const PORT = 4173;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'de-DE',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'mobile-light', use: { ...devices['Pixel 7'], colorScheme: 'light' } },
    { name: 'mobile-dark', use: { ...devices['Pixel 7'], colorScheme: 'dark' } },
  ],
  webServer: {
    // Expects a prior `npm run build`.
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});
