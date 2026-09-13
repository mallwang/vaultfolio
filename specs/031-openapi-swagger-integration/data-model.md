# Phase 1 Data Model: OpenAPI/Swagger API Documentation

This feature introduces no persisted entities and no database schema change. The "entities" below
(matching spec.md's Key Entities) are documentation/tooling artifacts, not domain data.

## API Specification Document

The single generated `OpenAPIObject` (per the `openapi-types`/`@nestjs/swagger` shape) built once
per process from `DocumentBuilder` + every registered controller/DTO. It is the shared source
consumed by three surfaces:

| Field / concern              | Description                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `info`                       | Title ("Vaultfolio API"), version (mirrors `apps/backend/package.json`'s `version`), description pointing to this feature's docs |
| `paths`                      | One entry per registered route, derived from controller decorators + the decorated DTO classes (research.md #1)                  |
| `components.schemas`         | One schema per decorated DTO class under `apps/backend/src/openapi/dto/`                                                         |
| `components.securitySchemes` | A single cookie-auth scheme (`vaultfolio_session`, research.md #2) applied to every non-`@Public()` route                        |
| Consumers                    | Interactive Documentation UI (live), `/openapi.yml` route (live), `api/openapi.yml` file (generation script)                     |

**Validation rule**: every path NestJS's router actually registers MUST appear in `paths` — this is
what the drift/completeness test (research.md #6, quickstart.md) asserts; a route present in the
app but missing from the document is a build-breaking failure, not a warning.

## Interactive Documentation UI

Not a data entity — the `SwaggerModule.setup('swagger', app, document)` HTTP surface itself
(static assets + `GET /swagger-json`/`GET /swagger-yaml` it fetches internally, all reverse-proxied
per research.md #2). No state of its own; it renders the API Specification Document and proxies
"try it out" calls to the real backend routes using the caller's own session cookie.

## Request Collection (Bruno)

A checked-in folder structure, not a runtime entity:

```text
api/bruno/
├── bruno.json
├── environments/
│   └── local.bru        # baseUrl = http://localhost:4200/api
├── auth/                 # includes the "Login" request other folders depend on
├── holdings/
├── accounts/
├── invitations/
├── signups/
├── profile/
├── account-overview/
└── health/
```

**Validation rule**: every `.bru` request's method + URL MUST correspond to a route present in the
API Specification Document (checked manually during review for this feature; not machine-enforced,
since Bruno collections are hand-curated per FR-009's "organized by feature area" requirement
rather than 1:1 generated).

## Documentation Annotation

Not a data entity — the collective term (per spec.md) for the `@ApiTags`, `@ApiOperation`,
`@ApiResponse`, `@ApiCookieAuth`, `@ApiProperty`/`@ApiPropertyOptional` decorators added to
existing controllers and to the new `apps/backend/src/openapi/dto/*` classes. Tracked as
implementation work per controller/module in tasks.md, not as a data model.

## Relationships

```text
libs/api-contract (interfaces)
        │  structurally mirrored by
        ▼
apps/backend/src/openapi/dto/*  (decorated classes)
        │  referenced in
        ▼
apps/backend/src/**/*.controller.ts  (@Api... decorators + typed params/returns)
        │  reflected by
        ▼
DocumentBuilder + SwaggerModule.createDocument()  →  API Specification Document
        │                                   │                        │
        ▼                                   ▼                        ▼
Interactive Documentation UI      GET /openapi.yml route     apps/backend/scripts/generate-openapi.ts
     (/swagger)                    (→ /api/openapi.yml)              → api/openapi.yml (committed)
```
