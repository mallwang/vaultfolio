/**
 * Shared contract for the Invitations API — see
 * specs/006-admin-accounts-invitations/contracts/invitations-api.md. Plain
 * TypeScript interfaces, no runtime dependency (Principle II).
 */

import { UserRole } from './auth.js';

/**
 * Invitation lifecycle states (data-model.md's Invitation "Lifecycle" — see
 * `@vaultfolio/domain-invitations`' `isLegalTransition` for the legal
 * transition graph between them). Same const-object pattern as `UserRole`.
 */
export const InvitationStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type InvitationStatus = (typeof InvitationStatus)[keyof typeof InvitationStatus];

export interface InvitationSummary {
  id: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}

export interface CreateInvitationRequest {
  email: string;
  role: UserRole;
}

export interface InvitationTokenLookup {
  email: string;
  role: UserRole;
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
