import { Routes } from '@angular/router';
import { NotFoundComponent } from './core/layout/not-found/not-found.component';
import { authGuard } from './auth/auth.guard';

/**
 * Route table (contracts/application-areas.md): one route per
 * APPLICATION_AREAS entry, lazy-loaded; '/' redirects to '/dashboard'; a
 * trailing wildcard renders NotFoundComponent inside the persistent shell
 * (FR-004, FR-006). `/sign-in` is the one public route
 * (005-auth-sessions-isolation); every other route carries `authGuard`.
 * `/invite/expired` and `/invite/:token` (006, User Story 2) are also
 * public — no session exists yet — and additionally render with no app
 * shell at all (design.md "Accept-invite page"/"Invite-expired page"); see
 * `App`'s route-based shell toggle in app.ts. `/invite/expired` is declared
 * before the `:token` route so the literal segment wins the match.
 * `/account/*` (008, User Stories 1–2) are the equivalent public,
 * shell-less routes for email-change verification and forgot/reset
 * password.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'sign-in',
    loadComponent: () => import('./auth/sign-in/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'invite/expired',
    loadComponent: () =>
      import('./invite/expired/expired.component').then((m) => m.ExpiredComponent),
  },
  {
    path: 'invite/:token',
    loadComponent: () => import('./invite/accept/accept.component').then((m) => m.AcceptComponent),
  },
  {
    path: 'account/link-invalid',
    loadComponent: () =>
      import('./account/link-invalid/link-invalid.component').then((m) => m.LinkInvalidComponent),
  },
  {
    path: 'account/verify-email/:token',
    loadComponent: () =>
      import('./account/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'account/forgot-password',
    loadComponent: () =>
      import('./account/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'account/reset-password/:token',
    loadComponent: () =>
      import('./account/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'signup',
    loadComponent: () => import('./signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'signup/verify/:token',
    loadComponent: () => import('./signup/verify/verify.component').then((m) => m.VerifyComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'holdings',
    canActivate: [authGuard],
    loadComponent: () => import('./holdings/holdings.component').then((m) => m.HoldingsComponent),
  },
  {
    path: 'imports',
    canActivate: [authGuard],
    loadComponent: () => import('./imports/imports.component').then((m) => m.ImportsComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', component: NotFoundComponent },
];
