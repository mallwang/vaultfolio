# Feature Specification: OpenAPI/Swagger API Documentation

**Feature Branch**: `031-openapi-swagger-integration`

**Created**: 2026-09-13

**Status**: Draft

**Input**: User description: "Ich möchte OpenAPI mit Swagger in das Backend integrieren und habe folgende Notizen dazu:

- Swagger NestJS alle Controller, DTOs etc. dekorieren
- Swagger UI unter einem eigenen Frontendendpunkt exportieren (/swagger)
- auch sicherstellen, dass /swagger mit Docker und Portainer funktioniert
- prüfen wie die Endpunkte ausprobiert werden können mit Usercredentials bzw. der Session
- zentrale /api/openapi.yml Datei die in Bruno importiert werden kann
- eigene Bruno Collection in /api/bruno Ordner
- in Specify Workflow integrieren, sodass wenn sich Funktionalitäten ändern, auch die openapi.yml angepasst werden muss sowie die Swagger Dekoratoren"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Browse and try out the API from a live, always-current reference (Priority: P1)

As a developer working on Vaultfolio (backend or frontend), I want a single, always up-to-date
reference of every API endpoint — its inputs, outputs, and possible error responses — that I can
browse in a web UI and try out directly against a running instance, so I don't have to read
controller source code or guess request/response shapes.

**Why this priority**: This is the core value of the feature. Without a live, browsable, testable
reference, every other capability (Bruno collection, exported spec file, workflow enforcement) has
nothing authoritative to be generated from or kept in sync with.

**Independent Test**: Start the backend, open the documentation UI in a browser, and confirm every
existing REST endpoint is listed with its request/response schema. Successfully execute a
representative sample of GET and mutating (POST/PATCH/DELETE) endpoints directly from the UI while
authenticated, and confirm the responses match what the running application actually returns.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** a developer opens the documentation UI, **Then**
   every currently registered API endpoint is listed, grouped in a way that reflects the
   application's feature areas, with its HTTP method, path, parameters, request body shape, and
   possible response shapes (including error responses) visible without leaving the UI.
2. **Given** the documentation UI is open and the developer is not authenticated, **When** they
   attempt to try out an endpoint that requires a logged-in user, **Then** the UI clearly indicates
   an authenticated session is required and guides the developer to authenticate before the
   request can succeed, rather than silently failing or returning a misleading generic error.
