/** Longest a sanitised log value may be before it is truncated. */
const MAX_LOG_VALUE_LENGTH = 512;

// Control characters (including CR/LF) — stripping these prevents log-line injection/forgery
// (FR-009) from any externally sourced string (e.g. a request path or header value) before it is
// ever written to a log line. Built via RegExp + String.fromCharCode rather than a literal
// character class so no raw control byte needs to live in this source file.
const CONTROL_CHAR_PATTERN = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}]`,
  'g',
);

/**
 * Strip newlines/control characters and cap the length of any externally sourced string before it
 * is logged (FR-009). Safe to apply to values that are already clean.
 */
export function sanitiseLogValue(value: string): string {
  const stripped = value.replace(CONTROL_CHAR_PATTERN, '');
  return stripped.length > MAX_LOG_VALUE_LENGTH
    ? `${stripped.slice(0, MAX_LOG_VALUE_LENGTH)}…`
    : stripped;
}
