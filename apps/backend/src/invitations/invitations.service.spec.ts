import type { Invitation } from './invitations.repository';
import { InvitationsService } from './invitations.service';

/**
 * Isolated unit tests (mocked repositories/EmailAvailabilityService) for
 * `InvitationsService.create()`'s account_exists/supersede-then-create
 * branching. The full create/resend/cancel flows are covered end-to-end by
 * `invitations.controller.spec.ts`; the availability-check logic itself is
 * covered by `../shared/email-availability.service.spec.ts` (007 extracted
 * it out of this service).
 */
describe('InvitationsService — create', () => {
  function makeInvitation(overrides: Partial<Invitation> = {}): Invitation {
    return {
      id: 'inv1',
      email: 'invitee@example.com',
      token: 'token',
      role: 'MEMBER',
      status: 'PENDING',
      invitedBy: 'admin1',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-08T00:00:00.000Z',
      acceptedAt: null,
      ...overrides,
    };
  }

  function service(options: {
    availability?: { kind: 'available' | 'has_account' | 'has_pending_invitation' };
    pendingInvitation?: Invitation | null;
  }) {
    const invitations = {
      findPendingByEmail: jest.fn().mockResolvedValue(options.pendingInvitation ?? null),
      supersede: jest.fn(),
      create: jest.fn().mockResolvedValue(makeInvitation()),
    };
    const users = {};
    const sessions = {};
    const emailService = { sendInvitation: jest.fn() };
    const emailAvailability = {
      check: jest.fn().mockResolvedValue(options.availability ?? { kind: 'available' }),
    };
    return {
      svc: new InvitationsService(
        invitations as never,
        users as never,
        sessions as never,
        emailService as never,
        emailAvailability as never,
      ),
      invitations,
    };
  }

  it('creates the invitation when the email is available', async () => {
    const { svc, invitations } = service({ availability: { kind: 'available' } });

    const result = await svc.create('new@example.com', 'MEMBER', 'admin1');

    expect(result.kind).toBe('success');
    expect(invitations.supersede).not.toHaveBeenCalled();
  });

  it('reports account_exists without creating anything when a user already exists', async () => {
    const { svc, invitations } = service({ availability: { kind: 'has_account' } });

    const result = await svc.create('existing@example.com', 'MEMBER', 'admin1');

    expect(result).toEqual({ kind: 'account_exists' });
    expect(invitations.create).not.toHaveBeenCalled();
  });

  it('supersedes the existing pending invitation before creating a new one', async () => {
    const pending = makeInvitation({ id: 'old-inv', email: 'pending@example.com' });
    const { svc, invitations } = service({
      availability: { kind: 'has_pending_invitation' },
      pendingInvitation: pending,
    });

    const result = await svc.create('pending@example.com', 'MEMBER', 'admin1');

    expect(invitations.supersede).toHaveBeenCalledWith('old-inv');
    expect(result.kind).toBe('success');
  });
});
