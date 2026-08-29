# Feature Specification: Public Self-Service Sign-Up with Admin Approval

**Feature Branch**: `007-self-service-signup`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Household Access Control — public registration gated by email verification and an explicit admin approval decision. Third of a 4-part split of a consolidated user-management specification (specs 005–008); depends on spec 005 (auth, sessions, roles) and spec 006 (admin queues, email-availability lookup) being in place."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Visitor submits a sign-up request and verifies their email (Priority: P2)

An unauthenticated visitor who wants access, without waiting for an admin invitation, submits their email and a password on a public page. They then click a verification link sent to that address, which moves their request into the admin's review queue.

**Why this priority**: Self-service sign-up is a convenience path alongside admin-driven invitations (spec 006), not a replacement for them — it can ship independently once accounts and roles exist.

**Independent Test**: Submit a sign-up with a fresh email address, open the verification link, and confirm the request appears in the admin queue with a "verified" status — with no admin action taken yet.

**Acceptance Scenarios**:

1. **Given** a new email address and a policy-compliant password, **When** submitted on the public sign-up page, **Then** a pending sign-up request is created.
2. **Given** an email address that is already an active account, an archived account, a pending invitation, a pending or verified sign-up request, or a blacklisted (previously rejected) address, **When** a sign-up is submitted, **Then** it is rejected.
3. **Given** a pending sign-up request, **When** its verification link is opened, **Then** the request moves to "verified" and enters the admin's review queue, and every administrator is notified by email.
4. **Given** an unused verification link, **When** it expires without being opened, **Then** the request is cleared automatically, freeing the address without any admin action.

---

### User Story 2 - Administrator reviews and resolves sign-up requests (Priority: P2)

An administrator sees verified sign-up requests in a dedicated queue, distinct from accounts and invitations, and either approves (creating an active account) or rejects (with an optional reason) each one. A rejected address is blocked from resubmitting until an admin explicitly clears it.

**Why this priority**: Approval is the gate that makes public sign-up safe to offer at all; it ships together with submission (User Story 1) as the two halves of one usable flow.

**Independent Test**: Approve one verified request and confirm the resulting account can sign in; reject a second and confirm resubmission with that address is blocked until the admin deletes the rejected entry.

**Acceptance Scenarios**:

1. **Given** sign-up requests, **Then** they appear in a table distinct from accounts and invitations, showing email, verification status, and submission date.
2. **Given** a verified request, **When** an admin approves it, **Then** an active account is created and a welcome email is sent to the new user.
3. **Given** a verified request, **When** an admin rejects it (with an optional reason), **Then** a rejection email is sent, no account is created, and the address is blacklisted.
4. **Given** a request that has already been approved or rejected, **When** a second resolution is attempted (including by a second admin acting concurrently), **Then** it is rejected as "already resolved."
5. **Given** an unverified request, **When** an admin attempts to approve or reject it, **Then** the action is refused — only verified requests can be resolved.
6. **Given** a rejected entry, **When** an admin deletes it, **Then** the address's blacklist status is cleared and it becomes available for a new sign-up or invitation.
7. **Given** a still-unverified request, **When** an admin deletes it, **Then** no email is sent and the address is simply freed.
8. **Given** a visitor attempts to sign up with a blacklisted address, **Then** the original rejection reason is never exposed to them.

---

### Edge Cases

- Two admins concurrently resolving the same verified request: the second action must be rejected as "already resolved," never silently overwrite the first outcome or create a duplicate account.
- Email-address availability for a new sign-up must be checked against the single source-of-truth lookup shared with the invitations spec (active accounts, archived accounts, pending invitations) plus this spec's own pending/verified sign-ups and rejection blacklist — one check, not several that can disagree.
- The verification link must work even when opened from a signed-out browser context.
- An expired-and-cleared request must leave no residual blacklist or reservation on the email address.
- Deleting a rejected entry must be distinguishable in effect from deleting an unverified/pending one (the former frees a blocked address; the latter frees an already-available one).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: An unauthenticated visitor MUST be able to submit a sign-up request (email + policy-compliant password) from a public entry point.
- **FR-002**: A sign-up submission MUST be rejected when the email is already an active account, an archived account, a pending invitation, a pending or verified sign-up request, or a blacklisted address — checked as one combined lookup.
- **FR-003**: A unique, single-use verification link MUST be emailed for each sign-up request; opening it MUST mark the request "verified."
- **FR-004**: Every administrator MUST be notified by email when a sign-up request becomes verified.
- **FR-005**: Sign-up requests MUST appear in a table distinct from accounts and invitations, showing email, verification status, and submission date.
- **FR-006**: An administrator MUST be able to approve a verified request, which creates an active account and sends a welcome email.
- **FR-007**: An administrator MUST be able to reject a verified request with an optional reason, which sends a rejection email and blacklists the address.
- **FR-008**: A resolved request (approved or rejected) MUST NOT be approvable or rejectable a second time.
- **FR-009**: The rejection reason MUST NOT be exposed to a visitor who later attempts to reuse the blacklisted address.
- **FR-010**: An unused, expired verification link MUST cause its request to be automatically cleared, freeing the address, without requiring admin action.
- **FR-011**: An administrator MUST be able to delete any sign-up entry; deleting a rejected entry MUST clear its blacklist status and free the address.
- **FR-012**: An unverified request MUST NOT be approvable or rejectable.

### Key Entities

- **Sign-Up Request**: A public registration attempt awaiting review — email, hashed password, verification token/status, submission timestamp, resolution outcome.
- **Rejection / Blacklist Entry**: The retained record of a rejected sign-up — email, optional reason, timestamp — blocking new sign-up attempts against that address until an admin deletes the entry.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of expired or already-resolved sign-up/verification actions are rejected with a specific message and change nothing.
- **SC-002**: 100% of rejected sign-up addresses stay blocked until an admin explicitly clears them.
- **SC-003**: Every verified sign-up request reaches the admin queue and triggers an admin notification, with no missed notifications observed in testing.
- **SC-004**: A visitor can never determine, from the sign-up form's response, whether an address was previously rejected versus simply already registered.

## Assumptions

- Verification links remain valid long enough for a typical inbox-check delay (on the order of a day), mirroring common practice; the exact duration is a configuration value, not a fixed requirement.
- Outbound email delivery is a deployment concern; every email-dependent step in this spec must surface a clear, reported error rather than fail silently when delivery is unavailable.
- This spec assumes accounts, roles, the password policy, and the admin-facing "email availability" lookup already exist as specified in the companion "Authentication, Sessions & Per-User Data Isolation" and "Admin Account Management & Invitations" specs, and extends that lookup with sign-up/blacklist state.
- Whether public sign-up is enabled at all (vs. invitation-only deployments) is a configuration toggle, not something this spec mandates as always-on.
