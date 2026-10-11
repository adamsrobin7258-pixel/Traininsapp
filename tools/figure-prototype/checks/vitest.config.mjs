// Checks of the figure prototype (phase 1A) – not part of `npm test`:
//   npx vitest run --config tools/figure-prototype/checks/vitest.config.mjs
import { mergeConfig } from 'vitest/config';
import base from '../../../vite.config.ts';

const config = mergeConfig(base, {});
config.test.include = ['tools/figure-prototype/checks/**/*.check.mjs'];
config.test.testTimeout = 120_000;
export default config;