3. **Given** the developer has an authenticated session (e.g., has logged into the application in
   the same browser, or provided credentials the UI's "try it out" flow requests), **When** they
   execute a "try it out" call against a protected endpoint, **Then** the call is made using that
   session and produces the same result the application itself would produce for that user.
4. **Given** a new endpoint, DTO field, or changed response shape is added to the backend,
   **When** the backend is rebuilt/restarted, **Then** the documentation UI reflects the change
   without any manual step beyond the normal code change itself (i.e., the documentation is
   generated from the same source of truth as the running code, not maintained as a separate
   hand-written artifact).

---

### User Story 2 - Exercise the API outside the browser via a portable spec and ready-made collection (Priority: P2)

As a developer, I want a standard, downloadable API specification file and a ready-to-use request
collection, so I can test and script against the API using my own tools (e.g., an API client)
without hand-building every request from scratch.

**Why this priority**: Many developers prefer a dedicated API client over a browser-based
try-it-out UI, especially for building multi-step test flows or sharing reusable requests with
teammates. This depends on User Story 1's generated documentation existing first, but delivers
distinct value once available.

**Independent Test**: Download the exported specification file and import it into a third-party
API client; separately, open the pre-built request collection directly in that same client.
Confirm both import cleanly and let a developer send a real request against the running backend
without further edits.

**Acceptance Scenarios**:

1. **Given** the backend is running, **When** a developer requests the exported specification
   file, **Then** they receive a single, complete, standards-compliant document describing every
   endpoint, which they can import into a third-party API client without transformation.
2. **Given** the exported specification file, **When** a developer imports it into an API client
   they already use, **Then** the import succeeds without errors and produces one request
   definition per endpoint with correct methods, paths, and parameters.
3. **Given** the project's pre-built request collection, **When** a developer opens it in the
   corresponding API client, **Then** the collection is organized by feature area, includes
   example requests for representative endpoints, and can authenticate against a running local
   instance with minimal setup (e.g., logging in via a provided request to obtain a session, then
   reusing it).
4. **Given** the backend's endpoints change, **When** the specification file is regenerated,
   **Then** the pre-built request collection either updates automatically alongside it or the
   project process makes clear how the collection stays in sync (see User Story 3).

---

### User Story 3 - Documentation stays accurate as the product evolves (Priority: P2)

As someone driving a feature through the project's spec-and-plan workflow, I want the workflow
itself to require that the API documentation is updated whenever a change affects the API, so the
documentation cannot silently drift out of date the way hand-maintained docs typically do.

**Why this priority**: A generated-but-unenforced documentation setup degrades over time as
contributors forget to regenerate or review it. Making this an explicit, checked step in the
existing feature workflow is what keeps the investment in User Stories 1 and 2 valuable long-term.
This is ordered alongside User Story 2 because it governs the same artifacts, but is independently
verifiable once basic generation exists.

**Independent Test**: Run a feature through the project's planning/task workflow that adds or
changes an API endpoint, and confirm the workflow's checklist/tasks explicitly call out updating
the API documentation source (decorators/annotations) and regenerating the exported specification
file, and that the feature cannot be marked complete while that step is outstanding.

**Acceptance Scenarios**:

1. **Given** a feature's implementation plan or task list is being generated for a feature that
   adds, removes, or changes an API endpoint or its request/response shape, **When** the workflow
   produces its tasks, **Then** it includes an explicit task to update the relevant API
   documentation annotations and to regenerate/verify the exported specification file.
2. **Given** a feature's tasks are being marked complete, **When** the feature changed the API but
   the documentation-update task was skipped, **Then** the workflow's completion/consistency check
   flags this as outstanding rather than silently allowing it through.
3. **Given** a feature does not touch any API endpoint, **When** its plan/tasks are generated,
   **Then** no documentation-update task is forced onto it (the requirement only applies when the
   API surface actually changes).

### Edge Cases

- What happens when a controller or DTO is missing documentation annotations? The documentation
  UI and exported specification should still generate without crashing, showing that endpoint with
  whatever information is available (e.g., inferred from types) rather than failing the whole
  build.
- How does the system handle an endpoint that requires a role/permission beyond simple
  authentication (e.g., admin-only)? The documentation must indicate the required role, and a
  try-it-out call from a session lacking that role must show the same authorization error the real
  API would return, not a confusing generic failure.
- What happens when the documentation UI or exported specification file is requested in a
  deployed (non-local-development) environment? The project must have an explicit, deliberate
  decision (not an accidental default) about whether this capability is reachable outside local
  development, since it exposes the full shape of the API surface.
- How does the pre-built request collection behave if imported without ever authenticating first?
  Requests to protected endpoints should fail with a clear, expected authentication error rather
  than an unrelated/confusing one.
- What happens if the exported specification file and the live documentation UI are regenerated at
  different times (e.g., one caches stale output)? Both must be derived from the same in-code
  source of truth at request/build time so they cannot disagree with each other or with the
  running API.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The system MUST generate API documentation directly from the backend's existing
  controllers, request DTOs, and response shapes, covering every REST endpoint currently exposed
  by the backend.
- **FR-002**: The generated documentation for each endpoint MUST include: HTTP method and path,
  a human-readable description of its purpose, request parameters/body schema, all possible
  response shapes including error responses, and whether authentication (and any required
  role/permission) is needed.
- **FR-003**: The system MUST provide a browsable, interactive documentation UI reachable at a
  dedicated, predictable web address, distinct from the backend's own API paths.
- **FR-004**: The interactive documentation UI MUST let a developer execute real requests against
  the running backend ("try it out") for both authenticated and unauthenticated endpoints.
- **FR-005**: The interactive documentation UI's try-it-out capability MUST support executing
  requests as an authenticated user, using the same session-based authentication mechanism the
  real application uses — a developer already logged into the application MUST be able to try out
  protected endpoints without re-entering separate API credentials, and the UI MUST clearly guide
  an unauthenticated developer to log in first when a protected endpoint is attempted.
- **FR-006**: The system MUST make the interactive documentation UI and the exported specification
  file reachable when the application is deployed via the project's containerized (Docker) setup,
  including behind the project's reverse-proxy/deployment configuration, so it is not a
  local-development-only capability by accident.
- **FR-007**: The system MUST expose a single, complete, standards-compliant API specification
  document at a predictable, centrally accessible location, kept consistent with the interactive
  documentation UI (both generated from the same in-code source of truth).
- **FR-008**: The exported specification document MUST be importable into a third-party API client
  without manual edits, producing correct request definitions (methods, paths, parameters, bodies)
  for every documented endpoint.
- **FR-009**: The project MUST include a pre-built, version-controlled request collection for a
  third-party API client, organized by feature area, that can be opened and used against a running
  local instance with minimal setup, including a way to establish an authenticated session for
  protected requests.
- **FR-010**: The project's feature-development workflow (the spec/plan/tasks process already used
  for other features) MUST require that any feature changing the API surface (adding, removing, or
  changing an endpoint or its request/response shape) includes an explicit step to update the
  corresponding documentation annotations and to keep the exported specification document current.
