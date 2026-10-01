# Implementation Plan: Parser Requests

**Branch**: `033-parser-requests` | **Date**: 2026-10-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/033-parser-requests/spec.md`

**Design**: [design.md](design.md) (approved mockup)

## Summary

A generic **requests** capability (feature + request type, status workflow, admin-only "Requests" tab,
e-mail alerts with deep link, retention) with **"Earnings / New parser"** as its first type. When an
import is rejected as _format not supported yet_, an entitled user can offer an **anonymized,
rebuilt** copy of the document: the PDF is read **only in the browser**; personal data is detected
and removed automatically, every amount/date/digit sequence is replaced by a random value of the
same shape, unknown words are decided by the user one by one, and optional rule hints are marked
with a live arithmetic check. The browser sends **structured layout data only** (strict, versioned
JSON — never a file); the server validates it, runs its own personal-data scan, **generates the
sample PDF itself** (a tiny hand-written, text-only PDF writer), and stores it in SQLite. Admins
download it from the portal only (audited), never by e-mail.

Technical approach in one paragraph: the pure logic (personal-data detectors, label vocabulary,
anonymizer, layout schema validation, sheet model, PDF writer, rule-draft model) lives in the
existing framework-free `libs/earnings` so browser and server run the **same code**; the generic
registry/status types live in a new small `libs/requests` (`scope:shared`, data only, no Earnings
dependency); a new backend `requests` module owns persistence, the admin API, mail and the
retention sweep; the Earnings frontend library gets the four-step wizard; `libs/frontend/admin`
gets the Requests tab.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS backend, evergreen browsers)

**Primary Dependencies**: NestJS, Angular + PrimeNG, Nx; existing `pdfjs-dist` (browser text
reading, already used by 032), `handlebars` via `@vaultfolio/notifications`, `nodemailer` via the
shared `MailerService`. **No new runtime dependency**: the sample PDF is written by a ~150-line
text-only writer (research R2). Test-time only: existing `pdfmake` (synthetic input PDFs) and
`pdfjs-dist` (parsing generated samples back).

**Storage**: SQLite via `DatabaseService` — three new tables `requests`, `request_attachments`
(BLOB), `request_download_audit` (data-model.md); one account-purge hook in
`UsersRepository.deleteById`.

**Testing**: Jest (backend, `libs/earnings`, `libs/requests`), `@angular/build:unit-test`
(frontend libs); exact-value assertions; synthetic PDFs through the real PDF.js adapter; backend
e2e-spec against a temp SQLite file; UI verified with the `verify-ui` skill; Bruno requests.

**Target Platform**: Linux container (backend + embedded SQLite), evergreen browsers.

**Project Type**: web-service + frontend, Nx monorepo.

**Performance Goals**: Analyse + anonymize a 3-page payslip in < 1 s in the browser; submission
validated, PDF generated and stored in < 500 ms; request list for ≈ 1 000 rows < 300 ms.

**Constraints**: Original PDF and raw text never leave the browser (FR-003); server accepts no
binary (FR-015); `/requests` JSON body ≤ 512 kB (raised only for that route, research R5);
logs carry ids/sizes/hashes/codes only (FR-023); e-mails carry link only (FR-022, FR-034).

**Scale/Scope**: 1 new shared library (`libs/requests`), additions to `libs/earnings`,
`api-contract`, `notifications`, `frontend-domain-earnings`, `frontend-admin`; 1 backend module
(5 endpoints), 3 tables, 2 mail templates (EN/DE), 1 wizard (4 steps), 1 admin tab, EN/DE texts.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._ (Constitution v3.6.0)

- **I. Library-First** — All decision logic (detectors, anonymizer, validation, PDF writer, rule
  draft live check) is framework-free in `libs/earnings`; registry/status types in
  `libs/requests`. Testable without HTTP/UI. PASS.
- **II. API-First Interface** — `/requests` contract written first
  ([contracts/requests-api.md](contracts/requests-api.md)); structured error bodies via
  `libs/observability`; types in `libs/api-contract`; OpenAPI DTOs + drift check; Bruno requests.
  The browser's on-device analysis exists solely to satisfy the on-device rule; the server
  re-validates and re-scans everything (FR-016/FR-017). PASS.
- **III. Test Coverage** — Exact-value tests for every detector, anonymizer shape rule, validator
  limit, retention date and PDF content. No monetary values are stored (rule drafts hold none).
  PASS.
- **IV. Integration Testing** — Real serialization: synthetic PDFs → PDF.js adapter → layout JSON →
  HTTP e2e → generated PDF parsed back by PDF.js; SMTP-boundary mocked at `MailerService`. No real
  payslips committed. PASS.
- **V. Observability, Versioning & Simplicity** — Sensitive-data log rules applied (ids, sizes,
  hashes, codes). Layout schema versioned (`schemaVersion: 1`). No new dependency (R2); one new
  small library justified in R1; shared `requireAbsoluteUrl` _removes_ duplication (FR-037). PASS.
- **Product Scope / Sensitive Personal Data** — **GATE: PASS only after the FR-043 amendment.**
  The rule "No document handling on the server: original documents and their extracted text MUST
  NOT be transmitted to or stored by the backend" is **not** violated literally (the original and
  its raw text still never leave the device), but a _derived, rebuilt_ document **is** stored by
  the backend, which the rule's intent ("no document handling on the server") and 032 FR-008/FR-009
  do not permit. The amendment (constitution **3.7.0**, MINOR; wording in research R16) is
  therefore task **T001, before any implementation task**, per spec FR-043. Other sensitive-data
  rules hold: data minimization (strict whitelist, server rejects unknown fields and personal
  data), owner-only access is _not applicable_ to requests (they hold no earnings data; the
  sample is anonymized and admin-visible by design — stated in the privacy note), deterministic
  on-device interpretation, log hygiene, account-lifecycle purge (FR-042). Conditional PASS.
- **Stack Decision** — SQLite single file (BLOB for samples); Material Symbols icons only; no
  charts; new library tagged `scope:shared`; admin lib depends only on `scope:shared`. PASS.

Post-design re-check (after data-model/contracts): no new violations; the only open gate is the
amendment (T001), which the tasks must schedule first.

## Project Structure

### Documentation (this feature)

```text
specs/033-parser-requests/
├── spec.md
├── design.md / mockup.html      # approved UX review
├── plan.md                      # this file
├── research.md                  # Phase 0
├── data-model.md                # Phase 1
├── quickstart.md                # Phase 1
├── contracts/
│   ├── requests-api.md          # REST contract
│   ├── layout-submission-v1.md  # strict browser→server structure
│   └── parser-request-lib.md    # @vaultfolio/earnings + @vaultfolio/requests public API
└── tasks.md                     # Phase 2 (/speckit-tasks) — not created here
```

### Source Code (repository root)

```text
libs/
├── requests/                                   # NEW — @vaultfolio/requests, scope:shared, data only
│   └── src/lib/
│       ├── request-status.ts                   # REQUEST_STATUSES, transitions, CLOSED statuses
│       └── request-types.ts                    # REQUEST_TYPES registry (feature, type, names en/de,
│                                               #   requiredDomain, attachment policy), lookup helpers
├── earnings/src/lib/parser-request/            # NEW (inside existing scope:shared lib)
│   ├── layout-submission.ts                    # types + strict validation + limits (v1)
│   ├── personal-data.ts                        # detectors (IBAN, tax ID, SSN, e-mail, phone, PLZ+city)
│   ├── label-vocabulary.ts                     # kept-label vocabulary (seeded from parsers)
│   ├── anonymize.ts                            # same-shape random values, right-align, placeholders
│   ├── sheet.ts                                # sheet model shared by preview and PDF writer
│   ├── sample-pdf.ts                           # minimal text-only PDF writer (Courier, no actions)
│   ├── rule-draft.ts                           # rule-draft types, validation, derived labels
│   ├── layout-fingerprint.ts                   # duplicate fingerprint (values normalised)
│   └── live-check.ts                           # derive figures from markings → existing checks
├── api-contract/src/lib/requests.ts            # NEW — DTO types
├── notifications/src/lib/templates/
│   ├── request-admin-alert/{en,de}.{subject,text,html}.hbs   # NEW
│   └── request-done/{en,de}.{subject,text,html}.hbs          # NEW
└── frontend/
    ├── domain/earnings/src/lib/parser-request/ # NEW — wizard, store, sheet, steps, service
    │   ├── parser-request.component.ts         # stepper host (route earnings/import/request)
    │   ├── parser-request.store.ts             # in-memory state (FR-009)
    │   ├── layout-extractor.ts                 # PDF.js adapter extension: positions, covered shapes
    │   ├── steps/ (consent, review-words, mark-rules, preview-send, sent, refused)
    │   └── sheet/sheet.component.ts            # clickable sheet (words / rules mode)
    ├── admin/src/lib/requests/                 # NEW — table, detail, service, payload views
    └── shared-ui/src/lib/i18n/translations/requests.{en,de}.ts  # NEW

