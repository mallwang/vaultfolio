# Feature Specification: Profile, Password & Account Self-Service

**Feature Branch**: `008-profile-password-account`

**Created**: 2026-08-29

**Status**: Draft

**Input**: User description: "Household Access Control — self-service account settings: display name, email change, password change, forgot password, and account deletion. Fourth of a 4-part split of a consolidated user-management specification (specs 005–008); depends on spec 005 (auth, sessions) and reuses the last-admin invariant from spec 006."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Update display name and email (Priority: P2)

A signed-in user updates their display name, which takes effect immediately everywhere it's shown, and separately requests an email address change, which only takes effect once they verify the new address — the old address stays fully active in the meantime.

**Why this priority**: Basic profile self-service is expected of any account system and is independent of admin workflows, but is lower priority than getting accounts and access control working at all.

**Independent Test**: Change the display name and confirm it updates immediately without a page reload; separately, request an email change and confirm sign-in still works with the old address until the new one is verified.

**Acceptance Scenarios**:

1. **Given** a valid new display name, **When** submitted, **Then** it updates immediately with no reload required, and is reflected everywhere the user's identity is shown (e.g. an app-shell header).
2. **Given** an empty display name or one over 100 characters, **When** submitted, **Then** validation rejects it and nothing changes.
3. **Given** a new, currently-unused email address, **When** submitted, **Then** a verification email is sent to the new address and the current address remains active and usable for sign-in.
4. **Given** a requested new email address that is already in use by another account, **When** submitted, **Then** the request is rejected with a conflict message.
5. **Given** a pending email-change verification link, **When** it is opened within 24 hours, **Then** the account's email updates and any other pending email-change tokens for that account are invalidated.
6. **Given** an email-change verification link that is expired or already used, **When** opened, **Then** a specific error is shown and nothing changes.
7. **Given** a new email-change request while one is already pending, **When** submitted, **Then** it supersedes the earlier pending request.

---

### User Story 2 - Change password / recover a forgotten password (Priority: P2)

A signed-in user changes their password by confirming their current one. A signed-out user who has forgotten their password requests a reset link by email and uses it to set a new password and sign in — without ever learning whether the email address they entered has an account.

**Why this priority**: Credential self-service is essential once accounts exist, ships alongside profile settings as the other half of "account settings," but does not block earlier, higher-priority slices.

**Independent Test**: Change password with the correct current password and confirm other active sessions are invalidated; separately, request a password reset for an unknown address and confirm the response is identical to a known one.

**Acceptance Scenarios**:

1. **Given** the correct current password and a policy-compliant new password, **When** submitted, **Then** the password updates and the user's other active sessions are invalidated.
2. **Given** an incorrect current password, **When** a password change is submitted, **Then** the change is rejected and nothing changes.
3. **Given** a forgot-password request for any email address, **Then** the visible response is identical regardless of whether that address has an account.
4. **Given** a valid password-reset link, **When** used with a policy-compliant new password, **Then** the password updates, the token is consumed, and the user is signed in.
5. **Given** an expired or already-used password-reset link, **When** opened, **Then** a specific error is shown; **Given** a fresh reset request for the same account, **Then** it invalidates any earlier outstanding reset token.

---

### User Story 3 - Delete own account (Priority: P3)

From a clearly marked "Danger Zone" in account settings, a user can permanently delete their own account and all data they own, after being advised (but not required) to export their data first, and after an explicit final confirmation.

**Why this priority**: Necessary for completeness and data-rights compliance, but the least frequently used and lowest-risk-if-delayed of the self-service flows.

**Independent Test**: Open the Danger Zone, cancel at the confirmation step and confirm nothing changed; then complete the flow and confirm the account and its data are gone and the user is signed out.

**Acceptance Scenarios**:

