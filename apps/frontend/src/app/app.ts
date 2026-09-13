import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { AppHeaderComponent } from './core/layout/app-header/app-header.component';

/**
 * Root component: renders `AppHeaderComponent` unconditionally, followed by
 * a bare `router-outlet`, for every route — public and authenticated alike
 * (research.md #1, FR-001). The header itself reads Auth Status to decide
 * what (if anything) identity-specific to show; the sidebar only ever
 * renders inside `AppShellComponent`, which is now reached solely via the
 * `app` parent route (see app.routes.ts), not from here.
 *
 * A single app-wide `<p-toast>` lives here (backed by the root-provided
 * `MessageService`, app.config.ts) so `httpErrorInterceptor` and
 * `GlobalErrorHandler` (specs/030-observability-logging-error-handling, US3)
 * can show a fallback notification from anywhere, including routes that
 * don't render their own toast.
 */
@Component({
  imports: [AppHeaderComponent, RouterOutlet, ToastModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
