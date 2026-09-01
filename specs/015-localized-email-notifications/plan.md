# Implementation Plan: Localized, Templated Email Notifications

**Branch**: `015-localized-email-notifications` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/015-localized-email-notifications/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Every outbound notification email (password reset, email-change verification, invitation,
sign-up verification/admin-alert/welcome/rejection) must be rendered in the recipient's stored
`email_language` preference (013, `en`/`de`, default `en`), sourced from maintainable HTML+text
template files with reusable partials (header, footer, salutation, signature) instead of
TypeScript string literals, and sent with a configurable sender display name
(`SMTP_SENDER_NAME`) on the From header. Today three near-duplicate `EmailService` classes
(`profile`, `signups`, `invitations`) each build English-only string-literal content and their own
`nodemailer` transport directly from `process.env`; none read `email_language`. The approach: add
a new framework-independent Nx library (`libs/notifications`) holding a Handlebars-based template
renderer (subject/html/text per type+language, English fallback for unsupported/missing
combinations) and shared partials; add a small shared backend mail-transport module wrapping
`nodemailer` + the new `SMTP_SENDER_NAME` env var (using nodemailer's structured `from: {name,
address}` form, which safely encodes the display name); and adapt the three existing
`EmailService` classes to resolve the recipient's language and delegate content generation to the
new library, changing only how each email is composed — not who/when each is sent (FR-012). The
admin sign-up alert changes from one shared-language `to: [...]` send to one per-admin
per-language send (FR-011).

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: NestJS (backend), Angular (frontend, unaffected by this feature), Nx
(monorepo tooling) — per the constitution's Stack Decision. New for this feature: `handlebars`
(HTML/text template rendering with first-class partial support, satisfying FR-005's reusable
header/footer/salutation/signature building blocks) and its `@types/handlebars` if published
separately (recent versions ship their own types). `nodemailer` (already a backend dependency)
continues to be the SMTP transport.

**Storage**: SQLite, embedded in the backend process (per constitution's Stack Decision); this
feature reads the existing `users.email_language` column (013) and writes nothing new to storage
— no schema change.

**Testing**: Jest (Nx default). The new `libs/notifications` library gets co-located unit tests
(language-resolution fallback, template-rendering per type/language, missing-translation
fallback-to-English) with no NestJS/nodemailer dependency, per Principle IV's public-contract
testing requirement. Existing `apps/backend/src/*/email.service.spec.ts`-adjacent call-site tests
(`profile.service.spec.ts`, `signups.service.spec.ts`, `invitations.service.spec.ts`) are updated
for the (non-)changed `EmailService` method signatures.

**Target Platform**: Linux server (backend container), no frontend/browser impact.

**Project Type**: web-service + frontend, Nx monorepo (see Project Structure below); this feature
is backend-only.

**Performance Goals**: No new performance target; template rendering is synchronous, in-process,
and negligible next to SMTP round-trip latency. Compiled Handlebars templates SHOULD be cached
in-process (compiled once per type+language, not per send) to avoid repeated parse cost.

**Constraints**: Must not change existing notification-triggering behavior (FR-012) — who receives
which email and when. Must not fail a send because of a missing translation or unsupported
language (FR-002, FR-003) — English is always the last-resort fallback.

**Scale/Scope**: 7 existing notification types × 2 languages today (`en`, `de`), designed for
easy addition of a 3rd+ language (US3) without touching sending/business logic. Volume is
low (transactional, per-user emails, no bulk/marketing sending) — no batching/queueing concerns.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **Principle I (Library-First)**: PASS. Template resolution, language fallback, and rendering
  move into a new standalone `libs/notifications` library, framework-independent (no NestJS,
  no nodemailer import), independently unit-testable — mirrors the existing `libs/domain/*`
  pattern. The three `apps/backend/src/*/email.service.ts` classes remain thin NestJS adapters
  (DI, SMTP transport, error mapping) that call into the library, not the other way round.
- **Principle II (API-First Interface)**: PASS / N/A. No new or changed HTTP endpoints; this
  feature only changes internal email composition. No frontend changes.
- **Principle III (Test Coverage)**: PASS. No monetary/date-period logic involved; standard
  implement-then-test coverage applies. Template-rendering and language-fallback logic in the new
  library get exact-match unit tests (rendered subject/body content, fallback behavior).
- **Principle IV (Integration Testing)**: PASS, with a scoped addition. The new library's public
  contract (render a notification's subject/html/text for a given type+language) gets unit/
  contract tests using real `.hbs` template files (not just in-memory strings), per Principle IV's
  "real serialization formats" intent applied to template files. Full SMTP delivery is out of
  scope for automated tests today (no existing nodemailer-transport tests) — call-site tests keep
  mocking `EmailService` at the same granularity as today.
- **Principle V (Observability, Versioning & Simplicity)**: PASS. Adds one focused dependency
  (`handlebars`) justified by FR-005's explicit reusable-partial requirement, which hand-rolled
  string interpolation cannot satisfy as cleanly; no new services/processes. Existing `Logger`-based
  error logging (never logging tokens/credentials) is preserved and extended to note the resolved
  language on send failure for auditability.
- **No violations requiring Complexity Tracking.**

## Project Structure

### Documentation (this feature)

```text
specs/015-localized-email-notifications/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
└── backend/                            # NestJS (only app touched by this feature)
    └── src/
        ├── mail/                       # NEW: thin shared SMTP-transport adapter
        │   ├── mailer.module.ts        #   builds/caches the nodemailer transport,
        │   ├── mailer.service.ts       #   reads SMTP_HOST/PORT/USER/PASSWORD/FROM/
        │   │                          #   SMTP_SENDER_NAME, sends a rendered
        │   │                          #   {subject, html, text} via nodemailer
        │   └── mailer.service.spec.ts
        ├── profile/
        │   └── email.service.ts        # MODIFIED: resolve user.emailLanguage,
        │                               #   call notifications lib for content,
        │                               #   call MailerService to send
        ├── signups/
        │   └── email.service.ts        # MODIFIED: same pattern; sendAdminNotification
        │                               #   changes to one render+send per admin
        │                               #   (per-admin language), not one shared send
        └── invitations/
            └── email.service.ts        # MODIFIED: same pattern

