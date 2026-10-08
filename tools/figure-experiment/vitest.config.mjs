// Runs only the checks of the figure experiment (not part of `npm test`):
//   npx vitest run --config tools/figure-experiment/vitest.config.mjs
import { mergeConfig } from 'vitest/config';
import base from '../../vite.config.ts';

const config = mergeConfig(base, {});
config.test.include = ['tools/figure-experiment/**/*.check.mjs'];
export default config;
