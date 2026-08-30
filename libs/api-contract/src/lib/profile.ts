/**
 * Shared contract for the Profile API — see
 * specs/008-profile-password-account/contracts/profile-api.md and, for the
 * `emailLanguage` field/endpoint,
 * specs/013-multilanguage-support/contracts/profile-api-i18n.md. Plain
 * TypeScript interfaces, no runtime dependency, imported by both
 * `apps/backend` and `apps/frontend` (Principle II).
 */

import type { LanguageCode } from './i18n.js';

export interface ProfileSummary {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'MEMBER';
  pendingEmail: string | null;
  /** `null` = not explicitly set; falls back to the default language (013, FR-008). */
  emailLanguage: LanguageCode | null;
}

export interface UpdateDisplayNameRequest {
  displayName: string;
}

export interface UpdateEmailLanguageRequest {
  emailLanguage: LanguageCode | null;
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
    | 'deletion_failed'
    | 'invalid_email_language';
  message: string;
}
