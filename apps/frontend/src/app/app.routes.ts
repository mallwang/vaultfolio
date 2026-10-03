import { EnvironmentInjector, inject, runInInjectionContext } from '@angular/core';
import { CanActivateFn, Routes } from '@angular/router';
import { domainGuard } from '@vaultfolio/frontend-domain-access';
import { NotFoundComponent } from './core/layout/not-found/not-found.component';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { authGuard } from './auth/auth.guard';
import { adminGuard } from './auth/admin.guard';
import { SETTINGS_TAB_CONTRIBUTIONS } from './settings/settings-tabs.registry';

/**
 * Runs the Earnings library's `earningsAvailableGuard` without importing the library eagerly: the
 * injector is captured before the dynamic import, since the injection context ends at the await.
 */
const lazyEarningsAvailableGuard: CanActivateFn = () => {
  const injector = inject(EnvironmentInjector);
  return import('@vaultfolio/frontend-domain-earnings').then((m) =>
    runInInjectionContext(injector, () => m.earningsAvailableGuard()),
  );
};

/** The parser-request wizard needs a file handed over from the import page (033 FR-009). */
const lazyParserRequestGuard: CanActivateFn = () => {
  const injector = inject(EnvironmentInjector);
  return import('@vaultfolio/frontend-domain-earnings').then((m) =>
    runInInjectionContext(injector, () => m.parserRequestGuard()),
  );
};

/** Same for the Retirement library's `retirementAvailableGuard` (form and import screens). */
const lazyRetirementAvailableGuard: CanActivateFn = () => {
  const injector = inject(EnvironmentInjector);
  return import('@vaultfolio/frontend-domain-retirement').then((m) =>
    runInInjectionContext(injector, () => m.retirementAvailableGuard()),
  );
};

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
      // Declared before `earnings` so the literal segment wins: the import screen is a sibling
      // page of the area (own header title, no toolbar/tabs), blocked while the key is unavailable.
      {
        path: 'earnings/import/request',
        title: 'pageTitle.earningsRequest',
        canActivate: [domainGuard('earnings'), lazyEarningsAvailableGuard, lazyParserRequestGuard],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-earnings').then((m) => m.ParserRequestComponent),
      },
      {
        path: 'earnings/import',
        title: 'pageTitle.earningsImport',
        canActivate: [domainGuard('earnings'), lazyEarningsAvailableGuard],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-earnings').then((m) => m.EarningsImportComponent),
      },
      {
        path: 'earnings',
        title: 'pageTitle.earnings',
        canActivate: [domainGuard('earnings')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-earnings').then((m) => m.EarningsAreaComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            title: 'pageTitle.earningsOverview',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-earnings').then(
                (m) => m.EarningsOverviewComponent,
              ),
          },
          {
            path: 'tables',
            title: 'pageTitle.earningsTables',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-earnings').then((m) => m.EarningsTablesComponent),
          },
          {
            path: 'check',
            title: 'pageTitle.earningsCheck',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-earnings').then(
                (m) => m.EarningsDataCheckComponent,
              ),
          },
          {
            path: 'imports',
            title: 'pageTitle.earningsImports',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-earnings').then(
                (m) => m.EarningsImportsComponent,
              ),
          },
        ],
      },
      {
        path: 'retirement/import',
        title: 'pageTitle.retirementImport',
        canActivate: [domainGuard('retirement'), lazyRetirementAvailableGuard],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-retirement').then((m) => m.RetirementImportComponent),
      },
      {
        path: 'retirement/new',
        title: 'pageTitle.retirementNew',
        canActivate: [domainGuard('retirement'), lazyRetirementAvailableGuard],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-retirement').then((m) => m.RecordFormComponent),
      },
      {
        path: 'retirement/new/:type',
        title: 'pageTitle.retirementNew',
        canActivate: [domainGuard('retirement'), lazyRetirementAvailableGuard],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-retirement').then((m) => m.RecordFormComponent),
      },
      {
        path: 'retirement/:id/edit',
        title: 'pageTitle.retirementEdit',
        canActivate: [domainGuard('retirement'), lazyRetirementAvailableGuard],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-retirement').then((m) => m.RecordFormComponent),
      },
      {
        path: 'retirement',
        title: 'pageTitle.retirement',
        canActivate: [domainGuard('retirement')],
        loadComponent: () =>
          import('@vaultfolio/frontend-domain-retirement').then((m) => m.RetirementAreaComponent),
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'overview' },
          {
            path: 'overview',
            title: 'pageTitle.retirementOverview',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-retirement').then((m) => m.OverviewComponent),
          },
          {
            path: 'statutory',
            title: 'pageTitle.retirementStatutory',
            data: { pillar: 'STATUTORY' },
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-retirement').then((m) => m.PillarComponent),
          },
          {
            path: 'occupational',
            title: 'pageTitle.retirementOccupational',
            data: { pillar: 'OCCUPATIONAL' },
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-retirement').then((m) => m.PillarComponent),
          },
          {
            path: 'private',
            title: 'pageTitle.retirementPrivate',
            data: { pillar: 'PRIVATE' },
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-retirement').then((m) => m.PillarComponent),
          },
          {
            path: 'info',
            title: 'pageTitle.retirementInfo',
            loadComponent: () =>
              import('@vaultfolio/frontend-domain-retirement').then(
                (m) => m.RetirementInfoComponent,
              ),
          },
        ],
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
            path: 'requests',
            title: 'pageTitle.adminRequests',
            loadComponent: () =>
              import('@vaultfolio/frontend-admin').then((m) => m.RequestsComponent),
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
