import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Architecture guards (see ARCHITECTURE.md, "Abhängigkeitsregeln").
const databaseDrivers = {
  group: ['@capacitor-community/sqlite', 'jeep-sqlite', 'jeep-sqlite/*', 'sql.js'],
  message: 'Only src/core/database/drivers may use SQLite directly. Use a repository instead.',
};
const layerRule = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns: [databaseDrivers, ...patterns] }],
});

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'android', 'ios', 'public/assets'] },
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
          allowExportNames: ['useI18n', 'useSettings', 'useProfile', 'useSyncService'],
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
      'no-restricted-imports': ['error', { patterns: [databaseDrivers] }],
    },
  },
  {
    files: ['src/core/**'],
    rules: layerRule({
      group: ['@/app', '@/app/*', '@/modules', '@/modules/*', '@/ui', '@/ui/*'],
      message: 'core must not depend on app, feature modules or UI.',
    }),
  },
  {
    files: ['src/ui/**', 'src/shared/**'],
    rules: layerRule({
      group: ['@/app', '@/app/*', '@/modules', '@/modules/*', '@/core', '@/core/*'],
      message: 'ui and shared must stay independent of app, core and feature modules.',
    }),
  },
  {
    files: ['src/modules/**'],
    rules: layerRule({
      group: ['@/modules/*', '@/app/*', '!@/app/routes', '!@/app/moduleTypes'],
      message: 'Feature modules must not import each other or the app shell (except routes/types).',
    }),
  },
  {
    files: ['src/core/database/drivers/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
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
