# Feature Specification: Notification Center

**Feature Branch**: `043-notification-center`

**Created**: 2026-10-07

**Status**: Draft

**Design**: [design.md](./design.md)

**Input**: User description: "Wiederverwendbares Hinweiscenter (Postfach): Features stellen Hinweise bereit (z. B. mögliche Versicherungsdopplungen, Datenprüfungshinweise der Einkommensentwicklung, später ein nicht versendeter Feedback-Entwurf). Die UI zeigt ein Badge mit der Anzahl offener Hinweise. Hinweise dürfen ausgeblendet werden und sind dann unter 'Ausgeblendet' wieder einblendbar; ausgeblendete Hinweise zählen nicht ins Badge. Das Ausblenden wird lokal gespeichert. Ändert sich der Inhalt eines ausgeblendeten Hinweises (z. B. neue Einkommensdaten erzeugen einen neuen Hinweis), wird er wieder aktiv."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Member sees open hints at a glance (Priority: P1)

A member sees a persistent indicator in the app shell showing how many hints currently need attention. Opening it lists all active hints, each with a title, a short description, a severity (info / warning) and a link that leads directly to the place where the issue can be resolved.

**Why this priority**: Without the central badge and list there is no value; every other story builds on it.

**Independent Test**: With at least two features providing hints, sign in, verify the badge shows the total count, open the list, and follow a hint's link to its target page.

**Acceptance Scenarios**:

1. **Given** features currently provide N active hints, **When** the member views the app shell, **Then** a badge shows N.
2. **Given** there are no active hints, **When** the member views the app shell, **Then** no count badge is shown and the list shows an empty state.
3. **Given** the list is open, **When** the member selects a hint's link, **Then** they are taken to the relevant page and the list closes.
4. **Given** hints from several features exist, **Then** the list groups them by source feature and orders warnings before info hints.
5. **Given** a hint's underlying problem is resolved (e.g. a duplicate insurance is removed), **When** the member next views the app, **Then** the hint is gone and the badge count is reduced accordingly.

---

### User Story 2 - Member hides and restores hints (Priority: P1)

A member can hide a hint they do not want to act on. Hidden hints no longer count in the badge and move to a separate "Hidden" section of the list, from where they can be shown again.

**Why this priority**: Hints that cannot be dismissed become noise and train users to ignore the badge.

**Independent Test**: Hide one of two hints, verify the badge drops by one and the hint appears under "Hidden"; restore it and verify the badge increases again.

**Acceptance Scenarios**:

1. **Given** an active hint, **When** the member hides it, **Then** it disappears from the active list, appears under "Hidden", and the badge count decreases by one.
2. **Given** a hidden hint, **When** the member restores it, **Then** it returns to the active list and the badge count increases by one.
3. **Given** a hint was hidden, **When** the member reloads the app or signs in again on the same browser, **Then** it is still hidden.
4. **Given** only hidden hints exist, **Then** the badge shows no count, and the "Hidden" section remains reachable.
5. **Given** a hidden hint, **When** the content of that hint changes (e.g. new earnings data produces a different data-check finding), **Then** it is treated as a new hint: it becomes active again and counts in the badge.
6. **Given** a hidden hint whose content is unchanged, **When** other hints change, **Then** it stays hidden.

---

### User Story 3 - Features provide hints through a shared contract (Priority: P2)

A feature developer makes a feature's hints appear in the notification center by implementing one shared contract, without touching the notification center itself. The first consumers are the insurance duplicate detection and the earnings data check.

**Why this priority**: The center is only worth building if features can plug in cheaply; the first two consumers prove the contract.

**Independent Test**: Register a hint provider from a feature, verify its hints show up with the correct source, and unregister it (or disable the domain) and verify the hints vanish.

**Acceptance Scenarios**:

1. **Given** a feature provides hints, **Then** they appear in the center without any change to the center's own code.
2. **Given** the insurance duplicate detection finds possible duplicates, **Then** a hint linking to the insurance overview is shown.
3. **Given** the earnings data check finds issues, **Then** a hint linking to the relevant earnings view is shown.
4. **Given** a domain is in maintenance mode or not unlocked for the member, **Then** it provides no hints.
5. **Given** a provider fails to deliver its hints, **Then** the other providers' hints are still shown and the failure does not break the shell.

---

### Edge Cases

- Many hints at once: the badge shows an upper bound (e.g. "9+") while the list shows all hints.
- Two browsers or devices: hiding is local to the browser; a hint hidden on one device remains active on another.
- Different users on one browser: hidden state is kept separately per user and is not shown to another user.
- A hint's content changes back to a previously hidden state: it is treated as a change at the moment it differs from what was hidden; it does not silently re-hide.
- Hidden-state entries for hints that no longer exist are cleaned up so local storage does not grow unbounded.
- Local storage is unavailable or full: hints still work, hiding is only valid for the current session.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST show a hint indicator with a count badge in the app shell for signed-in members.
- **FR-002**: The badge count MUST equal the number of active (not hidden) hints and MUST NOT include hidden hints.
- **FR-003**: System MUST provide a list of hints, each with title, description, severity (info / warning), source feature, and a navigation target.
- **FR-004**: System MUST let features contribute hints through one shared contract, without code changes in the notification center.
- **FR-005**: Hints MUST reflect the current state of the underlying data; a hint whose condition no longer applies MUST disappear.
- **FR-006**: Members MUST be able to hide any hint and restore it again from a "Hidden" section.
- **FR-007**: Hidden state MUST be stored locally in the browser, per user, and survive reloads and new sessions.
- **FR-008**: A hint MUST become active again when its content changes after it was hidden; each hint therefore carries a stable identity and a content signature.
- **FR-009**: Hints from a domain that is in maintenance mode or not unlocked for the member MUST NOT be shown or counted.
- **FR-010**: A failing provider MUST NOT prevent other hints from being shown.
- **FR-011**: The insurance duplicate detection MUST provide its findings as hints.
- **FR-012**: The earnings data check MUST provide its findings as hints.
- **FR-013**: All user-visible texts MUST be available in every supported UI language.
- **FR-014**: The indicator and list MUST be operable by keyboard and expose the count to assistive technology.
- **FR-015**: Interactive elements MUST follow the project's test-id convention.

### Key Entities

- **Hint**: A notice contributed by a feature. Attributes: stable identity, source feature, title, description, severity, navigation target, content signature.
- **Hint State (local)**: Per user and browser, which hint identities are hidden and the content signature at the time of hiding.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A member can see how many hints need attention from any page without navigating.
- **SC-002**: A member can reach the page that resolves a hint in at most two interactions from any page.
- **SC-003**: After hiding a hint, the badge reflects the change immediately, and the hint stays hidden across reloads in 100% of cases on the same browser.
- **SC-004**: A hidden hint with changed content becomes active again in 100% of cases on the next evaluation.
- **SC-005**: A new feature can add hints by implementing only the shared contract, with no modification of the notification center.

## Assumptions

- Hints are derived, not persisted on the server; there is no server-side inbox, history, or read/unread state.
- Hiding is intentionally per browser; cross-device sync is out of scope.
- No push or live updates; hints are re-evaluated on page load and on navigation.
- The unsent-feedback-draft hint is added by the separate Feedback feature (044), which depends on this contract.
- The notification center is a frontend contract in the shared frontend library; domain libraries only implement providers.
- Existing detection logic for insurance duplicates and earnings data checks is reused as-is.
