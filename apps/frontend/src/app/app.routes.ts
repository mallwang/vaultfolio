import { Routes } from '@angular/router';
import { NotFoundComponent } from './core/layout/not-found/not-found.component';

/**
 * Route table (contracts/application-areas.md): one route per
 * APPLICATION_AREAS entry, lazy-loaded; '/' redirects to '/dashboard'; a
 * trailing wildcard renders NotFoundComponent inside the persistent shell
 * (FR-004, FR-006).
 */
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'holdings',
    loadComponent: () => import('./holdings/holdings.component').then((m) => m.HoldingsComponent),
  },
  {
    path: 'imports',
    loadComponent: () => import('./imports/imports.component').then((m) => m.ImportsComponent),
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '**', component: NotFoundComponent },
];
