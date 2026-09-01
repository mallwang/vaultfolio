# Feature Specification: Localized, Templated Email Notifications

**Feature Branch**: `015-localized-email-notifications`

**Created**: 2026-09-01

**Status**: Draft

**Input**: User description: "I would like to enhance the email notifications with a more sophisticated approach. First. they should respect the email correspondence preference language of the user (currently only english or german). Second, the emails should be easily maintainable by humans, maybe there could be some html templates. Third, reusable partials ot the html templates (header, footer, salutation, signature) could be used to adapt things once and apply to all. Lastly, the sender name of the email should be set via environment variable, e.g. "SMTP_SENDER_NAME" to "Vaultfolio" to prevent from showing the from address which is unpersonal to the user. Note that adding languges should be easy for later maintenance."

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Receive emails in the preferred correspondence language (Priority: P1)

A user who has set their email correspondence language to German receives every Vaultfolio notification email (password reset, email-change verification, invitation, sign-up verification, welcome, rejection, admin sign-up alert) in German. A user who has not set a preference, or whose preference is not supported, receives emails in English.

**Why this priority**: This is the core value of the feature — it directly affects every user who has already set an email-language preference (013) but still receives English-only mail. Without this, the rest of the feature (templates, sender name) is cosmetic.

**Independent Test**: Set a test user's email correspondence language to German, trigger each notification type, and confirm the delivered email's subject and body are in German. Set the preference to unset/null and confirm English is used.

**Acceptance Scenarios**:

1. **Given** a user with email correspondence language set to German, **When** the system sends them a password-reset email, **Then** the email subject and body are rendered in German.
2. **Given** a user with email correspondence language set to English, **When** the system sends them any notification email, **Then** the email subject and body are rendered in English.
3. **Given** a user who has never set an email correspondence language, **When** the system sends them a notification email, **Then** the email is rendered in English (the default).
4. **Given** an admin-facing notification with multiple recipients who have different language preferences (e.g. the sign-up admin alert), **When** the email is sent, **Then** each admin recipient receives content in their own preferred language.

---

### User Story 2 - Maintain email content without touching application code (Priority: P2)

A developer who needs to update the wording, styling, or structure of a notification email edits an HTML template file (and its translated text) rather than editing string-literal templates embedded in TypeScript service code.

**Why this priority**: Directly requested by the user as the "maintainability" goal; it doesn't change what end users see today, but it changes how fast and safely future wording/branding changes can be made — a strong secondary value after correctness of localization.

**Independent Test**: Change the wording of one notification's template file only (no TypeScript changes), rebuild/restart, trigger that notification, and confirm the new wording appears in the delivered email without any code changes to the sending logic.

**Acceptance Scenarios**:

1. **Given** an existing notification template, **When** a developer edits its content (copy or layout) in the template file, **Then** the next email of that type reflects the change with no changes required in the service/business logic code.
2. **Given** a shared visual element used by multiple email types (e.g. the footer), **When** a developer edits that shared element once, **Then** every email type that includes it reflects the change the next time it is sent.

---

### User Story 3 - Add a new correspondence language with minimal effort (Priority: P3)

A maintainer wants to add support for a third language (e.g. French) to email notifications. They add the new language's translated template content following the existing pattern, without having to restructure the templating system or touch each notification's sending logic.

**Why this priority**: Explicitly called out as a future-maintainability requirement ("adding languages should be easy"), but it's a lower priority than getting the two current languages (English/German) correct and templated — it's a design constraint validated by inspection/process rather than a day-one user-facing capability.

**Independent Test**: Following only the documented pattern for adding a language, add a new language's content for one existing notification type and confirm it sends correctly to a test user whose preference is set to that new language, with no changes to sending/business logic and no changes to other languages' content.

**Acceptance Scenarios**:

1. **Given** the templating system supports English and German, **When** a maintainer adds a new language following the established pattern, **Then** no existing notification's sending logic (business logic that decides _when_ and _to whom_ to send) needs to change.
2. **Given** a new language has been added for some but not yet all notification types, **When** an email of an not-yet-translated type is sent to a user preferring that language, **Then** the system falls back to English for that email rather than failing to send.

---

### User Story 4 - Emails show a friendly sender name instead of a raw address (Priority: P2)

A recipient viewing any Vaultfolio notification email in their inbox sees a human-readable sender name (e.g. "Vaultfolio") instead of just the raw from-address, and this name is configurable per deployment via an environment variable rather than hard-coded.

**Why this priority**: Explicitly requested; improves trust/recognizability of every outbound email and is a small, independent, low-risk change — grouped at P2 alongside templating since it's part of the same "professionalize outbound email" effort, but is not gated on localization or templating being complete.

**Independent Test**: Set the sender-name environment variable to a test value, trigger any notification email, and confirm the message's From header shows "<Test Value> <configured-address>" in the recipient's mail client rather than the bare address. Unset the variable and confirm the email still sends using a documented default/fallback behavior.

**Acceptance Scenarios**:

1. **Given** the sender-name environment variable is set to "Vaultfolio", **When** any notification email is sent, **Then** the message's From header displays "Vaultfolio" as the sender name alongside the configured from-address.
2. **Given** the sender-name environment variable is not set, **When** an email is sent, **Then** the email still sends successfully, using the from-address alone (or another documented default) without erroring.

---

### Edge Cases

