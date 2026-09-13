import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';
import { SESSION_COOKIE_SECURITY_SCHEME_NAME } from './api-vaultfolio-auth.decorator';

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
      'Vaultfolio is a self-hosted personal finance tracker for manually tracking investments ' +
        'across ETFs, shares, precious metals, crypto, and more. Source, issues, and the full ' +
        'README live at https://github.com/mallwang/vaultfolio.\n\n' +
        'This document is generated directly from the backend controllers and DTOs, so it always ' +
        'matches what is actually running.\n\n' +
        '### Authentication\n\n' +
        `Every endpoint below except \`/health\` and \`/auth/sign-in\` requires the ${SESSION_COOKIE_NAME} ` +
        'session cookie set by signing in (via the app, or via `POST /auth/sign-in` below) — it is ' +
        'not a separate credential scheme. That cookie is httpOnly, so it rides along automatically ' +
        'on every "Try it out" call once you are signed in; there is nothing to enter in the ' +
        '"Authorize" dialog below, which exists only to mark which endpoints require it.',
    )
    .setVersion(readBackendVersion())
    // Every non-@Public() route requires this cookie (AuthGuard, globally
    // applied) — research.md #2. Registered under the 'sessionCookie' name
    // (not the raw cookie name — that'd read oddly in the Authorize dialog,
    // and ApiVaultfolioSessionAuth must reference this same name for the
    // per-route `security` entries to resolve instead of dangling). The
    // description spells out that there is nothing to paste: the cookie is
    // httpOnly, so a browser can neither read it to prefill the field nor
    // let a pasted value override the real one — Swagger UI still sends the
    // actual cookie automatically once you've signed in, and the lock icon
    // is here only to mark which endpoints require that.
    .addCookieAuth(
      SESSION_COOKIE_NAME,
      {
        type: 'apiKey',
        in: 'cookie',
        name: SESSION_COOKIE_NAME,
        description:
          'Set automatically by your browser after signing in (via the app, or via ' +
          '`POST /auth/sign-in` below) — this cookie is httpOnly, so there is nothing to paste ' +
          'here; it will be sent with "Try it out" requests regardless of this dialog.',
      },
      SESSION_COOKIE_SECURITY_SCHEME_NAME,
    )
    // Controllers register bare paths (e.g. `/health`), but the browser can
    // only reach the backend via the `/api` prefix — stripped and forwarded
    // by proxy.conf.json in dev and by nginx's `/api/` location in Docker
    // (docker/frontend.nginx.conf). Without this, Swagger UI's "Try it out"
    // fires at the bare path on the current origin and never reaches the
    // backend.
    .addServer('/api')
    .build();

  return SwaggerModule.createDocument(app, config);
}

let cachedDocument: OpenAPIObject | undefined;

/** Mounts the interactive Swagger UI at `/swagger` (research.md #2). */
export function setupOpenApi(app: INestApplication): OpenAPIObject {
  const document = buildOpenApiDocument(app);
  // customSiteTitle sets the browser tab's <title> — distinct from
  // DocumentBuilder's setTitle() above, which only sets the document's
  // `info.title` (the heading Swagger UI renders on the page itself).
  //
  // customCss hides the Authorize dialog's cookie-value input, its "Value:"
  // label, and the dialog's own "Authorize" submit button — none of them do
  // anything useful (see the scheme's `description` above: the value is
  // never read, and while signed in the browser refuses to let JS override
  // an httpOnly cookie of the same name anyway). `#api_key_value` /
  // `label[for="api_key_value"]` are swagger-ui-react's hardcoded ids for an
  // apiKey scheme's value field — stable across schemes/versions, and safe
  // to target unscoped since `sessionCookie` is the only such scheme
  // registered. `.auth-btn-wrapper .authorize` is scoped to the dialog's own
  // button (class `btn modal-btn auth authorize`) so the page's *other*
  // "Authorize" button — the padlock that opens this dialog in the first
  // place (class `btn authorize locked`/`unlocked`, not inside
  // `.auth-btn-wrapper`) — stays untouched, as does the dialog's "Close"
  // button (a sibling with a different class) for dismissing it.
  //
  // `!important` on the button rule: swagger-ui.css's own selector for it —
  // `.swagger-ui .scheme-container .schemes .auth-wrapper .authorize` — is
  // five classes deep (the modal is rendered inline under that same
  // `.auth-wrapper`, not in a portal), which outranks our two-class
  // `.auth-btn-wrapper .authorize` regardless of source order. Matching
  // that specificity would mean hardcoding its ancestor chain, which is
  // more fragile across swagger-ui-dist versions than settling it with
  // `!important` — a rule swagger-ui.css itself never uses, so nothing here
  // needs to out-escalate it further.
  SwaggerModule.setup('swagger', app, document, {
    customSiteTitle: 'Vaultfolio API',
    customCss:
      '#api_key_value, label[for="api_key_value"] { display: none; } ' +
      '.auth-btn-wrapper .authorize { display: none !important; }',
  });
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
