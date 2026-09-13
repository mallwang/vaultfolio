# Contract: Documentation-Serving Endpoints

This feature adds meta-endpoints that describe the existing API; it does not add or change any
business endpoint's contract. These are the new surfaces themselves.

## `GET /swagger` (and its supporting asset/JSON paths)

- **Reachable at**: `http://<app-origin>/swagger` — i.e. through the frontend's nginx proxy, at the
  same origin as the Angular app (`http://localhost:4200/swagger` locally;
  `http://<deployed-host>/swagger` under Portainer). Not intended to be reached directly via the
  backend's own port.
- **Auth**: The page itself is reachable without authentication (so a developer can see the API
  shape before logging in), but every "try it out" call it issues is subject to the same
  `AuthGuard`/`RolesGuard` as a normal call to that route — a call to a protected route without a
  valid session cookie gets the same `401 { error: "unauthenticated", ... }` body the real API
  returns.
- **Response**: Interactive HTML/JS UI (`@nestjs/swagger`'s bundled Swagger UI), rendering the API
  Specification Document (see below) and offering an "Authorize" affordance for the
  `vaultfolio_session` cookie scheme.

## `GET /openapi.yml` (backend route; reachable as `GET /api/openapi.yml` through the proxy)

- **Auth**: `@Public()` — the specification document itself is not sensitive (no secrets, only
  shape), consistent with research.md #5's deployed-reachability decision.
- **Response**: `200`, `Content-Type: text/yaml`, body = the full OpenAPI 3.x document (same
  content `SwaggerModule` uses for `/swagger`), YAML-serialized.
- **Errors**: None expected in normal operation (no user input); a `500` with the standard
  structured error body (`libs/api-contract/src/lib/error-response.ts`) only if document generation
  itself throws (e.g., a malformed decorator during development), consistent with Principle II's
  "no bare exceptions" rule.

## `api/openapi.yml` (repository file)

- Not a live endpoint — a committed snapshot produced by
  `nx run backend:openapi` (research.md #6), always expected to match what
  `GET /openapi.yml` returns for the current code on `main`. Verified by `nx run backend:openapi:check`
  in CI.

## Bruno collection entry points (`api/bruno/auth/Login.bru`, etc.)

- Not new backend contracts — thin wrappers around already-documented routes. `Login.bru` posts to
  the existing auth login endpoint and relies on Bruno's cookie jar to capture and replay the
  resulting `Set-Cookie`, exactly mirroring the browser behavior described in research.md #2.
