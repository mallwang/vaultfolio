# Data Model: Domain Maintenance Mode

## Table `domain_maintenance`

| Column           | Type | Notes                                                              |
| ---------------- | ---- | ------------------------------------------------------------------ |
| `domain_id`      | TEXT | Primary key. One of `MAINTENANCE_DOMAIN_IDS`.                      |
| `in_maintenance` | INT  | `0` or `1`, not null.                                              |
| `updated_at`     | TEXT | ISO timestamp of the last change.                                  |
| `updated_by`     | TEXT | User id of the acting admin (no FK; the audit must outlive users). |

A missing row means the domain is active. Rows are upserted on the first toggle.

## Table `domain_maintenance_audit` (append-only)

| Column           | Type | Notes               |
| ---------------- | ---- | ------------------- |
| `id`             | TEXT | Primary key (uuid). |
| `domain_id`      | TEXT | Domain affected.    |
| `in_maintenance` | INT  | New state.          |
| `actor_id`       | TEXT | Admin user id.      |
| `changed_at`     | TEXT | ISO timestamp.      |

Index on `(domain_id, changed_at)`. A change that does not alter the state writes no audit row.

## Shared types (`@vaultfolio/api-contract`)

- `MAINTENANCE_DOMAIN_IDS`: `holdings`, `retirement`, `insurances`, `haushaltsplaner`,
  `historic-wealth-development`, `account-overview`, `klaro`, `earnings` (equals the frontend registry).
- `DomainMaintenanceStatus`: `{ domainId, inMaintenance, updatedAt: string | null, updatedBy: string | null }`
  where `updatedBy` is shown as the admin's display name in the admin response.
- `DomainMaintenanceListResponse` (members): `{ domains: string[] }`.
- `DomainMaintenanceAdminResponse`: `{ domains: DomainMaintenanceStatus[] }`.
- Error code `DOMAIN_MAINTENANCE`.

## State transitions

`active` <-> `in_maintenance`, only by an admin, each real change in one transaction with its audit
row. Existing user data tables are never read or written by this feature.
