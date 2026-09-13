const REDACTED = '[REDACTED]';

/** Header names (lower-cased) never allowed to reach a log line unredacted (FR-010). */
const SENSITIVE_HEADER_NAMES = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key']);

/** A raw HTTP header value as exposed by Express/Node request/response header maps. */
type HeaderValue = string | string[] | undefined;

/**
 * Redact sensitive headers (`Authorization`, `Cookie`, and other configured sensitive headers)
 * before they are logged (FR-010). Returns a new object — the input is never mutated.
 */
export function sanitiseHeaders(headers: Record<string, HeaderValue>): Record<string, HeaderValue> {
  const sanitised: Record<string, HeaderValue> = {};
  for (const [name, value] of Object.entries(headers)) {
    sanitised[name] = SENSITIVE_HEADER_NAMES.has(name.toLowerCase()) ? REDACTED : value;
  }
  return sanitised;
}

/**
 * There is no `sanitiseBody` counterpart: request bodies are never passed to a log call anywhere
 * in this library (FR-010) — not sanitised-then-logged, simply never logged. This function exists
 * only so that intent is documented and testable, rather than relying on every call site to
 * remember not to log the body.
 */
export const REQUEST_BODY_NEVER_LOGGED = true;