- What happens when a user's stored email-language preference is a value that is not currently supported (e.g. a language that was removed, or invalid data)? → System MUST fall back to English rather than failing to send.
- What happens when a translated template for a given notification type is missing content for the user's preferred language (partial rollout of a new language, per User Story 3)? → System MUST fall back to English for that specific email rather than failing to send or sending a broken/empty template.
- What happens when a shared partial (header/footer/salutation/signature) is edited and accidentally breaks HTML structure? → Out of scope for runtime behavior; addressed by the maintainability workflow (e.g. review/testing before deploy), not a runtime requirement.
- What happens when the recipient's mail client does not render HTML? → Every email MUST continue to include a plain-text alternative body (already current behavior) reflecting the same localized content.
- What happens when the sender-name environment variable contains characters that could break the From header (e.g. angle brackets, quotes)? → System MUST encode/escape the sender name safely so the From header remains valid regardless of configured value.
- What happens for the admin sign-up notification, which can be sent to multiple admins at once with potentially different language preferences? → Each admin MUST receive their own message rendered in their own preferred language (not one email in one language to the whole list).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render every outbound notification email (password reset, email-change verification, invitation, sign-up verification, sign-up admin alert, sign-up welcome, sign-up rejection) in the recipient's stored email correspondence language preference when it is set and supported.
- **FR-002**: System MUST render a notification email in English when the recipient has no stored email correspondence language preference, or when the stored preference is not currently supported.
- **FR-003**: System MUST render a notification email in English for any notification type that does not yet have translated content for the recipient's preferred language, rather than failing to send.
- **FR-004**: System MUST source each notification email's subject, HTML body, and plain-text body from maintainable template content (not string literals embedded directly in business-logic/service code), separated by language.
- **FR-005**: System MUST provide reusable shared building blocks (at minimum: header, footer, salutation, signature) that multiple notification templates include, such that editing one shared building block updates every notification template that uses it without editing each one individually.
- **FR-006**: System MUST support adding a new correspondence language for notification emails by adding new template/translation content following the existing pattern, without requiring changes to the business logic that decides when and to whom each notification is sent.
- **FR-007**: System MUST continue to send both an HTML body and a plain-text fallback body for every notification email, both localized to the same language.
- **FR-008**: System MUST set a human-readable sender display name on the From header of every outbound notification email, sourced from an environment variable (e.g. `SMTP_SENDER_NAME`).
- **FR-009**: System MUST send notification emails successfully (using the from-address alone or another documented default) when the sender-name environment variable is not set.
- **FR-010**: System MUST safely encode the configured sender display name so that any value configured for the sender-name environment variable produces a valid From header rather than malformed or broken email headers.
- **FR-011**: When a single notification is addressed to multiple recipients with differing language preferences (e.g. the sign-up admin alert), the system MUST render and deliver a separate, individually-localized message per recipient rather than one shared-language message to the group.
- **FR-012**: Existing notification-triggering behavior (who receives which email, and when) MUST NOT change as part of this feature — only the language, source-of-content, and sender-name presentation of the emails change.

### Key Entities

- **Notification Email**: A single outbound email of a specific type (e.g. password reset, invitation). Has a type, a recipient, a resolved language, a subject, an HTML body, and a plain-text body.
- **Email Template**: The maintainable, human-editable definition of a notification email's content for one type and one language, composed of shared partials and type-specific content.
- **Shared Partial**: A reusable template fragment (header, footer, salutation, signature) included by multiple email templates.
- **Correspondence Language Preference**: The user's already-existing stored preference (013, `email_language`) determining which language their notification emails should be rendered in.
- **Sender Display Name**: The configured human-readable name shown alongside the from-address in the From header of outbound emails.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of notification emails sent to users with a supported, set email-language preference are delivered in that preferred language.
- **SC-002**: 100% of notification emails sent to users with no preference, or an unsupported/missing preference, are delivered in English with no delivery failures caused by the missing/unsupported preference.
- **SC-003**: A developer can change the wording of an existing notification email by editing template content alone, with zero changes to sending/business-logic code, verified by a passing test that only touches template content.
- **SC-004**: A developer can add a new correspondence language for notification emails by adding new template content alone, with zero changes to existing sending/business-logic code and zero changes to other languages' existing content.
- **SC-005**: 100% of outbound notification emails display the configured sender name in the recipient's inbox when the sender-name variable is configured, verified across all existing notification types.
- **SC-006**: Editing one shared partial (e.g. the footer) and re-sending affected notification types shows the updated content in every one of them, with the edit made in exactly one place.

## Assumptions

- The existing `email_language` user preference (013) — currently English or German — is the single source of truth for which language a notification email should be rendered in; no new preference-selection UI is introduced by this feature.
- "Supported languages" for notification emails starts as English and German, matching the existing 013 preference options, with English as the permanent fallback/default language.
- The list of notification email types in scope is the current set already sent by the system: password reset, email-change verification, invitation, sign-up verification, sign-up admin alert, sign-up welcome, and sign-up rejection.
- The sender email address itself (e.g. `SMTP_FROM`) is unchanged by this feature; only the human-readable display name portion of the From header is newly configurable via an environment variable.
- No user-facing UI changes are introduced; this feature affects only the content, language, and From-header presentation of already-existing outbound emails.
- Template maintainability is addressed by moving content out of business logic into separate, human-editable template artifacts; the specific file format/technology for those templates is an implementation decision left to the planning phase.
