# Implementation Plan: Versicherungen (Insurances Management)

**Branch**: `039-insurances-management` | **Date**: 2026-10-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/039-insurances-management/spec.md`; approved layout in [design.md](design.md)

## Summary

The registered but empty **Insurances** domain becomes a real domain. A user records **contracts**
(type from a fixed catalog, insurer, term, premium and interval, cancellation settings, type-specific
details). From the contracts the page derives monthly and yearly cost, cost by group, a month-by-month
payment timeline, the next possible **cancellation date** per contract, and a **gap check** against a
small user profile. Statutory social insurances (health, care, pension, unemployment) are shown as
read-only lines taken from the user's Earnings data when available and are otherwise entered by hand.
Optional **reminder emails** warn before cancellation deadlines.

Technical approach: (1) a new framework-independent lib `@vaultfolio/insurances` holds the model,
strict whitelist validation, the catalog (groups, classification, requirements), premium
normalization, cancellation-date derivation, payment timeline, summary and gap check, so screen,
export, reminder job and tests cannot disagree (Principle I); (2) a NestJS `insurances` module mirrors
the Retirement/Wealth modules (controller, service, repository, crypto service, availability guard)
with one row per contract and one settings row per user, contract data only inside an AES-256-GCM
payload under a dedicated operator key `INSURANCES_ENCRYPTION_KEY`, fail-closed when it is missing;
(3) the backend reads Earnings through the exported `EarningsService` to derive the linked social
lines on each request (nothing is copied or stored); (4) an hourly reminder sweep (same
`setInterval` pattern as the existing sweeps) renders a new `insurance-deadline-reminder`
notification through `@vaultfolio/notifications` and sends it via the shared mailer, deduplicated by
a small plain log table; (5) the existing Angular lib `libs/frontend/domain/insurances` replaces its
placeholder with the area (Übersicht, Verträge, Lückencheck tabs), the contract form, the reminders
view, the dashboard widget and a real export definition; ECharts (already used) draws the donut and
the timeline.

## Technical Context

**Language/Version**: TypeScript (Angular frontend, NestJS backend), Nx monorepo

**Primary Dependencies**: existing `decimal.js`, `echarts`, PrimeNG, `nodemailer` via `MailerService`, `@vaultfolio/notifications`, `@vaultfolio/export` — **no new third-party dependency**. One new internal lib: `@vaultfolio/insurances`. `echarts` is declared in the insurances frontend lib's own `package.json`, as Earnings and Wealth do.

**Storage**: SQLite via backend — three new tables: `insurance_contracts` (one row per contract), `insurance_settings` (one row per owner: profile, reminder preferences, dismissed gap suggestions, toolbar preference) and `insurance_reminder_log` (one plain row per sent reminder). Idempotent `CREATE TABLE IF NOT EXISTS`, owner-scoped. Everything user-written or monetary is inside the encrypted `payload_enc`; plain columns are ids, owner, key version, timestamps and, in the log only, contract id and deadline date.

**Testing**: Jest for `@vaultfolio/insurances` and the backend; Angular unit-test runner for the frontend lib; exact-decimal tests with fixed expectations for normalization, totals and timeline; table-driven date tests for cancellation deadlines (month-end clamping, leap years, fixed date, renewal, ended, open-ended); backend e2e for the API incl. owner isolation, whitelist, fail-closed key, linked social lines with and without Earnings data, reminder sweep with a stub mailer; Playwright check via `verify-ui`

**Target Platform**: Linux server (backend), modern evergreen browsers (frontend)

**Project Type**: web-service + frontend Nx monorepo

**Performance Goals**: overview, list, charts and gap check render within 1 s for 60 contracts; the list endpoint decrypts at most 200 small rows; the reminder sweep decrypts all settings and contract rows once per run (hundreds of rows, negligible)

**Constraints**: no amounts, names or contract numbers in logs; reminder emails contain only the insurance type label, the user's contract name and the date — never amounts, insurer or contract numbers; whitelist-only payloads; no external service besides the SMTP already in use; fail closed without key; amounts as decimal strings end to end; at most 200 contracts per user

**Scale/Scope**: one user: typically 5–25 contracts

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle / rule                          | Assessment                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Library-First                          | Model, validation, catalog, normalization, deadline derivation, timeline, summary and gap check live in `@vaultfolio/insurances` (no NestJS/Angular imports). PASS                                                                                                                                                         |
| II. API-First                             | New `/insurances` REST surface with OpenAPI DTOs and the existing drift/completeness checks; the frontend talks only via `@vaultfolio/api-contract` types. PASS                                                                                                                                                            |
| III. Test Coverage                        | Premium normalization, totals, timeline, deadlines and linked contributions involve money and dates → exact-value and table-driven tests; ≥ 80 % per project via the coverage audit. PASS                                                                                                                                  |
| IV. Integration Testing                   | Backend e2e (persistence, isolation, whitelist, 503, linked lines, reminder sweep, delete-all). Synthetic Earnings records only. PASS                                                                                                                                                                                      |
| V. Observability, Versioning & Simplicity | Logs carry contract id, counts and outcome only. Three small tables, one module, no new third-party dependency. PASS                                                                                                                                                                                                       |
| Sensitive Personal Data                   | Whitelist-only payloads, owner-only queries, encryption at rest, log hygiene, delete one / delete all apply as written to "any future domain holding comparably sensitive personal data". Contract numbers are stored (encrypted, owner-only) like in Retirement → constitution **MINOR bump 3.11.0**. PASS with amendment |
| Product Scope — domain list               | Insurances is a listed planned domain; the scope text needs a bullet, the naming under the sensitive rules and the contract-number relaxation → amendment as the first task (see Complexity Tracking). PASS with amendment                                                                                                 |
| Out of Scope — data-origin rule           | Manual entry, plus read-only contribution lines derived on the server from the user's own Earnings data; no bank, insurer or provider API. The rule text is extended in the amendment to name this derivation. PASS with amendment                                                                                         |
| Nx boundaries                             | Domain lib depends only on `scope:shared` libs (`@vaultfolio/insurances`, `api-contract`, `export`, `frontend-shared-ui`); it never imports the Earnings frontend lib. The Earnings link exists only server-side (backend module → `EarningsService`), which is not a frontend-domain dependency. PASS                     |
| Stack — Money/decimal                     | Decimal strings in DTOs and payload, `decimal.js` for sums; ciphertext at rest. PASS                                                                                                                                                                                                                                       |
| External integrations                     | Only the already permitted SMTP mailer is used for reminders. PASS                                                                                                                                                                                                                                                         |

**Post-design re-check (Phase 1)**: unchanged. The data model keeps names, insurer, contract numbers,
amounts, dates, notes, profile and dismissals inside ciphertext; plain columns hold only ids, owner,
key version, timestamps and, in the reminder log, the contract id and deadline date. Derived values
(normalized cost, deadlines, timeline, gap result, linked lines) are pure functions and are never
persisted, so no total can drift from its contracts. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/039-insurances-management/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── design.md / mockup.html
├── contracts/
│   ├── insurances-api.md
│   └── insurances-lib.md
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks (not created here)
```