1. **Given** account settings, **Then** a visually distinct Danger Zone offers a "Delete Account" action.
2. **Given** the deletion dialog opens, **Then** it advises exporting data first but allows proceeding straight to deletion without exporting.
3. **Given** explicit final confirmation, **When** deletion proceeds, **Then** the account and all data it owns are permanently removed and the user is immediately signed out.
4. **Given** the user is the sole administrator, **Then** the final deletion step is disabled until another administrator exists.
5. **Given** the dialog is cancelled at any point before final confirmation, **Then** nothing about the account changes.
6. **Given** a server error occurs during deletion, **Then** a clear error is shown and the account remains fully intact.

---

### Edge Cases

- Email-change and password-reset links must work even when clicked from a signed-out browser context.
- A password change (whether via "change password" or "reset password") must invalidate the user's other active sessions immediately, reusing the session-invalidation primitive from the authentication spec.
- The forgot-password response-uniformity requirement (Story 2, Scenario 3) must hold even under timing analysis (no observable delay difference between "account exists" and "account doesn't exist" paths).
- An account-deletion request from the sole administrator must be rejected using the same shared last-admin invariant defined in the admin-management spec, not a separate, possibly-inconsistent check.
- A new email-change or password-reset request must invalidate exactly the prior outstanding token of the same kind for that account — not tokens of a different purpose.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Every signed-in user MUST be able to reach account settings to update their display name (1–100 characters).
- **FR-002**: An email-change request MUST keep the current address active and usable for sign-in until a single-use, 24-hour verification link confirms the new address; a new request MUST supersede any earlier pending one.
- **FR-003**: An email-change request MUST be rejected if the requested new address is already in use by another account.
- **FR-004**: The app's shared UI chrome (e.g. header/footer) MUST reflect the signed-in user's avatar, display name, and role on every authenticated view, updating immediately when changed — no reload required.
- **FR-005**: A password change MUST require the user's current password and MUST invalidate the user's other active sessions on success.
- **FR-006**: A forgot-password request MUST respond identically regardless of whether the submitted address has an account; a new reset token MUST invalidate any earlier outstanding reset token for that account.
- **FR-007**: The password policy (shared with the authentication spec) MUST be applied uniformly everywhere a password is set within this spec: profile password change and password reset.
- **FR-008**: A user MUST be able to permanently delete their own account, subject to the last-active-administrator invariant (shared with the admin-management spec), after an optional data-export step, with immediate sign-out on completion.
- **FR-009**: The account-deletion confirmation flow MUST require an explicit final confirmation step and MUST leave the account fully intact if cancelled at any point before that step.
- **FR-010**: A server error during account deletion MUST leave the account fully intact and MUST surface a clear error to the user.

### Key Entities

- **Email Verification Token**: A generic single-use, expiring token used for both email-change confirmation and password reset, distinguished by a purpose field so the two flows share one mechanism without cross-invalidating each other's unrelated tokens.
- **User Account** _(extends the entity defined in the authentication spec)_: gains an optional pending-email field and associated token reference used while an email change is outstanding.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A display-name change is visible everywhere the user's identity appears within the same interaction, with no reload, in 100% of tested cases.
- **SC-002**: 100% of expired, used, or superseded email-change and password-reset links are rejected with a specific message and change nothing.
- **SC-003**: Forgot-password responses are indistinguishable between existing and non-existing addresses in 100% of tested cases.
- **SC-004**: 100% of completed account deletions leave no orphaned records belonging to the deleted account.
- **SC-005**: The last-administrator invariant blocks self-deletion by a sole admin in 100% of tested cases, with no bypass path.

## Assumptions

- Email-change links are valid for 24 hours; password-reset links are valid for 1 hour — mirrors common practice and is a configuration value, not a fixed requirement.
- Password policy (minimum 8 characters, maximum 200) is defined once in the companion "Authentication, Sessions & Per-User Data Isolation" spec and reused verbatim here.
- The last-active-administrator invariant is defined once in the companion "Admin Account Management & Invitations" spec and reused verbatim here for self-deletion.
- Outbound email delivery is a deployment concern; every email-dependent step in this spec must surface a clear, reported error rather than fail silently when delivery is unavailable.
- A user's data export (offered but not required before account deletion) covers only that user's own owned records; its exact format is an implementation detail for the planning phase.
