# @vaultfolio/notifications

Framework-independent library that renders outbound notification emails
(subject/HTML/text) from Handlebars template files, in the recipient's
resolved correspondence language, with English as the last-resort fallback.
No NestJS, no `nodemailer` — the three backend `EmailService` adapters
(`apps/backend/src/{profile,signups,invitations}/email.service.ts`) call
`renderNotification` for content, then send the result via
`apps/backend/src/mail/mailer.service.ts`.

See [contracts/notifications-lib.md](../../specs/015-localized-email-notifications/contracts/notifications-lib.md)
for the full programmatic/adapter contract.

## File layout

```text
src/lib/
├── templates/<type>/<lang>.subject.hbs
├── templates/<type>/<lang>.html.hbs
├── templates/<type>/<lang>.text.hbs
└── partials/<partialName>/<lang>.hbs
```

- One directory per `NotificationType` (`password-reset`, `email-change-verification`,
  `invitation`, `signup-verification`, `signup-admin-alert`, `signup-welcome`,
  `signup-rejection` — the fixed set from `types.ts`), containing exactly three
  files per supported language.
- Shared partials (`header`, `footer`, `salutation`, `signature`) live once per
  language under `partials/<partialName>/<lang>.hbs` and are registered with
  Handlebars as `<partialName>-<lang>` (e.g. `header-de`). A template includes
  its own language's partial by that literal name, e.g. `{{> header-de}}` in
  a `de.html.hbs`/`de.text.hbs` file.
- Partial content is plain text (no HTML markup) so the same file can be
  included from both the `.html.hbs` and `.text.hbs` variant of a template —
  the HTML template wraps it in its own tags (e.g. `<p>{{> footer-en}}</p>`).

Whether a given type has content for a given language is a directory-listing
question: if `templates/<type>/<lang>.*.hbs` exist, that language is used; if
not, `renderNotification` falls back to `DEFAULT_LANGUAGE_CODE` ('en') for
that type only, never failing a send (FR-002/FR-003).

## Editing existing wording (no code changes required)

Edit the relevant `.hbs` file(s) directly — `notification-renderer.ts` never
branches on language or content, so a wording-only change never touches any
`.ts` file. Rebuild/restart the backend to pick it up (templates are compiled
once and cached in-process per file, not across restarts).

## Adding a new language

1. For every notification type you want translated, add
   `templates/<type>/<newLang>.subject.hbs`, `.html.hbs`, and `.text.hbs`.
2. Add `partials/<partialName>/<newLang>.hbs` for every partial those
   templates include (`{{> header-<newLang>}}` etc.).
3. Add the new code to `SUPPORTED_LANGUAGES` in
   `libs/api-contract/src/lib/i18n.ts` (also drives the frontend's
   display-language/email-language pickers, per 013).

No changes to `notification-renderer.ts`, `language-resolution.ts`, or any
`*.service.ts` sending logic are required — a type with no files yet for the
new language falls back to English for that type (partial rollout is
supported, see `notification-renderer.spec.ts`'s fallback test).

## View models per type

| Type                        | View model                    |
| --------------------------- | ----------------------------- |
| `password-reset`            | `{ resetUrl }`                |
| `email-change-verification` | `{ newEmail, verifyUrl }`     |
| `invitation`                | `{ acceptUrl }`               |
| `signup-verification`       | `{ verifyUrl }`               |
| `signup-admin-alert`        | `{ requestEmail }`            |
| `signup-welcome`            | `{ appUrl }`                  |
| `signup-rejection`          | none (never exposes a reason) |
