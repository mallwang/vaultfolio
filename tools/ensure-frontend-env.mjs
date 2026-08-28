#!/usr/bin/env node
// environment.local.ts (apps/frontend/src/environments/) is gitignored — each
// developer creates their own with a real PrimeUI license key. But Angular's
// fileReplacements (see apps/frontend/project.json, `development` config)
// requires the file to exist just to build, even for tests/lint that never
// render a PrimeNG component. So CI (and any fresh checkout) needs *a* file
// there, just not a real key.
//
// This copies the placeholder example over only when environment.local.ts is
// missing — it never overwrites a real key a developer has already put there.
// Run automatically via the "prepare" npm lifecycle script (fires on every
// `npm ci`/`npm install`, including in CI).
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const environmentsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'apps/frontend/src/environments',
);
const target = join(environmentsDir, 'environment.local.ts');
const source = join(environmentsDir, 'environment.local.example.ts');

if (!existsSync(target)) {
  copyFileSync(source, target);
  console.log(
    'Created apps/frontend/src/environments/environment.local.ts from the example ' +
      '(placeholder PrimeUI license key — replace it with a real one for local dev).',
  );
}
