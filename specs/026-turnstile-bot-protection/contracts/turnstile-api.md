# API Contract: Turnstile Bot Protection

**Feature**: 026-turnstile-bot-protection | **Version**: 1.0.0

This document describes the contract changes introduced by Turnstile bot protection. See also the [data model](../data-model.md) and existing contracts referenced below.

---

## Changed Endpoints

### POST /signups

**Before** (spec: [007-self-service-signup/contracts/signups-api.md](../../007-self-service-signup/contracts/signups-api.md)):

```json
// Request body
{ "email": "user@example.com", "password": "s3cur3pass" }
```

**After**:

```json
// Request body — turnstileToken is now required
{
  "email": "user@example.com",
  "password": "s3cur3pass",
  "turnstileToken": "<cloudflare-widget-token>"
}
```

**New error response (HTTP 422)**:

```json
{
  "error": "bot_protection_failed",
  "message": "Bot protection verification failed. Please reload the page and try again."
}
```

All existing `SignupsErrorResponse` error codes remain unchanged. `bot_protection_failed` is returned whenever the Turnstile token is missing, invalid, already used, or the siteverify call fails.

---

### POST /profile/forgot-password

**Before** (spec: [008-profile-password-account/contracts/profile-api.md](../../008-profile-password-account/contracts/profile-api.md)):

```json
// Request body
{ "email": "user@example.com" }
```

**After**:

```json
// Request body — turnstileToken is now required
{
  "email": "user@example.com",
  "turnstileToken": "<cloudflare-widget-token>"
}
```

**New error response (HTTP 422)**:

```json
{
  "error": "bot_protection_failed",
  "message": "Bot protection verification failed. Please reload the page and try again."
}
```

> Note: The existing "always returns `{ accepted: true }`" behaviour (SC-003 — does not reveal account existence) applies only to the business-logic path. Bot-protection failure is returned before business logic runs, so `bot_protection_failed` does not reveal account existence.

---

## New Backend Module: TurnstileModule

Internal to the backend (`apps/backend/src/turnstile/`). Not an external API contract; documented here for completeness.

### TurnstileService

Single public method:

```ts
async verify(token: string, action: string, clientIp?: string): Promise<void>
// throws HttpException(422, 'bot_protection_failed') on any failure
```

Calls `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with:

- `Content-Type: application/x-www-form-urlencoded`
- Body: `URLSearchParams({ secret, response: token, remoteip: clientIp })`
- `AbortSignal.timeout(10_000)` (10 s)

Validation logic (fail-closed on any mismatch):

1. Pre-flight: reject if `!token || token.length > 2048` (no outbound call)
2. Assert `result.success === true`
3. Assert `result.action === action` (action name matches the form that issued the token)
4. Assert `TURNSTILE_HOSTNAMES` allow-list contains `result.hostname`

Logs `error-codes` + failed assertions at `warn` level on failure.

### TurnstileGuard

`CanActivate` guard. Reads `req.body.turnstileToken` and `req.ip` / `X-Forwarded-For`. Each guarded endpoint declares its action via `@TurnstileAction('...')` metadata — the guard reads this and passes it to `TurnstileService.verify(token, action, clientIp)`. Applied via `@UseGuards(TurnstileGuard)` on:

- `SignupsController.create()` — decorated with `@TurnstileAction('signup')` (`POST /signups`)
- `ProfileController.forgotPassword()` — decorated with `@TurnstileAction('forgot-password')` (`POST /profile/forgot-password`)

---

## Frontend Contract Changes

### TurnstileComponent

Standalone Angular component. Renders the Turnstile widget (managed/invisible mode). Inputs: `siteKey: string`, `action: string`. Emits a `tokenChange` `OutputEmitterRef<string | null>`.

```html
<!-- Usage in signup form -->
<app-turnstile [siteKey]="turnstileSiteKey" action="signup" (tokenChange)="onTokenChange($event)" />

<!-- Usage in forgot-password form -->
<app-turnstile
  [siteKey]="turnstileSiteKey"
  action="forgot-password"
  (tokenChange)="onTokenChange($event)"
/>
```

- `action` is passed to `turnstile.render()` as the widget's action name, which Cloudflare embeds in the issued token for server-side verification.
- After a successful form submission, the parent calls a `reset()` method on the component reference (`turnstile.reset(widgetId)`) to allow a fresh token for the next attempt.
- The host form's submit button `[disabled]` is bound to `token === null`.

### Environment / Runtime Config

| Key                | Dev source             | Prod source                                                                                                |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `turnstileSiteKey` | `environment.local.ts` | `window.__env.turnstileSiteKey` (set by `docker/frontend-entrypoint.sh` from `TURNSTILE_SITE_KEY` env var) |

When `turnstileSiteKey` is empty (e.g., CI build without a real key), the widget will not render; the token stays `null` and the form stays disabled. This is intentional fail-safe behaviour in environments without a configured key.
