import { Routes } from '@angular/router';
import { domainGuard } from '@vaultfolio/frontend-domain-access';
import { NotFoundComponent } from './core/layout/not-found/not-found.component';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';
import { SETTINGS_TAB_CONTRIBUTIONS } from './settings/settings-tabs.registry';

/**
 * Route table (contracts/routes.md): public pages live directly under the
 * base URL with no shell of their own beyond the always-on root header
 * (app.ts); authenticated pages are nested under the `app` parent route,
 * which carries `authGuard` once (research.md #3) and renders
 * `AppShellComponent` (sidebar + routed content). `redirectTo` routes keep
 * pre-restructure addresses working (FR-013). `/invite/expired` is declared
 * before the `:token` route so the literal segment wins the match.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },
  {
    path: 'sign-in',
    title: 'Sign In',
    loadComponent: () => import('./auth/sign-in/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'invite/expired',
    title: 'Invite Expired',
    loadComponent: () =>
      import('./invite/expired/expired.component').then((m) => m.ExpiredComponent),
  },
  {
    path: 'invite/:token',
    title: 'Accept Invite',
    loadComponent: () => import('./invite/accept/accept.component').then((m) => m.AcceptComponent),
  },
  {
    path: 'account/link-invalid',
    title: 'Link Invalid',
    loadComponent: () =>
      import('./account/link-invalid/link-invalid.component').then((m) => m.LinkInvalidComponent),
  },
  {
    path: 'account/verify-email/:token',
    title: 'Verify Email',
    loadComponent: () =>
      import('./account/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'account/forgot-password',
    title: 'Forgot Password',
    loadComponent: () =>
      import('./account/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'account/reset-password/:token',
    title: 'Reset Password',
    loadComponent: () =>
      import('./account/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'signup',
    title: 'Sign Up',
    loadComponent: () => import('./signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'signup/verify/:token',
    title: 'Verify Sign Up',
    loadComponent: () => import('./signup/verify/verify.component').then((m) => m.VerifyComponent),
  },
  // Legacy (pre-`/app`) addresses (FR-013, contracts/routes.md "Legacy
  // redirects") — still subject to `authGuard` on arrival at their `/app`
  // equivalent, same as any other `/app/...` request.
  { path: 'dashboard', pathMatch: 'full', redirectTo: 'app/dashboard' },
  { path: 'holdings', pathMatch: 'full', redirectTo: 'app/holdings' },
  // Imports no longer has its own address (021, US3) — both this and its
  // post-`/app` equivalent below now land on the relocated tab (FR-010).
  { path: 'imports', pathMatch: 'full', redirectTo: 'app/holdings/imports' },
  { path: 'settings', pathMatch: 'full', redirectTo: 'app/settings' },
  {
    path: 'app',
    canActivate: [authGuard],
    component: AppShellComponent,
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'holdings',
        title: 'Holdings',
        canActivate: [domainGuard('holdings')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-holdings').then((m) => m.HoldingsAreaComponent),
        // Imports is now an internal tab of Holdings, not its own nav
        // entry/route (FR-008/FR-009, US3) — both children inherit the
        // `domainGuard('holdings')` above from this parent, the same way
        // `adminGuard` already covers every Admin sub-route.
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'list' },
          {
            path: 'list',
            title: 'Holdings · List',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-holdings').then((m) => m.HoldingsComponent),
          },
          {
            path: 'imports',
            title: 'Holdings · Imports',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-holdings').then((m) => m.ImportsComponent),
          },
        ],
      },
      // Post-`/app` legacy address (FR-010, FR-013) — pre-021 direct visits
      // to `/app/imports` now land on the relocated tab.
      { path: 'imports', pathMatch: 'full', redirectTo: 'holdings/imports' },
      // Five placeholder domains (022-add-domain-placeholders, FR-001/FR-002):
      // each is a single `domainGuard`-gated route lazy-loading its own
      // library's placeholder component, exactly like Holdings' own route
      // (contracts/registry-additions.md §3) — no sub-tabs, no imports.
      {
        path: 'retirement',
        title: 'Retirement',
        canActivate: [domainGuard('retirement')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-retirement').then(
            (m) => m.RetirementPlaceholderComponent,
          ),
      },
      {
        path: 'insurances',
        title: 'Insurances',
        canActivate: [domainGuard('insurances')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-insurances').then(
            (m) => m.InsurancesPlaceholderComponent,
          ),
      },
      {
        path: 'haushaltsplaner',
        title: 'Haushaltsplaner',
        canActivate: [domainGuard('haushaltsplaner')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-haushaltsplaner').then(
            (m) => m.HaushaltsplanerPlaceholderComponent,
          ),
      },
      {
        path: 'historic-wealth-development',
        title: 'Wealth Development',
        canActivate: [domainGuard('historic-wealth-development')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-historic-wealth-development').then(
            (m) => m.HistoricWealthDevelopmentPlaceholderComponent,
          ),
      },
      {
        path: 'account-overview',
        title: 'Account Overview',
        canActivate: [domainGuard('account-overview')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-account-overview').then(
            (m) => m.AccountOverviewPlaceholderComponent,
          ),
      },
      {
        path: 'settings',
        title: 'Settings',
        loadComponent: () =>
          import('./settings/settings.component').then((m) => m.SettingsComponent),
        // Each tab is its own address (012 US4 — deep links from emails etc.):
        // SettingsComponent renders a `<router-outlet>` inside its p-tabpanels
        // and drives the active p-tab from the active child route.
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'profile' },
          {
            path: 'profile',
            title: 'Settings · Profile',
            loadComponent: () =>
              import('./settings/profile/profile.component').then((m) => m.ProfileComponent),
          },
          {
            path: 'preferences',
            title: 'Settings · Preferences',
            loadComponent: () =>
              import('./settings/preferences/preferences.component').then(
                (m) => m.PreferencesComponent,
              ),
          },
          // One child per SETTINGS_TAB_CONTRIBUTIONS entry (FR-002), each
          // guarded the same way a domain's own main route is
          // (contracts/dashboard-settings-extension-points.md).
          ...SETTINGS_TAB_CONTRIBUTIONS.map((contribution) => ({
            path: contribution.path,
            canActivate: [domainGuard(contribution.domainId)],
            loadComponent: contribution.loadComponent,
          })),
        ],
      },
      {
        path: 'admin',
        title: 'Admin',
        canActivate: [adminGuard],
        loadComponent: () => import('@vaultfolio/frontend-admin').then((m) => m.AdminComponent),
        // Same pattern as `settings` above; the `adminGuard` on the parent
        // route already covers these subsection addresses too. Admin now
        // lives in its own `scope:frontend-admin` library (021, US4) —
        // structurally distinct from any `scope:frontend-domain` library —
        // only the import source changes here, no path/title/guard change.
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'accounts' },
          {
            path: 'accounts',
            title: 'Admin · Accounts',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.AccountsComponent),
          },
          {
            path: 'signups',
            title: 'Admin · Sign-ups',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.SignupsComponent),
          },
          {
            path: 'invitations',
            title: 'Admin · Invitations',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.InvitationsComponent),
          },
          {
            path: 'general',
            title: 'Admin · General',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.HealthStatusComponent),
          },
        ],
      },
      { path: '**', title: 'Not Found', component: NotFoundComponent },
    ],
  },
  { path: '**', title: 'Not Found', component: NotFoundComponent },
];
