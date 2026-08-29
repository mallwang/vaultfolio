# Research: Admin Account Management & Invitations

## 1. Email delivery library

**Decision**: `nodemailer`, configured against a generic SMTP transport (host/port/user/pass via
env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`), wrapped in a single
`EmailService` (`apps/backend/src/invitations/email.service.ts`) exposing one method:
`sendInvitation(to: string, token: string): Promise<void>`.

**Rationale**: SMTP is the lowest-common-denominator transactional-email mechanism — every
deployment target (self-hosted mail relay, a provider's SMTP endpoint, a local dev catcher like
MailHog/Mailpit) speaks it, so it avoids locking the household deployment into one vendor's HTTP
API. `nodemailer` is the de-facto standard Node SMTP client, actively maintained, zero
runtime-config surprises. Isolating it behind one narrow `EmailService` interface (mirroring the
constitution's External Market Data isolation rule for outbound integrations) means swapping to a
provider-specific HTTP API later touches one file.

**Alternatives considered**:

- A provider-specific SDK (e.g. Postmark, SES) — rejected: locks a household/self-hosted deployment
  into one vendor; spec Assumptions frame delivery as "SMTP or a transactional API" without
  mandating either, and SMTP is the strict superset (a transactional API can front an SMTP relay,
  the reverse isn't always true).
- Rolling a raw SMTP client by hand — rejected as unjustified complexity per Principle V/YAGNI;
  `nodemailer` is a single well-scoped dependency, not a framework.

**Failure handling**: `sendInvitation` failures (connection refused, auth failure, timeout) are
caught in `InvitationsService`, logged with context (recipient email, SMTP error, not credentials),
and surfaced to the calling admin as a structured 502-class error (`{ error: "email_delivery_failed" }`)
— the invitation row is still created (token exists, admin can resend) so a transient SMTP outage
never silently loses the invite.

## 2. Invitation token shape & expiry

**Decision**: Reuse the session-id pattern from spec 005 (`randomBytes(32).toString('base64url')`)
as the token value — opaque, unguessable, URL-safe, no extra dependency. Default expiry: 7 days
(spec Assumptions: "a few days by default"), configurable via `INVITATION_EXPIRY_DAYS` env var,
mirroring the `SESSION_INACTIVITY_TIMEOUT_MINUTES` / `SESSION_ABSOLUTE_LIFETIME_HOURS` convention
already established.

**Rationale**: Consistency with the existing session-token generation this codebase already trusts
(same entropy source, same encoding) rather than introducing a second token scheme or a JWT
library the constitution's Stack Decision doesn't call for.

**Alternatives considered**: JWT-encoded invitation tokens (self-describing, no DB lookup needed)
— rejected: adds a dependency and a verification-key management concern for no benefit at
household scale; an opaque token with a DB row is simpler (YAGNI) and matches the spec's
requirement that a used/cancelled/superseded token becomes permanently invalid (a JWT's signature
would still verify after use unless additionally tracked in the DB anyway — same DB lookup ends up
required, so the added complexity buys nothing).

## 3. Last-admin invariant as a single shared rule

**Decision**: One pure function, `canRemoveLastAdmin(activeAdminCount: number): boolean` (or
equivalent), in `libs/domain/auth/src/lib/last-admin.ts`. All three enforcement points — role
change to MEMBER, archive, self-delete — call `AccountsService`'s one method that (a) counts
currently-active admins excluding the target account's current contribution, (b) rejects if the
result would be zero. The count query and rejection live in exactly one place in
`AccountsService`; controllers never re-implement the check.

**Rationale**: Directly satisfies Edge Cases' explicit requirement ("a single server-side rule that
all three action paths share — not three independently-maintained checks that can drift out of
sync") and SC-003.

**Alternatives considered**: A DB-level trigger/constraint — rejected: SQLite trigger logic for a
cross-row aggregate check (COUNT of other rows) is harder to unit-test and reason about than an
application-layer service method, and Principle I already establishes pure-function domain logic as
the preferred locus for business rules.

## 4. Race-condition resolution (concurrent admin actions)

**Decision**: Optimistic concurrency via each row's existing `updated_at`/status check inside a
single SQL statement: archive/reactivate and cancel/resend all execute as
`UPDATE ... WHERE id = $1 AND status = $expectedStatus`, checking the affected-row count. Zero rows
affected ⇒ the row's status already moved (raced) ⇒ respond with a specific 409-class error
("this account/invitation was already changed") rather than silently no-op'ing or double-applying.

**Rationale**: Matches Edge Cases' requirement ("resolve deterministically... without leaving the
account or invitation in an inconsistent state") with no new infrastructure (no distributed lock,
no version column) — `better-sqlite3` operations against a single embedded file are already
serialized per Principle V/YAGNI, so the affected-row-count check is sufficient to detect a
same-process race and is trivially testable.

**Alternatives considered**: A dedicated `version` column with optimistic-lock semantics — rejected
as unneeded complexity: the `status`-guarded `UPDATE` already captures the one state transition
that matters (pending→cancelled, active→archived, etc.), so a generic version counter adds a column
and a comparison with no behavior this simpler guard doesn't already provide.

## 5. Retention sweep scheduling

**Decision**: A `setInterval` timer started in `AccountsModule` (or a small `RetentionSweepService`
with `OnModuleInit`), running once per hour, that permanently deletes any `ARCHIVED` user whose
`retention_expires_at` has passed (and cascades to that user's owned data, mirroring spec 005's
`deleteAllForUser` pattern for sessions).

**Rationale**: Spec Assumptions explicitly defer the sweep's schedule to "an implementation detail
for the planning phase." An in-process interval timer needs no new infrastructure (no cron
container, no job queue) at household scale, consistent with Principle V/YAGNI and the existing
single-container backend deployment model.

**Alternatives considered**: An external cron job hitting an admin endpoint — rejected: adds an
operational dependency (something outside the app must be configured to call it) for no benefit
over a timer already running inside the one long-lived backend process the constitution mandates.

## 6. Email-availability lookup (accounts + archived + pending invitations)

**Decision**: `InvitationsService.checkEmailAvailable(email)` queries three sources in one place:
`UsersRepository.findByEmail` (covers both ACTIVE and ARCHIVED — a single table, no separate
archived-accounts store) and `InvitationsRepository.findPendingByEmail`. Returns a single
discriminated result (`available | has_account | has_pending_invitation`) so the invite endpoint
and any future self-service sign-up endpoint (Edge Cases: "this spec's slice of a lookup that a
later spec... extends further") share the same function rather than duplicating the three-source
check.

**Rationale**: Directly satisfies Edge Cases' "one source-of-truth lookup" requirement and keeps
the extension point explicit for the spec that will build on it later.

**Alternatives considered**: Separate checks inline in the controller — rejected as the same
drift-risk the last-admin invariant research item (#3) already rules out for a materially similar
reason.
