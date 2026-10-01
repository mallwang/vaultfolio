/** Injection token for the list of registered per-type handlers. */
export const REQUEST_TYPE_HANDLERS = Symbol('REQUEST_TYPE_HANDLERS');

export interface RequestAttachmentBuild {
  contentType: 'application/pdf';
  bytes: Uint8Array;
  pageCount: number;
}

/**
 * Server-side behaviour of one request type (registry row in `@vaultfolio/requests`). The generic
 * service looks a handler up by `(feature, type)`; a new feature registers its own handler and
 * needs no change to the requests table, API or mail mechanism (SC-010).
 */
export interface RequestTypeHandler<P = unknown> {
  readonly feature: string;
  readonly type: string;
  /** Throws a `BusinessException` with the error codes of contracts/requests-api.md. */
  validate(payload: unknown): P;
  buildAttachment(valid: P): RequestAttachmentBuild;
  /** What is stored in `requests.payload` (JSON-serialisable). */
  toStoredPayload(valid: P): Record<string, unknown>;
  /** Canonical string whose SHA-256 is stored for duplicate detection. */
  fingerprint(valid: P): string;
}
