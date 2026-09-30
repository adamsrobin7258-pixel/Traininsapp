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
