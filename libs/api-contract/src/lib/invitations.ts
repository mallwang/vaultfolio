/**
 * Shared contract for the Invitations API — see
 * specs/006-admin-accounts-invitations/contracts/invitations-api.md. Plain
 * TypeScript interfaces, no runtime dependency (Principle II).
 */

export interface InvitationSummary {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED' | 'SUPERSEDED';
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface InvitationTokenLookup {
  email: string;
  role: 'ADMIN' | 'MEMBER';
}

export interface AcceptInvitationRequest {
  password: string;
  displayName: string;
}

export interface InvitationsErrorResponse {
  error:
    | 'account_exists'
    | 'not_found'
    | 'already_resolved'
    | 'email_delivery_failed'
    | 'invalid_invitation'
    | 'invalid_password';
  message: string;
}
