/**
 * Shared contract for the Accounts API — see
 * specs/006-admin-accounts-invitations/contracts/accounts-api.md. Plain
 * TypeScript interfaces, no runtime dependency (Principle II).
 */

import { UserRole } from './auth.js';

/** The two lifecycle states for a user account (006, data-model.md's User). Same const-object pattern as `UserRole`. */
export const UserStatus = {
  ACTIVE: 'ACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export interface AccountSummary {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  archivedAt: string | null;
  retentionExpiresAt: string | null;
  isLastActiveAdmin: boolean;
  /** Domain ids this account is entitled to, independent of `role` (020, FR-004/FR-007). */
  domainScopes: string[];
}

export interface ChangeRoleRequest {
  role: UserRole;
}

export interface ChangeDomainScopesRequest {
  domainScopes: string[];
}

export interface AccountsErrorResponse {
  error:
    | 'not_found'
    | 'last_admin'
    | 'already_archived'
    | 'retention_expired'
    | 'forbidden'
    | 'invalid_domain';
  message: string;
}
