# Phase 0 Research: Public Self-Service Sign-Up with Admin Approval

## 1. Shared email-availability lookup

**Decision**: Extract the existing `InvitationsService.checkEmailAvailable()`
(`apps/backend/src/invitations/invitations.service.ts`) into a new
`EmailAvailabilityService` (e.g. `apps/backend/src/shared/email-availability.service.ts`),
injected into both `InvitationsService` and the new `SignupsService`. The extracted method gains
two more checks (pending/verified `signup_requests` rows, and `email_blacklist` rows) beyond its
current two (`UsersRepository.findByEmail`, `InvitationsRepository.findPendingByEmail`).

**Rationale**: The spec's own edge cases require "one check, not several that can disagree"
across active accounts, archived accounts, pending invitations, pending/verified sign-ups, and
blacklisted addresses. The current method is a private implementation detail of
`InvitationsService.create()`; leaving it there and duplicating similar logic in `SignupsService`
would violate that requirement and constitution Principle V (simplicity/no duplicated abstractions).

**Alternatives considered**:

- Duplicate the lookup logic in `SignupsService` — rejected: directly violates the spec's
  single-source-of-truth edge case and risks drift between the two copies.
- Expose `checkEmailAvailable` as a new HTTP endpoint — rejected: nothing in either spec calls
  for a client-facing availability-check endpoint; both 006 and 007 only ever call it
  server-side before creating a resource.

**Result shape**: extend the existing discriminated-union convention:

```ts
type CheckEmailAvailableResult =
  | { kind: 'available' }
  | { kind: 'has_account' }
  | { kind: 'has_pending_invitation' }
  | { kind: 'has_pending_signup' }
  | { kind: 'blacklisted' }; // caller decides how much detail to expose (FR-009)
```

## 2. Email sending (verification, admin notification, welcome, rejection)

**Decision**: Add new methods to a `signups/email.service.ts` (new `EmailService` instance
scoped to the `signups/` module, following the exact construction pattern of
`invitations/email.service.ts` — lazy `nodemailer.createTransport` from `SMTP_*` env vars,
`APP_BASE_URL`-based absolute links, rethrow-on-failure): `sendVerification(to, token)`,
`sendAdminNotification(adminEmails, requestSummary)`, `sendWelcome(to)`,
`sendRejection(to)` (no reason included, per FR-009).

