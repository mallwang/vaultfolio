import * as argon2 from 'argon2';
import type { User } from '../auth/users.repository';
import type { AccountActionToken } from './account-action-tokens.repository';
import { ProfileService } from './profile.service';

/**
 * Isolated unit tests (mocked repositories/services) for `ProfileService`'s
 * branching logic across all three user stories. End-to-end behavior against
 * a real temp-file SQLite DB (session invalidation, purpose isolation,
 * forgot-password uniformity, last-admin) is covered by
 * `profile.controller.spec.ts` per Constitution IV.
 */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user1',
    email: 'user@example.com',
    displayName: 'User One',
    passwordHash: 'irrelevant',
    role: 'MEMBER',
    status: 'ACTIVE',
    failedAttempts: 0,
    lockedUntil: null,
    archivedAt: null,
    retentionExpiresAt: null,
    pendingEmail: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeToken(overrides: Partial<AccountActionToken> = {}): AccountActionToken {
  return {
    id: 'token1',
    userId: 'user1',
    purpose: 'EMAIL_CHANGE',
    newEmail: 'new@example.com',
    token: 'tok',
    status: 'PENDING',
    createdAt: '2026-01-01T00:00:00.000Z',
    expiresAt: '2099-01-01T00:00:00.000Z',
    usedAt: null,
    ...overrides,
  };
}

function service(
  overrides: {
    users?: Partial<Record<string, jest.Mock>>;
    sessions?: Partial<Record<string, jest.Mock>>;
    tokens?: Partial<Record<string, jest.Mock>>;
    emailService?: Partial<Record<string, jest.Mock>>;
    emailAvailability?: Partial<Record<string, jest.Mock>>;
    accounts?: Partial<Record<string, jest.Mock>>;
  } = {},
) {
  const users = {
    findById: jest.fn().mockResolvedValue(makeUser()),
    findByEmail: jest.fn().mockResolvedValue(null),
    updateDisplayName: jest.fn().mockResolvedValue(makeUser()),
    updateEmail: jest.fn().mockResolvedValue(makeUser()),
    setPendingEmail: jest.fn().mockResolvedValue(makeUser()),
    clearPendingEmail: jest.fn().mockResolvedValue(makeUser()),
    updatePasswordHash: jest.fn().mockResolvedValue(makeUser()),
    ...overrides.users,
  };
  const sessions = {
    deleteAllForUserExcept: jest.fn().mockResolvedValue(undefined),
    deleteAllForUser: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockResolvedValue({
      id: 'sess1',
      userId: 'user1',
      createdAt: '2026-01-01T00:00:00.000Z',
      lastActiveAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
    }),
    ...overrides.sessions,
  };
  const tokens = {
    create: jest.fn().mockResolvedValue(makeToken()),
    findByTokenAndPurpose: jest.fn().mockResolvedValue(makeToken()),
    findPendingByUserAndPurpose: jest.fn().mockResolvedValue(null),
    markUsed: jest.fn().mockResolvedValue(makeToken({ status: 'USED' })),
    markSuperseded: jest.fn().mockResolvedValue(makeToken({ status: 'SUPERSEDED' })),
    ...overrides.tokens,
  };
  const emailService = {
    sendEmailChangeVerification: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    ...overrides.emailService,
  };
  const emailAvailability = {
    check: jest.fn().mockResolvedValue({ kind: 'available' }),
    ...overrides.emailAvailability,
  };
  const accounts = {
    deleteSelf: jest.fn().mockResolvedValue({ kind: 'success' }),
    ...overrides.accounts,
  };

  const svc = new ProfileService(
    users as never,
    sessions as never,
    tokens as never,
    emailService as never,
    emailAvailability as never,
    accounts as never,
  );
  return { svc, users, sessions, tokens, emailService, emailAvailability, accounts };
}

