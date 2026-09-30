import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Architecture guards (see ARCHITECTURE.md, "Abhängigkeitsregeln"). In flat config the last
// matching block wins, so every block lists the complete set of patterns for its files.
const databaseDrivers = {
  group: ['@capacitor-community/sqlite', 'jeep-sqlite', 'jeep-sqlite/*', 'sql.js'],
  message: 'Only src/core/database/drivers may use SQLite directly. Use a repository instead.',
};
const capacitor = {
  group: ['@capacitor/*', '@capacitor-community/*'],
  message: 'Native APIs belong in platform adapters (src/core/platform) or database drivers.',
};
const coreLayer = {
  group: ['@/app', '@/app/*', '@/modules', '@/modules/*', '@/ui', '@/ui/*'],
  message: 'core must not depend on app, feature modules or UI.',
};
const uiLayer = {
  group: ['@/app', '@/app/*', '@/modules', '@/modules/*', '@/core', '@/core/*'],
  message: 'ui and shared must stay independent of app, core and feature modules.',
};
const moduleLayer = {
  group: ['@/modules/*', '@/app/*', '!@/app/routes', '!@/app/moduleTypes'],
  message: 'Feature modules must not import each other or the app shell (except routes/types).',
};
const pureDomain = {
  group: ['react', 'react-*', 'react/*', '@/ui', '@/ui/*'],
  message: 'Domain logic, services and repositories must stay free of React and UI.',
};
const restrict = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'android',
      'ios',
      'public/assets',
      'test-results',
      'playwright-report',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strictTypeChecked],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        {
          allowConstantExport: true,
          // Context providers export their consumer hook from the same file.
          allowExportNames: [
            'useI18n',
            'useSettings',
            'useProfile',
            'useSyncService',
            'useStorage',
            'useWeightService',
            'useWeightData',
            'useWeightForDate',
            'useLatestWeight',
            'useWeightTrend',
            'useTraining',
            'useTrainingData',
          ],
        },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // i18n guard: visible text must come from the translation files, not from JSX literals.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'JSXText[value=/\\p{L}/u]',
          message: 'Hard-coded UI text. Add a key to src/core/i18n/locales and use t().',
        },
      ],
    },
  },
  { files: ['src/**'], rules: restrict(databaseDrivers, capacitor) },
  { files: ['src/core/**'], rules: restrict(databaseDrivers, capacitor, coreLayer) },
  { files: ['src/ui/**'], rules: restrict(databaseDrivers, capacitor, uiLayer) },
  { files: ['src/shared/**'], rules: restrict(databaseDrivers, capacitor, uiLayer, pureDomain) },
  { files: ['src/modules/**'], rules: restrict(databaseDrivers, capacitor, moduleLayer) },
  {
    files: ['src/modules/**/domain/**'],
    rules: restrict(databaseDrivers, capacitor, moduleLayer, pureDomain),
  },
  {
    files: [
      'src/core/**/*Service.ts',
      'src/core/**/*Repository.ts',
      'src/core/database/migrat*',
      'src/core/database/migrations/**',
      'src/core/privacy/**',
      'src/core/health/**/*.ts',
      'src/core/training/**/*.ts',
      'src/core/platform/location/**',
    ],
    rules: restrict(databaseDrivers, capacitor, coreLayer, pureDomain),
  },
  {
    files: ['src/core/platform/**'],
    ignores: ['src/core/platform/location/**'],
    rules: restrict(databaseDrivers, coreLayer),
  },
  { files: ['src/core/database/drivers/**'], rules: restrict(coreLayer) },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-imports': 'off',
      'no-restricted-syntax': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['*.config.{js,ts}', 'scripts/**'],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
