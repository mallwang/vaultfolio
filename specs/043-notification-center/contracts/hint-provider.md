# Contract: Hint Provider

Audience: a feature developer who wants hints to appear in the notification center. The center needs no change for a new provider.

## Steps

1. Implement the provider in your domain library (depends only on `@vaultfolio/frontend-hints`):

   ```ts
   @Injectable({ providedIn: 'root' })
   export class MyHintProvider implements HintProvider {
     readonly hints: Signal<readonly Hint[]>;
     readonly ready: Signal<boolean>;
     load(): void {}
     refresh(): void {} // optional
   }
   ```

2. Export it from the library's `index.ts`.
3. Add one entry to `apps/frontend/src/app/core/hints/hint-providers.registry.ts`:

   ```ts
   {
     sourceId: 'insurances',
     domainId: 'insurances',
     groupLabelKey: 'hints.groups.insurances',
     loadProvider: () =>
       import('@vaultfolio/frontend-domain-insurances').then((m) => m.InsurancesHintProvider),
   }
   ```

4. Add the i18n keys for the group, titles, descriptions and link labels in every supported language.

## Rules

- **Ids** are stable for the same underlying finding, start with `<sourceId>.`, and contain only `[a-z0-9.-]`; build them from entity ids, never from display text.
- **Content** is expressed as i18n keys plus scalar `params`; never pass translated text. Anything that should reactivate a hidden hint when it changes MUST be part of `params`.
- **Severity**: `warning` for something the user should act on, `info` otherwise.
- **Target**: a router command and optional query params; the center closes the panel and navigates.
- **Readiness**: `ready()` becomes `true` after the first load settles, also on failure (then `hints()` stays empty). Until then the center will not purge hidden state for the source.
- **Failure**: never throw from `hints()`; return an empty list. The center also guards against throwing providers.
- **Sensitivity**: params may contain names the user already sees in the app. They are held in memory only; the center stores a hash, never the content.
- **Domain gating**: set `domainId` for domain features. The provider is not loaded and its hints are not shown when the domain is not unlocked for the user or is in maintenance. Omit `domainId` only for cross-cutting sources (for example feedback drafts, 044).

## Library API (`@vaultfolio/frontend-hints`)

| Export                                                                         | Purpose                                                     |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| types `Hint`, `HintSeverity`, `HintTarget`                                     | Hint shape                                                  |
| types `HintProvider`, `HintProviderContribution`                               | Provider and registry entry                                 |
| `hintSignature(hint)`                                                          | Language-independent content hash                           |
| `isHidden(state, hint)`, `hide(state, hint, source)`, `restore(state, hintId)` | Hidden-state transitions (pure, return a new state)         |
| `purgeStale(state, readySources, currentIds)`                                  | Drops entries of ready sources whose hint vanished          |
| `parseHiddenState(raw)`, `serializeHiddenState(state)`                         | Safe (de)serialization                                      |
| `viewOf(hints, state)`                                                         | `{ active, hidden, badge }` (grouping is done by the shell) |
| `hintTestId(id)`                                                               | `data-testid`-safe fragment                                 |

## Shell behaviour (informative)

| Concern   | Behaviour                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------- |
| Loading   | After sign-in, entitled and non-maintenance contributions are loaded lazily and `load()` is called. |
| Refresh   | `refresh()` on navigation (at most every 60 s) and when the panel opens.                            |
| Isolation | A throwing or failing provider contributes no hints; others are unaffected.                         |
| Sign-out  | In-memory provider state is dropped; hidden state stays in storage under the user's key.            |
