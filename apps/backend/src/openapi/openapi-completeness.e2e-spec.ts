import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../app/app.module';
import { DatabaseService } from '../database/database.service';
import { buildOpenApiDocument } from './openapi.setup';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';

interface ExpressLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { method: string }[];
  };
  name?: string;
  handle?: { stack?: ExpressLayer[] };
  regexp?: RegExp;
}

/** Converts an Express route path (`:id`) to OpenAPI's `{id}` path-param syntax. */
function toOpenApiPath(expressPath: string): string {
  return expressPath.replace(/:(\w+)/g, '{$1}');
}

/**
 * Walks the real Express router (not a hand-maintained route list) to find
 * every method+path NestJS actually registered — including its own
 * `/openapi.yml` meta-route, so the test also proves that route is excluded
 * from the generated document as intended (@ApiExcludeController).
 */
function registeredRoutes(app: INestApplication): { method: string; path: string }[] {
  // Express 5 (this workspace's version): the app instance itself exposes
  // `.router.stack` directly — there is no top-level `._router` as in
  // Express 4.
  const router = (app.getHttpAdapter().getInstance() as { router: { stack: ExpressLayer[] } })
    .router;
  const routes: { method: string; path: string }[] = [];

  for (const layer of router.stack) {
    if (layer.route) {
      const path = toOpenApiPath(layer.route.path);
      for (const method of Object.keys(layer.route.methods)) {
        if (layer.route.methods[method]) {
          routes.push({ method: method.toLowerCase(), path });
        }
      }
    }
  }
  return routes;
}

/**
 * Integration test for data-model.md's API Specification Document validation
 * rule: every route NestJS actually registers must appear in the generated
 * OpenAPIObject's `paths`, and every non-`@Public()` route's operation must
 * carry the `vaultfolio_session` cookie security requirement (research.md
 * #2). Exercises the real generation pipeline against the real, currently
 * registered routes (Principle IV) — not a mocked subset.
 */
describe('OpenAPI document completeness (US1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DatabaseService)
      .useValue({ ping: async () => true })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("documents every route NestJS's router registers, except its own excluded meta-routes", () => {
    const document = buildOpenApiDocument(app);
    const routes = registeredRoutes(app).filter(
      // openapi.controller.ts is @ApiExcludeController() by design (T006) —
      // the document describing the API isn't itself part of the API.
      (route) => route.path !== '/openapi.yml',
    );

    expect(routes.length).toBeGreaterThan(0);

    for (const route of routes) {
      const pathItem = document.paths[route.path];
      expect(pathItem).toBeDefined();
      expect(pathItem?.[route.method as keyof typeof pathItem]).toBeDefined();
    }
  });

  it('excludes its own documentation meta-route from the generated document', () => {
    const document = buildOpenApiDocument(app);
    expect(document.paths['/openapi.yml']).toBeUndefined();
  });

  it('marks every documented, non-public operation with the vaultfolio_session cookie requirement', () => {
    const document = buildOpenApiDocument(app);
    // Every @Public() route in the app (mirrors each controller's own
    // @Public() decorators) — no session exists yet when these are called,
    // so they must NOT require the cookie. Kept explicit rather than
    // pattern-matched so this test fails loudly if a new @Public() route is
    // added here without a matching update.
    const publicOperations = new Set([
      'get /health',
      'post /auth/sign-in',
      'post /signups',
      'get /signups/token/{token}',
      'post /signups/token/{token}/verify',
      'get /invitations/token/{token}',
      'post /invitations/token/{token}/accept',
      'get /profile/email-change/token/{token}',
      'post /profile/email-change/token/{token}/confirm',
      'post /profile/forgot-password',
      'get /profile/reset-password/token/{token}',
      'post /profile/reset-password/token/{token}/confirm',
    ]);

    for (const [path, pathItem] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(pathItem ?? {})) {
        if (publicOperations.has(`${method} ${path}`)) {
          continue;
        }
        if (!operation || typeof operation !== 'object' || !('responses' in operation)) {
          continue;
        }
        const security = (operation as { security?: Record<string, unknown>[] }).security;
        const hasSessionCookieRequirement = security?.some(
          (requirement) => SESSION_COOKIE_NAME in requirement,
        );
        if (!hasSessionCookieRequirement) {
          throw new Error(
            `${method.toUpperCase()} ${path} is missing the ${SESSION_COOKIE_NAME} security requirement`,
          );
        }
      }
    }
  });
});
