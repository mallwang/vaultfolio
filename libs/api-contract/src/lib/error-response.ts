/**
 * Shared contract for the backend's error-response shape — see
 * specs/030-observability-logging-error-handling/contracts/error-response.md.
 * Additive extension of the flat `{ error, message }` shape already used by
 * every per-domain error union in this library (`auth.ts`, `signups.ts`,
 * `accounts.ts`, ...): `correlationId` and `details` are new fields every
 * existing consumer may safely ignore. No existing field is renamed, removed,
 * or reshaped (FR-008).
 */

/** One field-level validation failure, only present for validation errors. */
export interface ErrorResponseDetail {
  field: string;
  message: string;
}

export interface ErrorResponse {
  /** Existing stable machine-readable code, unchanged (e.g. 'bot_protection_failed'). */
  error: string;
  /** Existing human-readable message, unchanged. */
  message: string;
  /** UUID for end-to-end tracing; matches the `X-Correlation-Id` response header and the backend's own log entry. */
  correlationId: string;
  /** Only present for field-level validation errors; non-empty when present. */
  details?: ErrorResponseDetail[];
}
