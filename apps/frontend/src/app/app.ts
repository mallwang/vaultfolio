import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';

/**
 * Root component: renders `AppShellComponent` (sidebar+header+router-outlet)
 * for every route except `/invite/*` (006, User Story 2), which is
 * invitee-facing and signed-out — design.md explicitly requires those pages
 * to render with no app shell, so they get a bare `router-outlet` instead.
 * `/sign-in` still renders inside the shell — that's a pre-existing gap
 * (005), not something this feature changes.
 */
@Component({
  imports: [AppShellComponent, RouterOutlet],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected title = 'frontend';

  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  protected readonly shellless = computed(() => this.url().startsWith('/invite/'));
}