apps/backend/src/
├── requests/                                   # NEW module
│   ├── requests.module.ts / requests.controller.ts / requests.service.ts
│   ├── requests.repository.ts / request-types.provider.ts (type handlers)
│   ├── requests-email.service.ts / requests-retention.service.ts
│   └── handlers/earnings-new-parser.handler.ts # validate → scan → build sample → payload
├── mail/absolute-url.ts                        # NEW — shared requireAbsoluteUrl (FR-037); used by
│                                               #   profile/signups/invitations/requests e-mail services
├── auth/users.repository.ts                    # +purge requests on deleteById (FR-042)
├── database/database.service.ts                # +3 tables
├── app/body-parsers.ts                         # +/requests 512 kB limit
└── openapi/dto/requests.ts                     # NEW
apps/frontend/src/app/app.routes.ts             # +earnings/import/request, +admin/requests
api/bruno/requests/                             # NEW requests
docs/ user-guide(.de), development(.de)         # + feature description (FR-044)
.specify/memory/constitution.md                 # amendment 3.7.0 (T001)
specs/032-earnings-domain/spec.md               # FR-008/FR-009 amended cross-reference (T001)
```

**Structure Decision**: Reuse `libs/earnings` for everything Earnings-specific (it already holds the
vocabulary source — the parsers' labels — the checks reused by the live check, and the shared
browser/server contract). Add one tiny **data-only** `libs/requests` so the generic registry has no
dependency on any feature and the admin UI/table never imports Earnings logic (SC-010). Backend gets
a generic `requests` module plus a per-type handler interface; Earnings registers its handler there.
No new frontend domain library: the wizard belongs to the Earnings domain; the tab belongs to
`libs/frontend/admin`.

## Complexity Tracking

| Violation                                       | Why Needed                                                                                                                             | Simpler Alternative Rejected Because                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| New library `libs/requests` (Principle V/YAGNI) | Generic registry consumed by backend, admin UI and Earnings; must not depend on Earnings so a second feature registers without changes | Putting it in `libs/earnings` makes admin/backend generic code import Earnings; putting it in `api-contract` mixes data |
| Hand-written PDF writer instead of a library    | Guarantees "static text only, no actions/links/files/forms" by construction; no fs/font loading under webpack; no new dependency (R2)  | `pdfmake`/`pdfkit` read AFM/font files at runtime, pull a large dependency, and can emit links/attachments              |
| Constitution amendment 3.7.0                    | FR-043: a derived anonymized sample is stored server-side, which the current "no document handling on the server" rule does not permit | Storing nothing makes the feature impossible; sending the real PDF is the thing the rule exists to prevent              |
