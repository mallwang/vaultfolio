# Design: User Feedback

**Mockup**: [mockup.html](./mockup.html) (durable local copy, approved; no published Artifact link). All names and data in the mockup are invented.

## Summary

A feedback icon button sits in the authenticated header, left of the hints bell. It opens a modal dialog "Feedback an die Admins" with category, subject and message, a bot-check row, a quota footer and Cancel/Send actions. The dialog closes only via Cancel (with a nested confirmation when text exists) or after successful delivery (success toast). Failures and the daily limit are shown as banners inside the dialog; an unsent draft appears as a hint in the notification center (043). German UI text.

## Layout per region

### Header button (US1; FR-001)

- Icon button, accessible name "Feedback senden", placed immediately left of the hints bell, before the theme toggle.

### Dialog form (US1, US4, US5; FR-002, FR-011, FR-012, FR-016)

- Modal with dimmed backdrop, `role="dialog"`, `aria-modal`, title "Feedback an die Admins" and a one-line note not to include passwords or account data.
- Category as a segmented radiogroup: "Feature-Wunsch", "Problem", "Sonstiges".
- Subject (single line, counter, max 100) and message (multi-line, counter, max 2000); each with a label.
- Invalid fields use `aria-invalid` and `aria-describedby` pointing at the field-level message ("low" state in the mockup).
- Bot-check row ("Sicherheitsprüfung: bestanden") above the footer.
- Footer: quota indicator (five dots, "Noch 4 von 5 Feedbacks in 24 h") on the left; Cancel (text button) and Send (primary) on the right.

### Cancel confirmation (US2; FR-003, FR-004)

- Nested `role="alertdialog"` "Eingaben verwerfen?" over a second backdrop, explaining that subject, message and the local draft are deleted.
- Actions: "Weiterschreiben" (returns to form) and "Verwerfen und schließen" (danger).
- Not shown when both fields are empty; Cancel closes immediately.

### Sending (US1, US2; FR-005)

- Send is disabled and shows a spinner with "Wird gesendet …"; Cancel is disabled; the form stays visible.

### Failed send (US3; FR-007)

- Error banner (`role="alert"`) at the top of the body: "Senden fehlgeschlagen. Dein Text ist nicht verloren: Er wurde als Entwurf in diesem Browser gespeichert." Send stays available for retry.

### Limit reached (US4; FR-010, FR-011)

- Warning banner (`role="alert"`) with the reset time ("Der nächste Slot wird heute um 18:42 Uhr frei"); quota footer in warning style with "Noch 0 von 5 · nächster Slot 18:42 Uhr".
- Send disabled; fields and Cancel stay usable, draft stays stored.

### Success (US1; FR-005)

- Dialog closes; a status toast (`role="status"`) "Danke! Dein Feedback wurde an die Admins gesendet. Noch 3 von 5 heute."

### Draft hint (US3; FR-009)

- Bell shows a count badge; the panel has a group "Feedback" with a warning-style row "Ungesendetes Feedback", a description naming the draft subject, and a link "Entwurf öffnen".

### Mobile (all)

- Dialog is near full width; footer stacks with the primary action on top and quota below or above per the mockup (`column-reverse`); the hints panel becomes the existing 043 modal.

## Requirement traceability

| Region / state       | Stories  | Requirements                   |
| -------------------- | -------- | ------------------------------ |
| Header button        | US1      | FR-001, FR-017                 |
| Dialog form          | US1, US5 | FR-002, FR-012, FR-015, FR-016 |
| Cancel confirmation  | US2      | FR-003, FR-004                 |
| Sending              | US1, US2 | FR-005, FR-014                 |
| Failed send          | US3      | FR-007, FR-008, FR-016         |
| Limit reached, quota | US4      | FR-010, FR-011                 |
| Success toast        | US1      | FR-005                         |
| Draft hint           | US3      | FR-009                         |

## Out of scope for the mockup

- Server behaviour: quota enforcement, idempotency, mail delivery to admins, encrypted storage (FR-006, FR-010, FR-013, FR-014).
- Turnstile verification logic and the real widget states (FR-012).
- Draft storage format and restore logic (FR-007, FR-008), hint provider wiring.
- i18n in all supported languages (FR-015) and test ids (FR-017).
- Admin email layout.

## Visual language

The mockup approximates the PrimeNG Aura preset defaults. The real implementation uses PrimeNG components (`p-dialog`, buttons, inputs) with the app's theme tokens and icon component; exact spacing and colors follow the app theme, not the mockup CSS.
