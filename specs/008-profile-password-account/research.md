# Research: Profile, Password & Account Self-Service

## 1. Self-delete route: reuse `AccountsService.deleteSelf`, expose it outside `/accounts`

**Decision**: `AccountsService.deleteSelf(actorId, targetId)` (`apps/backend/src/accounts/accounts.service.ts`)
already implements exactly what this spec's User Story 3 needs — `actorId === targetId` check,
`canRemoveLastAdmin` invariant, `sessions.deleteAllForUser`, `users.deleteById` cascade — and is
already covered by 006's tests. The only problem is reachability: its sole HTTP route,
`DELETE /api/accounts/:id`, sits on `AccountsController`, which carries a class-level
`@Roles('ADMIN')` (`RolesGuard` checks `getAllAndOverride` across method+class metadata, so nothing
short of a method-level override changes that). A `MEMBER` calling it today gets a 403 before
`AccountsService` ever runs, regardless of the service already being self-scoped internally.

`ProfileController`'s `DELETE /api/profile/account` route (new, no `@Roles()` decorator — only the
global `AuthGuard` applies) calls `AccountsService.deleteSelf(currentUser.id, currentUser.id)`
directly (`ProfileService` injects `AccountsService`). Zero duplicated logic; `/api/accounts/:id`'s
existing `DELETE` stays as-is for now (still technically reachable by an admin deleting themselves
via the admin UI, redundant but harmless — not removed, to avoid an unrelated behavior change
outside this spec's scope).

**Rationale**: Directly satisfies FR-008's "reused, not duplicated" spirit and the Edge Cases'
explicit requirement that self-deletion "use the same shared last-admin invariant... not a
separate, possibly-inconsistent check" — reusing the _service method_, not just the _predicate_,
is the strongest form of that guarantee.

**Alternatives considered**: Loosening `AccountsController`'s guard with a method-level
`@Roles('ADMIN', 'MEMBER')` override on just the `DELETE` route — rejected: semantically confusing
(an "admin accounts management" controller with one route any member can call), and would require
also reworking its `403`/`404` response shapes to distinguish "not found" from "not yours," which
`ProfileController`'s self-only route (no `:id` param at all — always the caller) sidesteps
entirely by construction.

## 2. Email-change conflict check: extend `EmailAvailabilityService`

**Decision**: `EmailAvailabilityService.check(email)` (`apps/backend/src/shared/`) already answers
"can this email be used right now" against `users` → pending `invitations` → active
`signup_requests` → `email_blacklist`. `ProfileService.requestEmailChange` calls it unchanged for
the new address; a `has_account` (or any non-`available`) result maps to FR-003's conflict
rejection. No changes needed to `EmailAvailabilityService` itself — the requesting user's own
current email is structurally never the new address being checked (the frontend field distinguishes
"current" from "change to", and the service does the same not-equal check as any other new-value
validation).

**Rationale**: Reuses the "one source-of-truth lookup" already established in 006/007's research
(that item's own rationale — drift risk of duplicated checks — applies identically here).

**Alternatives considered**: A narrower `users`-only check inline in `ProfileService` — rejected:
would let a user "steal" an email that's mid-invitation or mid-signup elsewhere, a conflict the
existing service already prevents for every other entry point.

## 3. Generic token table with a `purpose` column (`account_action_tokens`)

**Decision**: One new table, `account_action_tokens`, with a `purpose TEXT NOT NULL CHECK (purpose
IN ('EMAIL_CHANGE','PASSWORD_RESET'))` column, following the exact `invitations`/`signup_requests`
convention (opaque `randomBytes(32).toString('base64url')` token, status-guarded
`UPDATE ... WHERE status = $expected RETURNING *`, lazy expiry-on-read). A `new_email` column is
`NOT NULL` only for `EMAIL_CHANGE` rows (`NULL` for `PASSWORD_RESET`) — one table, one repository
(`AccountActionTokensRepository`), purpose-scoped lookup methods (`findPendingByUserAndPurpose`,
`findByTokenAndPurpose`) so a `PASSWORD_RESET` token can never satisfy an `EMAIL_CHANGE` lookup or
vice versa (Edge Cases' explicit requirement).

**Rationale**: Directly implements the spec's own Key Entities section ("a generic single-use,
expiring token used for both email-change confirmation and password reset, distinguished by a
purpose field"). A single table (not two) is the simpler option and is what the spec text itself
already specifies — unlike 006/007, where two separate tables predate this spec and are left alone
(not retrofitted onto the new generic shape, to avoid an unrelated migration/behavior change to
already-shipped features).

**Alternatives considered**: Reusing `invitations` or `signup_requests` directly with a new purpose
value — rejected: both tables carry columns specific to their own flow (`role`, `invited_by` /
`password_hash`, `email_blacklist` linkage) that have no meaning for email-change or password-reset,
and conflating them would make every existing query on those tables need a `purpose`/`kind` filter
it doesn't need today. A dedicated table matches the spec's own framing and keeps 006/007 untouched.

**Expiry**: `EMAIL_CHANGE` tokens: 24 hours (spec Assumptions). `PASSWORD_RESET` tokens: 1 hour
(spec Assumptions) — configurable via `EMAIL_CHANGE_EXPIRY_HOURS` / `PASSWORD_RESET_EXPIRY_HOURS`
env vars, mirroring 006's `INVITATION_EXPIRY_DAYS` convention.

**Supersede rule**: Creating a new token of a given purpose for a given user sets any existing
`PENDING` token of that _same_ purpose for that _same_ user to `SUPERSEDED` in the same
transaction — scoped by `(user_id, purpose)`, never cross-purpose (Edge Cases: "not tokens of a
different purpose").

## 4. Third `EmailService`, not a shared one — deferred extraction

**Decision**: Add `apps/backend/src/profile/email.service.ts` as a third near-duplicate of
006/007's `EmailService` classes (`sendEmailChangeVerification(to, newEmail, token)`,
`sendPasswordReset(to, token)`), same `nodemailer` transport-per-send pattern, same
`APP_BASE_URL` validation. Do **not** extract a shared `libs/.../email` library in this pass.

**Rationale**: Principle V/YAGNI — the three services are each ~50 lines, single-purpose, and the
"shared abstraction" 006's research already flagged as worth revisiting is a refactor with no
behavior change and no urgency; doing it as a drive-by inside this feature risks touching
006/007's already-shipped, already-tested code for a purely cosmetic win. Flagged here (as 006's
research also flagged it) so a future spec/chore can extract `libs/shared/email` once a fourth
consumer makes the duplication cost clearly outweigh the extraction cost.

**Alternatives considered**: Extracting the shared library now — rejected per the above; would
expand this spec's blast radius into two already-complete features for no functional requirement
driving it.

## 5. Session invalidation: "other" sessions, not all sessions

**Decision**: Add `SessionsRepository.deleteAllForUserExcept(userId, exceptSessionId)` — the same
`DELETE FROM sessions WHERE user_id = $1` as the existing `deleteAllForUser`, plus `AND id != $2`.
`ProfileService.changePassword` and `.resetPassword` (the "change" path, which has a live session;
the "reset via link" path has none yet, so it just calls `deleteAllForUser` since there's no
"current" session to spare) call the new method, passing the request's own session id.

**Rationale**: FR-005 and the Edge Cases explicitly require keeping the acting session alive
("invalidate the user's _other_ active sessions") — distinct from 006's archive/self-delete
behavior, which intentionally kills every session including any current one (the account no longer
exists/is inaccessible either way). The existing `deleteAllForUser` stays unchanged and still backs
those two call sites; this is an additive method, not a modification of shared behavior.

**Alternatives considered**: Reusing `deleteAllForUser` and having the frontend silently re-sign-in
after a password change — rejected: signs the user out of the very tab that just changed the
password, a worse UX than the spec's own acceptance criteria call for, and harder to test
deterministically (a race between "sessions deleted" and "new session cookie set").

## 6. Forgot-password response uniformity, including timing

**Decision**: `ProfileService.requestPasswordReset(email)` always performs the same sequence of
operations regardless of whether the email matches a user — look up the user (present or not),
and if present, additionally perform the token-supersede + insert + email-send. To keep the _no_
branch from being trivially faster (a bare lookup vs. a lookup + write + SMTP call), the no-match
branch also runs an equivalent-shaped dummy write (an `INSERT ... ON CONFLICT DO NOTHING`-style
no-op against a scratch row, or simpler: the lookup itself, plus awaiting a resolved promise chain
of the same depth as the real path) before returning the identical `{ accepted: true }` body either
way. The controller returns `200 { accepted: true }` unconditionally — no `404`/`400` branch exists
for "email not found" at all, so there is no distinguishing status code to leak either.

**Rationale**: Directly satisfies FR-006, SC-003, and the Edge Cases' explicit timing-analysis
requirement. Matching response _shape_ alone (as 006/007 do for their own uniform-response
requirements) is necessary but not sufficient once the spec calls out timing specifically — the
dummy-write approach costs one extra no-op DB statement on the miss path, which is cheap enough at
household scale to not need a more elaborate constant-time framework.

**Alternatives considered**: A fixed artificial delay (`setTimeout`) on the miss path tuned to match
the hit path's average latency — rejected: brittle (SMTP latency varies per attempt, so a fixed
delay either overshoots or leaks variance) and adds a magic-number constant to maintain; matching
the _operation shape_ rather than adding a timer is more robust and self-documenting.

## 7. Header role badge

**Decision**: `app-header.component.html` gains one `<span class="role-badge">` bound to
`user()?.role`, next to the existing display-name/avatar — `SessionUser.role` (`libs/api-contract`)
already exists and is already populated by `CurrentUserStore`; this is a template-only change, no
new API call.

**Rationale**: Closes FR-004's "reflect... role" gap identified against the current implementation
(the field existed but wasn't rendered) with the smallest possible change — no new DTO, no new
request.

**Alternatives considered**: A full profile-menu dropdown replacing the current inline
name+avatar+sign-out — rejected as out of scope; not requested by any acceptance scenario, and
design.md's approved mockup keeps the existing header shape with one addition.
