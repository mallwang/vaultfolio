# Phase 0 Research: Manual Holdings Entry

No `NEEDS CLARIFICATION` markers remain in the Technical Context — spec.md's Assumptions section
already resolved the open product questions (base currency, weight units, ISIN scope, delete
semantics). The decisions below are the technical (not product) choices needed to implement it,
each with rejected alternatives.

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
it to `'ETF' | 'SHARE' | 'GOLD' | 'BITCOIN'`) and nullable type-specific columns (`isin`, `name`,
`weight`, `weight_unit`, `purity`), enforced consistent by a `CHECK` constraint requiring the
correct columns be non-null for each `asset_type`. See [data-model.md](./data-model.md) for the
full DDL.

**Rationale**: FR-009 requires each purchase to be its own row (no merging), and FR-006 requires
only type-relevant fields to ever be presented/considered — a single wide table with a
`CHECK`-constrained discriminator column enforces "the right fields are set for this type" at the
database boundary as a last line of defense, in addition to the domain-layer validation, without
the schema-migration overhead of one table per asset type. Matches the existing no-ORM, raw-SQL
migration pattern already established by `DatabaseService`.

**Alternatives considered**:

- One table per asset type (`etf_holdings`, `gold_holdings`, ...) — rejected: FR-010's unified
  list view would require a `UNION` across four tables for every read, and Story 1's shared fields
  (quantity, purchase price, purchase date) would be duplicated four times; not justified at this
  scale (dozens–hundreds of rows per user).
- JSONB column for type-specific fields — rejected: loses the `NUMERIC` type guarantee for
  `weight`/`purity` (constitution's Money/decimal handling clause bans float storage for monetary/
  quantity values), and loses queryability/constraint enforcement at the DB layer for no benefit
  at this scale.

## 4. Frontend form field-set switching

**Decision**: A single Angular Reactive Form whose field set is driven by the selected/locked
`assetType`, using PrimeNG's `p-select` (add mode) and a locked read-only type display (edit
mode, per design.md's "Edit — Bitcoin" state), `p-inputnumber` for quantity/price/weight/purity,
and `p-datepicker` for the optional purchase date. Switching `assetType` resets (clears) the
form controls for fields that don't apply to the newly selected type, per the Edge Cases
requirement ("MUST discard/reset fields that don't apply").

**Rationale**: Matches design.md's approved mockup interaction exactly (4-way type selector that
"swaps field groups"; edit mode shows the type "locked ... no selector"). Reactive Forms give
explicit control over resetting/disabling controls per type, which template-driven forms would
make harder to keep in sync with FR-006.

**Alternatives considered**: Four separate form components (one per asset type) — rejected: the
shared fields (quantity, price, purchase date) and shared validation/submit flow would be
duplicated four times for a mockup that treats this as one form with a swapped field subset.

## 5. Delete confirmation and "already deleted elsewhere" handling

**Decision**: Use PrimeNG's `p-confirmdialog` (already a natural fit for this Angular/PrimeNG
stack) for the delete confirmation step (FR-014), and treat a `404` from `DELETE /holdings/:id`
(already-deleted case) as a non-error success path in the frontend — refresh the list and show an
informative toast rather than surfacing it as a failure, per the Edge Case requirement.

**Rationale**: `p-confirmdialog` is the standard PrimeNG pattern for a destructive-action
confirmation and matches design.md's "Delete confirm (modal dialog)" region. Treating 404-on-delete
as "already gone, which is what you wanted" (rather than an error) directly satisfies the Edge
Case ("MUST handle this gracefully ... rather than erroring unrecoverably") without needing
optimistic-locking or version columns, which would be disproportionate for this feature's scope.

**Alternatives considered**: A generic browser `confirm()` — rejected: design.md's approved
mockup specifies a modal dialog with holding summary + explicit Cancel/Delete actions, which
`confirm()` cannot render.