### Source Code (repository root)

```text
libs/insurances/                          # NEW (scope:shared) — pure domain logic
└── src/lib/
    ├── model.ts                          # Contract, Money, Interval, Settings, Profile, SocialKind
    ├── catalog.ts                        # types (group, classification, details), requirements, overlaps
    ├── validation.ts                     # strict whitelist + rules (FR-002, FR-003, FR-018)
    ├── premium.ts                        # normalization, active-in-period, payment months
    ├── deadline.ts                       # next cancellation date from term data (FR-008)
    ├── summary.ts                        # totals, group split, timeline, upcoming deadlines
    ├── gap-check.ts                      # missing / covered / redundant / dismissed (FR-014–FR-016)
    ├── social.ts                         # linked social lines from earnings figures (FR-012/013)
    └── testing/builders.ts

libs/api-contract/src/lib/insurances.ts   # DTO types shared by backend & frontend
libs/notifications/src/lib/templates/insurance-deadline-reminder/   # de/en subject, html, text
libs/notifications/src/lib/types.ts       # + 'insurance-deadline-reminder'

apps/backend/src/insurances/              # NEW module
├── insurances.module.ts, insurances.controller.ts, insurances.service.ts, insurances.repository.ts
├── insurances-crypto.service.ts, insurances-available.guard.ts, insurances.exceptions.ts
├── insurances-linked-social.service.ts   # reads EarningsService, maps to linked lines
└── insurances-reminder.service.ts        # setInterval sweep, dedup log, mailer
apps/backend/src/earnings/earnings.module.ts           # export EarningsService
apps/backend/src/{app/app.module.ts,database/database.service.ts,auth/users.repository.ts,openapi/dto/insurances.ts}
apps/backend/src/tests/insurances.e2e-spec.ts, insurances-e2e.helpers.ts

libs/frontend/domain/insurances/src/lib/  # replaces the placeholder
├── insurances.service.ts                 # HTTP
├── insurances-area/ (tabs, available guard, unavailable state)
├── overview/ (kpis, donut + timeline panels, deadlines, gap summary, empty state)
├── contracts/ (table, filters, linked rows)
├── contract-form/ (catalog picker, premium, cancellation, derived summary, type details)
├── gap-check/ (profile, missing, covered, redundant, dismissed)
├── reminders/ (global + per-contract)
├── charts/insurances-charts.ts           # ECharts option builders
├── insurances-dashboard-widget/
└── insurances-export.definition.ts       # real provider (replaces the disabled placeholder)
apps/frontend/src/app/{app.routes.ts,dashboard/dashboard-widgets.registry.ts,export/feature-export.registry.ts}
libs/frontend/shared-ui/src/lib/i18n/translations/{insurances.de.ts,insurances.en.ts,insurances-translations.spec.ts}

.specify/memory/constitution.md           # 3.11.0 amendment (first task)
.env.example, docker-compose.yml, docker-compose.portainer.yml, README(.de).md, docs/user-guide(.de).md
docs/frontend/testid-conventions.md       # new data-testids follow the convention
api/openapi.yml, api/bruno/insurances/    # contract and requests
```

