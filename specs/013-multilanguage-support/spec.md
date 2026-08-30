# Feature Specification: Multilanguage Support

**Feature Branch**: `013-multilanguage-support`

**Created**: 2026-08-30

**Status**: Draft

**Input**: User description: "I would like to add multilanguage support to the application via a global language switcher in the header navbar. It should be persisted for later visits. Additionally, the user should be able to configure the email correspondence language as a separate configuration (maybe stored in the db), this will be used for later cron-based email notifications."

**Design**: [design.md](./design.md) — approved mockup: flag+name header language switcher next to the theme toggle; email correspondence language field on Settings › Preferences.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Switch the application display language (Priority: P1)

A user opens the application and wants to use it in a language other than the default. They open a language switcher in the header navbar, pick a language, and the entire interface immediately updates to that language. The next time they return, the application remembers their choice without them needing to select it again.

**Why this priority**: This is the core of the feature — without it there is no multilanguage support at all. It delivers immediate, visible value and is independently testable/demoable on its own.

**Independent Test**: Open the app, use the language switcher to pick a non-default language, verify all visible UI text changes to that language, reload the page (or return in a new session) and verify the chosen language is still applied.

**Acceptance Scenarios**:

1. **Given** a user viewing the application in the default language, **When** they open the header navbar language switcher and select a different supported language, **Then** all UI text on the current screen updates to the selected language without a full page reload being required.
2. **Given** a user has previously selected a non-default language, **When** they close the application and return later (new browser session, same device/browser), **Then** the application loads directly in their previously selected language.
3. **Given** a user has never selected a language, **When** they visit the application for the first time, **Then** the application displays a reasonable default language.
4. **Given** a user is authenticated on multiple devices/browsers, **When** they change the display language on one device, **Then** that change applies only to that device/browser — other devices/browsers keep their own independently-stored display language until changed there too.

---

### User Story 2 - Configure a separate email correspondence language (Priority: P2)

A user wants automated emails from the application (e.g., notifications sent by scheduled/cron jobs) to arrive in a language of their choosing, which may be different from the language they browse the application in (e.g., they use the app in English at work but want emails in their native language).

**Why this priority**: This depends on languages being supported at all (User Story 1 establishes the language catalog and translation content), but is a distinct, separately valuable and separately testable capability — a user can set this preference even before any cron email feature exists, and it can be verified independently by inspecting the stored preference.

**Independent Test**: As a logged-in user, open account/profile settings, set an email correspondence language different from the current display language, save, and verify the stored preference reflects the new value (and is independent of the display language setting).

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they open their account settings, **Then** they find a dedicated setting for "email correspondence language" that is distinct from the display language switcher.
2. **Given** a logged-in user has not explicitly set an email correspondence language, **When** the system needs a language for an outgoing email, **Then** it falls back to a sensible default (e.g., the user's current display language preference, or the application's default language).
3. **Given** a logged-in user sets their email correspondence language to a supported language, **When** they save the setting, **Then** the choice is persisted to their account and remains set across sessions and devices.
4. **Given** a user changes their display language, **When** they have already explicitly set an email correspondence language, **Then** the email correspondence language is unaffected (the two settings are independent).

---

### User Story 3 - Content is available in all supported languages (Priority: P3)

For the feature to be meaningful, the application's user-facing text (navigation, labels, messages, and eventually email templates) must actually exist in each supported language, not just allow switching.

**Why this priority**: This is a content/completeness concern rather than a mechanism — the switching mechanism (P1) and the settings mechanism (P2) can be built and demoed with partial or placeholder translations, but full value requires translated content. It is called out separately so scope and quality bar are explicit.

**Independent Test**: For each supported language, navigate through the primary screens and confirm labels/messages render in that language rather than falling back to the default or showing raw translation keys.

**Acceptance Scenarios**:

1. **Given** a supported language is selected, **When** a user navigates through the primary areas of the application, **Then** no untranslated placeholder text or raw translation keys are visibly shown to the user.
2. **Given** a piece of UI text has no translation yet for the selected language, **When** it is displayed, **Then** the system falls back to the default language's text rather than showing a broken or empty string.

---

### Edge Cases

