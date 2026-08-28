# Phase 0 Research: Manual Holdings Entry

No `NEEDS CLARIFICATION` markers remain in the Technical Context — spec.md's Assumptions section
and its Clarifications session (2026-08-28) already resolved the open product questions (base
currency, Gold's units, ISIN scope, delete semantics, the Management field, and the ETF/Gold
upsert-vs-lot behavior). The decisions below are the technical (not product) choices needed to
implement it, each with rejected alternatives.

## 1. ISIN format validation

**Decision**: Implement the standard ISIN checksum (2-letter ISO country code + 9 alphanumeric
characters + 1 mod-97/Luhn-style check digit, per spec.md's Assumptions) as a small pure function
in `libs/domain/holdings`, unit-tested with known-valid and known-invalid ISINs.

**Rationale**: The algorithm is ~20 lines with no external state or I/O — a textbook case for
Principle V's YAGNI guidance ("new abstractions, services, or dependencies require explicit
justification over a simpler alternative"). No currently-installed dependency provides it, and
pulling in a single-purpose npm package for one checksum function is a weaker choice than a
domain-library function that Principle I already requires to exist and be independently testable.

**Alternatives considered**:

- An `isin-validator`/similar npm package — rejected: adds a runtime dependency for ~20 lines of
  well-specified, stable logic that must live in the domain library anyway for testability.
- Regex-only shape check (no checksum) — rejected: spec.md's Assumptions explicitly scope this to
  "the standard 12-character ... structure" including the check digit; a shape-only check would
  accept malformed ISINs that fail the checksum, weakening SC-002.

## 2. DTO/request validation approach on the backend

**Decision**: Validate incoming create/update payloads inside the domain layer
(`libs/domain/holdings`'s validation function), not via `class-validator`/`class-transformer`
decorators on NestJS DTOs. The controller passes the raw request body to the service, which calls
the domain validator; validation failures are thrown as a typed domain error and mapped to a
structured 400 response by the controller (consistent with Principle II's "consistent, structured
responses" and the existing `HealthController`'s manual status-code handling — no global exception
pipe is currently configured).

**Rationale**: Keeps all "what makes a Holding valid" logic in one Principle-I-mandated,
framework-independent place, so the same rules apply whether the request comes from the REST API,
a future CSV/JSON import, or a unit test — with no risk of the two validation layers (decorators
vs. domain checks) drifting apart. It also introduces no new dependency (`class-validator` /
`class-transformer` are not currently installed anywhere in the repo), matching Principle V/YAGNI
and the precedent set by 001-tech-stack-setup (`DatabaseService` uses hand-rolled SQL, not an ORM,
for the same reason).

**Alternatives considered**:

- `class-validator` decorators on NestJS DTO classes — rejected for now: would duplicate the
  per-type required-field rules that must already exist in the domain library per Principle I,
  creating two sources of truth. Revisit if future features need declarative validation badly
  enough to justify the dependency.

## 3. Persistence shape for per-type fields

**Decision**: A single `holdings` table with an `asset_type` column (`CHECK` constraint restricting
it to `'ETF' | 'SHARE' | 'GOLD' | 'BITCOIN'`), a universal required `management` column, and
nullable type-specific columns (`isin`, `name`, `purchase_price`, `purchase_date`, `weight_grams`,
`current_value`), enforced consistent by a `CHECK` constraint requiring the correct columns be
non-null for each `asset_type`. See [data-model.md](./data-model.md) for the full DDL.

**Rationale**: FR-011/FR-011a require different persistence behavior per type (Share/Bitcoin
always insert; ETF/Gold upsert by identifier+Management), and FR-008 requires only type-relevant
fields to ever be presented/considered — a single wide table with a `CHECK`-constrained
discriminator column enforces "the right fields are set for this type" at the database boundary as
a last line of defense, in addition to the domain-layer validation, without the schema-migration
overhead of one table per asset type. Matches the existing no-ORM, raw-SQL migration pattern
already established by `DatabaseService`.

**Alternatives considered**:

- One table per asset type (`etf_holdings`, `gold_holdings`, ...) — rejected: FR-012's unified
  list view would require a `UNION` across four tables for every read, and shared fields
  (quantity, Management) would be duplicated four times; not justified at this scale (dozens–
  hundreds of rows per user).
- JSONB column for type-specific fields — rejected: loses the `NUMERIC` type guarantee for
  `weight_grams`/`current_value` (constitution's Money/decimal handling clause bans float storage
  for monetary/quantity values), and loses queryability/constraint enforcement at the DB layer for
  no benefit at this scale.

## 4. ETF/Gold create-or-update ("upsert") semantics

**Decision**: For `POST /holdings` on `assetType: 'ETF'`, the repository looks up an existing row
matching `(asset_type = 'ETF', isin = :isin, management = :management)`; if found, it **replaces**
that row's `quantity` and `purchase_price` with the submitted values (not additive accumulation)
and returns `200 OK`; otherwise it inserts a new row and returns `201 Created`. For
`assetType: 'GOLD'`, the same lookup uses `(asset_type = 'GOLD', management = :management)` (no
ISIN — "the fact of being Gold" is the asset identifier per spec.md's Clarifications) and replaces
`weight_grams` (and `current_value`, if submitted) on match. `SHARE` and `BITCOIN` always `INSERT`
a new row regardless of any existing match, per FR-011.

**Rationale**: The Clarifications session's resolved answer is explicit — "new quantity/average
price **replacing** the old" — so this is a replace-in-place upsert, not an additive merge (e.g.
two ETF submissions of 10 units each do not sum to 20; the second submission's own quantity is
what's stored). Doing the match-then-write in the repository (rather than a Postgres `ON CONFLICT`
upsert) keeps the "what counts as the same asset" identity rule (ISIN for ETF, type alone for
Gold, Management scoping both) in one place that mirrors the domain layer's own merge-decision
function (`holding-merge.ts`), rather than encoding it only as a SQL unique index — auditable per
Principle V (the service logs whether a submission created or updated a row).

**Alternatives considered**:

- A Postgres `UNIQUE` constraint + `ON CONFLICT ... DO UPDATE` — rejected: Gold's identity
  (`asset_type = 'GOLD'` alone, scoped by Management, with no ISIN) and ETF's (`isin` + Management)
  are different shapes, so a single partial-unique-index expression would need two different
  conditional indexes; readable, but it would move the "same asset" decision out of the
  domain-mirrored `holding-merge.ts` and into SQL DDL, splitting one business rule across two
  layers for no real benefit at this scale.
- Additive accumulation (new quantity added to existing) — rejected: contradicts the
  Clarifications session's explicit "replacing the old" resolution.

## 5. Frontend form field-set switching

**Decision**: A single Angular Reactive Form whose field set is driven by the selected/locked
`assetType`, using PrimeNG's `p-select` (add mode) and a locked read-only type display (edit
mode), `p-inputnumber` for quantity/price/weight/current-value, and `p-datepicker` for the
optional purchase date (Share/Bitcoin only — never rendered for ETF/Gold). A universal Management
text input (`p-inputtext`) renders for every asset type. Switching `assetType` resets (clears) the
form controls for fields that don't apply to the newly selected type, per the Edge Cases
requirement ("MUST discard/reset fields that don't apply").

**Rationale**: Reactive Forms give explicit control over resetting/disabling controls per type,
which template-driven forms would make harder to keep in sync with FR-008. The mockup in
[design.md](./design.md) predates the Management field and the current ETF/Gold field set (see
plan.md's Summary) — it establishes the general "one form, swapped field subset" pattern, which
still applies; the specific field list per type should be re-validated against a refreshed mockup
(recommended: re-run `/speckit-ux-review`) before `/speckit-tasks`.

**Alternatives considered**: Four separate form components (one per asset type) — rejected: the
shared fields (quantity, Management, and the submit flow) would be duplicated four times for what
is functionally one form with a swapped field subset.

## 6. Distribution-by-value view (FR-012a)

**Decision**: Add PrimeNG's `p-chart` (a thin wrapper around `chart.js`, PrimeNG's documented
charting integration) as a doughnut/pie chart in a new `holdings-distribution` frontend component,
fed by a value computed client-side from the already-fetched `GET /holdings` list — no new backend
endpoint. Per-holding value is `quantity × purchasePrice` for Share/Bitcoin/ETF and `currentValue`
(if present) for Gold; holdings with no computable value (Gold with `currentValue: null`) are
filtered out of the chart's percentage base entirely, not plotted as zero.

**Rationale**: `chart.js` is the dependency PrimeNG's own docs point to for `p-chart`; introducing
it is justified under Principle V/YAGNI specifically because FR-012a is a new requirement with no
existing in-repo charting capability to reuse (unlike ISIN validation or DTO validation above,
where reuse without a new dependency was possible). Computing the distribution client-side from
the existing list response avoids a second backend endpoint/contract surface for a value derivable
entirely from data the client already has, keeping the API surface minimal (Principle V).

**Alternatives considered**:

- A dedicated `GET /holdings/distribution` backend endpoint pre-computing percentages — rejected:
  the computation is a simple client-side reduce over already-fetched data; a second endpoint
  would duplicate the "how do I value a holding" logic across two request paths for no benefit.
- Hand-rolled inline SVG chart (no new dependency) — rejected: PrimeNG is the established UI
  library for this stack (per the constitution's Stack Decision) and already ships a supported
  charting component; hand-rolling one would violate Principle V's "start simple" guidance in the
  other direction (reinventing what the existing library already provides).

## 7. Delete confirmation and "already deleted elsewhere" handling

**Decision**: Use PrimeNG's `p-confirmdialog` (already a natural fit for this Angular/PrimeNG
stack) for the delete confirmation step (FR-016), and treat a `404` from `DELETE /holdings/:id`
(already-deleted case) as a non-error success path in the frontend — refresh the list and show an
informative toast rather than surfacing it as a failure, per the Edge Case requirement.

**Rationale**: `p-confirmdialog` is the standard PrimeNG pattern for a destructive-action
confirmation. Treating 404-on-delete as "already gone, which is what you wanted" (rather than an
error) directly satisfies the Edge Case ("MUST handle this gracefully ... rather than erroring
unrecoverably") without needing optimistic-locking or version columns, which would be
disproportionate for this feature's scope.

**Alternatives considered**: A generic browser `confirm()` — rejected: does not match the
established PrimeNG modal-dialog pattern already used elsewhere in the app shell, and cannot show
a holding summary alongside the confirm/cancel actions.
