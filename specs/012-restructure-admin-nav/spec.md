# Feature Specification: Restructure Admin & Settings Navigation

**Feature Branch**: `012-restructure-admin-nav`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "I would like to restructure the authenticated pages a bit:

- all admin related views (Accounts, Sign-up, Invitation, General) should be grouped into a "admin" side-nav entry (out from the settings)
- the preferences from "general" should live in the settings, but as a separate point (like the profile)
- the "settings" side-nav will then only contain the profile and empty preferences (and will be extended soon with other functionality)
- the "admin" side-nav must only be visible for "ADMIN" role, not for "MEMBER" role"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin views moved to a dedicated Admin area (Priority: P1)

An administrator currently finds account management, sign-up review, invitations, and general system status buried as tabs inside "Settings". These are administrative tools, not personal account settings, so they need their own top-level "Admin" side-navigation entry containing Accounts, Sign-ups, Invitations, and General as its sections, separate from Settings.

**Why this priority**: This is the core structural change the rest of the feature depends on — until admin content has moved out, Settings cannot be trimmed down and the role-based visibility rule has nothing distinct to gate.

**Independent Test**: Can be fully tested by signing in as an ADMIN user, opening the new "Admin" side-navigation entry, and confirming Accounts, Sign-ups, Invitations, and General are all present and functioning exactly as before, and that they are no longer reachable from within Settings.

**Acceptance Scenarios**:

1. **Given** a signed-in ADMIN user, **When** they open the side-navigation, **Then** an "Admin" entry is present alongside the existing entries.
2. **Given** an ADMIN user on the Admin page, **When** they view its sections, **Then** they see Accounts, Sign-ups, Invitations, and General, each showing the same content and behavior they had under Settings.
3. **Given** an ADMIN user, **When** they open Settings, **Then** Accounts, Sign-ups, Invitations, and General are no longer shown there.

---

### User Story 2 - Settings split into Profile and Preferences (Priority: P2)

A signed-in user opens "Settings" expecting only personal, self-service options. Today the placeholder "Preferences" card is nested inside the "General" admin tab. It needs to become its own section within Settings, alongside Profile, so Settings holds only personal-account content and can be extended with further personal settings later.

**Why this priority**: This delivers the requested Settings simplification and sets up the placeholder for future settings features; it depends on User Story 1 having relocated the admin-only "General" content out of Settings first.

**Independent Test**: Can be fully tested by signing in as any user, opening Settings, and confirming exactly two sections are shown — Profile and Preferences — with Preferences displaying the existing "coming soon" placeholder content.

**Acceptance Scenarios**:

1. **Given** a signed-in user, **When** they open Settings, **Then** they see two sections: Profile and Preferences.
2. **Given** a signed-in user, **When** they select Preferences, **Then** they see the existing placeholder content indicating preferences are coming soon.
3. **Given** a signed-in MEMBER user, **When** they open Settings, **Then** no admin-only content (Accounts, Sign-ups, Invitations, General) is present.

---

### User Story 3 - Admin navigation hidden from non-admin users (Priority: P1)

A MEMBER user should never see the "Admin" side-navigation entry or be able to reach admin pages by other means, since those tools are not relevant or permitted for their role.

**Why this priority**: This is a visibility/access rule of equal importance to the restructuring itself — moving admin content into one place is only safe once it is also gated to the right role, so it ties for top priority with User Story 1.

**Independent Test**: Can be fully tested by signing in as a MEMBER user and confirming the "Admin" side-navigation entry is entirely absent, then signing in as an ADMIN user and confirming it is present.

**Acceptance Scenarios**:

1. **Given** a signed-in MEMBER user, **When** they view the side-navigation, **Then** no "Admin" entry is shown.
2. **Given** a signed-in ADMIN user, **When** they view the side-navigation, **Then** the "Admin" entry is shown.
3. **Given** a signed-in MEMBER user, **When** they attempt to navigate directly to an admin page address, **Then** they are prevented from viewing admin content (e.g. redirected away or shown an access-denied outcome), consistent with how the system already protects admin-only actions.

---

### Edge Cases

- What happens if a MEMBER user has the Admin page bookmarked or types its address directly? The system must not display admin content to them, matching existing access-control behavior for admin-only actions.
- What happens if a user's role changes from MEMBER to ADMIN (or vice versa) while they have the app open? The side-navigation should reflect the correct entries the next time role/session state is refreshed (e.g. next navigation or reload), consistent with how the rest of the navigation already reacts to session/role state.
- What happens to deep links or bookmarks pointing at the old Settings tabs for Accounts, Sign-ups, Invitations, or General? They should resolve to the equivalent content under the new Admin area rather than a broken or empty Settings tab.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST provide a top-level "Admin" side-navigation entry, distinct from "Settings", for authenticated users.
- **FR-002**: The system MUST relocate the existing Accounts, Sign-ups, Invitations, and General sections from Settings into the Admin area, preserving their current functionality and content.
- **FR-003**: The system MUST relocate the existing "Preferences" placeholder content out of the General section and present it as its own section within Settings.
- **FR-004**: The system MUST limit Settings to exactly two sections: Profile and Preferences.
- **FR-005**: The system MUST show the "Admin" side-navigation entry only to users with the ADMIN role.
- **FR-006**: The system MUST hide the "Admin" side-navigation entry from users with the MEMBER role.
- **FR-007**: The system MUST prevent MEMBER users from viewing admin content even if they navigate to an admin page's address directly, consistent with existing access-control behavior for admin-only actions.
- **FR-008**: The system MUST continue to enforce all existing admin-only rules (e.g. who can approve sign-ups, manage accounts, or create invitations) unchanged by this restructuring — only the navigation location and visibility are changing.
- **FR-009**: The system MUST keep the Settings area accessible to both ADMIN and MEMBER users, unchanged in that respect.

### Key Entities

- **Admin Area**: A new grouping of existing administrative sections (Accounts, Sign-ups, Invitations, General) reachable via its own side-navigation entry, visible only to ADMIN-role users.
- **Settings Area**: The existing personal-account area, narrowed to two sections (Profile, Preferences), remaining visible to all authenticated users regardless of role.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of ADMIN users can locate and access all four relocated admin sections (Accounts, Sign-ups, Invitations, General) from the new Admin side-navigation entry.
- **SC-002**: 100% of MEMBER users see no trace of the Admin side-navigation entry or admin section content anywhere in the interface.
- **SC-003**: Settings shows exactly two sections (Profile, Preferences) for every signed-in user, with zero admin-only sections remaining.
- **SC-004**: No existing admin functionality (account management, sign-up review, invitations, general status) regresses in behavior as a result of the move — all prior actions remain available with identical outcomes, only reached via the new location.

## Assumptions

- "General" refers to the existing General tab currently shown under Settings (system/health status), which moves into the Admin area as-is, minus its embedded Preferences placeholder.
- "Preferences" refers to the existing placeholder card ("Account, currency, and notification settings will live here" / "Coming soon") currently nested inside the General tab; it becomes its own Settings section with the same placeholder content, unchanged for this feature.
- Role naming and enforcement (ADMIN vs. MEMBER) follow the existing role system already used elsewhere in the product; no new roles or permission levels are introduced.
- Direct navigation to an admin page by a MEMBER user should be handled the same way the system already handles unauthorized access to other protected content (e.g. route guarding), rather than introducing a new access-denied experience.
- No new admin capabilities are introduced or removed — this is purely a navigational and visibility restructuring of existing functionality.