describe('ProfileService.getProfile', () => {
  it('returns null for a non-existent user', async () => {
    const { svc } = service({ users: { findById: jest.fn().mockResolvedValue(null) } });
    expect(await svc.getProfile('missing')).toBeNull();
  });

  it('includes the pending email when a usable EMAIL_CHANGE token exists', async () => {
    const { svc } = service({
      tokens: { findPendingByUserAndPurpose: jest.fn().mockResolvedValue(makeToken()) },
    });
    const profile = await svc.getProfile('user1');
    expect(profile?.pendingEmail).toBe('new@example.com');
  });

  it('reports pendingEmail as null when the pending token has expired', async () => {
    const { svc } = service({
      tokens: {
        findPendingByUserAndPurpose: jest
          .fn()
          .mockResolvedValue(makeToken({ expiresAt: '2000-01-01T00:00:00.000Z' })),
      },
    });
    const profile = await svc.getProfile('user1');
    expect(profile?.pendingEmail).toBeNull();
  });
});

describe('ProfileService.updateDisplayName', () => {
  it('rejects an empty display name before any write', async () => {
    const { svc, users } = service();
    const result = await svc.updateDisplayName('user1', '   ');
    expect(result.kind).toBe('invalid_display_name');
    expect(users.updateDisplayName).not.toHaveBeenCalled();
  });

  it('rejects a display name over 100 characters before any write', async () => {
    const { svc, users } = service();
    const result = await svc.updateDisplayName('user1', 'a'.repeat(101));
    expect(result.kind).toBe('invalid_display_name');
    expect(users.updateDisplayName).not.toHaveBeenCalled();
  });

  it('trims and saves a valid display name', async () => {
    const { svc, users } = service();
    const result = await svc.updateDisplayName('user1', '  Valid Name  ');
    expect(result.kind).toBe('success');
    expect(users.updateDisplayName).toHaveBeenCalledWith('user1', 'Valid Name');
  });
});

describe('ProfileService.requestEmailChange', () => {
  it('rejects any non-available result as email_unavailable', async () => {
    const { svc, tokens } = service({
      emailAvailability: { check: jest.fn().mockResolvedValue({ kind: 'has_account' }) },
    });
    const result = await svc.requestEmailChange('user1', 'taken@example.com');
    expect(result.kind).toBe('email_unavailable');
    expect(tokens.create).not.toHaveBeenCalled();
  });

  it('creates a token (supersede-on-resubmit is the repository create() contract) and sends the email', async () => {
    const { svc, tokens, users, emailService } = service();
    const result = await svc.requestEmailChange('user1', 'new@example.com');
    expect(result).toEqual({ kind: 'success', pendingEmail: 'new@example.com' });
    expect(tokens.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user1',
        purpose: 'EMAIL_CHANGE',
        newEmail: 'new@example.com',
      }),
    );
    expect(users.setPendingEmail).toHaveBeenCalledWith('user1', 'new@example.com');
    expect(emailService.sendEmailChangeVerification).toHaveBeenCalled();
  });

  it('reports email_delivery_failed without rolling back the created row', async () => {
    const { svc, tokens } = service({
      emailService: {
        sendEmailChangeVerification: jest.fn().mockRejectedValue(new Error('smtp down')),
      },
    });
    const result = await svc.requestEmailChange('user1', 'new@example.com');
    expect(result.kind).toBe('email_delivery_failed');
    expect(tokens.create).toHaveBeenCalled();
  });
});

describe('ProfileService.cancelEmailChange', () => {
  it('is an idempotent no-op when nothing is pending', async () => {
    const { svc, tokens, users } = service();
    await svc.cancelEmailChange('user1');
    expect(tokens.markSuperseded).not.toHaveBeenCalled();
    expect(users.clearPendingEmail).toHaveBeenCalledWith('user1');
  });

  it('supersedes the pending token and clears pending_email', async () => {
    const { svc, tokens, users } = service({
      tokens: { findPendingByUserAndPurpose: jest.fn().mockResolvedValue(makeToken()) },
    });
    await svc.cancelEmailChange('user1');
    expect(tokens.markSuperseded).toHaveBeenCalledWith('token1');
    expect(users.clearPendingEmail).toHaveBeenCalledWith('user1');
  });
});