**Structure Decision**: One new Nx lib (`@vaultfolio/insurances`), one new backend module and the
existing Insurances frontend lib. The Retirement/Wealth structure is mirrored on purpose so guards,
crypto handling, e2e helpers and the coverage audit transfer directly. The placeholder component and
the disabled export definition are removed, not kept. Derived views are computed in the frontend
from the lib (as in Wealth); the backend uses the same lib for validation and for the reminder
deadline, so there is exactly one implementation of every rule.

## Complexity Tracking

| Violation / extra structure                        | Why Needed                                                                                                                                                  | Simpler Alternative Rejected Because                                                                                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Separate `INSURANCES_ENCRYPTION_KEY`               | Independent key lifecycle and blast radius per sensitive domain, same as Earnings, Retirement and Wealth                                                    | Reusing another domain's key couples availability and rotation of two domains                                                          |
| Constitution amendment (MINOR 3.11.0)              | Scope bullet for Insurances, naming under the sensitive rules, contract-number relaxation, and the derived-from-Earnings read named in the data-origin rule | Leaving the domain a bare placeholder would make the plan contradict the governing document                                            |
| `insurance_settings` besides `insurance_contracts` | Profile, reminder preferences and dismissals are per user, not per contract, and are user data that must stay encrypted                                     | Per-contract storage duplicates them; plain columns expose profile flags                                                               |
| `insurance_reminder_log` (plain)                   | One reminder per contract and deadline must survive restarts without decrypting history; holds only ids and a date                                          | "Sent" flags inside the encrypted payload force a decrypt-and-rewrite of contracts per reminder and race with user edits               |
| Backend module depends on `EarningsService`        | Earnings figures are encrypted with the Earnings key and owner-only; only the backend can read them without a second copy                                   | Frontend-to-frontend coupling is forbidden by Nx tags; copying figures into insurance storage duplicates sensitive data and goes stale |
