import type { Response } from 'express';

/**
 * Session-cookie name/attributes (research.md #1, #8): opaque session id,
 * httpOnly (never readable by frontend JS), `Secure` in prod, `SameSite=Lax`,
 * scoped to the whole app.
 */
export const SESSION_COOKIE_NAME = 'vaultfolio_session';

export function setSessionCookie(res: Response, sessionId: string, expiresAt: Date): void {
  res.cookie(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}
