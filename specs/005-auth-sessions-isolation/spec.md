# Feature Specification: Authentication, Sessions & Per-User Data Isolation

**Feature Branch**: `005-auth-sessions-isolation`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Household Access Control — foundational slice: session-based sign-in/sign-out and strict per-user data isolation. First of a 4-part split of a consolidated user-management specification (specs 005–008); this slice is the prerequisite for all others."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Sign in / sign out with a server-side session (Priority: P1)

A user opens the app, signs in with their email and password, and reaches only their own data. No route or API is reachable without an authenticated session, and signing out immediately and completely ends that session.

**Why this priority**: Nothing else in the system — admin management, invitations, sign-up, profile settings — has any meaning until authentication exists. This is the load-bearing wall.

**Independent Test**: Create two accounts, sign in as each in turn, and confirm each lands under their own identity with no other feature involved. Confirm every authenticated route redirects an unauthenticated visitor to sign-in.

**Acceptance Scenarios**:

1. **Given** a fresh deployment with no accounts, **When** the first admin account is provisioned, **Then** they can sign in and reach the app.
2. **Given** valid credentials, **When** submitted, **Then** a session is granted and the user reaches the app.
3. **Given** incorrect credentials, **When** submitted, **Then** a generic error is shown that does not reveal whether the email or the password was wrong.
4. **Given** a session that has been inactive past the configured timeout, **When** the user next acts, **Then** the session is treated as expired and they are prompted to sign in again.
5. **Given** an unauthenticated visitor, **When** they open any authenticated route or call any protected API directly, **Then** they are redirected to sign-in (or receive a 401).
6. **Given** a signed-in user, **When** they choose sign out, **Then** the session is destroyed server-side and the next request with the old session is rejected.
7. **Given** repeated failed sign-in attempts on one account, **When** the attempt count crosses a threshold, **Then** further attempts are temporarily locked out with an escalating delay.

---

### User Story 2 - Each user keeps their own private data (Priority: P1)

The system holds one shared instance serving many accounts, but every user's records are visible, editable, and deletable only by that user — never by any other non-admin user, and never through any admin "back door."

**Why this priority**: Data isolation is the entire point of "household access control." A leak here defeats the purpose of having accounts at all, so it ships in the same increment as sign-in.

**Independent Test**: User A creates a record of the target domain entity; sign in as user B and confirm it never appears in any list, dashboard, search result, or export — with no other feature (invitations, admin tools) involved.

**Acceptance Scenarios**:

1. **Given** user A creates a record, **When** user B opens their own equivalent views, **Then** B never sees A's record.
2. **Given** user A edits or deletes their own record, **Then** user B's data and views are entirely unaffected.
3. **Given** user A views any aggregate or summary figure, **Then** every number reflects only A's own data.
4. **Given** pre-existing single-user data at upgrade time, **When** the system is migrated to multi-user, **Then** that data becomes the private data of one bootstrap admin account — nothing lost, nothing shared.
5. **Given** an administrator account, **When** it accesses any other user's records through any surface, **Then** access is denied — an admin role never implies access to other users' private data.

---

### Edge Cases

- A session belonging to an account that is archived, deleted, or otherwise deauthorized mid-use is invalidated on its very next use (a lookup-miss), not only at the next sign-in attempt.
- Session cookies must remain scoped to the app's own origin and unusable if replayed after sign-out.
- A user who changes their password elsewhere has their other active sessions invalidated (coordination point for the profile-management slice; this spec only requires that session storage supports targeted invalidation).
- Ownership of a private record is never displayed anywhere in the UI — it is a server-side-only access-control field.
- An account with zero prior activity (freshly bootstrapped) must still be constrained by the same session rules as any other account.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST require authentication for every route and API that touches user data; nothing is reachable anonymously.
- **FR-002**: The system MUST support multiple distinct accounts, each with its own credentials and identity.
- **FR-003**: A signed-in user MUST be able to end their own session on demand (sign out).
- **FR-004**: Sessions MUST expire automatically after a period of inactivity, and MUST also carry an absolute maximum lifetime independent of activity.
- **FR-005**: Sessions MUST be stored server-side, so that sign-out, inactivity expiry, and account removal all reduce to a delete or a lookup-miss — never a client-trusted token that must itself be believed.
- **FR-006**: Credentials MUST be protected with salted, industry-standard password hashing; raw passwords MUST never be stored or logged.
- **FR-007**: Repeated failed sign-in attempts against one account MUST trigger an escalating temporary lockout, not an unlimited-guess window.
- **FR-008**: Sign-in failures MUST return a generic message that does not reveal whether the submitted email address has an account.
- **FR-009**: Every private data record MUST be scoped to exactly one owning account across every read/write surface — lists, detail views, dashboards, search, export, and import.
- **FR-010**: Ownership of a private record MUST never be displayed in the UI — it is a server-side-only access-control field.
- **FR-011**: The system MUST enforce a role distinction server-side (at minimum, Administrator vs. a regular member role) on every request, not only in the UI; holding the Administrator role MUST NOT by itself grant access to another user's private data.
- **FR-012**: A user's active session(s) MUST be invalidated immediately when a condition external to this spec requires it (e.g., the account is archived, deleted, or its password changed) — this spec provides the session-invalidation primitive that later slices (account management, profile settings) invoke.

### Key Entities

- **User Account**: Identity (email, display name), protected credentials (hash + salt), role, status, and failed-sign-in/lockout counters. Owns a private collection of domain records.
- **Session**: One authenticated period — created at sign-in, ended by sign-out, inactivity expiry, absolute-lifetime expiry, or an external invalidation trigger (account status change, password change).
- **[Resource]**: The application's existing per-user domain entity (substitute the target app's actual entity — e.g. holdings, contracts, documents), extended with a required owner reference; visible, editable, and deletable only by its owner, regardless of role.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of unauthenticated attempts to reach protected routes or APIs are redirected or rejected.
- **SC-002**: Zero cross-account data leaks are observable across any view, dashboard, search, or export in testing.
- **SC-003**: A signed-out or expired session is rejected by the server on its very next use, with no observable grace period.
- **SC-004**: Password guessing through the sign-in form is infeasible within a practical time budget due to escalating lockout.
- **SC-005**: Sign-in failure messages are indistinguishable regardless of whether the submitted email exists, in 100% of tested cases.

## Assumptions

- Session cookies are HTTP-only, `Secure` in production, `SameSite=Lax`, and scoped to the app's own origin.
- Password policy (minimum length, etc.) is defined once here and is expected to be reused verbatim by every other slice that collects a password (invitation acceptance, sign-up, password change, password reset): minimum 8 characters, maximum 200 characters.
- No cross-user sharing or joint ownership of private records is in scope anywhere in the system — data is strictly private per account.
- This spec establishes the Administrator vs. Member role distinction and the session-invalidation primitive; the account-lifecycle rules that call these mechanisms (archiving, invitations, the last-admin invariant) are specified in the companion "Admin Account Management & Invitations" spec.
- The bootstrap/first-admin provisioning mechanism (e.g., a seed step or first-run wizard) is an implementation detail left to the planning phase, not fixed here.
