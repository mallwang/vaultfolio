# Phase 0 Research: Localized, Templated Email Notifications

## 1. Template engine for HTML/text email content with reusable partials

- **Decision**: Use [Handlebars](https://handlebarsjs.com/) (`handlebars` npm package) as the
  rendering engine for subject/HTML/text notification content.
- **Rationale**: FR-005 explicitly requires reusable shared building blocks (header, footer,
  salutation, signature) editable once and applied everywhere. Handlebars has first-class,
  zero-config `{{> partialName}}` partial support, is logic-light (keeps templates
  maintainable by non-TypeScript-fluent editors, satisfying US2), has no runtime dependency on a
  DOM/browser, and is a small, stable, widely-used dependency (no new service, no build-step
  compiler required — `.hbs` files are compiled at request time or cached in-process). No
  templating library currently exists in the repo (confirmed via `apps/backend/package.json`), so
  this is a net-new, justified addition per the constitution's Principle V (YAGNI: justified over
  hand-rolled string interpolation, which cannot cleanly express partial composition or
  conditional fallback content).
- **Alternatives considered**:
  - **Hand-rolled template-literal functions per language** (i.e., keep today's pattern, just add
    a German copy of each literal) — rejected: does not satisfy FR-005 (no real partial/include
    mechanism without significant bespoke string-concatenation code), and keeps content mixed
    into `.ts` files, failing FR-004 and US2's "no code changes for wording changes" test.
  - **EJS** — viable alternative, but its partials require explicit `<%- include(...) %>` calls
    with file-path plumbing rather than named partials, and its more permissive
    arbitrary-JS-in-templates model is a worse fit for the low-logic content this feature needs.
    Handlebars' logic-less-by-default philosophy better matches "maintainable by humans."
  - **MJML** — solves responsive email layout robustness, but is a heavier dependency (its own
    compiler toolchain) solving a problem (cross-client responsive HTML) not raised by the spec;
    rejected as premature per Principle V (YAGNI) — can be revisited later without touching the
    subject/text rendering or language-resolution design.
  - **Nunjucks / Pug** — comparable capability to Handlebars but no added benefit for this use
    case; Handlebars was picked primarily for its explicit, named-partial ergonomics.

## 2. Structuring per-language template content

- **Decision**: One directory per notification type under `libs/notifications/src/lib/templates/`,
  containing one `{lang}.subject.hbs`, `{lang}.html.hbs`, and `{lang}.text.hbs` file per supported
  language (e.g. `password-reset/en.subject.hbs`, `password-reset/de.html.hbs`). Shared partials
  live under `libs/notifications/src/lib/partials/{partialName}/{lang}.hbs` and are registered
  with Handlebars keyed as `partialName-lang` (e.g. `header-de`), with each type template
  including e.g. `{{> (concat "header-" lang)}}` (or the renderer resolves and registers the
  correct partial name per render, whichever is simpler — resolved in Phase 1 design).
