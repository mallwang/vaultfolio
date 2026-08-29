import { randomBytes } from 'node:crypto';

/**
 * Invitation token shape/expiry (research.md #2): reuses the session-id
 * pattern from spec 005 — an opaque, unguessable, URL-safe token, no extra
 * dependency (JWT would need a DB lookup anyway to support instant
 * revocation, so it buys nothing — see research.md #2's alternatives).
 */
export function generateInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

/** `createdAt` + `days` days, as an ISO-8601 string (Principle I: pure, no implicit `Date.now()`). */
export function computeExpiry(createdAt: Date, days: number): string {
  const expiry = new Date(createdAt.getTime() + days * 24 * 60 * 60 * 1000);
  return expiry.toISOString();
}
