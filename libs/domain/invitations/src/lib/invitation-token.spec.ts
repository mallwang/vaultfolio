import { computeExpiry, generateInvitationToken } from './invitation-token.js';

describe('generateInvitationToken', () => {
  it('produces an opaque, URL-safe, sufficiently long token', () => {
    const token = generateInvitationToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('produces distinct tokens on each call', () => {
    expect(generateInvitationToken()).not.toBe(generateInvitationToken());
  });
});

describe('computeExpiry', () => {
  it('adds the given number of days to createdAt', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    expect(computeExpiry(createdAt, 7)).toBe('2026-01-08T00:00:00.000Z');
  });

  it('supports a zero-day expiry (expires immediately)', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    expect(computeExpiry(createdAt, 0)).toBe(createdAt.toISOString());
  });
});