- **FR-011**: The project's workflow consistency checks MUST be able to flag a feature as
  incomplete or inconsistent if it changed the API surface without updating the corresponding
  documentation step.
- **FR-012**: Every existing backend controller and DTO MUST carry documentation
  annotations/decorators sufficient to satisfy FR-002, as part of this feature's own
  implementation (this feature both builds the capability and retrofits it across the current
  API surface, so the initial documentation output is complete on day one).

### Key Entities

- **API Specification Document**: The single generated artifact describing the entire API surface
  (endpoints, schemas, auth requirements); the source of truth shared by the interactive
  documentation UI and the exported file.
- **Interactive Documentation UI**: The browsable, in-browser view of the API Specification
  Document that also allows executing real requests against the running backend.
- **Request Collection**: The pre-built, version-controlled set of example API requests organized
  by feature area, usable in a third-party API client independent of the interactive documentation
  UI.
- **Documentation Annotation**: The in-code decoration on a controller, endpoint, or DTO that
  supplies the descriptive detail (summaries, examples, auth requirements) feeding the API
  Specification Document beyond what can be inferred from types alone.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% of the backend's currently exposed REST endpoints appear in the generated
  documentation with a complete, accurate request/response schema, verified by comparing the
  documentation against the actual controllers.
- **SC-002**: A developer unfamiliar with a given endpoint's implementation can find its expected
  request shape and response, and successfully execute it (authenticated where required), through
  the documentation UI in under 2 minutes without reading backend source code.
- **SC-003**: The exported specification document imports into a third-party API client with zero
  manual corrections needed to get a representative sample of endpoints (spanning at least one
  unauthenticated, one authenticated, and one admin-only endpoint) working.
- **SC-004**: 100% of feature workflow runs that change the API surface produce an explicit
  documentation-update step in their generated tasks, verified across subsequent feature specs
  created after this feature ships.
- **SC-005**: The interactive documentation UI and exported specification document remain
  identical in content to each other and to the running backend's actual behavior at all times,
  with zero manually-maintained duplicate copies of endpoint documentation anywhere in the project.

## Assumptions

- "Third-party API client" and the request-collection format referenced throughout (Bruno) reflect
  the tool already in use by the team for manual API testing; this spec treats it as the target
  client for the Request Collection and specification-import scenarios.
- The interactive documentation UI's try-it-out authentication relies on the application's
  existing session-based (cookie) authentication rather than introducing a separate
  API-key/token scheme; this is a reasonable default since the project's constitution treats the
  documented API as an extension of the existing frontend/backend contract rather than a new
  external-facing API product.
- Whether the interactive documentation UI and exported specification are reachable in deployed
  (non-local) environments, and if so under what access restriction, is a deliberate scope
  decision rather than an accidental default (see Edge Cases) — this spec requires a decision to
  be made and documented, not a specific one.
- Retrofitting documentation annotations onto the entire existing API surface (FR-012) is treated
  as in-scope, one-time work performed as part of this feature, not a separate future feature.
- The centrally-exported specification file's exact location (`/api/openapi.yml` per the request)
  and the request collection's exact folder location (`/api/bruno`) are treated as fixed,
  agreed-upon conventions rather than points needing further clarification.
