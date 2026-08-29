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
}

export interface ChangeRoleRequest {
  role: 'ADMIN' | 'MEMBER';
}

export interface AccountsErrorResponse {
  error: 'not_found' | 'last_admin' | 'already_archived' | 'retention_expired' | 'forbidden';
  message: string;
}
