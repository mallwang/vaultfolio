# Quickstart: Validating Observability — Structured Logging & Consistent Error Handling

This is a runnable validation guide, not an implementation guide — it proves the feature works
end-to-end once implemented. See [contracts/](./contracts/) for the exact shapes and
[data-model.md](./data-model.md) for entity definitions.

## Prerequisites

- Backend running locally: `npm exec nx serve backend`
- Frontend running locally: `npm exec nx serve frontend`
- A tool to send raw HTTP requests with custom headers (`curl` is used below)

## Scenario 1 — Correlation ID round-trip and log lookup (US1, SC-001, SC-002)

1. Trigger a known backend failure, e.g. an invalid signup request:
   ```bash
   curl -i -X POST http://localhost:3000/api/signups -H 'Content-Type: application/json' -d '{}'
   ```
2. **Expect**: response includes an `X-Correlation-Id` header and a JSON body containing
   `correlationId` (see [contracts/error-response.md](./contracts/error-response.md)).
3. Check the backend's stdout log around the same time for a `"Request Failed"` line
   (see [contracts/request-log-entry.md](./contracts/request-log-entry.md)) whose
   `correlationId` matches the value from step 2 exactly.
4. Re-run step 1 while supplying your own header:
   ```bash
   curl -i -X POST http://localhost:3000/api/signups \
     -H 'Content-Type: application/json' \
     -H 'X-Correlation-Id: 11111111-1111-4111-8111-111111111111' \
     -d '{}'
   ```
   **Expect**: the response's `X-Correlation-Id`/`correlationId` is exactly
   `11111111-1111-4111-8111-111111111111` — the supplied value is reused, not replaced.
5. Repeat with a malformed value (`-H 'X-Correlation-Id: not-a-uuid'`). **Expect**: the response
   still contains a valid UUID, but a _different_, freshly generated one — the malformed value is
   never trusted or echoed back as-is (FR-009).

## Scenario 2 — Lifecycle logging and severity classification (US2, SC-003)

1. Send a successful request (e.g. `GET /health` or any authenticated `GET`).
   **Expect**: an `"Incoming Request"` and a `"Request Completed"` log line, `level: "log"`.
2. Send a request that fails for an expected, client-caused reason (e.g. the invalid signup from
   Scenario 1, or a request to a protected route without credentials).
   **Expect**: a `"Request Failed"` log line at `level: "warn"`.
3. Force a genuinely unexpected server failure (e.g. a temporary code change that throws a plain
   `Error`, or hitting an endpoint with a dependency intentionally taken down in a dev environment).
   **Expect**: a `"Request Failed"` log line at `level: "error"`, including the full stack trace —
   verify the corresponding HTTP response body does **not** contain that stack trace or any
   internal detail (SC-004).
4. Confirm an authenticated request's log lines include a `userId` field, and an unauthenticated
   one omits it entirely (spec Edge Cases).

## Scenario 3 — Frontend fallback notification (US3, SC-006)

1. In the running frontend app, trigger a backend call that fails with an error code no component
   currently branches on (e.g. temporarily point a request at a nonexistent endpoint, or force a
   500 in dev).
   **Expect**: a generic, dismissible toast appears (via PrimeNG `MessageService`), showing the
   `correlationId` from the failed response so it can be reported.
2. Trigger an existing, specifically-handled failure the app already shows a tailored message for
   (e.g. submitting an invalid invite code on the signup screen).
   **Expect**: the existing specific message displays exactly as before, and the generic fallback
   toast from step 1 does **not** also appear (FR-012).
3. Force an in-app (non-HTTP) script error in the browser console while the app is running (e.g.
   invoke a broken code path via the dev console).
   **Expect**: a non-blocking toast appears rather than a frozen/blank screen, and the error is
   logged (check the browser console) rather than silently swallowed.

Use the `verify-ui` skill to drive these checks with Playwright against the running app rather than
relying on unit tests or reading the code alone, per this repo's frontend-verification convention.

## Scenario 4 — Categorized failures are consistent across features (US4)

1. Trigger a permission-denied response from two different, unrelated features (e.g. an
   admin-only endpoint accessed as a non-admin, and any other role-gated action).
   **Expect**: both return the same `error` category shape for "access denied" (same HTTP status,
   same categorized structure) even though they come from different backend modules.
2. Trigger the Turnstile bot-verification failure path (e.g. submit signup with an invalid/missing
   Turnstile token). **Expect**: the response still uses the existing `bot_protection_failed`
   `error` code (unchanged for existing callers) but now also carries `correlationId`.
3. Simulate the Cloudflare Turnstile siteverify call failing/timing out (e.g. block outbound
   network access to `challenges.cloudflare.com` in a local dev environment).
   **Expect**: the caller receives a safe, generic external-service-failure response — never the
   raw upstream error — while the backend log contains the actual upstream failure detail.

## Cleanup

No teardown required — all scenarios use existing endpoints and temporary/local network
conditions; no test data is persisted (no new database entities are introduced by this feature).
