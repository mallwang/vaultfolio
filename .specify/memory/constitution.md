<!--
Sync Impact Report
- Version change: 3.10.0 → 3.11.0 (MINOR: Insurances domain gets concrete scope,
  039-insurances-management; it joins the Sensitive Personal Data rules; the contract-number
  relaxation also covers it; the data-origin rule names the read-only Earnings-derived lines; no
  principle removed or redefined)
- Modified sections:
  - Product Scope intro and In Scope: Insurances bullet (manual contracts, cost and deadline
    overview, gap check, optional reminder e-mails, read-only social-insurance lines derived
    server-side from the user's own Earnings data).
  - Product Scope → Out of Scope: the derivation from Earnings is not an import from an external
    system.
  - Product Scope → Sensitive Personal Data: names Insurances; contract numbers MAY be stored there.
- Added/removed principles and sections: none
- Templates requiring updates: none
- Previous: 3.9.0 → 3.10.0 (MINOR: Historic Wealth Development domain gets concrete scope,
  038-networth-tracking; its manual entry data joins the Sensitive Personal Data rules; no
  principle removed or redefined)
- Modified sections:
  - Product Scope intro: Historic Wealth Development is now specified (038), no longer a bare
    placeholder.
  - Product Scope → In Scope: Historic Wealth Development bullets (manual snapshots of assets and
    liabilities, balance-sheet view, dashboard tile, PDF export).
  - Product Scope → Sensitive Personal Data: applies to Historic Wealth Development (entry names,
    classes, amounts and notes are encrypted at rest, owner-only, whitelist-only, kept out of logs).
- Added/removed principles and sections: none
- Templates requiring updates: none
- Previous: 3.8.0 → 3.9.0 (MINOR: Retirement domain gets concrete scope, 037-altersvorsorge-
  retirement-planning; it joins the Sensitive Personal Data rules with one narrow relaxation for
  insurance/contract numbers; no principle removed or redefined)
- Modified sections:
  - Product Scope intro: Retirement is now specified (037), no longer a bare placeholder.
  - Product Scope → In Scope: Retirement-domain bullets (German three-pillar pension data; manual
    entry; DRV Renteninformation import from an uploaded document, interpreted on the device).
  - Product Scope → Out of Scope: the data-origin rule names Retirement's manual entry and
    document import as permitted; no pension-provider or DRV API integration.
  - Product Scope → Sensitive Personal Data: applies to Retirement; insurance and contract numbers
    MAY be stored (encrypted, owner-only) in Retirement because the user needs them for look-ups;
    imported figures are read-only, parser requests do not extend to Retirement.
- Added/removed principles and sections: none
- Templates requiring updates: none
- Previous: 3.7.0 → 3.8.0 (MINOR: Earnings document import also accepts PDFs without a text
  layer, read by on-device text recognition after the user's per-file consent,
  034-ocr-fallback-pdf; no principle removed or redefined)
- Modified sections:
  - Product Scope → In Scope → Earnings domain: PDFs are "text-based, or read by on-device text
    recognition after the user's consent".
  - Product Scope → Sensitive Personal Data → "Deterministic interpretation, no external services":
    recognition runs entirely on the device (no external/cloud OCR), its output is raw text under
    the same rules, and it is never transmitted, persisted or cached.
- Added/removed principles and sections: none
- Templates requiring updates: none
- Previous: 3.6.0 → 3.7.0 (MINOR: the Sensitive Personal Data rule "No document handling on
  the server" gains one narrow exception for an anonymized, rebuilt sample submitted in an opt-in
  parser request, 033-parser-requests, FR-043)
- Modified sections:
  - Product Scope → Sensitive Personal Data → "No document handling on the server": originals and
    raw text still never leave the device; a derived, anonymized, rebuilt sample (layout data only,
    random same-shape values, personal identifiers removed and re-checked server-side) MAY be
    stored for administrators only, never e-mailed, deleted 30 days after the request closes.
  - Product Scope → In Scope: Earnings parser requests added.
- Added/removed principles and sections: none
- Templates requiring updates: none (generic templates carry no product-scope language)
- Follow-up TODOs:
  - Add a pointer to this exception in specs/032-earnings-domain/spec.md FR-008/FR-009 (outside
    this command's scope; deferred).
  - Update the in-app Earnings privacy note, user and operator docs (033 FR-044).
- Previous: 3.5.0 → 3.6.0 (MINOR: Earnings out-of-scope rule gains a narrow exception for
  correcting a misread figure in the import preview, issue #63; details below the 3.5.0 report)
- Previous: 3.4.0 → 3.5.0 (MINOR: new domain added to Product Scope, a new Sensitive
  Personal Data section added, and Principles IV/V plus the Money/decimal Stack Decision
  materially expanded with scoped carve-outs — no principle removed or redefined)
- Modified principles:
  - IV. Integration Testing: added that real personal documents MUST NOT be committed as
    fixtures; synthetic documents reproducing the real layout satisfy the real-format requirement.
  - V. Observability, Versioning & Simplicity: for sensitive-data domains, traceability is
    achieved by logging import metadata (import id, content fingerprint, parser id/version,
    counts, outcome) instead of amounts or document content.
- Added sections:
  - Product Scope → Sensitive Personal Data (data minimization, no document transmission or
    storage, owner-only access, encryption at rest, log hygiene, deterministic on-device document
    interpretation without external/LLM services).
- Removed sections: none
- Modified sections:
  - Product Scope intro: Earnings added as a planned domain (032-earnings-domain).
  - Product Scope → In Scope: Earnings-domain bullets (employment income history; upload-only
    document import).
  - Product Scope → Out of Scope: the data-origin rule now names Earnings' document import as the
    one permitted exception to "manual UI entry or CSV/JSON import", and forbids manual entry of
    monetary figures in Earnings; payroll-system APIs added to the prohibited integrations.
  - Stack Decision → Money/decimal handling: encrypted-at-rest carve-out for sensitive-data
    domains (exact decimal at the application layer; ciphertext as the storage form).
  - Stack Decision → Frontend domain libraries: earnings added to the example list.
- Rationale for this amendment: spec 032-earnings-domain introduces a domain whose data
  (payslips, tax certificates) is far more sensitive than holdings and whose correctness depends
  on figures printed by employers rather than typed by users. The prior constitution only allowed
  manual entry or CSV/JSON import, required logging calculation inputs, and required plain decimal
  TEXT storage — all three conflict with that design, so they are reconciled here explicitly.
- Previous amendment (3.3.0 → 3.4.0): Haushaltsplaner budget tracking carved out of the general
  exclusion; Account Overview covered by the no-bank-API rule.
- Templates requiring updates:
  - .specify/templates/constitution-template.md ✅ no change needed (generic placeholder
    template, no product-scope-specific language to update)
  - .specify/templates/plan-template.md ✅ no change needed
  - .specify/templates/tasks-template.md ✅ no change needed
  - .specify/templates/spec-template.md ✅ no change needed (spec stays technology-agnostic)
- Follow-up TODOs:
  - TODO(MARKET_DATA_PROVIDER): Specific market-data API vendor (prices, ETF composition) not yet
    chosen. Resolve during the /speckit-plan run for the first feature that needs live market data;
    isolate behind a dedicated module per Principle I and the Product Scope's External Market Data
    rules so the vendor stays swappable.
  - Consider whether Account Overview's "planned cash flow" (per the intake) implies any
    forecasting/projection logic that would need its own Core Principle or Stack Decision entry —
    unresolved until that domain is actually specified via /speckit-specify.
  - Encryption-key rotation for sensitive-data domains is not yet defined; resolve when a
    rotation need arises (not part of 032-earnings-domain).
-->

# Vaultfolio Constitution

## Core Principles

### I. Library-First

Every feature starts as a standalone library or module with a well-defined boundary, before any
UI or transport layer is wired to it. Libraries MUST be self-contained, independently testable,
and documented with a clear purpose; a library that exists only to hold shared code with no
coherent responsibility (an "organizational-only" library) is not permitted. This applies equally
to core finance domain logic (e.g., position valuation, cost-basis/gain-loss calculation,
portfolio allocation and look-through weight aggregation) — that logic MUST be implemented and
testable independently of the API layer or UI that later calls into it.

**Rationale**: Financial logic is the highest-risk part of this system. Isolating it behind clear
library boundaries makes it possible to test money-handling code exhaustively, in isolation, and
without needing to stand up an entire application stack.

### II. API-First Interface

The backend exposes every capability the frontend needs through a documented, versioned API
(e.g., REST or GraphQL); the frontend MUST treat that API as the only path to data and business
logic — no bypassing it via direct database access or shared in-process calls. The API contract
(request/response schemas, status/error codes) MUST be written and reviewed before or alongside
the implementation, and both frontend and backend MUST be independently runnable and testable
against that contract (e.g., via a mock server or contract tests) without the other tier present.
Errors MUST use consistent, structured responses (status code + machine-readable error body), not
bare exceptions or HTML error pages. Operational/admin scripts (migrations, seed data, one-off
reconciliation jobs) MAY be exposed as CLI tools, but the CLI is not the product's primary
interface.

**Rationale**: In a three-tier web app, the frontend/backend boundary is the highest-traffic
contract in the system. Making the API the single, well-defined entry point keeps frontend and
backend independently deployable and testable, and prevents financial logic from leaking into the
UI layer or being duplicated across it.

### III. Test Coverage

Code that touches financial data or calculations follows a normal implement-then-test approach:
implementation is written first, then tests are added to cover it — tests are not required to be
written before, or to fail before, the implementation exists, and no Red-Green-Refactor ordering
is mandated. This applies to all code, including financial logic, because this project's
development is agentic: a single LLM context window typically produces both the implementation
and its tests from the precise logic already established by upfront research/plan/tasks
artifacts, so a strict tests-first ordering does not provide the independent-design-check benefit
it gives human developers. Despite the relaxed ordering, coverage itself is not optional: any
change to money amounts, balances, currency conversion, or date/period logic MUST end up covered
by tests that assert exact expected values before the change is considered done — approximate or
"close enough" assertions on monetary values are not permitted.

**Rationale**: Silent correctness bugs in a finance tool directly cause incorrect financial
decisions, so financial code must still be thoroughly tested. But in an agentic workflow the
tests-first ordering mostly duplicates work the plan/tasks phase already did, without the benefit
it gives human developers of using the test as an independent spec check before writing code.
Exact-value assertions remain required regardless of ordering, to prevent floating-point or
rounding errors from hiding inside loose tolerances.

### IV. Integration Testing

Integration tests are required, beyond unit tests, for: every new library's public contract;
any change to an existing contract; communication between services or modules (e.g., import
pipeline → valuation → storage, or market-data fetch → price cache → portfolio overview); and any
shared schema (holding records, transaction records, ETF composition data). Integration tests
MUST exercise real serialization formats (e.g., actual JSON/CSV import files, real market-data API
response payloads captured as fixtures) not just in-memory objects. Real personal documents (e.g.,
payslips, tax certificates) MUST NOT be committed as fixtures; for such formats the requirement is
met by synthetic documents that reproduce the real layout and structure with invented figures.

**Rationale**: Portfolio data flows through multiple stages (import or manual entry, price/
composition lookup, valuation, aggregation). Most real-world defects in such pipelines occur at
the boundaries between stages, not inside a single function — unit tests alone will not catch
them.

### V. Observability, Versioning & Simplicity

Text-based I/O and structured logging are required throughout so behavior is debuggable from
logs alone, without a debugger attached. All financial calculations and imports MUST log
sufficient context (inputs, source, timestamp) to reconstruct how a stored value was derived.
Exception for data covered by the Sensitive Personal Data rules (Product Scope): logs MUST NOT
contain amounts, document content, or personal identifiers; traceability is instead provided by
import metadata (import id, content fingerprint, parser identity and version, record counts,
outcome/error codes) together with the stored, per-import provenance of each record.
Libraries and any external-facing contracts (APIs, file formats, CLI flags for ops tooling) follow
MAJOR.MINOR.BUILD versioning; breaking changes to a contract require a MAJOR bump and a documented
migration path.
Implementations MUST start simple (YAGNI) — new abstractions, services, or dependencies require
explicit justification over a simpler alternative before being added.

**Rationale**: Auditability is a core requirement for any tool that handles someone's money —
users and maintainers must be able to trace why a balance or report looks the way it does.
Simplicity keeps that audit trail short and keeps the system easy to reason about as it grows.

## Product Scope

Vaultfolio is a multi-domain personal finance app, organized as an app-shell plus independent
domains per the Frontend domain libraries Stack Decision below. **Holdings** (investment tracking)
is the first fully-built domain; **Retirement**, **Insurances**, **Haushaltsplaner** (household/
budget planning), **Historic Wealth Development**, and **Account Overview** are planned domains
(registered today as placeholders — see 022-add-domain-placeholders; Retirement is specified in
037-altersvorsorge-retirement-planning; Historic Wealth Development is specified in
038-networth-tracking; Insurances is specified in 039-insurances-management), as is **Earnings**
(employment income history — see 032-earnings-domain). The scope rules below apply
per domain as noted; a rule scoped to "the Holdings domain" does not extend to other domains unless
stated.

### In Scope

- Holdings domain: tracking investment holdings — ETFs, individual shares/stocks, gold and other
  precious metals, and similar investment vehicles.
- Holdings domain: manual entry and management of holdings and transactions (buys, sells,
  quantities, cost basis) via the UI.
- Holdings domain: bulk import of holdings/transactions via CSV or JSON files.
- Holdings domain: a portfolio overview that aggregates allocation across holdings — including
  looking through ETF composition to underlying constituent weights — so overweight positions and
  duplicate/overlapping exposure across different holdings (e.g., the same share held both
  directly and inside two different ETFs) can be identified.
- Haushaltsplaner domain: day-to-day expense/budget tracking — income, spending categories, bills,
  recurring payments, and monthly budget planning. This is the express purpose of this domain, once
  specified; it is a deliberate exception to the general exclusion below, confined to this domain.
- Earnings domain: a user's employment income history — payslips (gross, net, payout, bonuses and
  one-off payments), wage tax, solidarity surcharge, church tax, employee social-insurance
  contributions, and annual wage-tax certificates — with yearly/monthly analysis and consistency
  checks against the printed year-to-date totals and certificates.
- Earnings domain: data enters exclusively by document import — payslip and wage-tax
  certificate PDFs (text-based, or read by on-device text recognition after the user's consent)
  interpreted on the user's own device, or the companion local tool's versioned,
  whitelisted JSON export. Every imported record MUST pass the domain's arithmetic checks, re-run
  by the backend; a file containing any failing record MUST be rejected as a whole.
- Earnings domain: parser requests (033-parser-requests) — when an import is rejected as "format
  not supported yet", an entitled user MAY request a new parser by submitting an anonymized, rebuilt
  sample under the exception in Sensitive Personal Data; requests are handled by administrators.

- Retirement domain: a user's German retirement provision across the three pillars — statutory
  pension (Renteninformation of the Deutsche Rentenversicherung), occupational pension contracts
  (any number, e.g. one per employer), and private provision (Riester, private pension insurance,
  Altersvorsorgedepot) — with an overview, a dashboard tile, and a static "further information"
  list of external resources. Scope is Germany only; no tax, inflation, or pension-gap calculation.
- Retirement domain: data enters by manual UI entry or, for the statutory pension, by upload of the
  user's own Renteninformation document, interpreted on the user's device under the Sensitive
  Personal Data rules. Figures of an imported record are read-only (delete or replace by a newer
  import only); manually entered records stay editable by the user.

- Historic Wealth Development domain: a user's net worth over time from manually recorded
  snapshots (Stichtage) of assets and liabilities, each entry with a name, a class and an amount —
  with an overview and chart, a personal balance-sheet view (Aktiva/Passiva with equity as the
  balancing figure), a dashboard tile, and a PDF/data export. Data enters by manual UI entry only;
  there is no bank, broker or Holdings import. Its manual entry data (entry names, classes,
  amounts, notes) falls under the Sensitive Personal Data rules.

- Insurances domain: a user's own insurance contracts (type from a fixed catalog, insurer, term,
  premium and interval, cancellation settings) entered manually, with cost and payment-timeline
  overview, derived cancellation deadlines, a profile-based gap check, optional cancellation-deadline
  reminder e-mails, a dashboard tile and a data export. Statutory social-insurance contribution
  lines are derived read-only on the server from the user's own Earnings data and never stored.
  Contract data falls under the Sensitive Personal Data rules.

### Out of Scope

- Day-to-day expense or budget tracking (income, spending categories, bills, recurring payments)
  **within the Holdings domain**, or as a standalone, non-domain-scoped feature of the app-shell.
  This remains explicitly not a goal of Holdings and MUST NOT be added to it — it belongs
  exclusively to the Haushaltsplaner domain (see In Scope above) so the two domains' data and
  concerns stay separated per the Frontend domain libraries Stack Decision.
- Any integration with personal banking, brokerage, or payroll-system account APIs to read the
  user's account, transaction, or payroll data. All personal holdings/transaction and
  expense/budget data MUST originate from manual UI entry or explicit CSV/JSON import — it MUST
  NOT be pulled automatically from a linked bank or brokerage account. This applies across all
  domains, including Account Overview: it MAY aggregate manually entered or imported balances
  across accounts, but MUST NOT itself integrate with a bank/brokerage API to fetch them live. The
  exceptions to the "manual UI entry or CSV/JSON import" origin rule are the Earnings domain's
  document import and the Retirement domain's Renteninformation import (see In Scope), which are
  still explicit, user-initiated uploads. Neither domain may fetch data from a provider, from the
  Deutsche Rentenversicherung, or from any other external system. The Insurances domain's
  read-only social-insurance lines, derived on the server from the user's own Earnings data, are a
  derivation inside the application, not an import from an external system.
- Manual entry of monetary figures in the Earnings domain. Payroll and tax figures MUST come from
  the documents that printed them. The one exception is the correction of a figure that a parser
  misread, in the import preview only: the figure MUST take part in a failing arithmetic check,
  the checks MUST pass again on the device and on the server before anything is saved, and the
  saved figure MUST stay marked as user-corrected. Users MAY also rename display labels (e.g., an
  employer's display name).

### External Market Data (Permitted)

Unlike personal account data, reference/market data MAY be sourced from external APIs, because it
is public, non-personal information required to keep the portfolio overview accurate:

- Current prices for stocks, ETFs, gold, and other tracked instruments.
- ETF composition — the underlying constituent shares and their percentage weights — needed to
  compute look-through exposure across the whole portfolio.

Such integrations MUST be: read-only (the application never writes personal data back to a market-
data provider); isolated behind a dedicated module/service so a provider can be swapped without
touching core domain logic (per Principle I); and resilient to unavailability — the application
MUST remain usable with manually entered or last-known prices/composition if a market-data
provider is unreachable, since a user's recorded holdings are the source of truth, not the prices.

### Sensitive Personal Data

The Earnings, Retirement, Insurances and Historic Wealth Development domains, and any future domain holding comparably sensitive personal
data (e.g., salary, tax, or health-related records), MUST follow these rules in addition to the rest of this
constitution:

- **Data minimization**: only an explicitly whitelisted set of figures and labels is transmitted
  and stored. Personal identifiers printed on source documents (tax ID, social-security number,
  bank account/IBAN, name, address, personnel number) MUST NOT be transmitted or stored; the
  backend MUST reject any payload containing fields outside the whitelist. Exception, Retirement
  and Insurances domains only: the insurance number and contract numbers MAY be entered, stored and displayed to
  their owner, because the user needs them to look up the contract; they follow the same
  owner-only, encryption-at-rest and log-hygiene rules as amounts. Name, address, tax ID, and bank
  details remain forbidden.
- **No document handling on the server**: original documents and their extracted text MUST NOT be
  transmitted to or stored by the backend. Document interpretation happens on the user's device.
  The single exception (available in the Earnings domain only, not in Retirement) is an opt-in, explicitly consented, user-reviewed flow that transmits a
  derived, anonymized, rebuilt sample — structured layout data only, never a file; every value
  replaced by a random value of the same shape; personal identifiers removed on the device and
  re-checked on the server — for the sole purpose of letting a developer build a parser. Such a
  sample MUST be stored only for administrators, MUST NOT be sent by e-mail, and MUST be deleted
  30 days after the request is closed. The original document, its raw text, personal identifiers,
  and figures from the user's real document MUST still never leave the device.
- **Deterministic interpretation, no external services**: document interpretation MUST be
  deterministic and reproducible for a given input and parser version, and MUST NOT use any
  external, cloud, or AI/LLM service. Text recognition for PDFs without a text layer is permitted
  only if it runs entirely on the user's device after the user's per-file consent, loads its
  engine and data only from the application's own origin, and neither transmits, persists nor
  caches anything derived from the document; recognised text is raw text under the same rules.
- **Owner-only access**: every record belongs to exactly one user and is only ever visible to,
  modifiable by, or deletable by that user. No administrative view, report, or endpoint may expose
  another user's data — role-based access (including Administrator) never overrides ownership.
- **Encryption at rest**: monetary amounts MUST be stored encrypted with a server-held key
  configured by the instance operator, so the database file or a backup alone reveals no amount.
  Non-monetary lookup fields (e.g., period, employer, kind) MAY remain in plain form. If the key is
  missing or invalid, the domain MUST fail closed (report unavailability; never show wrong/partial
  figures or accept new data).
- **User corrections stay traceable**: a figure the user corrected in the import preview MUST be
  validated again by the server, MUST be stored and shown marked as user-corrected (the figure's
  name only, never a second copy of the value), and MUST NOT be accepted for a figure outside a
  failing check.
- **Log hygiene**: logs, error reports, and diagnostics MUST NOT contain amounts, document
  content, or personal identifiers (see Principle V's exception).
- **User control and transparency**: users MUST be able to delete a single import and all of
  their data in the domain; the data MUST follow the account lifecycle of other owned data; and the
  domain MUST explain in-app what is stored, what is encrypted, and that the instance operator
  runs the server and holds the key.

## Technology & Architecture Constraints

- The system is a three-tier web application: a **frontend**, a **backend**, and a **database**,
  each developed and deployed as a separate component communicating over the API defined in
  Principle II.
- The full stack (frontend, backend, database) MUST be packaged as Docker containers and MUST be
  runnable end-to-end via a single orchestration file (e.g., `docker-compose.yml`) for local
  development, with the same images used for hosting/deployment.
- The database MUST be a single embedded file, bind-mounted into the backend container from a
  host-side directory (not a Docker-managed named volume), so data persists independently of
  application container restarts/recreation and can be backed up/restored with a plain filesystem
  copy of that directory — no separate database container/service is required or permitted.
- The backend MAY integrate with external market-data providers (e.g., stock/ETF price APIs,
  ETF holdings/composition APIs) strictly for the read-only reference data described in Product
  Scope. No other external API integrations are permitted — in particular, no banking or
  brokerage account APIs.

### Stack Decision

- **Repository layout**: A single Nx monorepo houses the frontend, backend, and any shared
  libraries (e.g., shared DTOs/types, domain logic libraries required by Principle I). Nx project
  boundaries MUST be used to enforce the frontend/backend separation mandated by Principle II —
  the frontend project MUST NOT import backend source directly, only the published API contract.
- **Backend**: NestJS on Node.js, written in TypeScript. Domain/finance logic (position valuation,
  cost-basis/gain-loss, allocation/look-through aggregation) MUST live in standalone Nx libraries
  per Principle I, independent of NestJS controllers/modules, so it is testable without the HTTP
  layer.
- **Frontend**: Angular, written in TypeScript, in the same Nx monorepo.
- **Database**: SQLite, embedded directly in the backend process as a single file at
  `DATABASE_PATH` (default `./data/vaultfolio.db`), bind-mounted from the host per the constraint
  above — not run as a separate container/service.
- **Money/decimal handling**: Monetary and quantity values MUST be stored as SQLite `TEXT` columns
  holding the canonical decimal string produced by the application-layer decimal library — never
  SQLite's `REAL` storage class (IEEE-754 float, unsafe for exact decimals) and never native
  JavaScript/TypeScript `number`. At the application layer, monetary values MUST be represented
  with an exact decimal type/library end-to-end through backend calculations and API responses,
  consistent with Principle III's ban on approximate assertions for monetary values. Carve-out for
  data under the Sensitive Personal Data rules: the storage form of such amounts is ciphertext
  (encrypting the canonical decimal string) rather than plain decimal `TEXT`; values MUST still be
  exact decimals before encryption and after decryption, and MUST NOT pass through a float at any
  point.
- **Market-data provider**: Not yet selected — see `TODO(MARKET_DATA_PROVIDER)` in the Sync Impact
  Report above. Whichever provider is chosen MUST be isolated behind a dedicated Nx library/module
  per Principle I and the Product Scope's External Market Data rules, so it can be swapped without
  touching domain logic.
- **Icon library**: Google Material Icons (Material Symbols) is the sole, standard icon library for
  the frontend. All icons MUST be sourced from Material Icons via PrimeNG's documented custom-icon
  mechanism (https://primeng.dev/customicons); PrimeIcons (PrimeNG's bundled default icon font)
  MUST NOT be used anywhere in the application UI — new and existing icon usage alike MUST resolve
  to a Material Icons glyph, with no partial/mixed icon sets left in place.
- **Charting library**: Apache ECharts is the sole, standard charting library for the frontend.
  All charts MUST be rendered via ECharts; PrimeNG's Chart component (and its underlying Chart.js
  dependency) MUST NOT be used anywhere in the application UI — new and existing chart usage alike
  MUST be migrated to ECharts, with no partial/mixed charting libraries left in place.
- **Frontend domain libraries**: Every frontend domain (e.g., holdings, retirement, insurances,
  household planning, historic wealth development, account overview, earnings) MUST be its own standalone
  Nx library under `libs/frontend/domain/<name>`, tagged `scope:frontend-domain`, independently
  testable per Principle I. Domain boundaries MUST be enforced by Nx project tags via
  `@nx/enforce-module-boundaries`, not by discipline alone:
  - `scope:frontend` (the app-shell) MAY depend only on `scope:shared`, `scope:frontend-domain`,
    and `scope:frontend-admin`.
  - `scope:frontend-domain` and `scope:frontend-admin` MAY depend only on `scope:shared` — a
    domain library MUST NOT import another domain library, and MUST NOT import the app-shell.
  - `scope:shared` MAY depend only on `scope:shared`.
    Entitlement checks (which domains a given account can access) MUST live in the single
    `scope:shared` `libs/frontend/domain-access` library, not be duplicated per domain; that library
    MUST NOT depend on any `scope:frontend-domain` library, so the shared entitlement mechanism
    never couples back to a specific domain. Admin/Verwaltung MUST remain its own role-gated module
    (`libs/frontend/admin`, tagged `scope:frontend-admin`), separate from the domain-entitlement
    model used for product domains. The Dashboard and Settings areas MUST expose a per-domain
    contribution mechanism (a registry a domain library registers against) so a domain can offer its
    own dashboard widget and/or settings tab, filtered by domain entitlement, without the shell
    hard-coding per-domain imports or domain libraries depending on each other.

## Development Workflow & Quality Gates

- All work is specified via `/speckit-specify`, planned via `/speckit-plan`, and broken into tasks
  via `/speckit-tasks` before implementation begins; ad-hoc, unplanned changes to financial logic
  are not permitted.
- Every pull request MUST verify compliance with the Core Principles above before merge; a PR that
  weakens test coverage on money-handling code MUST be rejected regardless of urgency.
- Any deviation from a principle (e.g., shipping money-handling code without exact-value test
  coverage) MUST be documented with an explicit justification in the PR description and, if it
  becomes a recurring pattern, MUST trigger a constitution amendment rather than silent
  accumulation of exceptions.

## Governance

This constitution supersedes all other project practices, templates, and prior conventions where
they conflict. Amendments are made by editing this file via the `/speckit-constitution` command,
which MUST: record the change in the Sync Impact Report at the top of this file, apply semantic
versioning to the change (MAJOR for backward-incompatible principle removal/redefinition, MINOR
for a new principle or materially expanded guidance, PATCH for clarifications and wording), and
update the `Last Amended` date below.

All feature specs, plans, and task lists MUST include a Constitution Check step that verifies
alignment with the Core Principles; unresolved violations MUST be justified in the plan's
Complexity Tracking section or the plan MUST be revised to comply. Reviewers MUST treat this
constitution as authoritative over informal team conventions.

**Version**: 3.11.0 | **Ratified**: 2026-08-13 | **Last Amended**: 2026-10-05
