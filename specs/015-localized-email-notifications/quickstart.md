# Quickstart: Validating Localized, Templated Email Notifications

This guide validates the feature end-to-end without duplicating the full contract (see
[contracts/notifications-lib.md](./contracts/notifications-lib.md)) or data model (see
[data-model.md](./data-model.md)).

## Prerequisites

- Backend running locally (`npm exec nx serve backend` or via the repo's `docker-compose.yml`).
- A local/dev SMTP catch-all (e.g. [MailHog](https://github.com/mailhog/MailHog) or
  [Mailpit](https://github.com/axllent/mailpit)) so sent emails can be inspected without real
  delivery. Point `SMTP_HOST`/`SMTP_PORT` at it.
- A test user account whose `email_language` can be set via the existing profile preference
  endpoint (013) — `PATCH` route in `apps/backend/src/profile/profile.controller.ts`.

## Scenario 1 — User Story 1: recipient language is respected

1. Set the test user's correspondence language to German via the existing preference
   endpoint/UI.
2. Trigger a password-reset email (existing "forgot password" flow).
3. Open the message in the SMTP catch-all: subject and both HTML and plain-text bodies MUST be in
   German.
4. Set the same user's preference to unset (`null`) and repeat: the email MUST now be in English.
5. Repeat steps 1–3 for each of the other 6 notification types (email-change verification,
   invitation, sign-up verification, sign-up welcome, sign-up rejection, sign-up admin alert) —
   trigger each via its existing flow (no new endpoints are introduced by this feature).
6. **Expected**: SC-001 and SC-002 hold — 100% German for the set/supported case, 100% English for
   the unset/unsupported case, no delivery failures.

## Scenario 2 — User Story 4: sender display name

1. Set `SMTP_SENDER_NAME=Vaultfolio` in the backend's environment and restart/redeploy.
2. Trigger any notification email.
3. In the SMTP catch-all, inspect the raw `From` header: it MUST read
   `Vaultfolio <the-configured-SMTP_FROM-address>` (mail-client display shows "Vaultfolio").
4. Unset `SMTP_SENDER_NAME` and repeat: the email MUST still send successfully, `From` falling
   back to the bare address (FR-009).
5. Set `SMTP_SENDER_NAME` to a value containing a double quote and a comma (e.g. `Vault"folio,
Inc.`) and repeat: the `From` header MUST remain RFC-5322-valid (properly quoted/escaped) and
   the email MUST still be deliverable — FR-010.

## Scenario 3 — User Story 4 + 1 combined: admin alert per-recipient localization

1. Configure two admin accounts, one with `email_language = 'en'`, one with `email_language =
'de'`.
2. Trigger a new sign-up (self-service sign-up flow) so the sign-up admin alert fires.
3. **Expected**: two separate messages are delivered — the English-preferring admin gets an
   English message, the German-preferring admin gets a German message (FR-011) — not one shared
   email in one language to both.

## Scenario 4 — User Story 2: template-only wording change (SC-003)

1. Edit only `libs/notifications/src/lib/templates/password-reset/en.html.hbs` (change some
   copy) — make no `.ts` changes.
2. Rebuild/restart the backend.
3. Trigger a password-reset email to an English-preferring user.
4. **Expected**: the new wording appears in the delivered email. Run the library's existing unit
   test suite (`npm exec nx test notifications`) — it should still pass, and (per SC-003) a test
   asserting on the old copy would need updating in the template's own fixture/test only, not in
   any service/business-logic test.

## Scenario 5 — User Story 2: shared partial change propagates (SC-006)

1. Edit only `libs/notifications/src/lib/partials/footer/en.hbs` (e.g. change the copyright year
   or a link).
2. Rebuild/restart the backend.
3. Trigger at least two different English notification types that both use the footer (e.g.
   password-reset and invitation).
4. **Expected**: both delivered emails show the updated footer content, confirming a single edit
   propagated to every template including that partial.

## Scenario 6 — User Story 3: adding a new language (SC-004)

1. Following only the file-naming convention in
   [contracts/notifications-lib.md §4](./contracts/notifications-lib.md#4-template-file-naming-convention-the-contract-a-maintainer-relies-on-for-us2us3),
   add `fr.subject.hbs` / `fr.html.hbs` / `fr.text.hbs` for exactly one existing notification type
   (e.g. `password-reset`), add matching `partials/*/fr.hbs` files for any partials it includes,
   and add `{ code: 'fr', label: 'Français', isDefault: false }` to `SUPPORTED_LANGUAGES` in
   `libs/api-contract/src/lib/i18n.ts`.
2. Set a test user's `email_language` to `'fr'` and trigger a password-reset email.
3. **Expected**: the email is delivered in French, with zero changes made to
   `notification-renderer.ts`, `language-resolution.ts`, or any `*.service.ts` sending logic
   (verify via `git diff` touching only template/partial files and the one catalog entry).
4. Trigger a _different_ notification type (e.g. invitation, which has no French templates yet)
   to the same French-preferring user.
5. **Expected**: the invitation email is delivered in English (fallback), not a delivery failure —
   confirming partial-rollout behavior (Edge Cases, FR-003).

## Automated coverage

- `npm exec nx test notifications` — unit tests for `resolveLanguage`, `renderNotification`
  (per-type/per-language rendering, English fallback, partial inclusion), against real `.hbs`
  files.
- `npm exec nx test backend` — updated `profile.service.spec.ts`, `signups.service.spec.ts`,
  `invitations.service.spec.ts` (call-site mocks/assertions), plus new
  `apps/backend/src/mail/mailer.service.spec.ts` covering the `SMTP_SENDER_NAME` set/unset/
  needs-encoding cases.
