# Phase 1 Data Model: Tech Stack & Tooling Setup

This feature introduces no real business/domain entities — it is a scaffold.
The only "data" it defines is the minimal shape needed to (a) prove the
frontend/backend/database wiring end-to-end and (b) prove the exact-decimal
rule (FR-008) is enforced from the start. Real domain entities (Holding,
Transaction, Position, ETF Composition, etc.) are explicitly out of scope and
will be modeled by the features that introduce them.

## HealthStatus (transport-only, not persisted)

Represents the backend's self-reported health, returned by `GET /health` and
rendered by the frontend's health-status component. Not stored in the
database — it is computed at request time.

| Field       | Type                             | Notes                                                                                                                      |
| ----------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `status`    | `"ok"` \| `"degraded"`           | `"ok"` when the database connection check succeeds; `"degraded"` otherwise (Edge Case: database container fails to start). |
| `database`  | `"connected"` \| `"unreachable"` | Result of a lightweight DB ping performed by the backend.                                                                  |
| `timestamp` | ISO 8601 string                  | Time the health check was evaluated; supports Principle V's observability requirement (reconstructable from logs).         |

Defined once in `libs/api-contract/src/health.ts` and imported by both
`apps/backend` (to shape its response) and `apps/frontend` (to type the HTTP
call), so the two tiers can never silently drift on this shape — the shared
type is the enforced contract (Principle II).

## ExampleDecimalValue (placeholder domain entity, `libs/domain/example`)

A throwaway entity that exists only to demonstrate — and test — the
exact-decimal handling rule (FR-008, constitution's Money/decimal handling
clause) before any real monetary entity is introduced. It is exercised only
by the domain library's own unit tests; it is not exposed via the API and not
persisted to PostgreSQL by this feature.

| Field    | Type                                                                 | Notes                                                                                                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `amount` | Exact decimal type (e.g., `Decimal` from the chosen decimal library) | MUST NOT be a native `number`. Unit test asserts exact equality (e.g., `0.1 + 0.2` must equal exactly `0.3` when using the decimal type, unlike native floating-point arithmetic), directly demonstrating Principle III's exact-value assertion requirement. |

**Validation rules**: `amount` must be constructible from a decimal-string
input (not a float literal), to keep the "never enters the system as a
native float" property visible at the boundary.

**Relationships / state transitions**: None — this is a stateless value
object with no relationships, deliberately kept minimal per Principle V
(YAGNI).

## Persistence

A single placeholder table is created only to prove PostgreSQL `NUMERIC`
storage and container-restart durability (SC-003) — it is not a real domain
table and future features are free to remove it once a real monetary entity
exists:

```text
Table: example_value
├── id            UUID PRIMARY KEY
├── amount        NUMERIC(20,8) NOT NULL   -- never FLOAT/DOUBLE PRECISION
└── created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
```

This table is not exposed through any API endpoint in this feature; it exists
solely so the "restart the database container, data survives" acceptance
scenario (spec.md User Story 1, Acceptance Scenario 3) has something concrete
to persist and re-read via an integration test.
