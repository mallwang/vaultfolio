import nx from '@nx/eslint-plugin';
import sonarjs from 'eslint-plugin-sonarjs';
import vitest from '@vitest/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/test-output'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'scope:frontend',
              onlyDependOnLibsWithTags: [
                'scope:shared',
                'scope:frontend-domain',
                'scope:frontend-admin',
              ],
            },
            {
              sourceTag: 'scope:backend',
              onlyDependOnLibsWithTags: ['scope:shared', 'scope:domain'],
            },
            {
              sourceTag: 'scope:domain',
              onlyDependOnLibsWithTags: ['scope:domain', 'scope:shared'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:frontend-domain',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:frontend-admin',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    plugins: { sonarjs },
    rules: {
      ...sonarjs.configs.recommended.rules,
      // Duplicates @typescript-eslint/no-unused-vars, which the codebase
      // already relies on at 'warn' (e.g. `const { isin: _isin, ...rest }`
      // to intentionally discard a field) — sonarjs has no way to match
      // that non-blocking severity, so it would re-flag the same spots as
      // blocking errors.
      'sonarjs/no-unused-vars': 'off',
    },
  },
  // Secret-detection heuristics from sonarjs key off variable/property
  // *names* (password, ip, ...), so they fire on deliberately fake
  // credentials/IPs in test fixtures just as readily as on real ones.
  // assertions-in-tests only checks for an `expect()` call directly inside
  // the `it()`/`test()` body, so it can't see assertions made through a
  // shared helper (e.g. `expectFieldError(...)` in holdings.e2e-spec.ts) and
  // has no option to allowlist such helpers. All three are switched off for
  // spec files rather than globally, so they still apply to real source.
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
    plugins: { sonarjs },
    rules: {
      'sonarjs/no-hardcoded-passwords': 'off',
      'sonarjs/no-hardcoded-ip': 'off',
      'sonarjs/assertions-in-tests': 'off',
    },
  },
  // Spec files that run on Vitest (the Angular libs, via
  // @angular/build:unit-test) rather than Jest. Keep this file list in sync
  // with the projects using the vitest-angular unit-test runner — everything
  // else (apps/backend, the non-frontend libs, and libs/frontend/domain-access)
  // still runs on Jest. apps/frontend itself is handled in its own
  // eslint.config.mjs, since that file is loaded with its own base path and
  // these patterns wouldn't match there.
  {
    files: [
      'libs/frontend/admin/**/*.spec.ts',
      'libs/frontend/shared-ui/**/*.spec.ts',
      'libs/frontend/domain/**/*.spec.ts',
    ],
    plugins: { vitest },
    rules: vitest.configs.recommended.rules,
  },
];
