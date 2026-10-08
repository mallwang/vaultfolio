# Research: User Feedback

## 1. Encryption of subject and message

- **Decision**: Add a new encryption domain `feedback` (table `feedback_submissions`, `payloadTable`), with a `FeedbackCryptoService` modelled on `insurances-crypto.service.ts`. Payload `{subject, message}` goes into `payload_enc` with `owner_id` and `key_version`. Category and timestamps stay plaintext (needed for quota and mail).
- **Rationale**: The 040 mechanism is per domain. Reusing an existing domain id would mix unrelated data in one key lifecycle. Server-held keys let admins (and later an admin UI) read the content, as the spec requires.
- **Wiring**: id in `ENCRYPTION_DOMAIN_IDS`, entry in `DOMAIN_ENCRYPTION`, startup/rotation coverage, admin encryption screen label + translations. Existing registry specs must be extended.
- **Key unavailable**: fail closed with 503 `feedback_unavailable` before any mail is sent; the client treats it as a failed send (draft kept).
- **Alternatives**: Plaintext like `requests.payload` (rejected: spec FR-013/SC-005); per-user keys (rejected: admins must read).

## 2. Delivery and storage order

- **Decision**: Order: guard (Turnstile) -> validate -> key available -> quota check -> idempotency lookup -> send mails -> insert row. Mail failure = nothing stored, nothing counted, 502 `feedback_delivery_failed`. Insert failure after confirmed delivery = still 201, logged `FeedbackStoreFailed`.
- **Rationale**: Only delivered feedback counts (FR-011) and the user is never told "failed" when admins got it (edge case). Counting by stored rows means a store failure under-counts, which is acceptable and logged.
- **"Delivered"**: at least one admin mail accepted by the SMTP transport. One mail per admin via `Promise.allSettled` in each admin's `emailLanguage` (same pattern as `RequestsEmailService`), but unlike requests the result is awaited and failure is surfaced (signups/invitations pattern). No admins at all = delivery failure (logged `FeedbackMailNoAdmin`).
- **Alternatives**: Insert first then mail (rejected: failed mails would count or need rollback); outbox/retry queue (rejected: spec wants synchronous confirmation).

## 3. Idempotency

- **Decision**: Client generates a UUID `attemptId` when the form opens (new one after success or discard) and sends it with each submit. It is the row `id` (PK). A repeat with an existing id for the same owner returns the original success (200 with the same body, no mail). In flight: an in-process per-user lock serializes submits, so a double click resolves to the lookup path. The UI also disables Submit while sending.
- **Rationale**: No idempotency pattern exists in the repo; a client id as PK is the simplest correct approach on single-instance SQLite. A retry after a failed send reuses the same id, which is safe because failures store nothing.
- **Alternatives**: Content hash dedup (rejected: legitimately identical messages, hides intent); `Idempotency-Key` header middleware (rejected: over-built for one endpoint).

## 4. Quota (rolling 24 h)

- **Decision**: Count rows of the owner with `created_at > now - 24h`. `limit = 5`. `resetAt` = oldest counted `created_at + 24h` (null when none counted). `GET /feedback/quota` returns `{limit, remaining, resetAt}`; `POST` returns the same quota after success and in the 429 body. Limit lives in `@vaultfolio/api-contract` so UI and server agree. Check and insert run under the per-user lock, so concurrent requests cannot exceed the limit.
- **Rationale**: Derived, no counters to drift. Admins have the same limit (spec).
- **Alternatives**: `@nestjs/throttler` (rejected: per IP/in-memory, counts failed attempts and resets on restart).

## 5. Bot protection

- **Decision**: `@TurnstileAction('feedback') @UseGuards(TurnstileGuard)` on `POST /feedback`; field `turnstileToken` in the body; error `bot_protection_failed` (403). Guard runs before the quota check so a rejection never counts. Frontend uses `app-turnstile` (action `feedback`) in a status row; after any failed submit the component is `reset()` because tokens are single-use. `TurnstileModule` is imported into `FeedbackModule`. Without a secret key the backend already skips verification (dev).
- **Alternatives**: None; spec mandates reuse of 026.

## 6. Admin mail

