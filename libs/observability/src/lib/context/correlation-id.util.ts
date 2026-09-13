import { randomUUID } from 'node:crypto';

/**
 * Per specs/030-observability-logging-error-handling/data-model.md#correlationreference-identifier:
 * reuse an inbound `X-Correlation-Id` (primary) or `x-request-id` (fallback) header only when it
 * is a syntactically valid UUID; otherwise generate a fresh one. A malformed or oversized inbound
 * value is never trusted as-is (FR-009) — it silently falls through to generation rather than
 * being rejected or echoed back unsanitised.
 */

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: string | undefined): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

/**
 * Resolve the correlation ID for one inbound request from its headers, accepting a client-supplied
 * value only when it is a syntactically valid UUID.
 */
export function resolveCorrelationId(
  headers: Record<string, string | string[] | undefined>,
): string {
  const primary = firstValue(headers['x-correlation-id']);
  if (isValidUuid(primary)) {
    return primary;
  }

  const fallback = firstValue(headers['x-request-id']);
  if (isValidUuid(fallback)) {
    return fallback;
  }

  return randomUUID();
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
