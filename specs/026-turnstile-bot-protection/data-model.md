# Data Model: Cloudflare Turnstile Bot Protection

**Feature**: 026-turnstile-bot-protection

---

## Persistent Entities

**None.** Turnstile tokens are short-lived, single-use, and verified in real time against Cloudflare's siteverify API. No database schema changes are required.

---

## Transient Entities (in-flight only)

### TurnstileToken

| Field   | Type     | Source                                 | Notes                                                                        |
| ------- | -------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `token` | `string` | Cloudflare Turnstile widget (frontend) | Included in request body as `turnstileToken`; consumed once by backend guard |

Single use — Cloudflare's siteverify API rejects already-used tokens. Expires in ~300 s; the widget auto-refreshes before expiry via `expired-callback`.

### TurnstileVerificationResult

| Field         | Type        | Source                             | Notes                                                                      |
| ------------- | ----------- | ---------------------------------- | -------------------------------------------------------------------------- |
| `success`     | `boolean`   | Cloudflare siteverify API response | `true` = token valid; any other value = rejected                           |
| `error-codes` | `string[]?` | Cloudflare siteverify API response | Logged on failure for observability (Principle V); not forwarded to client |

Consumed transiently by `TurnstileGuard`; not persisted.

---

## API Contract Changes (libs/api-contract)

### `CreateSignupRequest` (signups.ts)

```ts
// Before
export interface CreateSignupRequest {
  email: string;
  password: string;
}

// After
export interface CreateSignupRequest {
  email: string;
  password: string;
  turnstileToken: string;
}
```

### `ForgotPasswordRequest` (profile.ts)

```ts
// Before
export interface ForgotPasswordRequest {
  email: string;
}

// After
export interface ForgotPasswordRequest {
  email: string;
  turnstileToken: string;
}
```

### Error code additions

`SignupsErrorResponse.error` and `ProfileErrorResponse.error` unions gain `'bot_protection_failed'`.

---

## Environment Variables

| Variable               | Side               | Required         | Notes                                                                                                                                                    |
| ---------------------- | ------------------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `TURNSTILE_SECRET_KEY` | Backend            | Yes (production) | Cloudflare secret key; never sent to frontend                                                                                                            |
| `TURNSTILE_SITE_KEY`   | Frontend (runtime) | Yes (production) | Public site key (`0x4AAAAAAEreSPMcekykFDqv` for production); delivered via `window.__env` or `environment.local.ts`                                      |
| `TURNSTILE_HOSTNAMES`  | Backend            | Yes (production) | Comma-separated allowed hostnames (e.g. `vaultfolio.example.com`); MUST NOT include `localhost` or `127.0.0.1` to prevent local-dev bypass in production |

All three must be added to `.env.example`. Secret values MUST NOT be committed with real values; the site key is non-secret but still environment-specific.
