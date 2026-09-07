# Quickstart & Validation Guide: Cloudflare Turnstile Bot Protection

**Feature**: 026-turnstile-bot-protection

---

## Prerequisites

1. A Cloudflare account with Turnstile enabled (free tier).
2. A Turnstile site created in the Cloudflare dashboard for your domain. Note the **Site Key** (public) and **Secret Key** (private).
   - For local testing without a real domain, Cloudflare provides test keys:
     - **Always-pass site key**: `1x00000000000000000000AA`
     - **Always-pass secret key**: `1x0000000000000000000000000000000AA`
     - **Always-fail site key**: `2x00000000000000000000AB`
     - **Always-fail secret key**: `2x0000000000000000000000000000000AA`
3. Backend and frontend running (via `docker compose up` or `pnpm nx serve frontend` + `pnpm nx serve backend`).

---

## Environment Setup

### Local dev (`nx serve`)

Add to `apps/frontend/src/environments/environment.local.ts`:

```ts
export const environment = {
  production: false,
  primengLicenseKey: 'YOUR_KEY',
  turnstileSiteKey: '1x00000000000000000000AA', // always-pass test key
};
```

Add to `.env` (backend):

```
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

### Docker (production-like)

Add to `docker-compose.yml` (or your `.env`):

```
TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

---

## Validation Scenarios

### Scenario 1 — Happy path: Signup with valid token

1. Open `http://localhost:4200/signup`.
2. Confirm the submit button is **disabled** on page load (token not yet received).
3. Wait ~1–2 s for Turnstile to complete its invisible challenge.
4. Confirm the submit button becomes **enabled**.
5. Fill in email + password and submit.
6. **Expected**: Account created; redirect to confirmation page.

### Scenario 2 — Happy path: Forgot-password with valid token

1. Open `http://localhost:4200/forgot-password`.
2. Wait for Turnstile to issue a token (submit button enabled).
3. Enter an email and submit.
4. **Expected**: "Check your inbox" confirmation shown (regardless of whether the account exists).

### Scenario 3 — Missing token rejected (backend guard)

```bash
curl -s -X POST http://localhost:3000/api/signups \
  -H 'Content-Type: application/json' \
  -d '{"email":"bot@test.com","password":"Test1234!"}' | jq .
```

**Expected response (HTTP 422)**:

```json
{ "error": "bot_protection_failed", "message": "..." }
```

### Scenario 4 — Invalid token rejected

```bash
curl -s -X POST http://localhost:3000/api/signups \
  -H 'Content-Type: application/json' \
  -d '{"email":"bot@test.com","password":"Test1234!","turnstileToken":"invalid-token"}' | jq .
```

**Expected**: HTTP 422 `bot_protection_failed` (Cloudflare siteverify returns `success: false`).

### Scenario 5 — Always-fail site key

Configure `TURNSTILE_SITE_KEY=2x00000000000000000000AB` (always-fail) in the frontend and `TURNSTILE_SECRET_KEY=2x0000000000000000000000000000000AA` in the backend, then reload the signup page.

**Expected**: The widget returns a token, but the backend rejects it with `bot_protection_failed`. The form cannot be submitted successfully.

### Scenario 6 — Token expiry handling

1. Load the signup page.
2. Wait without submitting until the token expires (~5 min in real Turnstile; use a mock/spy in a unit test).
3. **Expected**: The expired-callback fires, the token clears (submit button disabled briefly), and Turnstile auto-refreshes and issues a new token (submit button re-enabled).

### Scenario 7 — Forgot-password token rejection, no email sent

```bash
curl -s -X POST http://localhost:3000/api/profile/forgot-password \
  -H 'Content-Type: application/json' \
  -d '{"email":"victim@test.com"}' | jq .
```

**Expected**: HTTP 422 `bot_protection_failed`. No reset email sent (confirm via email log / mailcatcher).

---

## What to Verify in Logs

- On verification failure: backend logs `[TurnstileService] verification failed: { errorCodes: [...] }` at `warn` level.
- On siteverify timeout/network error: `[TurnstileService] siteverify call failed: <error message>` at `error` level.
- On success: no log entry (avoid log spam for normal traffic).

---

## References

- [Data Model](data-model.md) — API contract changes and env var table
- [API Contract](contracts/turnstile-api.md) — endpoint diffs and error codes
- [Cloudflare Turnstile Docs](https://developers.cloudflare.com/turnstile/) — widget modes, test keys, siteverify API
