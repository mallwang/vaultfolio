import { ApiCookieAuth } from '@nestjs/swagger';

/**
 * Security scheme name (not the cookie's own name — see session-cookie.ts
 * for that) shared between `openapi.setup.ts`'s `DocumentBuilder.addCookieAuth`
 * registration and `ApiVaultfolioSessionAuth` below, so every route's
 * `security` entry resolves to the one scheme actually registered instead of
 * dangling.
 */
export const SESSION_COOKIE_SECURITY_SCHEME_NAME = 'sessionCookie';

/**
 * Marks a controller/route as requiring the app's real session cookie
 * (research.md #2) — referencing the `SESSION_COOKIE_SECURITY_SCHEME_NAME`
 * security scheme registered by `openapi.setup.ts`'s `DocumentBuilder`.
 * `ApiCookieAuth`'s argument is the *scheme name* to reference, not the
 * cookie name itself (that lives in the scheme's own `name`/`description`).
 */
export const ApiVaultfolioSessionAuth = () => ApiCookieAuth(SESSION_COOKIE_SECURITY_SCHEME_NAME);
