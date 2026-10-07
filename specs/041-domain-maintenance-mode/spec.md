# Feature Specification: Domain Maintenance Mode

**Feature Branch**: `041-domain-maintenance-mode`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Domänen in Wartungsmodus versetzen. Admins need a domain administration where individual domains can be temporarily deactivated (faulty calculations, faulty export, faulty data, general maintenance) — under Administration, preferably in its own tab. A deactivated domain shows a maintenance notice on its dashboard tile, and a centered orange notice with icon when its navigation item is opened (similar to an empty Altersvorsorge, but orange). Deactivated must not be equated with 'feature not unlocked': the navigation item stays visible. The API must not accept requests for a deactivated domain and returns a matching response. All data in the database must be preserved."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Admin puts a domain into maintenance (Priority: P1)

An administrator notices a problem in one domain (e.g. wrong calculations, a broken export, corrupt data) or needs to perform maintenance work. They open a new "Domains" tab under Administration, see every domain with its current state, and switch a single domain into maintenance mode. They can switch it back at any time.

**Why this priority**: Without the ability to toggle a domain, nothing else in this feature has any effect. It is the core control.

**Independent Test**: As an admin, open the Domains tab, put one domain into maintenance, reload, and verify the state is shown as "in maintenance"; switch it back and verify it is "active" again.

**Acceptance Scenarios**:

1. **Given** an admin is signed in, **When** they open Administration, **Then** a "Domains" tab lists all domains, each with its current state (active / in maintenance).
2. **Given** a domain is active, **When** the admin switches it to maintenance, **Then** the state is persisted and shown as "in maintenance" after the next page load.
3. **Given** a domain is in maintenance, **When** the admin switches it back to active, **Then** the domain is available to members again from their next page load.
4. **Given** a non-admin member is signed in, **When** they try to open the Domains tab or change a domain state, **Then** access is denied.
5. **Given** an admin changes a domain state, **Then** the change is recorded in an audit log with who, which domain, which new state, and when.

---

### User Story 2 - Member sees maintenance notice instead of the domain (Priority: P1)

A member who has access to a domain that is in maintenance still sees its navigation item. Opening it shows a centered orange notice with an icon explaining that the area is temporarily unavailable due to maintenance. The domain's dashboard tile shows a matching maintenance text instead of its normal content.

**Why this priority**: Members must understand why a domain is unavailable; otherwise it looks like a bug or a missing permission.

**Independent Test**: Put a domain into maintenance, sign in as a member entitled to it, verify that the navigation item is still visible, that opening it shows the orange notice, and that the dashboard tile shows the maintenance text.

**Acceptance Scenarios**:

1. **Given** a domain is in maintenance and the member is entitled to it, **When** the member views the navigation, **Then** the domain's navigation item is still visible.
2. **Given** a domain is in maintenance, **When** the member opens it, **Then** a centered orange notice with an icon is shown instead of the domain content.
3. **Given** a domain is in maintenance, **When** the member views the dashboard, **Then** that domain's tile shows a maintenance text instead of its normal content.
4. **Given** a domain is not unlocked for the member, **When** the member views the navigation, **Then** the item remains hidden — maintenance state never makes a hidden domain visible and is visually distinct from "not unlocked".
5. **Given** a member loaded the app before the domain was put into maintenance, **When** they next reload the page, **Then** they see the maintenance state (no live push is required).

---

### User Story 3 - Domain requests are rejected for members during maintenance (Priority: P1)

While a domain is in maintenance, all of its endpoints (reading, writing, export) reject requests from members with a clear "domain in maintenance" response, so no stale or faulty data is served or modified, even by direct requests that bypass the UI.

**Why this priority**: UI-only hiding would not protect against faulty calculations, exports, or data corruption.

**Independent Test**: With a domain in maintenance, send read, write, and export requests for it as a member and verify each is rejected with the maintenance response; send the same requests as an admin and verify they succeed.

**Acceptance Scenarios**:

1. **Given** a domain is in maintenance, **When** a member sends any request to any of its endpoints, **Then** the request is rejected with a response that clearly identifies the maintenance condition.
2. **Given** a domain is in maintenance, **When** an admin sends requests to its endpoints, **Then** they are processed normally.
3. **Given** a domain is in maintenance, **When** the maintenance ends, **Then** requests from members are processed normally again.
4. **Given** a domain is in maintenance, **Then** endpoints of other domains are unaffected.

---

### User Story 4 - Admin keeps working in the domain during maintenance (Priority: P2)

An admin can still open and use a domain that is in maintenance, to reproduce problems, fix data, or rework the domain. A visible indication tells the admin that the domain is currently in maintenance for members.

**Why this priority**: Maintenance is only useful if admins can still work on the domain; but this builds on the core toggle and blocking.

**Independent Test**: Put a domain into maintenance, open it as an admin, and verify that the normal domain UI works and a maintenance indicator is shown.

**Acceptance Scenarios**:

1. **Given** a domain is in maintenance, **When** an admin opens it, **Then** the regular domain UI is shown with an indication that members currently see the maintenance notice.
2. **Given** a domain is in maintenance, **When** an admin views the dashboard, **Then** the tile shows the domain's normal content with the maintenance indication.

---

### User Story 5 - Reminder emails pause and catch up (Priority: P2)

Scheduled reminder emails of a domain (e.g. insurance reminders) are not sent while that domain is in maintenance. Reminders that were skipped are sent after maintenance ends, provided they are still relevant.

