# Data Model: User Feedback

## Feedback (table `feedback_submissions`, backend)

| Column        | Type                       | Notes                                                     |
| ------------- | -------------------------- | --------------------------------------------------------- |
| `id`          | TEXT PK                    | Client attempt id (UUID v4); doubles as idempotency key   |
| `owner_id`    | TEXT NOT NULL              | Sender (users.id); AAD component for encryption           |
| `category`    | TEXT NOT NULL              | CHECK IN ('feature','problem','other'); plaintext         |
| `language`    | TEXT NOT NULL              | Sender UI language (`en`/`de`)                            |
| `payload_enc` | TEXT NOT NULL              | Base64 AES-256-GCM envelope of `{subject, message}` (040) |
| `key_version` | INTEGER NOT NULL DEFAULT 1 | Data key version for the `feedback` domain                |
| `created_at`  | TEXT NOT NULL              | ISO timestamp, set on successful delivery                 |

Index: `idx_feedback_owner_created (owner_id, created_at)`.

Rules: rows exist only for delivered feedback. Subject 1-100 chars, single line, trimmed. Message 1-2000 chars, trimmed. AAD is `feedback_submissions|<id>|<owner_id>`.

## Feedback Quota (derived)

`count` = rows of the owner with `created_at > now - 24h`; `remaining = max(0, 5 - count)`; `resetAt = oldest counted created_at + 24h` or null. Never stored.

## Feedback Draft (browser)

Key `vaultfolio.feedback-draft.<userId>`:

```json
{ "version": 1, "category": "problem", "subject": "...", "message": "...", "updatedAt": "ISO" }
```

State transitions: absent -> stored (send failed / rejected / edited while limit reached) -> absent (sent or discarded). Unparseable or wrong-version values are treated as absent.

## Encryption registry

`feedback` joins `ENCRYPTION_DOMAIN_IDS` and `DOMAIN_ENCRYPTION` with `payloadTable('feedback_submissions')`, so rotation, legacy migration and the admin encryption screen cover it.
