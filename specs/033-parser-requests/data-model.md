# Data Model: Parser Requests

Phase 1 for [plan.md](plan.md). SQLite via `DatabaseService.initializeSchema()` (brand-new tables:
`CREATE TABLE IF NOT EXISTS` is enough, no migration step). Timestamps are ISO-8601 UTC text, as in
the other tables. **No monetary values and no personal identifiers of the document are stored.**

## Tables

### `requests`

| Column               | Type             | Notes                                                                                           |
| -------------------- | ---------------- | ----------------------------------------------------------------------------------------------- |
| `id`                 | TEXT PK          | UUID; appears in the admin deep link                                                            |
| `feature`            | TEXT NOT NULL    | registry feature key, e.g. `earnings`                                                           |
| `type`               | TEXT NOT NULL    | registry type key, e.g. `new-parser`                                                            |
| `requester_id`       | TEXT NOT NULL    | owner; rows are deleted with the account (FR-042)                                               |
| `status`             | TEXT NOT NULL    | `CHECK IN ('OPEN','IN_PROGRESS','DONE','REJECTED')`, default `OPEN`                             |
| `payload`            | TEXT NULL        | type-specific JSON; for `earnings/new-parser` the **stored rule draft** (R9); NULL once purged  |
| `layout_fingerprint` | TEXT NULL        | SHA-256 hex of the normalised layout (R12); duplicate detection only                            |
| `possible_duplicate` | INTEGER NOT NULL | 0/1, set at submission (R12)                                                                    |
| `note`               | TEXT NULL        | admin note, ≤ 2 000 chars                                                                       |
| `created_at`         | TEXT NOT NULL    | submission time                                                                                 |
| `handled_by`         | TEXT NULL        | admin who last changed status/note (FR-033); NULL after that admin's account is deleted         |
| `handled_at`         | TEXT NULL        | time of that change                                                                             |
| `closed_at`          | TEXT NULL        | set when status becomes DONE/REJECTED, cleared on reopen — drives the 30-day countdown (FR-039) |
| `payload_purged_at`  | TEXT NULL        | set by the retention sweep; attachment row removed at the same time                             |

Indexes: `(status, created_at DESC)`, `(requester_id)`, `(layout_fingerprint)`, `(closed_at)`.

### `request_attachments` (0..1 per request)

| Column         | Type             | Notes                                          |
| -------------- | ---------------- | ---------------------------------------------- |
| `request_id`   | TEXT PK          | one attachment per request in v1               |
| `content_type` | TEXT NOT NULL    | `application/pdf` (registry attachment policy) |
| `size_bytes`   | INTEGER NOT NULL | ≤ policy max (default 512 kB)                  |
| `sha256`       | TEXT NOT NULL    | length 64; integrity, shown to admins          |
| `page_count`   | INTEGER NOT NULL | 1..3                                           |
| `content`      | BLOB NOT NULL    | generated PDF bytes, never user-supplied       |
| `created_at`   | TEXT NOT NULL    | generation time                                |

### `request_download_audit`

| Column          | Type          | Notes                                      |
| --------------- | ------------- | ------------------------------------------ |
| `id`            | TEXT PK       | UUID                                       |
| `request_id`    | TEXT NOT NULL | deleted together with the request          |
| `admin_id`      | TEXT NULL     | NULL after that admin's account is deleted |
| `downloaded_at` | TEXT NOT NULL |                                            |

No content, no file name, no IP.

## Shared registry (code, `libs/requests`) — not a table

```ts
type RequestStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'REJECTED';
interface RequestTypeDefinition {
  feature: string; // 'earnings'
  type: string; // 'new-parser'
  names: { en: string; de: string }; // 'New parser' / 'Neuer Parser'
  featureNames: { en: string; de: string };
  requiredDomain: string; // 'earnings'
  attachment: { allowed: boolean; contentType?: 'application/pdf'; maxBytes?: number };
}
const REQUEST_LIMITS = { open: 3, perDay: 5, retentionDays: 30 };
```

## State transitions

```text
        submit
          │
          ▼
        OPEN ◄──────────────┐
          │ ▲               │ reopen (closed_at := NULL, countdown cancelled)
          ▼ │               │
     IN_PROGRESS ◄──────────┤
          │                 │
          ▼                 │
   DONE / REJECTED ─────────┘
   closed_at := now
   +30 days → sweep: attachment + payload deleted, row stays
```

Any status may be set to any other by an administrator; the side effects depend only on entering or
leaving a closed state: entering DONE sends the requester mail (once per entry), entering
DONE/REJECTED sets `closed_at`, leaving them clears it. `handled_by/handled_at` are updated on every
status or note change.

## Entities ↔ spec

| Spec entity          | Storage                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Request              | `requests`                                                                                                      |
| Request Type         | `REQUEST_TYPES` registry (`libs/requests`) + backend `RequestTypeHandler`                                       |
| Request Attachment   | `request_attachments`                                                                                           |
| Anonymized Sample    | the `content` BLOB (generated by `renderSamplePdf`)                                                             |
| Layout Submission    | transient request body ([contracts/layout-submission-v1.md](contracts/layout-submission-v1.md)); **not stored** |
| Rule Draft           | `requests.payload` (JSON) for `earnings/new-parser`                                                             |
| Label Vocabulary     | constant in `libs/earnings`                                                                                     |
| Download Audit Entry | `request_download_audit`                                                                                        |

## Stored rule-draft payload (`earnings/new-parser`)

```json
{
  "schemaVersion": 1,
  "pages": 1,
  "lines": [
    {
      "page": 0,
      "line": 12,
      "label": "Lohnsteuer",
      "figure": "WAGE_TAX",
      "deduction": true,
      "column": { "x0": 380.0, "x1": 455.5 },
      "format": "DE_DECIMAL"
    }
  ],
  "period": { "page": 0, "line": 3, "x0": 400.0, "x1": 470.0 }
}
```

`label` is derived server-side from the validated layout line (non-digit words); the client sends
only `page`, `line`, `figure`, `deduction`, `column`, `format`, `period`.

## Validation rules (server, summarised — full list in the contract)

- `feature`/`type` ∈ registry; user holds the type's `requiredDomain` (admins pass).
- Layout: schema v1, exact keys, ≤ 3 pages / 120 lines / 40 words / 3 000 words, text ≤ 60 chars,
  printable characters only, coordinates finite and within the page box.
- `scanDocument` finds no personal data.
- Rule draft: ≤ 60 lines, `page`/`line` reference existing lines, `figure`/`format` from the enums,
  `column.x0 < x1` within page width, **no other keys**.
- Open ≤ 3 and ≤ 5 in the last 24 h per requester.
- Generated PDF ≤ attachment `maxBytes`.
