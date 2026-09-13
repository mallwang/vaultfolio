/**
 * Generates `api/openapi.yml` from the same in-code `OpenAPIObject` the
 * backend serves live at `/swagger` and `/openapi.yml` (research.md #6,
 * data-model.md). Two modes:
 *
 *   npx nx run backend:openapi          — writes api/openapi.yml
 *   npx nx run backend:openapi:check    — generates to a temp file and diffs
 *                                          it against the committed one,
 *                                          exiting non-zero on any difference
 *                                          (User Story 3's drift check).
 *
 * Builds a real Nest application (the same way the e2e specs under
 * apps/backend/src/tests/ do — Principle IV) rather than hand-assembling
 * route metadata, so the generated document always reflects the real,
 * currently-registered routes. `DatabaseService` is stubbed exactly as in
 * those specs: document generation never touches the database, so there is
 * no reason for this script to require a writable `./data` directory or
 * bootstrap-admin env vars.
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { dump } from 'js-yaml';
import { AppModule } from '../src/app/app.module';
import { DatabaseService } from '../src/database/database.service';
import { buildOpenApiDocument } from '../src/openapi/openapi.setup';

const OUTPUT_PATH = join(__dirname, '..', '..', '..', 'api', 'openapi.yml');

async function buildApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DatabaseService)
    .useValue({ ping: async () => true })
    .compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

async function generate(): Promise<string> {
  const app = await buildApp();
  try {
    return dump(buildOpenApiDocument(app));
  } finally {
    await app.close();
  }
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const yaml = await generate();

  if (!check) {
    mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
    writeFileSync(OUTPUT_PATH, yaml);
    console.log(`Wrote ${OUTPUT_PATH}`);
    return;
  }

  let committed: string;
  try {
    committed = readFileSync(OUTPUT_PATH, 'utf-8');
  } catch {
    console.error(`${OUTPUT_PATH} does not exist — run "npx nx run backend:openapi" first.`);
    process.exit(1);
    return;
  }

  if (committed === yaml) {
    console.log(`${OUTPUT_PATH} is up to date.`);
    return;
  }

  // Written to a temp file (not just printed) so a CI failure gives the
  // exact freshly generated content to diff/inspect, not just "it differs".
  const tempDir = mkdtempSync(join(tmpdir(), 'vaultfolio-openapi-'));
  const tempPath = join(tempDir, 'openapi.yml');
  writeFileSync(tempPath, yaml);
  console.error(
    `${OUTPUT_PATH} is stale — it no longer matches the current API.\n` +
      `Freshly generated document written to ${tempPath} for comparison.\n` +
      'Run "npx nx run backend:openapi" and commit the result.',
  );
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
