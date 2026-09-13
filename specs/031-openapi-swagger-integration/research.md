# Phase 0 Research: OpenAPI/Swagger API Documentation

## 1. Generating schemas from `libs/api-contract`'s plain interfaces

**Decision**: Add a parallel, decorated-class layer under `apps/backend/src/openapi/dto/` — one
class per request/response shape currently expressed as a plain `interface` in
`libs/api-contract`. Each class's fields are typed to structurally match the corresponding
interface and carry `@ApiProperty()`/`@ApiPropertyOptional()` decorators (with `enum`, `example`,
`nullable` where useful). Controllers keep importing the `libs/api-contract` interfaces for their
actual type-checking against the frontend contract, but their NestJS method signatures (the
`@Body()`/return-type positions `@nestjs/swagger` inspects) are annotated with the matching
decorated class via `@Body() body: CreateHoldingDto` / `@ApiResponse({ type: HoldingResponseDto })`.

**Rationale**: `@nestjs/swagger`'s reflection (and its CLI/webpack plugin) needs a runtime-visible
class to read property metadata from — plain TypeScript `interface`s are fully erased at compile
time and carry no runtime information to decorate or reflect. Rewriting `libs/api-contract` itself
into classes was considered and rejected (see Alternatives) because that module is intentionally
"plain TypeScript interfaces, no runtime dependency" per its own file header — turning it into
NestJS-decorated classes would pull a backend-framework dependency into a module the frontend also
imports, which Principle II's frontend/backend separation forbids.

**Alternatives considered**:

- _Convert `libs/api-contract` interfaces to classes directly_: rejected — would make the frontend
  bundle depend on `@nestjs/swagger` decorators/metadata, violating the "no runtime dependency,
  shared by both tiers" design already documented in that library.
- _Hand-write the OpenAPI document/YAML directly instead of generating it from decorators_:
  rejected — this is exactly the "separate, hand-maintained artifact" the spec's User Story 1
  explicitly rules out (FR-001, Edge Cases); it would drift immediately.
- _Enable only the `@nestjs/swagger` CLI plugin's automatic interface introspection and skip
  writing decorators by hand_: rejected as the sole mechanism — the plugin's automatic mode infers
  property presence/optionality/type well but cannot infer per-field descriptions, examples, enum
  documentation, or which fields are DTOs, so most FR-002 detail (human-readable descriptions,
  auth/role requirements) still needs explicit decorators regardless. It is still enabled as a
  supplementary code-gen aid (reduces boilerplate `@ApiProperty({ type: ... })` for primitive
  fields) but is not a substitute for the decorated-class layer above.

## 2. Serving `/swagger` so its "try it out" reuses the app's session cookie

