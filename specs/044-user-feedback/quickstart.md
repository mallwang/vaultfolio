# Quickstart: User Feedback

Prerequisites: `npm ci`; app running locally (see the `verify-ui` skill for URLs); test account from the gitignored `.env.local`; SMTP either configured or a local catch-all (check `SMTP_*` in the backend env docs) and at least one admin account. Optional: `TURNSTILE_SECRET_KEY` unset in dev skips verification.

## Automated

```bash
npx nx test backend --testPathPattern=feedback
npx nx e2e backend    # feedback e2e + openapi completeness
npx nx test frontend --testPathPattern=feedback
npx nx test api-contract notifications
```

## Manual / Playwright (verify-ui)

1. Header shows the feedback icon left of the hints bell; click opens the dialog with the quota footer ("5 of 5 left").
2. Backdrop click does nothing; Escape acts as Cancel; Cancel with empty fields closes; with text it asks for confirmation.
3. Fill category, subject, message, Submit: sending state, dialog closes after success, toast, quota shows 4 left; admin mailbox receives `[Feedback: ...]` in the admin's language.
4. Stop the mail transport, Submit: banner error, dialog stays open, reload -> reopen restores the draft; the hints bell shows a feedback hint that reopens the dialog. Restore the transport, Submit: draft and hint disappear.
5. Send 5 feedbacks: sixth is rejected (also via direct `POST /feedback`), dialog shows 0 left with the reset time; the draft can still be edited and is kept.
6. Double-click Submit: exactly one mail and one row.
7. DB check: `feedback_submissions.payload_enc` is not readable plaintext.
8. Sign in as another user in the same browser: no draft, no hint.
