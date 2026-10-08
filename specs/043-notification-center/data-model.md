# Data Model: Notification Center

All types are frontend-only (`@vaultfolio/frontend-hints`). Nothing is stored on the server.

## Hint

A notice currently contributed by a provider. Never persisted.

| Field            | Type                                                          | Rules                                                                                   |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `id`             | string                                                        | Stable across evaluations for the same underlying finding; unique within the whole app. |
| `severity`       | `'warning' \| 'info'`                                         | Warnings sort before info hints.                                                        |
| `titleKey`       | string                                                        | i18n key.                                                                               |
| `descriptionKey` | string                                                        | i18n key.                                                                               |
| `params`         | `Record<string, string \| number>` (optional)                 | Interpolation values; part of the signature. Plain scalars only.                        |
| `target`         | `{ commands: string[]; queryParams?: Record<string,string> }` | Router navigation target for the hint's link; `linkLabelKey` below labels it.           |
| `linkLabelKey`   | string                                                        | i18n key for the link text.                                                             |

Derived by the center (not supplied): `source` (from the contribution), `signature` (see below).

## HintProviderContribution

Registry entry in the app shell.

| Field           | Type                                | Rules                                                                   |
| --------------- | ----------------------------------- | ----------------------------------------------------------------------- |
| `sourceId`      | string                              | Stable key; prefix of every hint id the provider returns.               |
| `domainId`      | string (optional)                   | If set, the provider is only used when entitled and not in maintenance. |
| `groupLabelKey` | string                              | i18n key of the group title in the panel.                               |
| `loadProvider`  | `() => Promise<Type<HintProvider>>` | Dynamic import factory, never imported eagerly.                         |

## HintProvider

Root-provided class implemented by a feature.

| Member      | Type                      | Rules                                                                    |
| ----------- | ------------------------- | ------------------------------------------------------------------------ |
| `hints`     | `Signal<readonly Hint[]>` | Current valid hints; empty while loading or after a failed load.         |
| `ready`     | `Signal<boolean>`         | `true` once the first load settled (success or failure). Guards cleanup. |
| `load()`    | `() => void`              | Idempotent; starts the first load.                                       |
| `refresh()` | `() => void` (optional)   | Re-evaluates; called on navigation (throttled) and when the panel opens. |

## Content signature

`signature = hex(cyrb53(canonicalJson({ titleKey, descriptionKey, severity, params })))` with keys sorted. Language-independent. Two hints with equal signature and id are "unchanged".

## Hidden State (local)

Stored per user under `vaultfolio.hints-hidden.<userId>`.

```text
{ version: 1, entries: { "<hintId>": { source: "<sourceId>", signature: "<hex>" } } }
```

Rules:

- A hint is **hidden** iff an entry with its id exists and `entry.signature === hint.signature`.
- A hint whose entry has a different signature is **active**; the stale entry stays until the user hides it again (replaced) or it is purged.
- **Purge**: an entry is removed when its `source` provider is `ready()` and its id is not in that provider's current hints.
- Unparsable or version-mismatched storage is treated as empty.
- Storage failures keep the state in memory for the session.

## View model

- `activeHints`, `hiddenHints`: partition of all current hints by the hidden rule.
- `groups`: active hints grouped by source in registry order, warnings before info within a group (stable otherwise).
- `badge`: `{ count: n, label: n > 9 ? '9+' : String(n), dot: n === 0 && hiddenHints.length > 0 }`; `count` counts only active hints.
