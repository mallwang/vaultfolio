import type { LanguageCode } from '@vaultfolio/api-contract';

export type { LanguageCode };

/**
 * Fixed at compile time (data-model.md "Notification Type") — the renderer
 * only ever accepts one of these; there is no runtime/user-supplied
 * notification type.
 */
export type NotificationType =
  | 'password-reset'
  | 'email-change-verification'
  | 'invitation'
  | 'signup-verification'
  | 'signup-admin-alert'
  | 'signup-welcome'
  | 'signup-rejection';

/** The in-process render result consumed by `apps/backend/src/mail/mailer.service.ts`. */
export interface RenderedNotificationEmail {
  type: NotificationType;
  /** The language actually rendered — may differ from the raw request due to fallback (FR-002/FR-003). */
  language: LanguageCode;
  subject: string;
  html: string;
  text: string;
}

export interface RenderNotificationRequest<V = Record<string, unknown>> {
  type: NotificationType;
  /** Raw stored preference, e.g. `user.emailLanguage` — may be `null`/unsupported. */
  preferredLanguage: string | null;
  /** Per-type view model (e.g. `{ resetUrl }` for `password-reset`). */
  viewModel: V;
}
