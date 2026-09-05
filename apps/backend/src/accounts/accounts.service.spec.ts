import type { User } from '../auth/users.repository';
import { AccountsService } from './accounts.service';

/**
 * T056: isolated unit tests (mocked repositories) for the `isLastActiveAdmin`
 * flag `AccountsService.listAll()` computes per account — the last-admin
 * invariant surfaced to the UI (design.md "Last-admin-blocked banner").
 * `canRemoveLastAdmin` itself is covered by
 * `libs/domain/auth/src/lib/last-admin.spec.ts`; this file covers how
 * `AccountsService` combines it with account status/role/active-admin-count.
 */
describe('AccountsService — isLastActiveAdmin computation', () => {
  function makeUser(overrides: Partial<User>): User {
    return {
      id: 'u1',
      email: 'user@example.com',
      displayName: 'User',
      passwordHash: 'hash',
      role: 'MEMBER',
      status: 'ACTIVE',
      failedAttempts: 0,
      lockedUntil: null,
      archivedAt: null,
      retentionExpiresAt: null,
      pendingEmail: null,
      emailLanguage: null,
      domainScopes: ['holdings'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function service(users: User[], activeAdminCount: number) {
    const usersRepo = {
      findAll: jest.fn().mockResolvedValue(users),
      countActiveAdmins: jest.fn().mockResolvedValue(activeAdminCount),
    };
    const sessionsRepo = {};
    return new AccountsService(usersRepo as never, sessionsRepo as never);
  }

  it('flags an active admin as the last one when the active-admin count is 1', async () => {
    const admin = makeUser({ id: 'a1', role: 'ADMIN', status: 'ACTIVE' });
    const svc = service([admin], 1);

    const [summary] = await svc.listAll();

    expect(summary.isLastActiveAdmin).toBe(true);
  });

  it('does not flag an active admin when another active admin exists', async () => {
    const admin1 = makeUser({ id: 'a1', role: 'ADMIN', status: 'ACTIVE' });
    const admin2 = makeUser({ id: 'a2', role: 'ADMIN', status: 'ACTIVE' });
    const svc = service([admin1, admin2], 2);

    const summaries = await svc.listAll();

    expect(summaries.every((s) => !s.isLastActiveAdmin)).toBe(true);
  });

  it('does not flag an archived admin even if they are the only ADMIN-role row', async () => {
    const archivedAdmin = makeUser({ id: 'a1', role: 'ADMIN', status: 'ARCHIVED' });
    const svc = service([archivedAdmin], 0);

    const [summary] = await svc.listAll();

    expect(summary.isLastActiveAdmin).toBe(false);
  });

  it('never flags a MEMBER account', async () => {
    const member = makeUser({ id: 'm1', role: 'MEMBER', status: 'ACTIVE' });
    const svc = service([member], 1);

    const [summary] = await svc.listAll();

    expect(summary.isLastActiveAdmin).toBe(false);
  });
});

/**
 * 022-add-domain-placeholders, US3 (FR-010): granting or revoking one of the
 * five new placeholder domain scopes must not add or remove any other id
 * already present on the account.
 */
describe('AccountsService#changeDomainScopes — per-domain independence', () => {
  function makeUser(overrides: Partial<User>): User {
    return {
      id: 'u1',
      email: 'user@example.com',
      displayName: 'User',
      passwordHash: 'hash',
      role: 'MEMBER',
      status: 'ACTIVE',
      failedAttempts: 0,
      lockedUntil: null,
      archivedAt: null,
      retentionExpiresAt: null,
      pendingEmail: null,
      emailLanguage: null,
      domainScopes: ['holdings'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  function service(user: User) {
    const usersRepo = {
      findById: jest.fn().mockImplementation(() => Promise.resolve(user)),
      countActiveAdmins: jest.fn().mockResolvedValue(1),
      // Mutates the same `user` object in place, so the reference captured
      // by the caller (destructured once) reflects the update — a fresh
      // object per call would leave that reference stale.
      updateDomainScopes: jest.fn().mockImplementation((_id: string, domainScopes: string[]) => {
        user.domainScopes = domainScopes;
        return Promise.resolve(user);
      }),
    };
    const sessionsRepo = {};
    return { svc: new AccountsService(usersRepo as never, sessionsRepo as never), user };
  }

  it.each([
    'retirement',
    'insurances',
    'haushaltsplaner',
    'historic-wealth-development',
    'account-overview',
  ])('granting %s keeps the existing "holdings" scope intact', async (domainId) => {
    const { svc, user } = service(makeUser({ domainScopes: ['holdings'] }));

    const result = await svc.changeDomainScopes('actor-1', 'u1', ['holdings', domainId]);

    expect(result.kind).toBe('success');
    expect(user.domainScopes).toEqual(['holdings', domainId]);
  });

  it.each([
    'retirement',
    'insurances',
    'haushaltsplaner',
    'historic-wealth-development',
    'account-overview',
  ])('revoking %s leaves other existing scopes untouched', async (domainId) => {
    const { svc, user } = service(makeUser({ domainScopes: ['holdings', domainId] }));

    const result = await svc.changeDomainScopes('actor-1', 'u1', ['holdings']);

    expect(result.kind).toBe('success');
    expect(user.domainScopes).toEqual(['holdings']);
  });
});
