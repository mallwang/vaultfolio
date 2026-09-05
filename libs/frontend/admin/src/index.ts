export { AdminComponent } from './lib/admin.component.js';
export { AccountsComponent } from './lib/accounts/accounts.component.js';
export { SignupsComponent } from './lib/signups/signups.component.js';
export { InvitationsComponent } from './lib/invitations/invitations.component.js';
// Also consumed directly by `apps/frontend/src/app/invite/accept` (the
// public accept-invite flow looks up/accepts an invitation by token) — both
// a route's `loadComponent` target and a service consumed by another
// `scope:frontend` view are legitimate public-API consumers of a library
// (contracts/module-boundaries.md guarantee 2, mirroring
// `HoldingsService`'s identical export in `@vaultfolio/frontend-domain-holdings`).
export { InvitationsService } from './lib/invitations/invitations.service.js';
export { HealthStatusComponent } from './lib/health-status/health-status.component.js';