libs/
├── notifications/                       # NEW: framework-independent Nx lib (Principle I)
│   ├── src/
│   │   ├── index.ts
│   │   └── lib/
│   │       ├── notification-renderer.ts        # resolves language + renders
│   │       │                                   # subject/html/text for a given
│   │       │                                   # notification type + view-model
│   │       ├── notification-renderer.spec.ts
│   │       ├── language-resolution.ts          # preference → supported code,
│   │       │                                   # else DEFAULT_LANGUAGE_CODE ('en')
│   │       ├── language-resolution.spec.ts
│   │       ├── templates/
│   │       │   ├── password-reset/{en,de}.{subject,html,text}.hbs
│   │       │   ├── email-change-verification/{en,de}.{subject,html,text}.hbs
│   │       │   ├── invitation/{en,de}.{subject,html,text}.hbs
│   │       │   ├── signup-verification/{en,de}.{subject,html,text}.hbs
│   │       │   ├── signup-admin-alert/{en,de}.{subject,html,text}.hbs
│   │       │   ├── signup-welcome/{en,de}.{subject,html,text}.hbs
│   │       │   └── signup-rejection/{en,de}.{subject,html,text}.hbs
│   │       └── partials/
│   │           ├── header/{en,de}.hbs
│   │           ├── footer/{en,de}.hbs
│   │           ├── salutation/{en,de}.hbs
│   │           └── signature/{en,de}.hbs
│   ├── tsconfig.json / tsconfig.lib.json / tsconfig.spec.json / jest.config.cts
│   └── package.json                     # name: @vaultfolio/notifications
├── api-contract/                        # UNCHANGED — SUPPORTED_LANGUAGES/LanguageCode
│                                         # (libs/api-contract/src/lib/i18n.ts) is reused
│                                         # as-is by the new lib's language resolution
├── domain/*                             # unaffected
└── market-data/                         # unaffected
```

**Structure Decision**: One new Nx library, `libs/notifications`, holds all template content and
rendering/fallback logic — framework-independent per Principle I, reusing the existing
`@vaultfolio/api-contract` language catalog (`SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE_CODE`,
`isSupportedLanguageCode`) as the single source of truth for supported languages (US3: adding a
language means adding template files under this lib plus one catalog entry, no sending-logic
changes). One new small backend module, `apps/backend/src/mail/`, consolidates the three
duplicated `nodemailer` transport-construction/env-parsing blocks and adds `SMTP_SENDER_NAME`
handling in exactly one place. The three existing `apps/backend/src/{profile,signups,invitations}/
email.service.ts` classes are modified (not replaced) to stay the per-feature seam that today's
tests already mock at (`emailService.sendX = jest.fn()`), keeping FR-012's sending/business logic
(who/when) in `*.service.ts` untouched. No frontend changes.

## Complexity Tracking

> No violations — this section is intentionally empty.
