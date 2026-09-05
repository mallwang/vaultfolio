export { HoldingsComponent } from './lib/holdings.component.js';
// Also consumed directly by `apps/frontend/src/app/dashboard` (the
// Allocation card embeds the same distribution chart the Holdings page
// uses) — both a route's `loadComponent` target and a component consumed
// inline by another `scope:frontend` view are legitimate public-API
// consumers of a domain library (contracts/module-boundaries.md guarantee 2).
export { HoldingsDistributionComponent } from './lib/holdings-distribution/holdings-distribution.component.js';
export { HoldingsService } from './lib/holdings.service.js';
