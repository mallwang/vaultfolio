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
async verify(token: string, clientIp?: string): Promise<void>
// throws HttpException(422, 'bot_protection_failed') on any failure
```

Calls `POST https://challenges.cloudflare.com/turnstile/v0/siteverify` with a 5 s timeout. Logs `error-codes` from Cloudflare on failure.

### TurnstileGuard

`CanActivate` guard. Reads `req.body.turnstileToken` and `req.ip` (or `X-Forwarded-For`). Delegates to `TurnstileService.verify()`. Applied via `@UseGuards(TurnstileGuard)` on:

- `SignupsController.create()` (`POST /signups`)
- `ProfileController.forgotPassword()` (`POST /profile/forgot-password`)

---

## Frontend Contract Changes

### TurnstileComponent

Standalone Angular component. Renders the Turnstile widget (managed/invisible mode). Emits a `tokenChange` `OutputEmitterRef<string | null>`.

```html
<!-- Usage in signup form -->
<app-turnstile [siteKey]="turnstileSiteKey" (tokenChange)="onTokenChange($event)" />
```

The host form's submit button `[disabled]` is bound to `token === null`.

### Environment / Runtime Config

| Key                | Dev source             | Prod source                                                                                                |
| ------------------ | ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `turnstileSiteKey` | `environment.local.ts` | `window.__env.turnstileSiteKey` (set by `docker/frontend-entrypoint.sh` from `TURNSTILE_SITE_KEY` env var) |

When `turnstileSiteKey` is empty (e.g., CI build without a real key), the widget will not render; the token stays `null` and the form stays disabled. This is intentional fail-safe behaviour in environments without a configured key.
