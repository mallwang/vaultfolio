import { Routes } from '@angular/router';
import { NotFoundComponent } from './core/layout/not-found/not-found.component';
import { authGuard } from './auth/auth.guard';

/**
 * Route table (contracts/application-areas.md): one route per
 * APPLICATION_AREAS entry, lazy-loaded; '/' redirects to '/dashboard'; a
 * trailing wildcard renders NotFoundComponent inside the persistent shell
 * (FR-004, FR-006). `/sign-in` is the one public route
 * (005-auth-sessions-isolation); every other route carries `authGuard`.
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'sign-in',
    loadComponent: () => import('./auth/sign-in/sign-in.component').then((m) => m.SignInComponent),
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