**Decision**: `SwaggerModule.setup('swagger', app, document)` runs inside the NestJS backend
(unchanged listen port), and `docker/frontend.nginx.conf` gains a new reverse-proxy location —
alongside the existing `location /api/` — that forwards `/swagger` (and the UI's supporting paths:
its static assets and the JSON document it fetches internally) to the backend container, the same
way `/api/` already is. This makes `/swagger` reachable at the frontend's own origin
(`http://localhost:4200/swagger` locally, and the deployed host's origin under Portainer), so a
developer who has already logged into the Angular app in that browser has the
`vaultfolio_session` cookie (`SameSite=Lax`, path `/`, httpOnly) automatically attached by the
browser to Swagger UI's `fetch` calls — `httpOnly` only blocks JavaScript from _reading_ the
cookie, it does not stop the browser from _sending_ it on same-origin requests. No second
credential scheme (API keys, a Swagger-only login form) is introduced.

`DocumentBuilder().addCookieAuth('vaultfolio_session')` marks every non-`@Public()` route as
requiring that cookie, so Swagger UI shows a lock icon and an "Authorize" affordance whose
description points the developer at the app's real login page rather than accepting a pasted
credential.

**Rationale**: Directly answers the spec's "how are user credentials/the session exercised" check
(User Story 1, FR-005) with the app's existing auth mechanism instead of a parallel one — consistent
with the constitution's YAGNI clause (no new abstraction without justification) and with keeping
the documented API framed as an extension of the existing frontend/backend contract (spec
Assumptions).

**Alternatives considered**:

- _Serve Swagger UI directly from the backend's own published port (`:3000/swagger`) without a
  proxy change_: rejected — that is a different origin from the Angular app
  (`localhost:4200`/the deployed host on port 80), so the browser would not attach the app's
  session cookie; a developer would need a separate login flow just for Swagger, which the spec's
  FR-005 explicitly wants to avoid, and `docker-compose.portainer.yml` doesn't even publish the
  backend's port by default.
- _Add a Swagger-specific API-key or basic-auth scheme_: rejected — introduces a second credential
  system to maintain (rejected by Assumptions in spec.md) for no benefit over reusing the session
  the developer already has.

## 3. Exposing the specification at `/api/openapi.yml`

**Decision**: A small controller (`apps/backend/src/openapi/openapi.controller.ts`, `@Public()`)
serves `GET /openapi.yml`, returning the same `OpenAPIObject` `SwaggerModule.createDocument()`
produced, serialized to YAML (via `js-yaml`) with a `text/yaml` content type. Because
`docker/frontend.nginx.conf`'s existing `location /api/` strips the `/api` prefix and forwards to
the backend root, this single backend route is reachable at `/api/openapi.yml` through the proxy
with no extra nginx rule beyond the one already added in decision #2 for `/swagger` itself
(`/api/` is pre-existing).

**Rationale**: Keeps one source of truth — the same in-memory `OpenAPIObject` backs the interactive
UI (#2), this exported file endpoint, and the generation script (#6) — satisfying FR-007's "kept
consistent... generated from the same in-code source of truth" requirement by construction rather
than by convention.

**Alternatives considered**: _Generate `api/openapi.yml` only via the build/CI script and never
serve it live from a route_ — rejected as the sole mechanism because the spec's User Story 2,
Acceptance Scenario 1 expects a developer to be able to request the current file from a running
backend, not only obtain a repo snapshot that might lag an uncommitted local change during
development.

## 4. Bruno collection structure and authentication

**Decision**: `api/bruno/` is a standard Bruno collection (`bruno.json` + one `.bru` folder per
backend module, mirroring the `apps/backend/src/<module>` breakdown) with a single `local`
environment whose `baseUrl` is `http://localhost:4200/api` (i.e., through the same nginx proxy used
by the real frontend, not the backend's bare port) so that a login request's `Set-Cookie` response
is captured by Bruno's cookie jar and automatically replayed on subsequent requests in the same
collection run — mirroring exactly how the real browser session behaves. The collection includes
an explicit "Login" request (posting to the auth module's login endpoint) as the first item in
`auth/`, documented as the prerequisite step before trying protected requests.

**Rationale**: Directly satisfies FR-009 ("a way to establish an authenticated session for
protected requests") using the same session mechanism as decisions #2–3, rather than inventing a
Bruno-specific credential shortcut.

**Alternatives considered**: _Point Bruno directly at the backend's port (`:3000`)_ — rejected for
parity with decision #2's reasoning: `docker-compose.portainer.yml` doesn't publish that port by
default, so a Bruno collection meant to also work against a deployed instance needs to go through
the same reverse-proxied origin the browser uses.

## 5. Deployed-environment reachability of `/swagger` and `/api/openapi.yml`

**Decision**: Both are reachable in every environment the app runs in, including the
Portainer/NAS deployment (`docker-compose.portainer.yml`) — this is an explicit, deliberate choice
the spec's Edge Cases section asked for, not an accidental default, made because the user's own
request explicitly calls out verifying `/swagger` works under Docker and Portainer. No additional
access restriction (e.g., a separate admin-only guard in front of `/swagger` itself) is added: the
documentation only describes the API's shape, and every endpoint it lets a developer "try out"
still enforces its own existing authentication/role checks exactly as it does for any other
caller — `/swagger` grants no capability beyond what a logged-in session (or public endpoint)
already allows.

**Rationale**: Matches the explicit ask and keeps the security boundary where it already correctly
lives (per-endpoint `AuthGuard`/`RolesGuard`), rather than duplicating it at the documentation
layer.

**Alternatives considered**: _Gate `/swagger` behind an admin-only check or an environment flag
that disables it in the Portainer compose file_ — rejected for this iteration since it directly
contradicts the explicit request to verify it works under Portainer; noted as a possible future
hardening step if the deployed instance is ever exposed beyond a trusted network, but out of scope
here (this is a self-hosted, small-user-base personal finance app per the constitution's Product
Scope, not a multi-tenant public API).

## 6. Keeping `openapi.yml` from drifting (Speckit workflow integration, US3)

**Decision**: Two complementary mechanisms, not just one:

1. **Generation script** (`apps/backend/scripts/generate-openapi.ts`, wired as an Nx target
   `nx run backend:openapi`) builds the same Nest application context used by tests, calls
   `SwaggerModule.createDocument()`, and writes `api/openapi.yml`. A second mode
   (`nx run backend:openapi:check`) generates to a temp path and diffs it against the committed
   file, exiting non-zero on any difference — wired into CI (and optionally the pre-push hook
   already used for other checks) so a controller/DTO change without a regenerated
   `api/openapi.yml` fails the build, not just a human review.
2. **Speckit task-generation reminder**: `/speckit-tasks` and `/speckit-analyze` are updated (see
   data-model.md's note on this and the tasks that follow from it) so that any feature whose
   plan/spec touches a backend controller, DTO, or route includes an explicit task to run
   `nx run backend:openapi` and to add/update the relevant `@Api...` decorators — giving the
   _human-facing_ checklist the drift check backs up mechanically.

**Rationale**: The constitution's Observability/Simplicity principle favors mechanisms the system
itself enforces over ones that rely on someone remembering a step; a CI-enforced diff check is what
actually satisfies "cannot silently drift" (US3's own framing), while the Speckit task reminder
gives contributors the earlier, cheaper nudge before CI catches it.

**Alternatives considered**: _Rely solely on the Speckit task-list reminder, with no automated
diff check_ — rejected: this is precisely the pattern (a manual checklist item that's easy to skip)
User Story 3's own rationale calls out as insufficient ("cannot silently drift out of date the way
hand-maintained docs typically do").
