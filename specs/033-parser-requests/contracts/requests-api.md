# Contract: Requests REST API

Base path `/requests`. Session-cookie auth like every other route (`AuthGuard` global). Errors use
the shared structured body `{ error: <CODE>, message: <English text> }` from `libs/observability`;
the frontend translates by `error` code (FR-045). Types live in
`libs/api-contract/src/lib/requests.ts`; OpenAPI DTOs in `apps/backend/src/openapi/dto/requests.ts`;
Bruno requests in `api/bruno/requests/`.

| Method | Path                       | Who                                     | Purpose                              |
| ------ | -------------------------- | --------------------------------------- | ------------------------------------ |
| POST   | `/requests`                | any user entitled to the type's feature | Submit a request (FR-027)            |
| GET    | `/requests`                | ADMIN                                   | List requests (FR-030)               |
| GET    | `/requests/:id`            | ADMIN                                   | Detail (FR-031)                      |
| PATCH  | `/requests/:id`            | ADMIN                                   | Set status and/or note (FR-031, 033) |
| GET    | `/requests/:id/attachment` | ADMIN                                   | Download the sample (FR-020, 021)    |

Members can submit but **cannot list or read** any request, including their own (FR-028): the four
read/write admin routes answer `403 forbidden` for a non-administrator and `401` without a session —
identical bodies for existing and non-existing ids, so nothing about a request is revealed (FR-032).

## POST /requests

Body limit **512 kB** (only this route; others keep 100 kB). `Content-Type: application/json`
(anything else → `415 UNSUPPORTED_MEDIA_TYPE`).

```json
{
  "feature": "earnings",
  "type": "new-parser",
  "payload": { "...": "see layout-submission-v1.md" }
}
```

**201**

```json
{ "id": "uuid", "submittedAt": "2026-10-01T10:00:00.000Z", "possibleDuplicate": false }
```

| Status | `error`                  | When                                                                 |
| ------ | ------------------------ | -------------------------------------------------------------------- |
| 400    | `UNKNOWN_REQUEST_TYPE`   | `(feature,type)` not in the registry                                 |
| 400    | `INVALID_LAYOUT`         | schema/type/range violation (details: JSON path only, never values)  |
| 400    | `LAYOUT_UNKNOWN_FIELD`   | key outside the strict schema                                        |
| 400    | `LIMIT_EXCEEDED`         | pages/lines/words/text/rule-line limits                              |
| 400    | `PERSONAL_DATA_DETECTED` | server scan hit (response lists **kinds and page/line**, never text) |
| 400    | `INVALID_RULE_DRAFT`     | rule draft violates its schema or references missing lines           |
| 403    | `forbidden`              | user lacks the type's required domain                                |
| 413    | `payload_too_large`      | body > 512 kB (existing body-parser mapping)                         |
| 415    | `UNSUPPORTED_MEDIA_TYPE` | not JSON                                                             |
| 429    | `REQUEST_LIMIT_OPEN`     | ≥ 3 open/in-progress requests of this user (FR-040)                  |
| 429    | `REQUEST_LIMIT_DAILY`    | ≥ 5 requests in the last 24 h (FR-040)                               |

Side effects, in order: validate → scan → generate PDF → insert request + attachment in **one
transaction** → (after commit) send one admin alert per active admin; mail failure is logged and
ignored (FR-036). The response never echoes any submitted content.

## GET /requests

Query: `status` (optional, repeatable: `OPEN|IN_PROGRESS|DONE|REJECTED`). Newest first. No paging in
v1 (volume is small; the table scrolls).

**200**

```json
{
  "openCount": 2,
  "items": [
    {
      "id": "uuid",
      "feature": "earnings",
      "type": "new-parser",
      "requesterEmail": "someone@example.org",
      "status": "OPEN",
      "createdAt": "2026-10-01T10:00:00.000Z",
      "possibleDuplicate": true,
      "closedAt": null,
      "sampleDeletesAt": null,
      "hasSample": true
    }
  ]
}
```

`openCount` counts OPEN + IN_PROGRESS regardless of the filter (tab badge). `sampleDeletesAt` =
`closedAt + 30 d` while a sample still exists, else null.

## GET /requests/:id

**200**

```json
{
  "id": "uuid",
  "feature": "earnings",
  "type": "new-parser",
  "requesterEmail": "someone@example.org",
  "status": "IN_PROGRESS",
  "note": "…",
  "createdAt": "…",
  "handledByEmail": "admin@example.org",
  "handledAt": "…",
  "closedAt": null,
  "sampleDeletesAt": null,
  "possibleDuplicate": false,
  "payload": { "schemaVersion": 1, "pages": 1, "lines": [], "period": null },
  "attachment": {
    "contentType": "application/pdf",
    "sizeBytes": 18234,
    "pageCount": 1,
    "sha256": "…64 hex…",
    "downloadCount": 2,
    "lastDownloadedAt": "…"
  }
}
```

After retention: `payload: null`, `attachment: null`, `sampleDeleted: true` (UI shows "sample has been
deleted", no error page). `404 REQUEST_NOT_FOUND` for an unknown id (admin only).

## PATCH /requests/:id

```json
{ "status": "DONE", "note": "Parser added in v0.4.2" }
```

Both fields optional, at least one required; `status` ∈ the four statuses; `note` ≤ 2 000 chars
(`400 INVALID_REQUEST_UPDATE`). Updates `handled_by/handled_at`; maintains `closed_at` (see
data-model state transitions); entering DONE sends the requester mail after commit (failure
logged only). **200** returns the detail shape. Idempotent: setting the current status again sends
no mail.

## GET /requests/:id/attachment

**200** raw bytes with

```text
Content-Type: application/pdf
Content-Disposition: attachment; filename="request-<8 hex of id>-sample.pdf"
X-Content-Type-Options: nosniff
Cache-Control: no-store
```

Writes one `request_download_audit` row (admin, request, time). `404 REQUEST_NOT_FOUND` for an
unknown id; `410 SAMPLE_DELETED` once retention removed it. Never reachable without an
administrator session; there is no public or signed URL.

## Logging (FR-023)

One structured line per submit / status change / download / sweep: `event`, `requestId`, `feature`,
`type`, `status`, `sizeBytes`, `sha256`, `errorCode`, `kinds` (for PII rejections). Never text,
rule-draft content, e-mail addresses of requesters or any layout word.

## E-mail contract

| Type                  | Recipient          | View model                              | Link                                         |
| --------------------- | ------------------ | --------------------------------------- | -------------------------------------------- |
| `request-admin-alert` | every active ADMIN | `featureName`, `typeName`, `requestUrl` | `${APP_BASE_URL}/app/admin/requests?id=<id>` |
| `request-done`        | requester          | `featureName`, `typeName`, `importUrl`  | `${APP_BASE_URL}/app/earnings/import`        |

Language = recipient's `emailLanguage` (fallback English, 015). No attachment, no sample content,
no figures; the admin mail states that the sample is available in the portal after login only.
