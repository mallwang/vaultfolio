import type { SessionUser } from '@vaultfolio/api-contract';
import { isDomainEntitled } from './is-domain-entitled.js';

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 'user-1',
    email: 'user@example.com',
    displayName: 'User',
    role: 'MEMBER',
    domainScopes: [],
    ...overrides,
  };
}

describe('isDomainEntitled', () => {
  it('is false for an unauthenticated user', () => {
    expect(isDomainEntitled(null, 'holdings')).toBe(false);
  });

  it('is true for an ADMIN regardless of domainScopes (FR-008)', () => {
    expect(isDomainEntitled(user({ role: 'ADMIN', domainScopes: [] }), 'holdings')).toBe(true);
  });

  it('is true when domainId is present in domainScopes', () => {
    expect(isDomainEntitled(user({ domainScopes: ['holdings'] }), 'holdings')).toBe(true);
  });

  it('is false when domainId is absent from domainScopes', () => {
    expect(isDomainEntitled(user({ domainScopes: ['other'] }), 'holdings')).toBe(false);
  });

  // 022-add-domain-placeholders, US3 (FR-009): an ADMIN is entitled to each
  // of the five new placeholder domains by default, the same bypass Holdings
  // already relies on — no per-domain special-casing needed.
  it.each([
    'retirement',
    'insurances',
    'haushaltsplaner',
    'historic-wealth-development',
    'account-overview',
  ])('is true for an ADMIN with no explicit domainScopes for the new domain %s', (domainId) => {
    expect(isDomainEntitled(user({ role: 'ADMIN', domainScopes: [] }), domainId)).toBe(true);
  });
});
