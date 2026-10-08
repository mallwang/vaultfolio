# Contract: Feedback API

Auth: signed-in session, any role, no domain entitlement. Errors use the standard body `{error, message, correlationId, details?}`. Types live in `@vaultfolio/api-contract` (`feedback.ts`).

## GET /feedback/quota

200: `{ "limit": 5, "remaining": 3, "resetAt": "2026-10-09T08:00:00.000Z" | null }`

## POST /feedback

Guards: session auth, `TurnstileGuard` (action `feedback`).

Request:

```json
{
  "attemptId": "uuid-v4",
  "category": "feature | problem | other",
  "subject": "string 1-100, single line",
  "message": "string 1-2000",
  "language": "en | de",
  "turnstileToken": "string"
}
```

| Status | `error`                    | When                                                        | Counts against limit |
| ------ | -------------------------- | ----------------------------------------------------------- | -------------------- |
| 201    | -                          | Delivered and stored. Body `{ id, quota }`                  | yes                  |
| 200    | -                          | Same `attemptId` already delivered; body as above, no mail  | no (already counted) |
| 400    | `validation_error`         | Field problems; `details[{field,message}]`                  | no                   |
| 400    | `bot_protection_failed`    | Turnstile rejected                                          | no                   |
| 429    | `feedback_limit_reached`   | 5 in the last 24 h; body includes `quota`                   | no                   |
| 502    | `feedback_delivery_failed` | No admin mail accepted (or no admin exists); nothing stored | no                   |
| 503    | `feedback_unavailable`     | `feedback` data key unavailable                             | no                   |

Behaviour: delivery succeeded but storing failed still returns 201 (logged `FeedbackStoreFailed`). Requests of one user are serialized, so concurrent submits cannot exceed the limit or duplicate an `attemptId`.

## Admin mail

One mail per admin in that admin's `emailLanguage`. Subject `[Feedback: <category>] <subject>`; body: category, subject, message, sender name and email, sender UI language. Notification type `feedback-admin-notice`.

## Logging

Events with ids, category and counts only, never subject/message or addresses: `FeedbackDelivered`, `FeedbackMailFailed`, `FeedbackMailNoAdmin`, `FeedbackStoreFailed`, `FeedbackLimitReached`.

## Frontend hint contract (043)

Registry entry `{ sourceId: 'feedback', groupLabelKey: 'hints.groups.feedback', loadProvider }` (no `domainId`). Hint id `feedback.draft`, target `commands ['/app'], queryParams { feedback: 'draft' }`; the shell opens the dialog and strips the param.
