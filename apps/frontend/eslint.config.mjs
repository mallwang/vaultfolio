import nx from '@nx/eslint-plugin';
import vitest from '@vitest/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'app',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'app',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
  // apps/frontend runs its tests on Vitest too (see eslint.config.mjs at the
  // workspace root for the equivalent rule for the frontend libs).
  {
    files: ['**/*.spec.ts'],
    plugins: { vitest },
    rules: vitest.configs.recommended.rules,
  },
];
