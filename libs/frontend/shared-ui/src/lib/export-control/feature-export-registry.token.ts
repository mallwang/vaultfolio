import { InjectionToken } from '@angular/core';
import { FeatureExportRegistry } from '@vaultfolio/export';

/**
 * The app-wide `FeatureExportRegistry` singleton (data-model.md's `FeatureExportRegistry`,
 * contracts/export-lib.md), injected by `ExportControlComponent` to look up its own feature's
 * `FeatureExportDefinition` and by the "Export my data" flow to iterate every registered one.
 *
 * Defaults to a fresh, empty registry (`providedIn: 'root'`) so this library never depends on
 * `apps/frontend` — the app-shell populates the real instance at bootstrap by registering each
 * domain's `FeatureExportDefinition` into it (mirrors `CURRENT_USER_SOURCE`'s
 * shared-token-defined-here/bound-in-app.config.ts pattern in `@vaultfolio/frontend-domain-access`).
 */
export const FEATURE_EXPORT_REGISTRY = new InjectionToken<FeatureExportRegistry>(
  'FEATURE_EXPORT_REGISTRY',
  { providedIn: 'root', factory: () => new FeatureExportRegistry() },
);
