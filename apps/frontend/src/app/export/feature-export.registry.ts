import { type EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { FeatureExportRegistry } from '@vaultfolio/export';

/**
 * Registers every domain's `FeatureExportDefinition` into the app-wide `FEATURE_EXPORT_REGISTRY`
 * singleton (FR-008/FR-009/FR-012) — the only place a new feature's export support is wired in;
 * neither `libs/export` nor `ExportControlComponent` change when a 7th feature registers here.
 *
 * Every domain is registered via a **dynamic** `import()` of its package — the same specifier
 * `app.routes.ts` already dynamically imports for its route (`loadComponent: () =>
 * import('@vaultfolio/frontend-domain-...').then(...)`) — rather than a static one. A static
 * top-level import of any of these packages here (an always-eagerly-loaded `app.config.ts` call
 * site) would force their entire domain bundle into the app's main chunk instead of staying in
 * their route's own lazy chunk, since a module reached by both a static and a dynamic import path
 * is bundled into the static (eager) one; `@nx/enforce-module-boundaries` enforces this (a lazy-
 * loaded library may not also be statically imported). `provideAppInitializer` in `app.config.ts`
 * already awaits this (mirrors the existing `AuthService.getSession()` initializer), so the
 * registry is fully populated before the app finishes bootstrapping.
 *
 * `createHoldingsExportDefinition`/`createAccountOverviewExportDefinition` both call `inject()`
 * internally, which only works synchronously inside an active injection context — lost across
 * the `await import(...)` boundary above, hence `runInInjectionContext` re-entering it with the
 * `EnvironmentInjector` captured (synchronously) by the caller before that `await`. The 4
 * placeholder domains export a plain constant instead of a factory, so no injection context is
 * needed for those.
 */
export async function registerFeatureExports(
  registry: FeatureExportRegistry,
  injector: EnvironmentInjector,
): Promise<void> {
  const [
    createHoldingsExportDefinition,
    createAccountOverviewExportDefinition,
    retirementExportDefinition,
    insurancesExportDefinition,
    haushaltsplanerExportDefinition,
    historicWealthDevelopmentExportDefinition,
  ] = await Promise.all([
    import('@vaultfolio/frontend-domain-holdings').then((m) => m.createHoldingsExportDefinition),
    import('@vaultfolio/frontend-domain-account-overview').then(
      (m) => m.createAccountOverviewExportDefinition,
    ),
    import('@vaultfolio/frontend-domain-retirement').then((m) => m.RETIREMENT_EXPORT_DEFINITION),
    import('@vaultfolio/frontend-domain-insurances').then((m) => m.INSURANCES_EXPORT_DEFINITION),
    import('@vaultfolio/frontend-domain-haushaltsplaner').then(
      (m) => m.HAUSHALTSPLANER_EXPORT_DEFINITION,
    ),
    import('@vaultfolio/frontend-domain-historic-wealth-development').then(
      (m) => m.HISTORIC_WEALTH_DEVELOPMENT_EXPORT_DEFINITION,
    ),
  ]);
  registry.register(runInInjectionContext(injector, createHoldingsExportDefinition));
  registry.register(runInInjectionContext(injector, createAccountOverviewExportDefinition));
  registry.register(retirementExportDefinition);
  registry.register(insurancesExportDefinition);
  registry.register(haushaltsplanerExportDefinition);
  registry.register(historicWealthDevelopmentExportDefinition);
}
