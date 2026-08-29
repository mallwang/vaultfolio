import { EmailAvailabilityService } from './email-availability.service';
import { UsersRepository } from '../auth/users.repository';
import { InvitationsRepository } from '../invitations/invitations.repository';
import { SignupsRepository } from '../signups/signups.repository';

/** Unit test: repositories mocked directly (jest.fn()), mirroring `invitations.service.spec.ts`. */
describe('EmailAvailabilityService', () => {
  function makeService(overrides?: {
    hasAccount?: boolean;
    hasPendingInvitation?: boolean;
    hasPendingSignup?: boolean;
    blacklisted?: boolean;
  }) {
    const users = {
      findByEmail: jest.fn().mockResolvedValue(overrides?.hasAccount ? { id: 'u1' } : null),
    } as unknown as UsersRepository;
    const invitations = {
      findPendingByEmail: jest
        .fn()
        .mockResolvedValue(overrides?.hasPendingInvitation ? { id: 'inv1' } : null),
    } as unknown as InvitationsRepository;
    const signups = {
      findActiveByEmail: jest
        .fn()
        .mockResolvedValue(overrides?.hasPendingSignup ? { id: 'sig1' } : null),
      findBlacklistEntry: jest
        .fn()
        .mockResolvedValue(overrides?.blacklisted ? { email: 'x@example.com' } : null),
    } as unknown as SignupsRepository;

    return new EmailAvailabilityService(users, invitations, signups);
  }

  it('returns available when no source has a match', async () => {
    const service = makeService();
    expect(await service.check('new@example.com')).toEqual({ kind: 'available' });
  });

  it('returns has_account when an active/archived user exists', async () => {
    const service = makeService({ hasAccount: true });
    expect(await service.check('taken@example.com')).toEqual({ kind: 'has_account' });
  });

  it('returns has_pending_invitation when a pending invitation exists', async () => {
    const service = makeService({ hasPendingInvitation: true });
    expect(await service.check('invited@example.com')).toEqual({
      kind: 'has_pending_invitation',
    });
  });

  it('returns has_pending_signup when an active sign-up request exists', async () => {
    const service = makeService({ hasPendingSignup: true });
    expect(await service.check('signed-up@example.com')).toEqual({ kind: 'has_pending_signup' });
  });

  it('returns blacklisted when an email_blacklist entry exists', async () => {
    const service = makeService({ blacklisted: true });
    expect(await service.check('blocked@example.com')).toEqual({ kind: 'blacklisted' });
  });

  it('checks in priority order: an account wins over every other source', async () => {
    const service = makeService({
      hasAccount: true,
      hasPendingInvitation: true,
      hasPendingSignup: true,
      blacklisted: true,
    });
    expect(await service.check('multi@example.com')).toEqual({ kind: 'has_account' });
  });
});
