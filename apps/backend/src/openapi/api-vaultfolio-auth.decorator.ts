import { ApiCookieAuth } from '@nestjs/swagger';
import { SESSION_COOKIE_NAME } from '../auth/session-cookie';

/**
 * Marks a controller/route as requiring the app's real session cookie
 * (research.md #2) — the `vaultfolio_session` security scheme registered by
 * `openapi.setup.ts`'s `DocumentBuilder`. A thin, named wrapper around
 * `@ApiCookieAuth(SESSION_COOKIE_NAME)` so every protected route references
 * the same constant rather than re-typing the cookie name string.
 */
export const ApiVaultfolioSessionAuth = () => ApiCookieAuth(SESSION_COOKIE_NAME);