**Why this priority**: Prevents notifications based on possibly faulty data, without losing reminders permanently.

**Independent Test**: Put the insurances domain into maintenance across a reminder's due time, verify no email is sent; end maintenance and verify the skipped reminder is sent once.

**Acceptance Scenarios**:

1. **Given** a domain is in maintenance, **When** a reminder for that domain becomes due, **Then** no email is sent and the reminder is not marked as sent.
2. **Given** a reminder was skipped during maintenance, **When** maintenance ends and the next reminder run occurs, **Then** the reminder is sent once, as long as its target date has not yet passed.
3. **Given** a reminder was skipped and its target date has passed by the time maintenance ends, **Then** it is not sent.
4. **Given** reminders of other domains are due, **Then** they are sent normally.

---

### Edge Cases

- A member is on a domain page when the domain is put into maintenance: the next request returns the maintenance response and the UI shows the maintenance notice (no live push needed; a failed request must be handled gracefully, not as a generic error).
- Domain is put into maintenance and back repeatedly in quick succession: only the latest state counts; every change is logged.
- Multiple domains are in maintenance at the same time: each is handled independently.
- Background jobs other than reminders that touch a domain's data (e.g. data refresh): they are not required to pause; only member-facing requests and reminder emails are in scope.
- A domain that a member is not entitled to is also in maintenance: the item stays hidden; entitlement takes precedence for visibility.
- Existing sessions, entitlements, and unlock settings are unchanged by entering or leaving maintenance.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The Administration area MUST provide a dedicated "Domains" tab, accessible to admins only, listing every domain with its current maintenance state.
- **FR-002**: Admins MUST be able to switch each domain individually into and out of maintenance mode; there is no finer granularity than the whole domain.
- **FR-003**: The maintenance state MUST be persisted and survive restarts.
- **FR-004**: Entering maintenance mode MUST NOT delete, alter, or hide any stored data of the domain.
- **FR-005**: While a domain is in maintenance, the system MUST reject every request from non-admin members to all endpoints of that domain (read, write, export) with a response that clearly identifies the maintenance condition, distinguishable from permission or generic errors.
- **FR-006**: While a domain is in maintenance, admins MUST retain full access to the domain's endpoints and UI.
- **FR-007**: The navigation item of a domain in maintenance MUST remain visible to members entitled to the domain.
- **FR-008**: Opening a domain in maintenance as a member MUST show a centered notice with an icon in an orange (warning) style, visually analogous to the empty-state of a domain but in orange.
- **FR-009**: The dashboard tile of a domain in maintenance MUST show a maintenance text for members instead of the regular tile content.
- **FR-010**: Admins viewing a domain or its dashboard tile during maintenance MUST see an indication that the domain is in maintenance for members.
- **FR-011**: The maintenance state MUST be independent of the existing "domain unlocked/entitled" mechanism: it MUST NOT grant, revoke, or hide access, and a domain in maintenance MUST NOT be presented as "not unlocked".
- **FR-012**: Maintenance notices on the tile and on the domain page MUST be provided by shared UI components so all domains present them consistently; texts MUST be available in all supported languages.
- **FR-013**: State changes take effect for members on the next page load or request; live push to open sessions is not required.
- **FR-014**: Scheduled reminder emails of a domain MUST NOT be sent while that domain is in maintenance, and MUST NOT be marked as sent.
- **FR-015**: Reminders skipped during maintenance MUST be sent after maintenance ends if their target date has not passed; reminders whose target date has passed MUST NOT be sent retroactively.
- **FR-016**: Every maintenance state change MUST be written to an audit log containing the acting admin, the domain, the new state, and the timestamp.
- **FR-017**: Maintenance state MUST be readable by signed-in members (to render notices and tiles) but changeable only by admins.

### Key Entities

- **Domain maintenance state**: Per-domain flag indicating whether the domain is active or in maintenance; includes who last changed it and when.
- **Maintenance audit entry**: Record of a state change: acting admin, domain, previous and new state, timestamp.
- **Domain**: Existing product area (e.g. holdings, retirement, insurances, earnings); gains a maintenance state independent of entitlements.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An admin can put a domain into maintenance, or end it, in under 30 seconds from opening Administration.
- **SC-002**: 100% of member requests to a domain in maintenance are rejected with the maintenance response, and 0% of member-visible data is served from it.
- **SC-003**: 100% of the domain's stored data is identical before and after a maintenance period.
- **SC-004**: After a state change, members see the new state on their next page load in 100% of cases.
- **SC-005**: Members opening a domain in maintenance see an explanatory notice instead of an error in 100% of cases.
- **SC-006**: No reminder email for a domain is sent during its maintenance, and each skipped, still-relevant reminder is sent exactly once after maintenance ends.
- **SC-007**: 100% of state changes appear in the audit log with actor and timestamp.

## Assumptions

- "Members" are non-admin users; admins are the existing administrator role.
- The set of domains is the existing domain registry; each domain's endpoints can be identified as belonging to exactly one domain.
- No custom notice text is required; a fixed, translated text is used (de/en).
- Default state for every domain is active.
- The audit log can reuse the application's existing logging/audit facilities; viewing the log in the UI is out of scope.
- Only member-facing requests and reminder emails are paused; other internal background jobs are out of scope.
- Reminder catch-up relies on reminders being tracked as "not yet sent" until actually sent.
