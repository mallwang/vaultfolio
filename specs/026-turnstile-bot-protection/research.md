# Research: Cloudflare Turnstile Bot Protection

**Feature**: 026-turnstile-bot-protection | **Phase**: 0

---

## 1. Node.js Built-in `fetch` for Backend Siteverify

**Decision**: Use `globalThis.fetch` (Node 18+ LTS built-in) to call the Cloudflare siteverify endpoint.

**Rationale**: Node 18+ ships `fetch` as a stable global; no new npm package is required, satisfying the spec's "no new npm packages" constraint. The NestJS LTS runtime already targets Node 18+.

**Alternatives considered**:

- `@nestjs/axios` + `HttpModule` — would add a new dependency; ruled out by spec constraint.
- `node:https` — verbose, no benefit over `fetch` for a single outbound POST.

---

## 2. Cloudflare siteverify API

**Decision**: Call `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with `application/json` body `{ secret, response, remoteip? }`.

**Rationale**: Cloudflare's documented server-side verification endpoint. Returns `{ success: boolean, error-codes?: string[] }`. Any response where `success !== true` MUST be treated as failed (spec FR-006, edge case). The `remoteip` parameter is optional and improves accuracy; include the client IP from the `X-Forwarded-For` header when available.

**Timeout handling**: `fetch` will be called with `AbortSignal.timeout(5000)` (5 s). Any thrown error (timeout, network failure) is treated as verification failure — fail-closed per FR-007.

---

## 3. Turnstile Widget Integration in Angular (no npm package)

**Decision**: Load the Turnstile JS API via a CDN `<script>` tag in `apps/frontend/src/index.html`. Interact with `window.turnstile` in a typed Angular service/component. Declare `window.turnstile` in `env.d.ts`.

**Rationale**: Cloudflare explicitly supports this pattern — no npm package exists or is needed. The spec assumption states "loaded from Cloudflare's CDN via a `<script>` tag."

**Widget mode**: Use `managed` (Cloudflare's default, equivalent to "invisible/managed") so users with clean signals see no challenge UI, matching FR-003.

**Token lifecycle**:

- `turnstile.render()` triggers on component init; the `callback` sets a local `token` signal.
- `turnstile.remove()` on component destroy cleans up the widget.
- The `expired-callback` re-renders the widget automatically (Turnstile refreshes on its own); the frontend clears the stale token until the new one arrives.
- The form's submit button is `[disabled]` while `token` is null/empty (FR-001, FR-002).

---

## 4. TURNSTILE_SITE_KEY Delivery to Angular

**Decision**: Follow the existing `window.__env` pattern (same mechanism as `primengLicenseKey`):

- Docker production: `docker/frontend-entrypoint.sh` writes `TURNSTILE_SITE_KEY` into `window.__env.turnstileSiteKey`.
- Local dev (`nx serve`): developers add `turnstileSiteKey` to their `environment.local.ts` (gitignored).
- A `TurnstileConfigService` reads `window.__env?.turnstileSiteKey ?? environment.turnstileSiteKey ?? ''` at runtime.

**Rationale**: Consistent with the established runtime config pattern; keeps the key out of the built bundle (configurable per deployment) while remaining functional in local dev via the env file.

---

## 5. Backend Guard vs. Service Call Pattern

**Decision**: Implement a `TurnstileGuard` (`CanActivate`) in a `TurnstileModule` within the backend app. Apply the guard to the two protected endpoints via `@UseGuards(TurnstileGuard)`.

**Rationale**:

- A guard clearly signals "this endpoint requires bot protection" at the controller level — readable and enforceable without touching service logic.
- The `TurnstileService` (injected into the guard) handles the HTTP call and is independently testable.
- No new Nx lib needed: this is backend infrastructure, not domain/finance logic. A NestJS module within the backend app is the right boundary per Principle I — it has a coherent single responsibility (Turnstile verification) without being "shared code with no coherent responsibility."

**Alternatives considered**:

- Inline service call from controller — less declarative, easy to forget on new endpoints.
- NestJS Interceptor — wrong layer (interceptors act after the handler can run; guards gate entry).
- Standalone Nx lib — unjustified: the logic is backend-only and not reused elsewhere.

---

## 6. `turnstileToken` Field in API Contract

**Decision**: Add `turnstileToken: string` to `CreateSignupRequest` and `ForgotPasswordRequest` in `libs/api-contract/src/lib/signups.ts` and `profile.ts`.

**Rationale**: Principle II requires the API contract to be written alongside the implementation. Both backend and frontend consume `@vaultfolio/api-contract`; the field must be declared there to keep type safety across the boundary.

**Error handling**: Backend returns `422 Unprocessable Entity` with `{ error: 'bot_protection_failed', message: '...' }` for failed verification. The `SignupsErrorResponse` and `ProfileErrorResponse` union types are extended with this new error code.

---

## 7. Class-Validator Usage in Backend

**Decision**: Check whether the backend already uses `class-validator` / `class-transformer` for DTO validation (via NestJS `ValidationPipe`). If yes, add `@IsString() @IsNotEmpty()` on `turnstileToken` in backend DTO classes. The api-contract types are plain interfaces (no runtime decorators); backend DTOs are separate.

**Finding from codebase exploration**: Backend uses `@nestjs/class-validator`-style DTOs with `ValidationPipe` globally in `main.ts`. The Signups and Profile services accept typed body parameters. Adding `turnstileToken` to the api-contract interface is sufficient for the shared type; the guard extracts the token directly from `req.body.turnstileToken` without a separate DTO class, consistent with how the existing public-endpoint bodies work.

---

## 8. Fail-Closed Behaviour

**Decision**: Any exception from the siteverify fetch (network error, timeout, unexpected response shape) throws an `HttpException(422, 'bot_protection_failed')`. The guard never allows the request through on uncertainty.

**Rationale**: FR-007 is explicit. A false positive (legitimate user rejected due to siteverify outage) is accepted over the risk of a bypass.
