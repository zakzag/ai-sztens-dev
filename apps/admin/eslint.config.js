import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

/**
 * Flat ESLint config for the admin SPA.
 *
 * Scope: `src` plus the Vite/Vitest config files. The React hooks rules are the
 * only framework-specific addition — the UI rules from
 * `.roo/rules/react.coding-standards.md` are enforced by review and by the
 * definition-of-done checks, not by a custom rule set.
 */
export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
  {
    files: ['*.config.ts', 'eslint.config.js'],
    rules: {
      // Config files are evaluated by Node/Vite tooling, not by the app bundle.
      '@typescript-eslint/no-unsafe-assignment': 'off',
    },
  },
);
