# Feature Specification: User Feedback

**Feature Branch**: `044-user-feedback`

**Created**: 2026-10-07

**Status**: Draft

**Input**: User description: "Feedback-Möglichkeit mit Formular, das an die Admins gesendet wird. Kategorie (Feature, Problem, Sonstiges), Betreff und Text. Modal, das nur über Abbrechen schließt (mit Bestätigung, wenn Text eingegeben wurde). Schließt nach Senden erst, wenn die E-Mail wirklich versandt wurde; bei Fehler wird der Entwurf lokal gespeichert und beim nächsten Öffnen geladen, zusätzlich erscheint ein Hinweis im Hinweiscenter (043). Limit 5 Feedbacks pro 24 Stunden, transparent im Modal angezeigt. Feedback wird zusätzlich verschlüsselt in der Datenbank gespeichert. Bot-Schutz per Turnstile."

**Design**: [design.md](./design.md)

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Member sends feedback to the admins (Priority: P1)

A signed-in member opens a feedback dialog, chooses a category (Feature, Problem, Other), enters a subject and a message, and submits. The dialog stays open while sending and closes only after the message has been delivered to the admins. The member sees a confirmation.

**Why this priority**: This is the core value: a direct channel from members to admins.

**Independent Test**: Open the dialog, fill in all fields, submit, and verify the admins receive an email with category, subject, text, and sender, and that the dialog closes with a confirmation.

**Acceptance Scenarios**:

1. **Given** a signed-in member, **When** they open the feedback dialog, **Then** they can choose one of the categories Feature, Problem, Other and enter subject and message.
2. **Given** all required fields are filled, **When** the member submits, **Then** the dialog shows a sending state and closes only after delivery succeeded, followed by a success confirmation.
3. **Given** required fields are empty or exceed the length limits, **When** the member tries to submit, **Then** submission is blocked with field-level messages.
4. **Given** feedback was delivered, **Then** the admin email contains category (also in the subject line), subject, message, the sender's identity, and the sender's UI language.
5. **Given** the feedback was delivered, **Then** it is also stored in the database with subject and message encrypted at rest.

---

### User Story 2 - Dialog protects against accidental loss (Priority: P1)

The dialog does not close by clicking outside it or by pressing Escape. It closes only through the Cancel button. If text has been entered, cancelling asks for confirmation; without any entered text it closes immediately.

**Why this priority**: Members writing longer messages must not lose them by a stray click.

**Independent Test**: Click the backdrop and press Escape (dialog stays open); cancel with empty fields (closes); type text and cancel (confirmation appears; confirming closes, declining keeps the dialog).

**Acceptance Scenarios**:

1. **Given** the dialog is open, **When** the member clicks the backdrop or presses Escape, **Then** the dialog stays open, except that Escape counts as pressing Cancel.
2. **Given** subject and message are empty, **When** the member cancels, **Then** the dialog closes without confirmation.
3. **Given** subject or message contains text, **When** the member cancels, **Then** a confirmation is shown; confirming discards the input and closes, declining returns to the form.
4. **Given** a send is in progress, **Then** Cancel is disabled until the attempt finishes.

---

### User Story 3 - Failed sends keep the draft (Priority: P1)

When sending fails (network or delivery error), the dialog stays open with an error message, and the draft (category, subject, message) is saved locally in the browser. On the next opening the draft is restored. While an unsent draft exists, the notification center (feature 043) shows a hint that links back to the dialog.

**Why this priority**: Written feedback must not be lost on transient failures.

**Independent Test**: Simulate a failing send, verify the error and that the draft survives closing and reloading; reopen and verify the fields are restored and the hint is shown; send successfully and verify the draft and hint are removed.

**Acceptance Scenarios**:

1. **Given** sending fails, **Then** the dialog stays open, shows an error, and the draft is stored locally for that user.
2. **Given** a stored draft, **When** the member opens the dialog again, **Then** category, subject, and message are restored.
3. **Given** a stored draft exists, **Then** the notification center shows an active hint that opens the dialog with the draft.
4. **Given** a draft is sent successfully, or the member discards it via the cancel confirmation, **Then** the draft and its hint are removed.
5. **Given** another user signs in on the same browser, **Then** they do not see the first user's draft.

---

### User Story 4 - Daily limit is enforced and visible (Priority: P2)

A member can send at most 5 feedbacks within any 24 hours. The dialog shows how many are left and when the next slot frees up. When the limit is reached, submission is disabled and the reason is explained; the member can still write and keep a local draft.

**Why this priority**: Protects admins and the mail system from floods; transparency avoids frustration.

**Independent Test**: Send 5 feedbacks, verify the dialog shows 0 remaining with a reset time and rejects a sixth, including via direct requests.

**Acceptance Scenarios**:

