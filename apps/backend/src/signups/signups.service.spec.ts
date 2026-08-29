import type { SignupRequest } from './signups.repository';
import { SignupsService } from './signups.service';

/** Isolated unit tests (mocked repositories), mirroring `invitations.service.spec.ts`. */
describe('SignupsService', () => {
  function makeRequest(overrides: Partial<SignupRequest> = {}): SignupRequest {
    return {
      id: 'req1',
      email: 'visitor@example.com',
      passwordHash: 'hashed',
      token: 'tok',
      status: 'PENDING',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-02T00:00:00.000Z',
      verifiedAt: null,
      resolvedAt: null,
      resolvedBy: null,
      ...overrides,
    };
  }

  function service(options: {
    availability?: {
      kind:
        | 'available'
        | 'has_account'
        | 'has_pending_invitation'
        | 'has_pending_signup'
        | 'blacklisted';
    };
    findById?: SignupRequest | null;
    findByToken?: SignupRequest | null;
    markVerified?: SignupRequest | null;
    markApproved?: SignupRequest | null;
    markRejected?: SignupRequest | null;
    admins?: { email: string }[];
  }) {
    const signups = {
      create: jest.fn().mockResolvedValue(makeRequest()),
      findById: jest.fn().mockResolvedValue(options.findById ?? null),
      findByToken: jest.fn().mockResolvedValue(options.findByToken ?? null),
      markExpired: jest.fn(),
      markVerified: jest.fn().mockResolvedValue(options.markVerified ?? null),
      markApproved: jest.fn().mockResolvedValue(options.markApproved ?? null),
      markRejected: jest.fn().mockResolvedValue(options.markRejected ?? null),
      deleteById: jest.fn(),
      createBlacklistEntry: jest.fn(),
      deleteBlacklistEntryBySignupRequestId: jest.fn(),
    };
    const users = {
      create: jest.fn().mockResolvedValue({ id: 'u1', email: 'visitor@example.com' }),
      findAllByRole: jest
        .fn()
        .mockResolvedValue(options.admins ?? [{ email: 'admin@example.com' }]),
    };
    const emailAvailability = {
      check: jest.fn().mockResolvedValue(options.availability ?? { kind: 'available' }),
    };
    const emailService = {
      sendVerification: jest.fn(),
      sendAdminNotification: jest.fn(),
      sendWelcome: jest.fn(),
      sendRejection: jest.fn(),
    };
    return {
      svc: new SignupsService(
        signups as never,
        users as never,
        emailAvailability as never,
        emailService as never,
      ),
      signups,
      users,
      emailService,
    };
  }

  describe('submit', () => {
    it('rejects a password that fails the shared policy', async () => {
      const { svc, signups } = service({});
      const result = await svc.submit('new@example.com', 'short');
      expect(result).toEqual({ kind: 'invalid_password' });
      expect(signups.create).not.toHaveBeenCalled();
    });

    it('reports email_unavailable for every non-available availability result', async () => {
      const { svc } = service({ availability: { kind: 'has_account' } });
      const result = await svc.submit('taken@example.com', 'a-valid-8-char-password');
      expect(result).toEqual({ kind: 'email_unavailable' });
    });

    it('creates the request and sends the verification email on success', async () => {
      const { svc, emailService } = service({});
      const result = await svc.submit('new@example.com', 'a-valid-8-char-password');
      expect(result.kind).toBe('success');
      expect(emailService.sendVerification).toHaveBeenCalledWith(
        'new@example.com',
        expect.any(String),
      );
    });

    it('reports email_delivery_failed when the verification email fails, keeping the request', async () => {
      const { svc, emailService } = service({});
      emailService.sendVerification.mockRejectedValue(new Error('smtp down'));
      const result = await svc.submit('new@example.com', 'a-valid-8-char-password');
      expect(result.kind).toBe('email_delivery_failed');
    });
  });

  describe('lookupByToken / verify', () => {
    it('reports invalid_token when no request matches', async () => {
      const { svc } = service({ findByToken: null });
      expect(await svc.lookupByToken('missing')).toEqual({ kind: 'invalid_token' });
    });

    it('reports invalid_token for a non-PENDING request', async () => {
      const { svc } = service({ findByToken: makeRequest({ status: 'VERIFIED' }) });
      expect(await svc.lookupByToken('tok')).toEqual({ kind: 'invalid_token' });
    });

    it('reports invalid_token and lazily expires a past-expiry PENDING request', async () => {
      const { svc, signups } = service({
        findByToken: makeRequest({ expiresAt: '2020-01-01T00:00:00.000Z' }),
      });
      expect(await svc.lookupByToken('tok')).toEqual({ kind: 'invalid_token' });
      expect(signups.markExpired).toHaveBeenCalledWith('req1');
    });

    it('verify notifies every admin on success', async () => {
      const { svc, emailService } = service({
        findByToken: makeRequest(),
        markVerified: makeRequest({ status: 'VERIFIED', verifiedAt: '2026-01-01T00:00:00.000Z' }),
        admins: [{ email: 'admin1@example.com' }, { email: 'admin2@example.com' }],
      });
      const result = await svc.verify('tok');
      expect(result.kind).toBe('success');
      expect(emailService.sendAdminNotification).toHaveBeenCalledWith(
        ['admin1@example.com', 'admin2@example.com'],
        'visitor@example.com',
      );
    });

    it('verify reports invalid_token on a race (markVerified returns null)', async () => {
      const { svc } = service({ findByToken: makeRequest(), markVerified: null });
      expect(await svc.verify('tok')).toEqual({ kind: 'invalid_token' });
    });
  });

  describe('approve / reject', () => {
    it('approve reports not_found for a missing request', async () => {
      const { svc } = service({ findById: null });
      expect(await svc.approve('req1', 'admin1')).toEqual({ kind: 'not_found' });
    });

    it('approve reports not_verified for a still-PENDING request', async () => {
      const { svc } = service({ findById: makeRequest({ status: 'PENDING' }) });
      expect(await svc.approve('req1', 'admin1')).toEqual({ kind: 'not_verified' });
    });

    it('approve reports already_resolved on a race (markApproved returns null)', async () => {
      const { svc } = service({
        findById: makeRequest({ status: 'VERIFIED' }),
        markApproved: null,
      });
      expect(await svc.approve('req1', 'admin1')).toEqual({ kind: 'already_resolved' });
    });

    it('approve creates an ACTIVE/MEMBER account and sends a welcome email on success', async () => {
      const { svc, users, emailService } = service({
        findById: makeRequest({ status: 'VERIFIED' }),
        markApproved: makeRequest({ status: 'APPROVED', resolvedAt: '2026-01-01T00:00:00.000Z' }),
      });
      const result = await svc.approve('req1', 'admin1');
      expect(result.kind).toBe('success');
      expect(users.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'visitor@example.com', role: 'MEMBER' }),
      );
      expect(emailService.sendWelcome).toHaveBeenCalledWith('visitor@example.com');
    });

    it('reject blacklists the email and sends a rejection email without exposing the reason', async () => {
      const { svc, signups, emailService } = service({
        findById: makeRequest({ status: 'VERIFIED' }),
        markRejected: makeRequest({ status: 'REJECTED', resolvedAt: '2026-01-01T00:00:00.000Z' }),
      });
      const result = await svc.reject('req1', 'admin1', 'spam');
      expect(result.kind).toBe('success');
      expect(signups.createBlacklistEntry).toHaveBeenCalledWith({
        email: 'visitor@example.com',
        reason: 'spam',
        signupRequestId: 'req1',
      });
      expect(emailService.sendRejection).toHaveBeenCalledWith('visitor@example.com');
      // FR-009: the rejection email call carries no reason argument.
      expect(emailService.sendRejection.mock.calls[0]).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('reports not_found for a missing request', async () => {
      const { svc } = service({ findById: null });
      expect(await svc.delete('req1')).toEqual({ kind: 'not_found' });
    });

    it('clears the blacklist entry when deleting a REJECTED request', async () => {
      const { svc, signups } = service({ findById: makeRequest({ status: 'REJECTED' }) });
      const result = await svc.delete('req1');
      expect(result).toEqual({ kind: 'success' });
      expect(signups.deleteBlacklistEntryBySignupRequestId).toHaveBeenCalledWith('req1');
      expect(signups.deleteById).toHaveBeenCalledWith('req1');
    });

    it('does not touch the blacklist when deleting a PENDING/VERIFIED request', async () => {
      const { svc, signups } = service({ findById: makeRequest({ status: 'PENDING' }) });
      await svc.delete('req1');
      expect(signups.deleteBlacklistEntryBySignupRequestId).not.toHaveBeenCalled();
    });
  });
});
