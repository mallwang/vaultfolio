import { Routes } from '@angular/router';
import { domainGuard } from '@vaultfolio/frontend-domain-access';
import { NotFoundComponent } from './core/layout/not-found/not-found.component';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';
import { SETTINGS_TAB_CONTRIBUTIONS } from './settings/settings-tabs.registry';

/**
 * Route table: public pages live directly under the base URL with no shell
 * of their own beyond the always-on root header (app.ts); authenticated pages
 * are nested under the `app` parent route, which carries `authGuard` once and
 * renders `AppShellComponent` (sidebar + routed content). `/invite/expired` is
 * declared before the `:token` route so the literal segment wins the match.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'app/dashboard' },
  {
    path: 'sign-in',
    title: 'pageTitle.signIn',
    loadComponent: () => import('./auth/sign-in/sign-in.component').then((m) => m.SignInComponent),
  },
  {
    path: 'invite/expired',
    title: 'pageTitle.inviteExpired',
    loadComponent: () =>
      import('./invite/expired/expired.component').then((m) => m.ExpiredComponent),
  },
  {
    path: 'invite/:token',
    title: 'pageTitle.acceptInvite',
    loadComponent: () => import('./invite/accept/accept.component').then((m) => m.AcceptComponent),
  },
  {
    path: 'account/link-invalid',
    title: 'pageTitle.linkInvalid',
    loadComponent: () =>
      import('./account/link-invalid/link-invalid.component').then((m) => m.LinkInvalidComponent),
  },
  {
    path: 'account/verify-email/:token',
    title: 'pageTitle.verifyEmail',
    loadComponent: () =>
      import('./account/verify-email/verify-email.component').then((m) => m.VerifyEmailComponent),
  },
  {
    path: 'account/forgot-password',
    title: 'pageTitle.forgotPassword',
    loadComponent: () =>
      import('./account/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },
  {
    path: 'account/reset-password/:token',
    title: 'pageTitle.resetPassword',
    loadComponent: () =>
      import('./account/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent,
      ),
  },
  {
    path: 'signup',
    title: 'pageTitle.signUp',
    loadComponent: () => import('./signup/signup.component').then((m) => m.SignupComponent),
  },
  {
    path: 'signup/verify/:token',
    title: 'pageTitle.verifySignUp',
    loadComponent: () => import('./signup/verify/verify.component').then((m) => m.VerifyComponent),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    component: AppShellComponent,
    children: [
      {
        path: 'dashboard',
        title: 'pageTitle.dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'holdings',
        title: 'pageTitle.holdings',
        canActivate: [domainGuard('holdings')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-holdings').then((m) => m.HoldingsAreaComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'list' },
          {
            path: 'list',
            title: 'pageTitle.holdingsList',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-holdings').then((m) => m.HoldingsComponent),
          },
          {
            path: 'imports',
            title: 'pageTitle.holdingsImports',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-holdings').then((m) => m.ImportsComponent),
          },
        ],
      },
      {
        path: 'retirement',
        title: 'pageTitle.retirement',
        canActivate: [domainGuard('retirement')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-retirement').then(
            (m) => m.RetirementPlaceholderComponent,
          ),
      },
      {
        path: 'insurances',
        title: 'pageTitle.insurances',
        canActivate: [domainGuard('insurances')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-insurances').then(
            (m) => m.InsurancesPlaceholderComponent,
          ),
      },
      {
        path: 'haushaltsplaner',
        title: 'pageTitle.haushaltsplaner',
        canActivate: [domainGuard('haushaltsplaner')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-haushaltsplaner').then(
            (m) => m.HaushaltsplanerPlaceholderComponent,
          ),
      },
      {
        path: 'historic-wealth-development',
        title: 'pageTitle.wealthDevelopment',
        canActivate: [domainGuard('historic-wealth-development')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-historic-wealth-development').then(
            (m) => m.HistoricWealthDevelopmentPlaceholderComponent,
          ),
      },
      {
        path: 'account-overview',
        title: 'pageTitle.accountOverview',
        canActivate: [domainGuard('account-overview')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-account-overview').then(
            (m) => m.AccountOverviewPageComponent,
          ),
      },
      {
        path: 'klaro',
        title: 'pageTitle.klaro',
        canActivate: [domainGuard('klaro')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-klaro').then((m) => m.KlaroPageComponent),
      },
      {
        path: 'settings',
        title: 'pageTitle.settings',
        loadComponent: () =>
          import('./settings/settings.component').then((m) => m.SettingsComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'profile' },
          {
            path: 'profile',
            title: 'pageTitle.settingsProfile',
            loadComponent: () =>
              import('./settings/profile/profile.component').then((m) => m.ProfileComponent),
          },
          {
            path: 'preferences',
            title: 'pageTitle.settingsPreferences',
            loadComponent: () =>
              import('./settings/preferences/preferences.component').then(
                (m) => m.PreferencesComponent,
              ),
          },
          ...SETTINGS_TAB_CONTRIBUTIONS.map((contribution) => ({
            path: contribution.path,
            canActivate: [domainGuard(contribution.domainId)],
            loadComponent: contribution.loadComponent,
          })),
        ],
      },
      {
        path: 'admin',
        title: 'pageTitle.admin',
        canActivate: [adminGuard],
        loadComponent: () => import('@vaultfolio/frontend-admin').then((m) => m.AdminComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'accounts' },
          {
            path: 'accounts',
            title: 'pageTitle.adminAccounts',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.AccountsComponent),
          },
          {
            path: 'signups',
            title: 'pageTitle.adminSignups',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.SignupsComponent),
          },
          {
            path: 'invitations',
            title: 'pageTitle.adminInvitations',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.InvitationsComponent),
          },
          {
            path: 'general',
            title: 'pageTitle.adminGeneral',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.HealthStatusComponent),
          },
        ],
      },
      { path: '**', title: 'pageTitle.notFound', component: NotFoundComponent },
    ],
  },
  { path: '**', title: 'pageTitle.notFound', component: NotFoundComponent },
];
