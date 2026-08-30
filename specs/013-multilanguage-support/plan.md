# Implementation Plan: Multilanguage Support

**Branch**: `013-multilanguage-support` | **Date**: 2026-08-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/013-multilanguage-support/spec.md`

## Summary

Add runtime multilanguage support to Vaultfolio with two independent preferences, per the spec's
User Stories:

- **Display language** (US1, P1): a header navbar language switcher, backed by a small hand-rolled
  frontend `I18nService` (same shape as `010-theme-switch`'s `ThemeService`) that resolves the
  active language from `localStorage` (else the app default), exposes it as a signal, and drives a
  `translate` pipe reading from per-language dictionaries bundled directly in the frontend — no
  network fetch, so switching is instant (SC-001) and per-device (FR-004, not account-bound).
- **Email correspondence language** (US2, P2): a new `email_language` column on `users`, exposed via
  a new `PATCH /api/profile/email-language` endpoint and surfaced in the existing Settings >
  Profile screen, independent of the display language (FR-006/FR-007/FR-009) and readable by future
  backend cron jobs without a browser session.
- **Content completeness** (US3, P3): the supported-language catalog (`en` default + `de` at
  launch, FR-010) is shared between frontend and backend via `libs/api-contract`, and every
  translatable string used by the switcher/settings/primary screens gets an `en` and `de` entry,
  with the `translate` pipe falling back to `en` for any missing key (FR-011).

No new Nx library, no third-party i18n dependency, no ORM/migration framework — consistent with
this codebase's existing hand-rolled patterns (`ThemeService`, `DatabaseService`'s
`PRAGMA table_info` migrations) and Principle V (YAGNI).

## Technical Context

**Language/Version**: TypeScript, Angular ~22.1 (frontend), NestJS ~11 on Node.js LTS (backend)

**Primary Dependencies**: Angular (signals, structural directives), PrimeNG ^22.1 (`p-select` for
the switcher control), NestJS, `better-sqlite3` — no new runtime dependencies. Translation
dictionaries are plain TypeScript modules (`Record<string, string>` per language), not a
third-party i18n library (see research.md #1).

**Storage**: Browser `localStorage` for the display language (key `vaultfolio-language`, mirroring
`010-theme-switch`'s `vaultfolio-theme`); a new `users.email_language TEXT NULL` column in the
existing SQLite database for the email correspondence language (account-level, FR-007).

**Testing**: Jest + Angular Testing Library conventions already used under
`apps/frontend/src/app/**/*.spec.ts` and `apps/backend/src/**/*.spec.ts`; unit tests for
`I18nService` (resolution/persistence/fallback logic, mirroring `theme.service.spec.ts`), the
`translate` pipe, the new `ProfileService`/`ProfileController` email-language methods/routes, and
the new `DatabaseService` migration step.

**Target Platform**: Modern evergreen browsers (Angular frontend); Linux server (NestJS backend +
SQLite), no infrastructure change.

**Project Type**: Nx monorepo, `apps/frontend` + `apps/backend` + `libs/api-contract` (existing
projects extended; no new Nx project).

**Performance Goals**: Display-language switch completes and repaints in under 2 seconds with no
page reload (SC-001) — in practice a synchronous signal update, effectively instant since
dictionaries are bundled, not fetched.

**Constraints**: Switching language MUST NOT require a full page reload (FR-003); missing
translation keys MUST fall back to the default language, never a raw key or empty string
(FR-011); the two language preferences MUST remain independent (FR-009).

**Scale/Scope**: Two supported languages at launch (`en` default, `de`), extensible catalog; one
new frontend service + pipe + header control + settings control; one new backend column + one new
profile endpoint; no new routes, no new Nx projects, one shared-DTO addition to `api-contract`.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: N/A in the "standalone domain library" sense — this feature touches no
  finance/domain logic (no holdings, valuations, or money values). Per Principle V (YAGNI) and the
  precedent set by `010-theme-switch` (a plain service under `apps/frontend/src/app/core/`, not a
  dedicated Nx lib), the frontend i18n service/pipe/dictionaries live under
  `apps/frontend/src/app/core/i18n/`. The email-language setting is a small addition to the
  existing `profile` module (`ProfileService`/`ProfileController`), following the same pattern as
  the existing display-name/email-change settings there. **PASS** (no violation to track).
- **II. API-First Interface**: The email correspondence language is exposed through a new,
  documented `PATCH /api/profile/email-language` endpoint (contracts/profile-api-i18n.md) returning
  the existing structured-error convention; the frontend reads/writes it only through this API,
  never direct DB access. The supported-language catalog itself is a shared constant in
  `libs/api-contract`, not a runtime endpoint (no reason to round-trip a static, build-time-known
  list — YAGNI). **PASS**.
- **III. Test Coverage**: No money/date/financial values are touched by this feature, so the
  exact-value-assertion mandate doesn't apply; ordinary implement-then-test coverage (current
  constitution wording) applies to `I18nService`, the `translate` pipe, and the new profile
  service/controller/repository methods. **PASS**.
- **IV. Integration Testing**: The new `PATCH /api/profile/email-language` contract gets an
  integration/controller test (mirroring existing `profile.controller.spec.ts` coverage for
  `display-name`), and the new `DatabaseService` migration step is covered the same way existing
  `migrateProfile`/`migrateAccountsAndInvitations` steps are (idempotent-migration assertions in
  `database.service.spec.ts`). **PASS**.
- **V. Observability, Versioning & Simplicity**: No new abstractions/services/dependencies beyond
  what's justified above; the email-language change is logged the same way other profile mutations
  are (`this.logger.log({ actor, event })`). **PASS**.

## Project Structure

### Documentation (this feature)

```text
specs/013-multilanguage-support/
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
├── backend/
│   └── src/
│       ├── database/
│       │   └── database.service.ts        # + migrateI18n(): users.email_language column
│       └── profile/
│           ├── profile.controller.ts       # + PATCH /profile/email-language
│           ├── profile.service.ts          # + updateEmailLanguage()
│           └── profile.service.spec.ts
└── frontend/
    └── src/app/
        ├── core/
        │   ├── i18n/                        # NEW — mirrors core/theme/
        │   │   ├── i18n.service.ts          # active language signal, localStorage persistence
        │   │   ├── i18n.service.spec.ts
        │   │   ├── translate.pipe.ts        # {{ 'key.path' | translate }}, falls back to default
        │   │   ├── translate.pipe.spec.ts
        │   │   └── translations/
        │   │       ├── en.ts                # default-language dictionary
        │   │       └── de.ts
        │   └── layout/app-header/           # + language switcher control (p-select)
        └── settings/preferences/             # + email correspondence language control (design.md)

libs/
└── api-contract/src/lib/
    └── i18n.ts           # NEW — SUPPORTED_LANGUAGES catalog + LanguageCode type
    └── profile.ts        # + emailLanguage on ProfileSummary, UpdateEmailLanguageRequest
```

**Structure Decision**: Extends the three existing projects touched by comparable prior features
(`apps/frontend`, `apps/backend`, `libs/api-contract`) — no new Nx app or lib. Frontend i18n
mechanics live under `apps/frontend/src/app/core/i18n/`, matching the `core/theme/` precedent set
by `010-theme-switch` for a per-browser UI-chrome concern that isn't finance/domain logic. The
supported-language catalog is the one piece of frontend/backend-shared data, so it goes in the
existing `libs/api-contract` shared-DTO library rather than a new library.

## Complexity Tracking

_No Constitution Check violations — this section is intentionally empty._
