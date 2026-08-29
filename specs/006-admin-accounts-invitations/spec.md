# Feature Specification: Admin Account Management & Invitations

**Feature Branch**: `006-admin-accounts-invitations`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Household Access Control — admin-driven account lifecycle and email invitations. Second of a 4-part split of a consolidated user-management specification (specs 005–008); depends on spec 005 (auth, sessions, roles) being in place."

**Design**: See [design.md](./design.md) for the approved UI layout/states and their requirement traceability.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Administrator manages the full account lifecycle (Priority: P1)

An administrator can see every account in the system, active or archived, and can change roles, archive an account (revoking access while preserving its data for a retention window), and reactivate an archived account — entirely through the UI, with no direct database access ever required.

**Why this priority**: Once authentication exists (spec 005), the very next need is a way for an admin to actually manage who has access — this is the core administrative capability the whole feature is named for.

**Independent Test**: As an admin, archive a member's account and confirm sign-in is immediately denied and any active session is invalidated; reactivate within the retention window and confirm access and data return intact.

**Acceptance Scenarios**:

1. **Given** the accounts page, **Then** every account — active and archived — is listed with email, display name, and role.
2. **Given** an admin archives an account, **Then** sign-in is denied for that account and any of its active sessions are invalidated immediately.
3. **Given** a mistakenly archived account, **When** an admin reactivates it within the retention window, **Then** access and the account's original data are fully restored.
4. **Given** a non-admin user, **When** they call an account-management route directly (bypassing the UI), **Then** they are denied with a 403.
5. **Given** the last remaining active administrator, **When** archival or demotion of that account is attempted, **Then** the action is rejected.
6. **Given** a sole administrator attempting to delete their own account, **Then** the deletion is rejected until another administrator exists.
7. **Given** an admin changes a member's role, **Then** the new role takes effect on the member's very next request.

---

### User Story 2 - Email-based invitations (Priority: P2)

An administrator invites a new member by email address alone. The admin never sees or sets the invitee's password — the invitee receives a unique, single-use, time-limited link and chooses their own password to activate the account.

**Why this priority**: This is the primary path by which new accounts are created in a closed household/team deployment, but it depends on account management (User Story 1) existing first, and the system remains usable via manually-provisioned accounts without it.

**Independent Test**: Invite a test email address, confirm a usable, single-use link is generated; separately, complete the invitation with a compliant password and confirm sign-in succeeds.

**Acceptance Scenarios**:

1. **Given** an admin enters an email address, **Then** a unique, single-use, time-limited invitation link is generated and sent to that address.
2. **Given** a pending invitation, **Then** its status and send time are visible to admins, and it can be cancelled or resent.
3. **Given** the invited address already has an active or archived account, **Then** the invitation is rejected with a clear reason.
4. **Given** a second invitation is sent to an address with an existing pending invitation, **Then** the earlier link is superseded and no longer usable.
5. **Given** the invitee opens the link and submits a policy-compliant password, **Then** their account is created and activated, and they can sign in.
6. **Given** a link that has already been used, or one past its expiry, **When** it is opened, **Then** a specific message is shown and nothing about the invitation or any account changes.

---

### Edge Cases

- The last-active-administrator invariant (no archival, no demotion, no self-deletion of the last admin) is enforced as a single server-side rule that all three action paths share — not three independently-maintained checks that can drift out of sync.
- Two admins racing to archive/reactivate the same account, or to cancel/resend the same invitation, must resolve deterministically (last write wins, or the second action is rejected as stale) without leaving the account or invitation in an inconsistent state.
- Email-address availability for a new invitation must be checked as one source-of-truth lookup across active accounts, archived accounts, and pending invitations — this spec's slice of a lookup that a later spec (self-service sign-up) extends further.
- An invitation link must work even when opened from a signed-out browser context (it is, by definition, for someone with no account yet).
- Archiving an account with sessions active in multiple browsers invalidates all of them, not just the one the admin can see.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: An administrator MUST be able to view every account — active and archived — with identity, role, and status, through the UI.
- **FR-002**: An administrator MUST be able to change a member's role, subject to the last-admin invariant (FR-004).
- **FR-003**: Archiving an account MUST retain its data for a defined retention window and MUST be reactivatable by an admin within that window; past the window, the data is permanently deleted.
- **FR-004**: The system MUST prevent removal, demotion, or self-deletion of the last active administrator, enforced as a single shared server-side rule across all three actions.
- **FR-005**: Archiving, demoting, or deleting an account MUST invalidate that account's active session(s) immediately (built on the session-invalidation primitive from the authentication spec).
- **FR-006**: A non-admin calling any account-management route directly MUST be denied (403), regardless of what the UI shows or hides.
- **FR-007**: An administrator MUST be able to invite a new member by email address only; the administrator MUST NOT see or set the invitee's password.
- **FR-008**: Inviting an email address that already has an active or archived account MUST be rejected with a clear, specific reason.
- **FR-009**: A new invitation sent to an address with an existing pending invitation MUST supersede the earlier invitation link.
- **FR-010**: An administrator MUST be able to view the status and send time of a pending invitation, and MUST be able to cancel or resend it.
- **FR-011**: An invitation link MUST activate an account only after the invitee chooses a policy-compliant password; successfully using the link is itself accepted as proof of control over the invited email address.
- **FR-012**: Reusing a completed invitation link, or opening one past its expiry, MUST show a specific message and MUST change nothing about the invitation or any account.

### Key Entities

- **Invitation**: An administrator's pending offer to one email address — token, expiry, status (pending / accepted / expired / cancelled / superseded), and the role the resulting account will receive.
- **User Account** _(extends the entity defined in the authentication spec)_: gains lifecycle status (active / archived), an archival timestamp, and a retention-expiry timestamp used by the archival sweep.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Onboarding or revoking a member's access takes under 3 minutes, UI-only, with no direct data access required.
- **SC-002**: 100% of expired, used, cancelled, or superseded invitation links are rejected with a specific message and change nothing.
- **SC-003**: The last-administrator invariant cannot be bypassed by any of the three paths (archive, demote, self-delete) in testing.
- **SC-004**: An archived account's sessions stop working within one request of the archival action, in 100% of tested cases.

## Assumptions

- Archived accounts and their data are retained 30 days before permanent deletion — adjust to organizational policy.
- Invitation links remain valid for a few days by default, mirroring common practice; exact duration is a configuration value, not a fixed requirement.
- Outbound email delivery (SMTP or a transactional API) is a deployment concern; every email-dependent flow in this spec must surface a clear, reported error rather than fail silently when delivery is unavailable.
- This spec assumes the Administrator/Member role distinction, session-invalidation primitive, and password policy already exist as specified in the companion "Authentication, Sessions & Per-User Data Isolation" spec.
- Permanent deletion of retention-expired archived accounts (the sweep) runs automatically without admin action; its schedule is an implementation detail for the planning phase.
