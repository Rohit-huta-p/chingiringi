// Flat ESLint config (ESLint v9+/v10) for the backend.
//
// The backend is ESM ("type": "module"), so this config file is itself ESM.
// Scope: backend/src. Linting is intentionally about code-quality rules only —
// formatting is owned by Prettier, and eslint-config-prettier (last in the
// array) switches off every stylistic rule that would otherwise fight it.
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  // Never lint build output / deps (node_modules is ignored by default, but be explicit).
  {
    ignores: ['node_modules/**', 'coverage/**'],
  },

  // Recommended JS correctness rules for everything we lint.
  js.configs.recommended,

  // All backend source: ESM + Node runtime globals (process, console, Buffer, …).
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      // Framework signatures (Express's 4-arg error handler) and intentionally
      // ignored catch bindings are idiomatic here — don't flag them. Prefix any
      // other deliberately-unused binding with `_` to opt out.
      'no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'none',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Test files additionally get Jest's globals (describe/it/expect/jest/…),
  // so bare usages aren't flagged as no-undef even when not imported explicitly.
  {
    files: ['src/**/*.test.js', 'src/**/__tests__/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },

  // Must stay LAST: disables ESLint stylistic rules that conflict with Prettier.
  prettier,
];