- What happens if a user's browser/OS language is a supported language but they have never made an explicit choice — should the app auto-detect it, or always start from the fixed default? (Resolved by Assumptions below with a documented default.)
- What happens when a user selects an email correspondence language but is later using the app in a context where email language cannot be resolved (e.g., an anonymous/system-triggered email not tied to a specific user)? Such emails use the application's default language.
- How does the system handle a supported language being added or removed in the future — existing users' stored preferences for a removed language should fall back gracefully to the default rather than erroring.
- What happens if a user changes their email correspondence language while a scheduled/cron email is already queued or being generated? The email should use whichever language preference was current at the time the email content was generated/sent, not require special handling of a race condition.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The application MUST provide a language switcher control in the header navbar, visible and accessible from every screen.
- **FR-002**: The language switcher MUST list all supported display languages and indicate which one is currently active.
- **FR-003**: Selecting a language from the switcher MUST update all translatable UI text currently on screen to the selected language.
- **FR-004**: The system MUST persist the user's selected display language on their device/browser (independent of their account) so that it is automatically applied on their next visit to that same device/browser, without requiring the user to reselect it. This preference does not sync to other devices/browsers.
- **FR-005**: The system MUST apply a defined default display language for users/visitors who have not made an explicit selection.
- **FR-006**: The system MUST provide a dedicated, separate setting where an authenticated user can configure their "email correspondence language," independent of their display language.
- **FR-007**: The email correspondence language setting MUST be persisted as part of the user's account data (not just local/browser storage), so it is available to backend processes (e.g., scheduled email jobs) that do not run in the user's browser.
- **FR-008**: If a user has not explicitly set an email correspondence language, the system MUST fall back to a defined default (their display language preference if known, otherwise the application default language) when generating correspondence for them.
- **FR-009**: Changing the display language MUST NOT alter an already explicitly-set email correspondence language, and vice versa.
- **FR-010**: The system MUST support at least two languages at launch, with the ability to add further supported languages without redesigning the switcher or settings mechanism.
- **FR-011**: When translated text is missing for a given supported language, the system MUST fall back to the default language's text rather than showing empty text or a raw translation key.
- **FR-012**: The set of supported languages MUST be presented identically (same list, same names) in both the display language switcher and the email correspondence language setting, since email correspondence language is chosen from the same supported-language catalog.

### Key Entities

- **User Language Preference**: Represents an individual's display language choice for the application UI. Attributes: selected language, scope (whether tied to account or device — see clarification), last-updated timestamp.
- **Email Correspondence Language Setting**: Represents an individual's chosen language for outbound email communications, stored against their account. Attributes: selected language, whether it was explicitly set by the user or is using the fallback default.
- **Supported Language**: Represents a language the application can render its UI/emails in. Attributes: language code, display name, whether it is the application's default language.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: A user can switch the application's display language and see the change reflected across the visible screen in under 2 seconds, with no page reload required.
- **SC-002**: 100% of users who select a non-default display language see that same language applied automatically on their next visit, without reselecting it.
- **SC-003**: A user can locate and set their email correspondence language within 3 clicks/taps from account settings.
- **SC-004**: 100% of automatically generated correspondence (once cron-based email notifications exist) is generated using the recipient's configured email correspondence language, falling back correctly when unset.
- **SC-005**: Across all supported languages, fewer than 1% of visible UI strings on primary screens are missing a translation (i.e., visibly falling back or showing raw keys) at launch.

## Assumptions

- The application currently has a single default language; multilanguage support introduces the ability to switch among a small initial set (assumed: at least the current default plus one additional language) at launch, with more addable later.
- For first-time/anonymous visitors with no stored preference, the application defaults to its existing default language rather than attempting automatic detection from browser/OS locale, to keep initial behavior predictable and testable; this can be revisited later.
- The display language preference is stored per-device/browser (e.g., local storage/cookie), not on the user's account, and applies the same way for both authenticated and guest sessions — it does not sync across a user's devices. This is a deliberate contrast with the email correspondence language, which is account-level (see FR-006/FR-007) precisely because it must be readable by backend processes not tied to any one browser session.
- Actual cron-based email sending/scheduling infrastructure is out of scope for this feature — this feature only establishes and persists the email correspondence language _setting_ that such a future feature will read.
- Translation of all existing UI text and future email templates into each supported language is treated as a content task tracked under User Story 3, not a blocking technical dependency for shipping the switcher and settings mechanism.
- "Header navbar" refers to the application's persistent top navigation bar shown across authenticated and/or public pages.
