/**
 * Shared contract for the Accounts API — see
 * specs/006-admin-accounts-invitations/contracts/accounts-api.md. Plain
 * TypeScript interfaces, no runtime dependency (Principle II).
 */

export interface AccountSummary {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'ACTIVE' | 'ARCHIVED';
  archivedAt: string | null;
  retentionExpiresAt: string | null;
  isLastActiveAdmin: boolean;
  /** Domain ids this account is entitled to, independent of `role` (020, FR-004/FR-007). */
  domainScopes: string[];
}

export interface ChangeRoleRequest {
  role: 'ADMIN' | 'MEMBER';
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
