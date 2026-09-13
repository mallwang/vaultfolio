# Implementation Plan: OpenAPI/Swagger API Documentation

**Branch**: `031-openapi-swagger-integration` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/031-openapi-swagger-integration/spec.md`

## Summary

Generate the backend's API documentation directly from its NestJS controllers/DTOs using
`@nestjs/swagger`, serve it as an interactive UI at `/swagger` (reachable through the frontend's
nginx reverse proxy so it shares the app's origin — and therefore its session cookie — in both
local Docker Compose and the Portainer/NAS deployment), export the same generated document as
`/api/openapi.yml`, and check in a hand-curated Bruno collection under `/api/bruno` that imports
against it. The existing `libs/api-contract` interfaces are the shape of truth for every DTO;
because `@nestjs/swagger`'s reflection needs runtime-visible classes, this feature introduces a
thin decorated-class layer per contract interface rather than replacing the interfaces themselves.
A checked-in generation script plus a CI/pre-commit drift check — not just a Speckit task-list
reminder — is what keeps `openapi.yml` from silently going stale (US3), since relying on a human
remembering a checklist item is exactly the failure mode the constitution's Observability &
Simplicity principle warns against for anything meant to be trustworthy from the artifact alone.

## Technical Context

**Language/Version**: TypeScript (Node.js LTS runtime for the backend)

**Primary Dependencies**: `@nestjs/swagger` (new) for schema generation and the interactive UI;
`js-yaml` (new, or `yaml`) to serialize the generated OpenAPI JSON document to the committed
`openapi.yml`. No new frontend dependency — `/swagger` is served by the backend and reached
through the existing nginx reverse proxy, not built as an Angular route. Bruno itself is a
developer-local desktop/CLI tool, not a project dependency; only the `.bru` collection files are
checked in.

**Storage**: N/A — this feature adds documentation/tooling only, no persisted data or schema
changes.

**Testing**: Jest (Nx default) for a small unit/integration test asserting the generated OpenAPI
document contains every registered route and marks protected routes' security requirement
correctly; a script-level check (see Phase 1 contracts) that fails when the committed
`api/openapi.yml` doesn't match freshly generated output.

**Target Platform**: Same as the rest of the backend — Linux server container; the interactive UI
and exported file must work identically in local `docker-compose.yml` and in
`docker-compose.portainer.yml` (NAS/Portainer deployment), both of which front the backend with the
same `docker/frontend.nginx.conf` reverse proxy.

**Project Type**: web-service + frontend, Nx monorepo (existing structure; no new Nx app)

**Performance Goals**: N/A — documentation generation happens once at process startup (or lazily
on first request) and is not on any user-facing request's hot path; no specific latency target
beyond "does not measurably slow down backend boot".

**Constraints**: The interactive UI's "try it out" must reuse the existing httpOnly session cookie
(`vaultfolio_session`, `SameSite=Lax`, path `/`) rather than introduce a second credential scheme —
this only works if `/swagger` is served from the same origin the browser already holds that cookie
for, which drives the nginx-proxy requirement in FR-006 (see research.md #2).

**Scale/Scope**: Every existing REST endpoint across all current backend modules (`auth`,
`accounts`, `holdings`, `invitations`, `signups`, `profile`, `account-overview`, `turnstile`,
`health`) gets decorated as part of this feature (FR-012); no new business endpoints are added.

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

- **I. Library-First**: PASS. This feature only adds a documentation/presentation layer over
  existing controllers and the existing `libs/api-contract` shapes; no domain/finance logic is
  touched, so no new library boundary is required. The new decorated-class layer lives in
  `apps/backend` (framework-bound, presentation concern), not in a domain library.
- **II. API-First Interface**: PASS — this feature is a direct enabler of this principle: it turns
  the already-mandatory documented API contract into a generated, always-current artifact instead
  of one that only exists implicitly in code. No change to error-response structure is needed; the
  existing structured error shape (`libs/api-contract/src/lib/error-response.ts`) is documented
  as-is.
- **III. Test Coverage**: PASS — no monetary/financial calculation code is touched; the new tests
  cover documentation completeness and drift-detection, not money values.
- **IV. Integration Testing**: PASS — the drift-detection check (research.md #6) is itself an
  integration-style test: it exercises the real generation pipeline against the real, currently
  registered routes, not a mocked subset.
- **V. Observability, Versioning & Simplicity**: PASS — this feature directly serves auditability
  (every endpoint's contract is now inspectable without reading source) and deliberately favors the
  simpler, automatically-enforced option (a generation/diff script) over a purely manual workflow
  reminder for keeping `openapi.yml` current (YAGNI: don't rely on process discipline where a
  script can check it).

No violations requiring Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/031-openapi-swagger-integration/
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
│   ├── src/
│   │   ├── openapi/                    # NEW: doc generation + Swagger wiring for this feature
│   │   │   ├── openapi.setup.ts        # DocumentBuilder + SwaggerModule.setup('swagger', app, ...)
│   │   │   ├── openapi.controller.ts   # serves GET /openapi.yml (backed by the same document)
│   │   │   └── dto/                    # decorated classes mirroring libs/api-contract interfaces,
│   │   │                               # one file per existing contract module (holdings.ts,
│   │   │                               # accounts.ts, auth.ts, ...), used only as controller
│   │   │                               # method parameter/return types so @nestjs/swagger can
│   │   │                               # reflect them
│   │   ├── <existing modules>          # auth, holdings, accounts, invitations, signups, profile,
│   │   │                               # account-overview, turnstile, health — each controller
│   │   │                               # gets @ApiTags/@ApiOperation/@ApiResponse/@ApiCookieAuth
│   │   │                               # decorators added in place (no restructuring)
│   │   └── main.ts                     # calls openapi setup during bootstrap
│   └── scripts/
│       └── generate-openapi.ts         # NEW: emits api/openapi.yml from the same document used
│                                       # by SwaggerModule; run manually and by the drift check
│
├── frontend/                            # no source change; only docker/frontend.nginx.conf gains
                                          # a new location block (see below)

api/                                      # NEW top-level folder (sibling to apps/, libs/) — the
├── openapi.yml                          # centrally-exported, generated OpenAPI document
└── bruno/                               # checked-in Bruno collection, organized by module
    ├── bruno.json
    ├── environments/
    │   └── local.bru                    # baseUrl http://localhost:4200/api (through nginx, so
    │                                    # the session cookie set by /api/auth/login is reused)
    ├── auth/
    ├── holdings/
    ├── accounts/
    ├── invitations/
    ├── signups/
    ├── profile/
    ├── account-overview/
    └── health/

docker/
└── frontend.nginx.conf                  # MODIFIED: new `location /swagger` (and its supporting
                                          # asset/json paths) proxied to the backend, alongside the
                                          # existing `location /api/`

libs/
└── api-contract/                        # unchanged — remains the plain-interface source of truth;
                                          # apps/backend/src/openapi/dto/ classes are typed to
                                          # structurally match these interfaces, not to replace them
```

**Structure Decision**: No new Nx app or domain library. This is presentation-layer work confined
to `apps/backend` (new `src/openapi/` folder + one generation script) and `docker/` (nginx config),
plus a new top-level `api/` folder (outside `apps/`/`libs/`) to hold the two developer-facing,
non-Nx-project artifacts the request specifically calls out: `api/openapi.yml` and `api/bruno/`.
`libs/api-contract` is read, not modified — its interfaces stay the single shape definition;
`apps/backend/src/openapi/dto/` classes exist solely so `@nestjs/swagger` has something with
runtime-reflectable metadata to point controller signatures at (see research.md #1).

## Complexity Tracking

_No Constitution Check violations — this section is not needed._
