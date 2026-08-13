# Contract: Health Check API

The only API surface introduced by this feature. Defined here as the
authoritative contract; the shared TypeScript type in
`libs/api-contract/src/health.ts` (see [data-model.md](../data-model.md)) is
the implementation of this contract and MUST stay in sync with it.

## `GET /health`

**Purpose**: Lets the frontend, an operator, or an orchestrator (e.g., Docker
Compose healthcheck) confirm the backend is running and can reach the
database. Satisfies spec.md FR-002 and User Story 1's Acceptance Scenario 2.

**Request**: No parameters, no auth (this endpoint is intentionally
unauthenticated — it exposes no business data, only liveness).

**Response — 200 OK** (database reachable):

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "2026-08-13T12:00:00.000Z"
}
```

**Response — 503 Service Unavailable** (database unreachable, per spec.md
Edge Cases: "the database container fails to start"):

```json
{
  "status": "degraded",
  "database": "unreachable",
  "timestamp": "2026-08-13T12:00:00.000Z"
}
```

**Error format**: Follows Principle II's requirement for consistent,
structured error responses — even this degraded case returns a structured
JSON body with the real HTTP status code, never a bare exception or an HTML
error page.

**Contract test**: An integration test in `apps/backend/src/tests/` MUST
issue a real HTTP request to a running instance of the app (via NestJS's
testing module + `supertest`, not an in-memory call) and assert the exact
JSON shape and status code above, per Principle IV.

## Versioning

This is the first version of this contract. Per Principle V (MAJOR.MINOR.BUILD
versioning for external-facing contracts), it is implicitly `1.0.0`. Any
breaking change to the response shape (field removal/rename, status code
semantics change) requires a MAJOR bump and a documented migration note in
this file's future revisions.
