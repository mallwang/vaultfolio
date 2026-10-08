# Research: Notification Center

## 1. Where the contract and shared logic live

- **Decision**: New library `libs/frontend/hints` (`@vaultfolio/frontend-hints`, tag `scope:shared`, Jest like `@vaultfolio/frontend-domain-access`) holds the contract types and the pure logic. Registry, store and UI stay in `apps/frontend`.
- **Rationale**: Domain libraries may only depend on `scope:shared`, so the provider contract must sit there. `domain-access` is about entitlement; adding unrelated hint logic would blur its purpose (Principle I: coherent responsibility). The pure logic (hash, reconcile, ordering) is testable without Angular.
- **Alternatives**: Extending `domain-access` (rejected: mixed responsibility). Putting everything in the app (rejected: domain libs could not implement the contract without importing the app).

## 2. Contribution mechanism

- **Decision**: Same pattern as the dashboard/settings contributions: a static registry in the shell (`HINT_PROVIDER_CONTRIBUTIONS`) with lazy `loadProvider: () => Promise<Type<HintProvider>>`. Each contribution has `sourceId`, optional `domainId`, `groupLabelKey`. A provider is a root-provided class exposing `hints: Signal<readonly Hint[]>` and `ready: Signal<boolean>`, plus `load()` and optional `refresh()`.
- **Rationale**: Consistent with 021/042 and Nx boundaries; lazy so no domain code loads before it is needed; providers can wrap existing root stores (`InsurancesStore`) without duplicating requests.
- **Alternatives**: Multi-provider `InjectionToken` (rejected: domain providers would have to be registered eagerly in app config); a central service that every feature pushes into (rejected: ordering, cleanup and ownership problems).

## 3. Hints as keys and params, not text

- **Decision**: A hint carries i18n keys and params (`titleKey`, `descriptionKey`, `params`), never translated strings.
- **Rationale**: Language switching re-renders correctly; the content signature is language-independent.
- **Alternatives**: Pre-translated text (rejected: stale after language change, signature changes with language).

## 4. Content signature and reactivation

- **Decision**: `signature = hash(titleKey, descriptionKey, severity, canonical JSON of params)` using a synchronous 53-bit string hash (cyrb53) rendered as hex. A hidden entry is `{ source, signature }` keyed by hint id. A hint is hidden only while its current signature equals the stored one; otherwise it is active again and the entry is replaced when the user hides it again.
- **Rationale**: Satisfies FR-008 and SC-004. Only a hash reaches `localStorage` (no names or amounts). Synchronous, so no async crypto in computed signals; this is a change detector, not a security primitive.
- **Alternatives**: Storing the full content (rejected: sensitive text in plain storage); `crypto.subtle` SHA-256 (rejected: async, unnecessary strength); version counters supplied by providers (rejected: easy to forget, spreads logic).

## 5. Hidden-state storage and cleanup

- **Decision**: Key `vaultfolio.hints-hidden.<userId>` (same prefix style as `vaultfolio.dashboard-layout.<userId>`), value `{ version: 1, entries: Record<hintId, { source, signature }> }`. Reads and writes are best effort (try/catch); when storage fails the state stays in memory for the session. Entries are purged only for sources whose provider reports `ready() === true` and whose id is no longer present.
- **Rationale**: Per-user separation (edge case), bounded growth (edge case), and no false purge while a provider is still loading (the `ready` flag is the guard).
- **Alternatives**: Purging on every evaluation (rejected: loses hidden state during load or on a failed fetch).

## 6. Evaluation timing

- **Decision**: After sign-in the store loads entitled, non-maintenance providers (dynamic import, `load()`), then calls `refresh()` on `NavigationEnd` at most once per 60 s and when the panel opens. Providers backed by a shared store (Insurances) update reactively on edits anyway.
- **Rationale**: Matches the spec assumption "re-evaluated on page load and on navigation" without a request per click. Domain maintenance status already refreshes per page load (041).
- **Alternatives**: Polling or push (rejected: out of scope); refresh only at start (rejected: stale after an import in another area).

## 7. Filtering and failure isolation

- **Decision**: A contribution with a `domainId` is skipped unless `isDomainEntitled(user, domainId)` and `!DomainMaintenanceStore.isInMaintenance(domainId)`; its provider is not even loaded. Each provider's `hints()` is read inside a guard so one throwing or rejecting provider contributes nothing and does not affect others (FR-009, FR-010).
- **Rationale**: Deactivated domains must neither fetch data nor show hints. The maintenance store already exposes a signal-reading `isInMaintenance`.

## 8. Providers

- **Insurances**: `InsurancesHintProvider` wraps `InsurancesStore` (`ensureLoaded()`, `refresh()`, `gaps().redundant`). One hint per `RedundantItem`; id `insurances.redundant.<contractId>.<otherContractId>`; target the gap-check route; params `{ name, other, reason }`. `ready` follows `loaded()`; a failed load yields no hints.
- **Earnings**: `EarningsHintProvider` calls `EarningsService.dataCheck()` and keeps the rows in a signal. One hint per row with any difference or `completeness.status === 'MISSING'`; id `earnings.data-check.<employerId>.<year>`; params from the difference fields and missing periods so the signature changes when findings change; target the Earnings check view. `ready` is set after the first response or failure.
- **Rationale**: Reuses existing detection (FR-011, FR-012, assumption) without duplicating logic.

## 9. Panel container

- **Decision**: One `HintsPanelComponent`; desktop hosts it in a PrimeNG `p-popover`, mobile (max-width 768 px, `matchMedia` signal) in a `p-dialog` modal with `dismissableMask` and a close button. Focus handling and Escape come from PrimeNG.
- **Rationale**: Matches the approved design; one content component avoids duplication.
- **Alternatives**: Separate page (rejected by the user), custom overlay (rejected: accessibility effort).

## 10. Icon and naming

- **Decision**: Add `notifications: 'notifications'` to `ICON_NAME_MAP`. Name everything "hints" (`HintsStore`, `hints-bell`) to avoid collisions with the existing email-notification preferences, `libs/notifications` (e-mail) and PrimeNG `MessageService` toasts.
- **Rationale**: The repository already uses "notifications" for e-mail and "toast" for transient messages.

## 11. Test ids

- **Decision**: `hints-bell`, `hints-badge`, `hints-panel`, `hints-hidden-toggle`, and per hint `hints-row-<safe-id>`, `hints-hide-<safe-id>`, `hints-restore-<safe-id>`, `hints-link-<safe-id>`, where `<safe-id>` is `hintTestId(id)` (lowercase, non `[a-z0-9]` runs replaced by `-`). Follows `docs/frontend/testid-conventions.md`.

## Open items

None blocking. Feature 044 contributes its own entry (source `feedback`, no `domainId`) once its draft storage exists.
