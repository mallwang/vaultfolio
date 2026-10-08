/** User feedback API contract (044-user-feedback). */
export const FEEDBACK_CATEGORIES = ['feature', 'problem', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_SUBJECT_MAX = 100;
export const FEEDBACK_MESSAGE_MAX = 2000;
export const FEEDBACK_DAILY_LIMIT = 5;
export const FEEDBACK_WINDOW_HOURS = 24;

export const FEEDBACK_LANGUAGES = ['en', 'de'] as const;
export type FeedbackLanguage = (typeof FEEDBACK_LANGUAGES)[number];

export const FEEDBACK_ERROR_CODES = [
  'validation_error',
  'bot_protection_failed',
  'feedback_limit_reached',
  'feedback_delivery_failed',
  'feedback_unavailable',
] as const;
export type FeedbackErrorCode = (typeof FEEDBACK_ERROR_CODES)[number];

export interface FeedbackQuota {
  limit: number;
  remaining: number;
  /** ISO time when the oldest counted feedback leaves the window, null when none counted. */
  resetAt: string | null;
}

export interface SendFeedbackRequest {
  /** Client-generated UUID v4; doubles as idempotency key. */
  attemptId: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  language: FeedbackLanguage;
  turnstileToken?: string;
}

export interface SendFeedbackResponse {
  id: string;
  quota: FeedbackQuota;
}
