# Research: Authentication, Sessions & Per-User Data Isolation

**Feature**: `005-auth-sessions-isolation` | **Date**: 2026-08-29

All items below were `NEEDS CLARIFICATION` in the initial Technical Context pass. Each resolves
one such gap; no open unknowns remain.

## 1. Session mechanism: cookie + server-side session table (not JWT)

- **Decision**: Opaque, cryptographically random session ID (`randomBytes(32)`, base64url) stored
  in an httpOnly, `Secure` (prod), `SameSite=Lax` cookie scoped to the app's own origin. The
  session ID is looked up against a `sessions` table in the existing SQLite database on every
  request; a miss (deleted row, expired row) is a 401. No JWT/stateless token is used anywhere.
- **Rationale**: FR-005 explicitly requires sign-out/expiry/account-removal to reduce to "a delete
  or a lookup-miss — never a client-trusted token that must itself be believed." A JWT cannot be
  invalidated server-side without an additional revocation-list table, which just reimplements a
  session table with extra steps. A plain session table is simpler (Principle V, YAGNI) and is the
  direct, obvious implementation of FR-005 and FR-012 (external invalidation triggers).
- **Alternatives considered**:
  - **JWT (stateless)** — rejected: fails FR-005 outright without a revocation list.
  - **`express-session` + a store package** — rejected: pulls in a dependency and an adapter layer
    for something ~80 lines of NestJS middleware/guard does directly against the existing
    `DatabaseService`, matching the "no ORM, thin wrapper" pattern already established by
    `HoldingsRepository`. Also `express-session`'s default MemoryStore is explicitly unsafe for
    production and would need a SQLite store adapter anyway (unmaintained ecosystem for
    `better-sqlite3`), so the net dependency savings of NOT using it are real.
  - **`iron-session` (encrypted stateless cookie)** — rejected: same FR-005 problem as JWT (no
    server-side delete), plus it's an Express/Next-oriented library not a natural NestJS fit.

## 2. Password hashing library

- **Decision**: `argon2` (the `argon2` npm package, native binding to Argon2id).
- **Rationale**: FR-006 requires "industry-standard" salted hashing. Argon2id is the current
  OWASP-recommended default (memory-hard, resistant to GPU/ASIC cracking), and the library
  generates and embeds its own random salt per hash — no separate salt column/management needed.
- **Alternatives considered**:
  - **bcrypt** — viable, widely used, but has a 72-byte input truncation quirk and is not
    memory-hard (weaker against dedicated hardware). Argon2id is the newer OWASP #1 choice.
  - **Node's built-in `crypto.scrypt`** — avoids an extra dependency, but requires hand-rolling
    salt generation/storage and timing-safe verification, i.e. reimplementing what `argon2`
    already does correctly. Rejected per Principle V (don't hand-roll security primitives).

## 3. Login throttling / escalating lockout (FR-007)

- **Decision**: Track `failed_attempts` (int) and `locked_until` (nullable timestamp) columns
  directly on the `users` row (per spec's Key Entities: "failed-sign-in/lockout counters" live on
  User Account). On each failed attempt: increment `failed_attempts`; once it crosses a threshold
  (5), set `locked_until = now + delay`, where delay escalates geometrically per additional
  failure beyond the threshold (30s, 60s, 120s, ... capped at 15 min) so repeated failures don't
  reset to a flat wait. A successful login resets `failed_attempts` to 0 and clears `locked_until`.
  Lockout is checked and enforced before the password comparison runs, and elapsed lockout is
  cleared lazily on the next attempt after `locked_until` has passed.
- **Rationale**: Simplest mechanism that satisfies FR-007's "escalating temporary lockout" and
  SC-004 without a new table, rate-limiter dependency, or external store (Principle V, YAGNI) —
  the counters already live on the row the login flow reads anyway.
- **Alternatives considered**:
  - **`@nestjs/throttler`** — rejected as the primary mechanism: it rate-limits by request
    (typically IP), not by account, so it doesn't satisfy "repeated failed sign-in attempts
    against **one account**" (FR-007) on its own — an attacker rotating source IPs would bypass
    it. It is still useful as a defense-in-depth _global_ rate limit on the login endpoint (cheap
    to add, guards against brute-force volume regardless of account), so it is included as a
    secondary control, not the primary lockout mechanism.
  - **Redis-backed rate limiter** — rejected: introduces a new infrastructure dependency the
    constitution's Technology & Architecture Constraints don't otherwise require (SQLite is the
    only mandated store), and the per-account row is already the natural place for these counters.

## 4. Session invalidation on external triggers (FR-012)

- **Decision**: `sessions.user_id` is a foreign key to `users.id`. Any operation that needs to
  invalidate a user's sessions (account archived/deleted, password changed — implemented by later
  slices, out of scope here) does `DELETE FROM sessions WHERE user_id = ?`. This feature exposes
  that as a plain repository method (`SessionsRepository.deleteAllForUser(userId)`) so later specs
  (profile/password-change, admin account management) call it directly — no event bus or pub/sub
  needed for a same-process, same-database operation.
- **Rationale**: Matches FR-012's framing of this spec as providing "the session-invalidation
  primitive that later slices ... invoke." A direct repository method is the simplest contract a
  future NestJS module can depend on (Principle V).
- **Alternatives considered**: In-process event emitter (`@nestjs/event-emitter`) — rejected as
  unnecessary indirection for a same-process call; would only earn its keep if invalidation needed
  to fan out to multiple unrelated listeners, which it doesn't.

## 5. Authorization / role + ownership enforcement point