describe('ProfileService.lookupEmailChangeToken / confirmEmailChange', () => {
  it('collapses not-found into invalid_token', async () => {
    const { svc } = service({
      tokens: { findByTokenAndPurpose: jest.fn().mockResolvedValue(null) },
    });
    expect(await svc.lookupEmailChangeToken('nope')).toEqual({ kind: 'invalid_token' });
  });

  it('collapses an expired token into invalid_token', async () => {
    const { svc } = service({
      tokens: {
        findByTokenAndPurpose: jest
          .fn()
          .mockResolvedValue(makeToken({ expiresAt: '2000-01-01T00:00:00.000Z' })),
      },
    });
    expect(await svc.lookupEmailChangeToken('expired')).toEqual({ kind: 'invalid_token' });
  });

  it('returns the pending newEmail for a usable token', async () => {
    const { svc } = service();
    expect(await svc.lookupEmailChangeToken('tok')).toEqual({
      kind: 'success',
      newEmail: 'new@example.com',
    });
  });

  it('confirmEmailChange collapses a race (markUsed returns null) into invalid_token', async () => {
    const { svc, users } = service({ tokens: { markUsed: jest.fn().mockResolvedValue(null) } });
    expect(await svc.confirmEmailChange('tok')).toEqual({ kind: 'invalid_token' });
    expect(users.updateEmail).not.toHaveBeenCalled();
  });

  it('confirmEmailChange applies the new email on success', async () => {
    const { svc, users } = service();
    const result = await svc.confirmEmailChange('tok');
    expect(result).toEqual({ kind: 'success', email: 'new@example.com' });
    expect(users.updateEmail).toHaveBeenCalledWith('user1', 'new@example.com');
  });
});

describe('ProfileService.changePassword', () => {
  it('rejects an incorrect current password with invalid_current_password', async () => {
    const { svc, sessions } = service();
    jest.spyOn(argon2, 'verify').mockResolvedValueOnce(false);
    const result = await svc.changePassword('user1', 'sess1', 'wrong', 'new-password-123');
    expect(result.kind).toBe('invalid_current_password');
    expect(sessions.deleteAllForUserExcept).not.toHaveBeenCalled();
  });

  it('rejects a new password failing policy with invalid_password', async () => {
    const { svc } = service();
    jest.spyOn(argon2, 'verify').mockResolvedValueOnce(true);
    const result = await svc.changePassword('user1', 'sess1', 'correct', 'short');
    expect(result.kind).toBe('invalid_password');
  });

  it('updates the hash and invalidates only other sessions on success', async () => {
    const { svc, users, sessions } = service();
    jest.spyOn(argon2, 'verify').mockResolvedValueOnce(true);
    const result = await svc.changePassword('user1', 'sess1', 'correct', 'new-password-123');
    expect(result.kind).toBe('success');
    expect(users.updatePasswordHash).toHaveBeenCalledWith('user1', expect.any(String));
    expect(sessions.deleteAllForUserExcept).toHaveBeenCalledWith('user1', 'sess1');
  });
});

