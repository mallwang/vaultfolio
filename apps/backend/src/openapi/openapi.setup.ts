import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';

function readBackendVersion(): string {
  // Read directly rather than `import ... from '../../package.json'` so this
  // works both under ts-node (src/openapi/, two levels below
  // apps/backend/package.json) and under the webpack bundle (dist/main.js,
  // sitting next to the generated dist/package.json — @nx/webpack's
  // generatePackageJson) without a bundler-specific JSON import config.
  for (const candidate of [
    join(__dirname, 'package.json'),
    join(__dirname, '..', 'package.json'),
    join(__dirname, '..', '..', 'package.json'),
  ]) {
    try {
      return (JSON.parse(readFileSync(candidate, 'utf-8')) as { version: string }).version;
    } catch {
      // try the next candidate
    }
  }
  return '0.0.0';
}

/**
 * Builds the single `OpenAPIObject` shared by the interactive UI
 * (`/swagger`), the `/openapi.yml` route (openapi.controller.ts), and the
 * `api/openapi.yml` generation script — one in-code source of truth
 * (research.md #3, data-model.md).
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Vaultfolio API')
    .setDescription(
      'Generated directly from the backend controllers/DTOs — see specs/031-openapi-swagger-integration. ' +
        `"Try it out" reuses the ${SESSION_COOKIE_NAME} session cookie from a normal app login; ` +
        'it is not a separate credential scheme.',
    )
    .setVersion(readBackendVersion())
    // Every non-@Public() route requires this cookie (AuthGuard, globally
    // applied) — research.md #2. Swagger UI shows a lock icon + "Authorize"
    // affordance for it instead of accepting a pasted credential.
    .addCookieAuth(SESSION_COOKIE_NAME, { type: 'apiKey', in: 'cookie', name: SESSION_COOKIE_NAME })
    .build();

  return SwaggerModule.createDocument(app, config);
}

let cachedDocument: OpenAPIObject | undefined;

/** Mounts the interactive Swagger UI at `/swagger` (research.md #2). */
export function setupOpenApi(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);
  SwaggerModule.setup('swagger', app, document);
  // Cached so OpenApiController (a plain HTTP handler with no INestApplication
  // reference of its own) can serve the identical document at
  // GET /openapi.yml without rebuilding it per request.
  cachedDocument = document;
  return document;
}

/** The document built by the most recent `setupOpenApi(app)` call. */
export function getOpenApiDocument(): OpenAPIObject {
  if (!cachedDocument) {
    throw new Error('setupOpenApi(app) must run before getOpenApiDocument() is called.');
  }
  return cachedDocument;
}
