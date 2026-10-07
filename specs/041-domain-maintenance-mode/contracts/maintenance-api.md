# Contract: Domain Maintenance API

All endpoints require a signed-in session (cookie). Errors use the existing structured error body.

## `GET /domains/maintenance` (any signed-in user)

Domains currently in maintenance. Used by the frontend on page load.

`200`

```json
{ "domains": ["insurances"] }
```

`401` when not signed in.

## `GET /admin/domains` (ADMIN)

Status of every maintainable domain.

`200`

```json
{
  "domains": [
    {
      "domainId": "insurances",
      "inMaintenance": true,
      "updatedAt": "2026-10-06T18:42:10.000Z",
      "updatedBy": "Markus Allwang"
    },
    { "domainId": "holdings", "inMaintenance": false, "updatedAt": null, "updatedBy": null }
  ]
}
```

`403` for non-admins.

## `PUT /admin/domains/:domainId` (ADMIN)

Sets the state. Idempotent: repeating the same state succeeds and writes no audit row.

Request

```json
{ "inMaintenance": true }
```

`200` returns the updated `DomainMaintenanceStatus`. `400` for a malformed body, `404` for an unknown
`domainId` (not in `MAINTENANCE_DOMAIN_IDS`), `403` for non-admins.

## Enforcement on existing domain routes

For every route under a `@RequiresDomain(<id>)` controller, when `<id>` is in maintenance:

| Caller                  | Result                           |
| ----------------------- | -------------------------------- |
| Not signed in           | `401` (unchanged)                |
| Signed in, not entitled | `403` (unchanged, checked first) |
| Entitled member         | `503` with the body below        |
| Admin                   | Request is processed normally    |

`503` body

```json
{
  "error": "DOMAIN_MAINTENANCE",
  "message": "This area is temporarily unavailable due to maintenance.",
  "domainId": "insurances",
  "correlationId": "..."
}
```

The OpenAPI document (`api/openapi.yml`) gets the new paths, schemas and a shared `503` response on
domain controllers. Bruno requests are added under `api/bruno/`.