1. **Given** the dialog opens, **Then** it shows the remaining count and the time when the oldest counted feedback expires.
2. **Given** 5 feedbacks in the last 24 hours, **When** the member tries to send another, **Then** the server rejects it and the dialog explains the limit and reset time.
3. **Given** the limit is reached, **Then** the draft can still be edited and stored locally.
4. **Given** a successfully sent feedback, **Then** the remaining count updates immediately.
5. **Given** a failed send, **Then** it does not count against the limit.

---

### User Story 5 - Bot protection (Priority: P2)

Submission requires passing the existing bot challenge, consistent with other protected forms in the app.

**Why this priority**: Prevents automated abuse of the admin mailbox.

**Independent Test**: Submit without a valid challenge result and verify rejection; submit with a valid one and verify success.

**Acceptance Scenarios**:

1. **Given** the challenge is not passed, **Then** the submission is rejected and the member sees a message to retry.
2. **Given** the challenge is passed, **Then** the submission proceeds normally.
3. **Given** a rejection due to the challenge, **Then** it does not count against the daily limit and the draft is kept.

---

### Edge Cases

- The mail transport is down while the database is available: the send is treated as failed, nothing counts against the limit, the draft is kept.
- Mail was delivered but storing in the database fails (or vice versa): the member must not be told the send failed if the admins received it; the outcome is logged for admins.
- Double submission by double-click or repeated Enter: only one feedback is created.
- Very long messages: limited by length caps with a visible character counter.
- Admins sending feedback: same rules and limit as members.
- Local storage unavailable: the dialog works, drafts just cannot be preserved.
- Domain/feature access: the feedback dialog is available to all signed-in members regardless of unlocked domains.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Signed-in members MUST be able to open a feedback dialog from the app shell.
- **FR-002**: The form MUST contain category (Feature, Problem, Other), subject, and message, all required, with enforced length limits.
- **FR-003**: The dialog MUST NOT close via backdrop click; Escape MUST behave like Cancel.
- **FR-004**: Cancel MUST close immediately when subject and message are empty, and ask for confirmation when either contains text.
- **FR-005**: Submission MUST happen only via the Submit action and the dialog MUST close only after delivery to the admins succeeded.
- **FR-006**: The admin email MUST contain category (in the subject line), subject, message, sender identity, and sender UI language, and MUST reach all admin recipients.
- **FR-007**: On failure, the dialog MUST stay open with an error, and category, subject, and message MUST be stored as a local draft per user.
- **FR-008**: A stored draft MUST be restored when the dialog is opened and removed after successful delivery or explicit discard.
- **FR-009**: While a draft exists, the system MUST provide a hint to the notification center (043) that opens the dialog.
- **FR-010**: The system MUST limit each user to 5 successfully sent feedbacks within a rolling 24 hours, enforced on the server.
- **FR-011**: The dialog MUST show remaining count and reset time; failed or challenge-rejected attempts MUST NOT count.
- **FR-012**: Submission MUST require passing the existing bot challenge.
- **FR-013**: Each delivered feedback MUST be stored in the database with category, timestamp, and sender; subject and message MUST be encrypted at rest using the application's existing encryption mechanism so that admins can read them.
- **FR-014**: Repeated submission of the same attempt MUST NOT create duplicate feedbacks.
- **FR-015**: All user-visible texts and the admin email MUST be available in every supported UI language.
- **FR-016**: The dialog MUST be keyboard operable, trap focus, and announce errors to assistive technology.
- **FR-017**: Interactive elements MUST follow the project's test-id convention.

### Key Entities

- **Feedback**: Category, subject (encrypted), message (encrypted), sender, language, created-at.
- **Feedback Draft (local)**: Per user and browser; category, subject, message, last-edited time.
- **Feedback Quota**: Derived from the user's delivered feedbacks within the last 24 hours; yields remaining count and reset time.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A member can send feedback in under 2 minutes from opening the dialog.
- **SC-002**: No written text is lost through accidental backdrop clicks; in simulated send failures the draft is restored in 100% of cases.
- **SC-003**: A sixth feedback within 24 hours is rejected in 100% of cases, including direct requests.
- **SC-004**: Members always see their remaining quota before submitting, with no surprise rejections for the limit.
- **SC-005**: Stored feedback subject and message are not readable in plain form in the database.
- **SC-006**: Admins receive 100% of successfully confirmed feedbacks.

## Assumptions

- Depends on feature 043 (Notification Center) only for the unsent-draft hint; the dialog, draft restore, and sending work without it.
- Admin recipients are the existing administrator accounts; the existing email delivery of the app is reused.
- The bot challenge from feature 026 is reused.
- Encryption uses the application-level mechanism (feature 040), not user-specific keys, because admins must read the content.
- There is no admin UI for browsing stored feedback in this feature; storage serves traceability and later extension.
- No attachments, replies, or ticket status tracking; out of scope.
