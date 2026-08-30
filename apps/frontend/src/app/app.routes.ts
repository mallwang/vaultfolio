import { Routes } from '@angular/router';
import { NotFoundComponent } from './core/layout/not-found/not-found.component';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';

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
  { path: 'imports', pathMatch: 'full', redirectTo: 'app/imports' },
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
        loadComponent: () =>
          import('./holdings/holdings.component').then((m) => m.HoldingsComponent),
      },
      {
        path: 'imports',
        title: 'Imports',
        loadComponent: () => import('./imports/imports.component').then((m) => m.ImportsComponent),
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
        ],
      },
      {
        path: 'admin',
        title: 'Admin',
        canActivate: [adminGuard],
        loadComponent: () => import('./admin/admin.component').then((m) => m.AdminComponent),
        // Same pattern as `settings` above; the `adminGuard` on the parent
        // route already covers these subsection addresses too.
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'accounts' },
          {
            path: 'accounts',
            title: 'Admin · Accounts',
            loadComponent: () =>
              import('./admin/accounts/accounts.component').then((m) => m.AccountsComponent),
          },
          {
            path: 'signups',
            title: 'Admin · Sign-ups',
            loadComponent: () =>
              import('./admin/signups/signups.component').then((m) => m.SignupsComponent),
          },
          {
            path: 'invitations',
            title: 'Admin · Invitations',
            loadComponent: () =>
              import('./admin/invitations/invitations.component').then(
                (m) => m.InvitationsComponent,
              ),
          },
          {
            path: 'general',
            title: 'Admin · General',
            loadComponent: () =>
              import('./admin/health-status/health-status.component').then(
                (m) => m.HealthStatusComponent,
              ),
          },
        ],
      },
      { path: '**', title: 'Not Found', component: NotFoundComponent },
    ],
  },
  { path: '**', title: 'Not Found', component: NotFoundComponent },
];