- **Decision**: New notification type `feedback-admin-notice` in `libs/notifications` (folder under `templates/`, en + de) with view model `{category, subject, message, senderName, senderEmail, senderLanguage}`. The subject line is `[Feedback: <category label>] <subject>` rendered in the admin's language. Subject/message are HTML-escaped by the renderer; header injection is avoided because the subject only goes through nodemailer's own header encoding, and newlines in the user subject are rejected at validation (single-line subject).
- **Alternatives**: Plain-text only mail (rejected: all other notifications use the shared renderer).

## 7. API shape and validation

- **Decision**: `POST /feedback` and `GET /feedback/quota` under the existing session auth (`@ApiVaultfolioSessionAuth`, any signed-in role, no domain entitlement). Hand-written validation (no class-validator in the repo) returning `ValidationException` with `details[{field,message}]`. Limits in the contract: subject 1-100, message 1-2000 (placeholders from the mockup; trimmed before checking). Documented in OpenAPI; completeness e2e must stay green.
- **Alternatives**: Adding class-validator (rejected: new dependency, not the repo style).

## 8. Table and retention

- **Decision**: `feedback_submissions(id TEXT PK, owner_id, category CHECK IN (...), language, payload_enc, key_version, created_at)` plus index on `(owner_id, created_at)`. `owner_id` references users; on account deletion rows follow the same cleanup as other owner data (to be confirmed in tasks against `accounts.service`). No retention job (no admin UI yet; storage is for traceability).
- **Alternatives**: Store mail status (rejected: only delivered rows exist).

## 9. Frontend structure and draft

- **Decision**: Shell code in `apps/frontend/src/app/core/feedback`. Draft key `vaultfolio.feedback-draft.<userId>` (same prefix style as hints), value `{version:1, category, subject, message, updatedAt}`; best-effort access like `hints-storage.ts`. Draft is written on: send failure, server rejections (limit, challenge, unavailable), and edits while the limit is reached. Removed on success or confirmed discard. The draft text is the user's own content on their own device; it is cleared on discard/success, not on sign-out (per spec "another user does not see it").
- **Library-First note**: the serializer/isEmpty logic is tiny and only used by the shell; a new lib would be speculative. If a second consumer appears, extract.
- **Alternatives**: Draft on every keystroke for everyone (rejected: spec limits drafts to failed sends, and it would show a permanent hint).

## 10. Hint for an unsent draft

- **Decision**: `FeedbackHintProvider` (root-provided, local to the app) registered in `HINT_PROVIDER_CONTRIBUTIONS` without `domainId`, `sourceId: 'feedback'`. `hints` has one hint `feedback.draft` while a draft exists. The hint target is `['/app']` with query param `feedback=draft`; the shell (feedback store/button) watches that query param, opens the dialog, and removes the param. `ready()` is true immediately (the draft is read synchronously).
- **Rationale**: Hint actions are router links only (043 contract); a query param is the existing no-callback way to open UI from a link. i18n keys `hints.groups.feedback`, `hints.feedback.draft.title|description|linkLabel` in en/de.
- **Alternatives**: Extending the hint contract with a callback action (rejected: changes a shared contract for one use).

## 11. Dialog behaviour

- **Decision**: `p-dialog` with `[modal]=true`, `[closable]=false`, `[dismissableMask]=false`, `[closeOnEscape]=false` and a keydown handler that maps Escape to the Cancel action (including the confirm step; Escape on the confirm = decline). Cancel-confirm is an in-dialog confirm state (no stacked dialog) so focus trap stays simple. `aria-live` regions for banners and field errors; character counters with `aria-describedby`. Cancel disabled while sending. Closes only after the 2xx response; success toast. Test ids per `docs/frontend/testid-conventions.md`: `feedback-open`, `feedback-category`, `feedback-subject`, `feedback-message`, `feedback-submit`, `feedback-cancel`, `feedback-discard-confirm`, `feedback-discard-decline`, `feedback-quota`, `feedback-error`, `feedback-limit-banner`.
- **Note**: No existing dialog in the repo uses `closable=false`/`closeOnEscape`; verify PrimeNG 22 props in the implementation (Context7) rather than assuming.

## 12. i18n

- **Decision**: `feedback.en.ts` / `feedback.de.ts` wired into `en.ts`/`de.ts`, parity spec like other features. Category labels also needed by the mail template (separate dictionary in `libs/notifications`, which is backend-side).
