import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppSidebarComponent } from '../app-sidebar/app-sidebar.component';

/**
 * Authenticated layout: sidebar + routed content, per the two-region layout
 * in design.md's ASCII diagram (FR-004). Used only as the `component` of
 * the `app` parent route (app.routes.ts), which already carries `authGuard`
 * — so this only ever renders once the visitor is signed in. The header now
 * lives at the application root (`App`, research.md #1), not here.
 */
@Component({
  selector: 'app-shell',
  imports: [AppSidebarComponent, RouterOutlet],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {}