describe('ProfileService.requestPasswordReset — response-shape/timing uniformity', () => {
  it('runs the same number of awaited DB + "delivery" steps whether or not the email matches a user', async () => {
    const matchTokens = {
      create: jest.fn().mockResolvedValue(makeToken()),
      findByTokenAndPurpose: jest.fn(),
      findPendingByUserAndPurpose: jest.fn(),
    };
    const { svc: matchSvc } = service({
      users: { findByEmail: jest.fn().mockResolvedValue(makeUser()) },
      tokens: matchTokens,
    });
    await matchSvc.requestPasswordReset('user@example.com');
    // 1 DB write (create) + 1 delivery await (sendPasswordReset).
    const matchSteps = matchTokens.create.mock.calls.length + 1;

    const missTokens = {
      create: jest.fn(),
      findByTokenAndPurpose: jest.fn(),
      findPendingByUserAndPurpose: jest.fn().mockResolvedValue(null),
    };
    const { svc: missSvc } = service({
      users: { findByEmail: jest.fn().mockResolvedValue(null) },
      tokens: missTokens,
    });
    await missSvc.requestPasswordReset('nobody@example.com');
    // 1 DB read (dummy lookup) + 1 resolved-promise await (dummy delivery).
    const missSteps = missTokens.findPendingByUserAndPurpose.mock.calls.length + 1;

    expect(missSteps).toBe(matchSteps);
    expect(matchTokens.findByTokenAndPurpose).not.toHaveBeenCalled();
    expect(missTokens.create).not.toHaveBeenCalled();
  });

  it('never surfaces an email-delivery failure on the existing-account branch', async () => {
    const { svc } = service({
      users: { findByEmail: jest.fn().mockResolvedValue(makeUser()) },
      emailService: { sendPasswordReset: jest.fn().mockRejectedValue(new Error('smtp down')) },
    });
    await expect(svc.requestPasswordReset('user@example.com')).resolves.toBeUndefined();
  });
});

describe('ProfileService.lookupPasswordResetToken / confirmPasswordReset', () => {
  it('lookup collapses an invalid token into invalid_token, revealing no email', async () => {
    const { svc } = service({
      tokens: { findByTokenAndPurpose: jest.fn().mockResolvedValue(null) },
    });
    expect(await svc.lookupPasswordResetToken('nope')).toEqual({ kind: 'invalid_token' });
  });

  it('confirmPasswordReset rejects a policy-failing password without a current-password check', async () => {
    const { svc, tokens } = service({
      tokens: {
        findByTokenAndPurpose: jest
          .fn()
          .mockResolvedValue(makeToken({ purpose: 'PASSWORD_RESET', newEmail: null })),
      },
    });
    const result = await svc.confirmPasswordReset('tok', 'short');
    expect(result.kind).toBe('invalid_password');
    expect(tokens.markUsed).not.toHaveBeenCalled();
  });

  it('confirmPasswordReset signs the user in on success (fresh session, all sessions invalidated)', async () => {
    const { svc, sessions, users } = service({
      tokens: {
        findByTokenAndPurpose: jest
          .fn()
          .mockResolvedValue(makeToken({ purpose: 'PASSWORD_RESET', newEmail: null })),
        markUsed: jest
          .fn()
          .mockResolvedValue(
            makeToken({ purpose: 'PASSWORD_RESET', newEmail: null, status: 'USED' }),
          ),
      },
    });
    const result = await svc.confirmPasswordReset('tok', 'new-password-123');
    expect(result.kind).toBe('success');
    expect(users.updatePasswordHash).toHaveBeenCalledWith('user1', expect.any(String));
    expect(sessions.deleteAllForUser).toHaveBeenCalledWith('user1');
    expect(sessions.create).toHaveBeenCalled();
  });
});

describe('ProfileService.deleteAccount', () => {
  it('delegates to AccountsService.deleteSelf with actor === target (no duplicated last-admin logic)', async () => {
    const { svc, accounts } = service();
    await svc.deleteAccount('user1');
    expect(accounts.deleteSelf).toHaveBeenCalledWith('user1', 'user1');
  });

  it('maps last_admin straight through', async () => {
    const { svc } = service({
      accounts: { deleteSelf: jest.fn().mockResolvedValue({ kind: 'last_admin' }) },
    });
    expect(await svc.deleteAccount('user1')).toEqual({ kind: 'last_admin' });
  });

  it('maps an unexpected error to deletion_failed', async () => {
    const { svc } = service({
      accounts: { deleteSelf: jest.fn().mockRejectedValue(new Error('boom')) },
    });
    expect(await svc.deleteAccount('user1')).toEqual({ kind: 'deletion_failed' });
  });

  it('maps success straight through', async () => {
    const { svc } = service();
    expect(await svc.deleteAccount('user1')).toEqual({ kind: 'success' });
  });
});