**Rationale**: `invitations/email.service.ts` has no generic/shared mailer abstraction to extend
(research confirmed it's a single hardcoded `sendInvitation` method) — introducing a new
`signups`-scoped instance is simpler (Principle V, YAGNI) than refactoring a shared mailer
abstraction that only two features would ever use, especially since message content/recipients
differ (single invitee vs. all-admins vs. new-user vs. rejected-visitor).

**Alternatives considered**:

- Generalize `invitations/email.service.ts` into a shared `MailerService` with a template
  registry — rejected as premature abstraction for two consumers; revisit if a third
  email-sending feature appears.

**Admin recipient list**: `sendAdminNotification` needs every admin's email — obtained via
`UsersRepository` (already has a role column; needs a new `findAllByRole('ADMIN')`-style query,
or reuse of the existing account-listing query filtered in the service layer).

## 3. Sign-up request schema & repository conventions

**Decision**: New `signup_requests` table added via a new `migrateSignups()` method in
`database.service.ts`, following the exact shape of the `invitations` table:

```sql
CREATE TABLE signup_requests (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('PENDING','VERIFIED','APPROVED','REJECTED')) DEFAULT 'PENDING',
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  verified_at TEXT NULL,
  resolved_at TEXT NULL,
  resolved_by TEXT NULL REFERENCES users(id)
);
CREATE UNIQUE INDEX signup_requests_token_idx ON signup_requests(token);
CREATE INDEX signup_requests_email_idx ON signup_requests(email COLLATE NOCASE);
```

A separate `email_blacklist` table (rather than a `REJECTED` row left in `signup_requests`)
holds the retained-until-admin-clears-it block, so "delete a rejected entry" (FR-011) can
delete the blacklist row directly without ambiguity about whether the `signup_requests` row
itself should also disappear:

```sql
CREATE TABLE email_blacklist (
  email TEXT PRIMARY KEY,     -- COLLATE NOCASE
  reason TEXT NULL,
  created_at TEXT NOT NULL,
  signup_request_id TEXT NULL REFERENCES signup_requests(id)
);
```

**Rationale**: Mirrors the `invitations` table's conventions exactly (UUID id, unique token
index, case-insensitive email index, status enum via `CHECK`) for consistency and so the
race-guarded `UPDATE ... WHERE status = $expected RETURNING *` pattern
(`invitations.repository.ts`) transfers directly to `SignupsRepository`. Splitting rejection
into its own `email_blacklist` table (rather than encoding "rejected + still blacklisted" vs.
"rejected + cleared" as extra status values on `signup_requests`) makes FR-011's two delete
behaviors ("deleting a rejected entry clears the blacklist" vs. "deleting an unverified/pending
one just frees it") a simple presence/absence check on one row, rather than a state machine
with an extra branch.

**Alternatives considered**:

- Single `signup_requests` table with a `blacklisted BOOLEAN` column instead of a separate
  table — rejected: conflates "this specific request was rejected" with "this email address is
  currently blocked," which breaks the required distinction when an admin deletes the rejected
  request row but the address should stay (or stop being) blocked independently.

## 4. Verification-link expiry sweep

**Decision**: New `SignupExpirySweepService` in `apps/backend/src/signups/`, an
`OnModuleInit` class scheduling an hourly `setInterval(...).unref()` sweep, directly mirroring
`apps/backend/src/accounts/retention-sweep.service.ts`. The sweep deletes (or marks) `PENDING`
`signup_requests` rows past `expires_at`, freeing the email with no residual state (per the
spec's edge case).

**Rationale**: This is the exact same "background TTL sweep on an embedded SQLite DB, no
external job scheduler" pattern already proven for account-retention (006); reusing it avoids
introducing a new dependency (e.g. `@nestjs/schedule` or a cron library) per Principle V (YAGNI —
this codebase already solved this problem once).

**Alternatives considered**:

- `@nestjs/schedule` (`@Cron` decorator) — rejected: not already a dependency, and the existing
  hand-rolled `setInterval` pattern is simpler and already tested (Principle V).

## 5. Public-sign-up-enabled toggle

**Decision**: A single new env var, `PUBLIC_SIGNUP_ENABLED` (default `true`, or `false` for
invitation-only deployments), read once in `SignupsController`/`SignupsService` construction —
no generic settings/feature-flag service exists in this codebase (confirmed: no settings table,
no flag library), so this follows the exact ad-hoc pattern already used for
`BOOTSTRAP_ADMIN_*`/`SMTP_*`/`APP_BASE_URL`.

**Rationale**: Introducing a generic feature-flag mechanism for a single boolean would be
premature abstraction (Principle V); a plain env var matches existing convention exactly.

**Alternatives considered**:

- A `settings` DB table admins can toggle at runtime via UI — out of scope for this spec (not
  requested by any FR/acceptance scenario) and would need its own mini-spec; deferred.

## 6. Route & error-response conventions

**Decision**: One `SignupsController` at `@Controller('signups')`, mixing `@Public()` routes
(`POST /signups` submit, `GET /signups/token/:token` verify-lookup or
`POST /signups/token/:token/verify` verify-action — decided in data-model/contracts) with
`@Roles('ADMIN')` routes (`GET /signups` list, `POST /signups/:id/approve`,
`POST /signups/:id/reject`, `DELETE /signups/:id`), exactly mirroring
`InvitationsController`'s mixed-audience shape. A new `SignupsErrorResponse` discriminated union
in `libs/api-contract/src/lib/signups.ts` follows the `InvitationsErrorResponse` shape
(`{ error: '<code>', message: string }`), using `409` for `already_resolved`, `410` for an
invalid/expired verification link (deliberately generic per FR-009/FR-012-equivalent), `400` for
`not_verified` (approve/reject attempted on an unverified request), and `502` for
`email_delivery_failed`.

**Rationale**: Direct precedent in the same codebase (`InvitationsController`) for exactly this
public+admin mixed-controller shape and structured-error convention; reusing it keeps the two
account-onboarding flows consistent for future maintainers.
