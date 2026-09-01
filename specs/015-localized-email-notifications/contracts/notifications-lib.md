# Contract: `@vaultfolio/notifications` Library Public Interface

This feature exposes no new/changed HTTP endpoints (Principle II N/A — no frontend involvement).
The interface that matters here is the **public contract of the new `libs/notifications` Nx
library**, consumed by the three backend `EmailService` adapters, plus the **file-naming
convention** template authors must follow (the "contract" a maintainer relies on per US2/US3).

## 1. Programmatic contract

```ts
// libs/notifications/src/index.ts

export type NotificationType =
  | 'password-reset'
  | 'email-change-verification'
  | 'invitation'
  | 'signup-verification'
  | 'signup-admin-alert'
  | 'signup-welcome'
  | 'signup-rejection';

export interface RenderedNotificationEmail {
  type: NotificationType;
  language: LanguageCode; // re-exported from @vaultfolio/api-contract
  subject: string;
  html: string;
  text: string;
}

export interface RenderNotificationRequest<V = Record<string, unknown>> {
  type: NotificationType;
  /** Raw stored preference, e.g. user.emailLanguage — may be null/unsupported. */
  preferredLanguage: string | null;
  /** Per-type view model (e.g. { resetUrl, expiresAt } for password-reset). */
  viewModel: V;
}

export function renderNotification(request: RenderNotificationRequest): RenderedNotificationEmail;

export function resolveLanguage(preferredLanguage: string | null): LanguageCode;
```

### Behavioral guarantees (verified by the library's unit tests)

1. `resolveLanguage(null)` and `resolveLanguage('fr')` (unsupported) both return
   `DEFAULT_LANGUAGE_CODE` ('en'). `resolveLanguage('de')` returns `'de'`. — FR-002.
2. `renderNotification({ type, preferredLanguage: 'de', viewModel })` returns German content when
   `templates/<type>/de.*.hbs` exist; if they do not exist for that type, it returns English
   content for that type instead, and `language` on the result reflects the _language actually
   rendered_ ('en'), not the raw request — FR-003, Edge Cases.
3. `renderNotification` never throws for a missing/unsupported `preferredLanguage` or a missing
   per-type translation — it only throws (loudly, at startup or first call) if the _English_
   (fallback) template files for a given type are themselves missing/malformed, since English has
   no further fallback.
4. `subject`, `html`, and `text` on the result are always non-empty strings — FR-007.
5. Editing a shared partial file on disk changes the output of every `renderNotification` call for
   every type that includes it, on the next call after the file change is loaded (in-process
   compiled-template cache, if any, must not defeat this across a restart) — FR-005, SC-006.

## 2. Adapter contract (`EmailService` ↔ library ↔ `MailerService`)

Each of `profile/email.service.ts`, `signups/email.service.ts`, `invitations/email.service.ts`
follows the same shape for every send method:

```ts
async sendPasswordReset(user: { email: string; emailLanguage: string | null }, resetUrl: string) {
  const rendered = renderNotification({
    type: 'password-reset',
    preferredLanguage: user.emailLanguage,
    viewModel: { resetUrl },
  });
  await this.mailerService.send({ to: user.email, ...rendered });
}
```

`sendAdminNotification` (the one multi-recipient case) loops per admin instead of sending once:

```ts
async sendAdminNotification(admins: { email: string; emailLanguage: string | null }[], viewModel: AdminAlertViewModel) {
  await Promise.all(admins.map((admin) => {
    const rendered = renderNotification({ type: 'signup-admin-alert', preferredLanguage: admin.emailLanguage, viewModel });
    return this.mailerService.send({ to: admin.email, ...rendered });
  }));
}
```

**Contract guarantee**: the _signature_ of "who receives a call to which `sendX` method, and
when" (i.e., the call sites in `profile.service.ts` / `signups.service.ts` /
`invitations.service.ts`) is unchanged by this feature except for `sendAdminNotification` gaining
per-admin language data instead of a bare email-string array — FR-012.

## 3. `MailerService` contract (new shared module)

```ts
// apps/backend/src/mail/mailer.service.ts
export interface MailerSendRequest {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export class MailerService {
  async send(request: MailerSendRequest): Promise<void>;
}
```

- Reads `SMTP_HOST`, `SMTP_PORT` (default `587`), `SMTP_USER`/`SMTP_PASSWORD` (auth only if
  `SMTP_USER` set), `SMTP_FROM`, and the new `SMTP_SENDER_NAME` from `process.env`.
- `from` is `{ name: SMTP_SENDER_NAME, address: SMTP_FROM }` when `SMTP_SENDER_NAME` is set,
  otherwise the bare `SMTP_FROM` string — FR-008/FR-009.
- Errors are logged (never logging credentials/tokens) and re-thrown, preserving today's
  502-mapping behavior at the caller.

## 4. Template file-naming convention (the contract a maintainer relies on for US2/US3)

- One directory per `NotificationType` under `libs/notifications/src/lib/templates/<type>/`.
- Exactly three files per supported language in that directory:
  `<lang>.subject.hbs`, `<lang>.html.hbs`, `<lang>.text.hbs`.
- Shared partials under `libs/notifications/src/lib/partials/<partialName>/<lang>.hbs`.
- **To add a language** (US3): add `<newLang>.subject.hbs` / `.html.hbs` / `.text.hbs` for one or
  more types, add matching `partials/*/<newLang>.hbs` files for any partial those templates
  include, and add the new code to `SUPPORTED_LANGUAGES` in
  `libs/api-contract/src/lib/i18n.ts`. No changes to `notification-renderer.ts`,
  `language-resolution.ts`, or any `*.service.ts` sending logic are required.
- **To edit existing wording** (US2): edit the relevant `.hbs` file(s) directly; no `.ts` change
  required anywhere.
