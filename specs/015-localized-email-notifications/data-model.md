# Phase 1 Data Model: Localized, Templated Email Notifications

No database schema changes. This feature reads the existing `users.email_language` column (013)
and introduces no new persisted entities — the entities below are in-process/file-based concepts
used by the new `libs/notifications` library and the modified `EmailService` classes.

## Notification Type

An enumerated identifier for each kind of outbound notification email, fixed by the spec's
Assumptions (no new types introduced by this feature):

| Code (suggested)            | Description                                  | Sent by                        |
| --------------------------- | -------------------------------------------- | ------------------------------ |
| `password-reset`            | Password reset link                          | `profile/email.service.ts`     |
| `email-change-verification` | Verify a newly requested email address       | `profile/email.service.ts`     |
| `invitation`                | Invite a new user to Vaultfolio              | `invitations/email.service.ts` |
| `signup-verification`       | Verify a self-service sign-up request        | `signups/email.service.ts`     |
| `signup-admin-alert`        | Notify an admin of a new pending sign-up     | `signups/email.service.ts`     |
| `signup-welcome`            | Notify a user their sign-up was approved     | `signups/email.service.ts`     |
| `signup-rejection`          | Notify a user their sign-up was not approved | `signups/email.service.ts`     |

This code is also the template-directory name under
`libs/notifications/src/lib/templates/<code>/` (see Project Structure in plan.md).

**Validation rule**: The set of valid notification-type codes is fixed at compile time (a
TypeScript union/enum in `libs/notifications`); the renderer only accepts one of these — there is
no runtime/user-supplied notification type.

## Correspondence Language Preference

The existing (013) per-user setting, unchanged by this feature.

- **Source**: `users.email_language` column (`apps/backend/src/database/database.service.ts:299-316`),
  surfaced via `User.emailLanguage: string | null` (`apps/backend/src/auth/users.repository.ts:20`).
- **Values**: `null` (unset) or a code present in `SUPPORTED_LANGUAGES`
  (`libs/api-contract/src/lib/i18n.ts`) — currently `'en'` | `'de'`.
- **Validation rule**: Already enforced at write-time by a `CHECK` constraint and
  `isSupportedLanguageCode()` (`profile.service.ts` `updateEmailLanguage`); this feature only
  _reads_ the column, adding no new write path or validation.

## Resolved Language

A derived, request-scoped value — not persisted — computed by `libs/notifications`'
`language-resolution.ts` for a single email send:

- **Input**: `user.emailLanguage: string | null`.
- **Output**: a `LanguageCode` (from `@vaultfolio/api-contract`), guaranteed to be one of
  `SUPPORTED_LANGUAGES`.
- **Rule**: `isSupportedLanguageCode(user.emailLanguage) ? user.emailLanguage : DEFAULT_LANGUAGE_CODE`.

## Email Template

The maintainable, human-editable definition of one notification type's content for one language —
realized as three files on disk (not a database row):

| File                                  | Contains                                                                     |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `templates/<type>/<lang>.subject.hbs` | The email subject line (single Handlebars string)                            |
| `templates/<type>/<lang>.html.hbs`    | The HTML body (includes shared partials)                                     |
| `templates/<type>/<lang>.text.hbs`    | The plain-text fallback body (includes shared partials, plain-text variants) |

- **Relationships**: Composed of zero or more Shared Partials (via `{{> partialName-lang}}`) plus
  type-specific content; parameterized by a **View Model** (below) specific to that notification
  type (e.g. `password-reset` needs a reset link + expiry; `invitation` needs an inviter name +
  accept link).
- **Validation rule**: A template file is valid Handlebars syntax; missing variables render as
  empty per Handlebars' default (no strict-mode requirement introduced — kept simple per
  Principle V, revisit if a real incident demonstrates the need for stricter template validation).
- **State/lifecycle**: Static content, loaded/compiled by the renderer (optionally cached
  in-process after first compile per type+language) — no runtime mutation.

## Shared Partial

A reusable Handlebars partial included by multiple Email Templates:

| Partial      | Purpose                                                |
| ------------ | ------------------------------------------------------ |
| `header`     | Common top-of-email branding/logo area                 |
| `footer`     | Common bottom-of-email legal/unsubscribe-style content |
| `salutation` | Common greeting (e.g. "Hi {{name}},")                  |
| `signature`  | Common sign-off (e.g. "— The Vaultfolio Team")         |

- **Files**: `partials/<partialName>/<lang>.hbs`, one file per partial per supported language.
- **Relationships**: Included by any number of Email Templates of any notification type; editing
  one partial file changes every template that includes it, the next time that type is rendered
  (satisfies FR-005 / SC-006) — no build step or cache invalidation beyond normal process
  restart/deploy, since compiled templates are cached only in-process, not across restarts.

## Notification Email (render result)

The in-memory, per-send output object produced by `libs/notifications`'
`notification-renderer.ts` and consumed by the `mail/mailer.service.ts`:

```ts
interface RenderedNotificationEmail {
  type: NotificationType; // e.g. 'password-reset'
  language: LanguageCode; // the *resolved* language actually used (may differ from the
  // user's raw preference due to fallback)
  subject: string;
  html: string;
  text: string;
}
```

- **Relationships**: One Notification Email is produced per (Notification Type, recipient,
  resolved language, view model) — for the admin sign-up alert this means one
  `RenderedNotificationEmail` per admin recipient (FR-011), not one shared object for the group.
- **Validation rule**: `subject`, `html`, and `text` are all non-empty strings once rendered
  (English fallback guarantees this even under FR-002/FR-003 fallback paths) — the renderer never
  returns a partially-empty result.

## Sender Display Name

Configuration, not a stored entity:

- **Source**: `process.env.SMTP_SENDER_NAME` (new), read once per send in
  `apps/backend/src/mail/mailer.service.ts` alongside the existing `SMTP_FROM`.
- **Validation rule**: No format restriction is enforced on the configured value itself (FR-010
  requires _safe encoding_, not input validation) — any string is accepted and passed through
  nodemailer's structured `from: {name, address}` form, which performs RFC 5322/2047-compliant
  encoding.
- **Fallback**: If unset, `from` is passed as the bare `SMTP_FROM` address (today's behavior,
  FR-009).