- **Rationale**: Keeps "does this type have German content yet" a simple, greppable
  directory-listing question (US3's "add a language" independent test) and keeps per-type,
  per-language content changes isolated to files a template author would naturally think in terms
  of (type first, then language) — matching the spec's own framing of Email Template as "one type
  and one language."
- **Alternatives considered**: A single file per type containing all languages
  (e.g. front-matter-delimited sections) — rejected: harder to diff/review a single-language
  change (SC-003's independent test wants "editing template content alone"), and mixes languages
  in one file, working against US3's approvable "add a language" review.

## 3. Language resolution & fallback

- **Decision**: Reuse the existing `libs/api-contract/src/lib/i18n.ts` catalog
  (`SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE_CODE` = `'en'`, `isSupportedLanguageCode()`) as the
  single source of truth. Resolution order for a given user: (1) if `user.emailLanguage` is set
  and `isSupportedLanguageCode()` is true for it, use it; (2) otherwise use
  `DEFAULT_LANGUAGE_CODE`. Independently, at render time: if the resolved language's template
  files for the requested notification type do not exist (partial rollout, US3 scenario 2), the
  renderer falls back to `DEFAULT_LANGUAGE_CODE`'s files for that type rather than erroring.
- **Rationale**: Directly satisfies FR-002 (unset/unsupported preference → English) and FR-003
  (missing per-type translation → English) with a single reused catalog, avoiding a second,
  divergent list of "supported languages" (already flagged as the natural single source of truth
  in the spec's Assumptions).
- **Alternatives considered**: Throwing/rejecting the send on a missing translation — explicitly
  rejected by FR-003 and the Edge Cases section ("MUST fall back to English ... rather than
  failing to send").

## 4. Sender display name & From-header encoding

- **Decision**: Read a new `SMTP_SENDER_NAME` environment variable in the new
  `apps/backend/src/mail/mailer.service.ts` and pass nodemailer's structured address form,
  `from: { name: process.env.SMTP_SENDER_NAME, address: process.env.SMTP_FROM }`, when
  `SMTP_SENDER_NAME` is set; when unset, pass `from: process.env.SMTP_FROM` unchanged (today's
  behavior).
- **Rationale**: `nodemailer` already depends on `nodemailer/lib/addressparser` +
  `nodemailer/lib/mime-funcs` internally to encode the `name` part of a structured `from`/`to`
  address per RFC 5322/2047 (quoting, escaping, or Q-encoding as needed) — this satisfies FR-010
  "safely encode... so the From header remains valid" with zero bespoke escaping code, which is
  the simplest and most battle-tested option (Principle V, YAGNI: don't hand-roll header
  encoding when the existing dependency already solves it correctly).
- **Alternatives considered**: Manually formatting `"${name}" <${address}>` and hand-escaping
  quotes/angle-brackets — rejected: reinvents RFC 5322 encoding poorly and is exactly the kind of
  hand-rolled correctness risk (malformed headers, edge cases like non-ASCII names) the spec's
  edge case calls out; nodemailer's structured form already exists and is already a project
  dependency.

## 5. Consolidating duplicated SMTP transport code

- **Decision**: Extract the three copies of `nodemailer.createTransport({...})` +
  `process.env.SMTP_*` reading (currently duplicated near-verbatim in `profile/email.service.ts`,
  `signups/email.service.ts`, `invitations/email.service.ts`) into one new
  `apps/backend/src/mail/mailer.service.ts`, injected into all three existing `EmailService`
  classes.
- **Rationale**: Not explicitly requested by the spec, but directly serves FR-008/FR-009/FR-010
  (sender name + fallback + encoding) by giving them exactly one implementation site instead of
  three that must all be kept in sync — reduces risk of the three services drifting (as they
  already have, per the "light copy/paste drift" noted during research). Consistent with
  Principle V's simplicity mandate once three call sites need the identical new behavior.
- **Alternatives considered**: Duplicating the `SMTP_SENDER_NAME` handling into all three
  services (matching today's pattern) — rejected: triples the surface area for FR-010's
  encoding-safety requirement to be gotten right and kept in sync for no benefit, and the plan
  already introduces one new shared module (`mail/`) so the marginal cost of consolidating the
  pre-existing transport code into it is negligible.

## 6. Admin sign-up alert: per-recipient localization (FR-011)

- **Decision**: Change `signups/email.service.ts`'s `sendAdminNotification` from a single
  `sendMail({ to: adminEmails, ... })` call to iterating the admin list and calling the
  render-and-send path once per admin, using that admin's own resolved language.
- **Rationale**: Directly required by FR-011 and Edge Cases ("each admin MUST receive their own
  message rendered in their own preferred language"); the caller
  (`signups.service.ts:135-140`) already has each admin's row available and only needs to pass
  `{email, emailLanguage}` per admin instead of a flat `email` array — a small, contained change
  to the call site, not a change to _when_/_whether_ the notification is sent (FR-012 preserved).
- **Alternatives considered**: Keep one email to all admins but with mixed-language content in a
  single body — explicitly rejected by the spec's Edge Cases section.

## 7. Test strategy for the new library and modified services

- **Decision**: `libs/notifications` gets dedicated unit tests exercising real `.hbs` files on
  disk (not in-memory template strings) for: (a) correct rendering of subject/html/text per
  type+language, (b) fallback to English when the resolved language lacks a given type's files,
  (c) partial inclusion (editing a partial affects every type that includes it). Existing
  `profile.service.spec.ts` / `signups.service.spec.ts` / `invitations.service.spec.ts` continue
  mocking `EmailService` at the same method-call granularity as today (`sendX = jest.fn()`) —
  their assertions are updated only where a method signature gains a parameter (e.g.
  `sendAdminNotification` taking admin objects with language instead of a bare email-string
  array).
- **Rationale**: Matches Principle IV's "exercise real serialization formats... not just
  in-memory objects" for the new library's public contract, while preserving today's
  call-site mocking pattern (no existing nodemailer-transport tests exist to extend, and adding
  them is not requested by the spec).