- **Decision**: A NestJS `AuthGuard` (validates the session cookie, attaches
  `request.user = { id, role }`, 401s on missing/expired/invalid session) applied globally via
  `APP_GUARD`, with an explicit `@Public()` decorator to opt individual routes out (sign-in,
  health check). A second, narrower `RolesGuard` + `@Roles('ADMIN')` decorator enforces role checks
  where needed (kept minimal in this slice — full admin-management endpoints are FR/spec territory
  for the companion "Admin Account Management" spec). Per-record ownership (FR-009/FR-011) is
  enforced in each repository's `WHERE owner_id = $userId` clause, not as a separate interceptor —
  the same pattern `HoldingsRepository` already uses for its queries, just with the added
  predicate, so ownership can never be forgotten by relying on a filter applied after the fact.
- **Rationale**: A global guard with an explicit opt-out (rather than opt-in per route) makes
  "authenticated by default" (FR-001) structurally true instead of a convention someone can forget
  to apply to a new controller. Enforcing ownership in the query itself (not a post-hoc filter in
  the service/controller layer) means a missing `WHERE` clause fails closed (zero rows) rather than
  leaking another user's row past a forgotten check.
- **Alternatives considered**: Per-route `@UseGuards(AuthGuard)` (opt-in) — rejected: new
  controllers added later could forget it, silently reopening FR-001. Filtering ownership in the
  service layer after an unscoped `SELECT *` — rejected: one missed filter leaks data; scoping the
  query itself is fail-closed.

## 6. Bootstrap / first-admin provisioning

- **Decision**: On backend startup, `DatabaseService`'s migration step checks whether the `users`
  table is empty; if so, it creates a single Administrator account from `BOOTSTRAP_ADMIN_EMAIL` /
  `BOOTSTRAP_ADMIN_PASSWORD` environment variables (required at startup only in that empty-table
  case; the app logs a clear startup error and refuses to serve auth routes if they're unset with
  no existing users). This mirrors the existing `DATABASE_PATH`-via-env convention already used by
  `DatabaseService` and `main.ts`.
- **Rationale**: Spec explicitly leaves this "an implementation detail left to the planning phase."
  An env-var seed on first boot needs no separate CLI tool or setup wizard (YAGNI) and fits the
  container-based deployment model (Technology & Architecture Constraints: single orchestration
  file) — the operator sets two env vars in `docker-compose.yml`/`.env` once.
- **Alternatives considered**: Interactive first-run CLI wizard — rejected: added complexity with
  no benefit in a headless container deployment. A dedicated seed script run out-of-band —
  rejected: an extra manual step that's easy to forget; startup-time check is self-enforcing.

## 7. Migration of existing single-user data (User Story 2, Acceptance #4)

- **Decision**: The same startup migration that creates the bootstrap admin also adds an
  `owner_id` column to the existing `holdings` table (nullable during migration) and, in the same
  transaction, backfills every pre-existing row's `owner_id` to the newly created (or
  already-existing) bootstrap admin's id, then the column is used as `NOT NULL` for all rows going
  forward at the application layer. This runs once, guarded by checking whether `owner_id` already
  exists (idempotent, matching the existing `CREATE TABLE IF NOT EXISTS` migration style).
- **Rationale**: Directly implements spec Acceptance Scenario #4 under User Story 2 ("pre-existing
  single-user data ... becomes the private data of one bootstrap admin account"). Doing it inline
  in `DatabaseService.migrate()` matches the file's existing self-migrating pattern rather than
  introducing a separate migration-runner dependency (Principle V).
- **Alternatives considered**: A dedicated migration framework/tool — rejected: the codebase has
  no such tool today and one row of `ALTER TABLE` + one `UPDATE` doesn't justify adding one.

## 8. Frontend session/auth integration

- **Decision**: A `SESSION_COOKIE`-based approach needs no frontend token storage at all — the
  browser sends the httpOnly cookie automatically on same-origin requests (already proxied through
  nginx per the existing frontend deploy setup). The frontend adds: an Angular `authGuard`
  (functional route guard) that calls a `GET /api/auth/session` endpoint to check auth state before
  activating protected routes, an `HttpInterceptor` that redirects to `/sign-in` on any `401`
  response, and a sign-in page/component under `apps/frontend/src/app/auth/`.
- **Rationale**: HttpOnly cookies mean the frontend never touches the session ID directly (no XSS
  token-theft surface), consistent with the Assumptions section's cookie requirements. This matches
  the existing Angular app's functional-guard/service conventions already used elsewhere in
  `apps/frontend/src/app/`.
- **Alternatives considered**: `localStorage`-held token read by an interceptor and sent as a
  bearer header — rejected: reintroduces a client-trusted, JS-readable token, which is exactly what
  FR-005 and the Assumptions' httpOnly cookie requirement rule out.

## Summary of Technical Context resolutions

| Item                          | Resolution                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Session mechanism             | Opaque cookie ID → server-side `sessions` table (SQLite)                                                         |
| Password hashing              | `argon2` (Argon2id)                                                                                              |
| Login throttling              | Per-account counters/lockout columns on `users`, escalating delay; `@nestjs/throttler` as secondary global guard |
| Cross-slice invalidation hook | `SessionsRepository.deleteAllForUser(userId)`                                                                    |
| AuthN/AuthZ enforcement       | Global `AuthGuard` (opt-out via `@Public()`) + `RolesGuard`; ownership via `WHERE owner_id = $1` in repositories |
| Bootstrap admin               | Env-var seed (`BOOTSTRAP_ADMIN_EMAIL`/`PASSWORD`) on empty `users` table at startup                              |
| Existing data migration       | Inline `ALTER TABLE holdings ADD owner_id` + backfill to bootstrap admin in `DatabaseService.migrate()`          |
| Frontend integration          | HttpOnly cookie (no client token), Angular `authGuard` + `401` interceptor                                       |
