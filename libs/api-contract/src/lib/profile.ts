/**
 * Shared contract for the Profile API — see
 * specs/008-profile-password-account/contracts/profile-api.md. Plain
 * TypeScript interfaces, no runtime dependency, imported by both
 * `apps/backend` and `apps/frontend` (Principle II).
 */

export interface ProfileSummary {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  pendingEmail: string | null;
}

export interface UpdateDisplayNameRequest {
  displayName: string;
}

export interface RequestEmailChangeRequest {
  newEmail: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  newPassword: string;
}

export interface ProfileErrorResponse {
  error:
    | 'invalid_display_name'
    | 'email_unavailable'
    | 'email_delivery_failed'
    | 'invalid_token'
    | 'invalid_password'
    | 'invalid_current_password'
    | 'last_admin'
    | 'deletion_failed';
  message: string;
}
