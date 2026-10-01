import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Browser shims only apply to jsdom tests; config tests in tests/ run in plain Node.
if (typeof window !== 'undefined') {
  afterEach(() => {
    cleanup();
  });

  // jsdom does not implement matchMedia.
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
      }),
    });
  }

  // jsdom does not implement scrolling (used by React Router's <ScrollRestoration>).
  window.scrollTo = () => undefined;
}

// Tests never talk to real services (e.g. Open Food Facts): external requests fail loudly.
const realFetch = globalThis.fetch as typeof fetch | undefined;
globalThis.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (/^https?:\/\//.test(url) && !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(url)) {
    return Promise.reject(new Error(`External request blocked in tests: ${url}`));
  }
  if (!realFetch) return Promise.reject(new Error('fetch unavailable'));
  return realFetch(input, init);
};
