import type { Invitation } from './invitations.repository';
import { InvitationsService } from './invitations.service';

/**
 * T056: isolated unit tests (mocked repositories) for
 * `InvitationsService.checkEmailAvailable`'s three-way discriminated result.
 * The full create/resend/cancel flows are covered end-to-end by
 * `invitations.controller.spec.ts`; this file isolates just the
 * available/has_account/has_pending_invitation branching.
 */
describe('InvitationsService — checkEmailAvailable', () => {
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

  function service(options: { existingUser?: unknown; pendingInvitation?: Invitation | null }) {
    const users = { findByEmail: jest.fn().mockResolvedValue(options.existingUser ?? null) };
    const invitations = {
      findPendingByEmail: jest.fn().mockResolvedValue(options.pendingInvitation ?? null),
    };
    const sessions = {};
    const emailService = { sendInvitation: jest.fn() };
    return new InvitationsService(
      invitations as never,
      users as never,
      sessions as never,
      emailService as never,
    );
  }

  it('reports available when no account or pending invitation exists for the email', async () => {
    const svc = service({});

    const result = await svc.checkEmailAvailable('new@example.com');

    expect(result).toEqual({ kind: 'available' });
  });

  it('reports has_account when a user already exists for the email', async () => {
    const svc = service({ existingUser: { id: 'u1', email: 'existing@example.com' } });

    const result = await svc.checkEmailAvailable('existing@example.com');

    expect(result).toEqual({ kind: 'has_account' });
  });

  it('reports has_pending_invitation when a pending invitation already exists', async () => {
    const pending = makeInvitation({ email: 'pending@example.com' });
    const svc = service({ pendingInvitation: pending });

    const result = await svc.checkEmailAvailable('pending@example.com');

    expect(result).toEqual({ kind: 'has_pending_invitation', invitation: pending });
  });

  it('prefers has_account over has_pending_invitation when both are somehow true', async () => {
    const pending = makeInvitation({ email: 'both@example.com' });
    const svc = service({ existingUser: { id: 'u1' }, pendingInvitation: pending });

    const result = await svc.checkEmailAvailable('both@example.com');

    expect(result).toEqual({ kind: 'has_account' });
  });
});
