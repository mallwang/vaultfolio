import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import type { HealthStatus } from '@vaultfolio/api-contract';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { IconComponent, LocaleDateTimePipe, TranslatePipe } from '@vaultfolio/frontend-shared-ui';

/**
 * Minimal page that calls GET /health and renders the result — proves the
 * frontend/backend/database tiers are wired together end-to-end (FR-002,
 * FR-003, User Story 1 Acceptance Scenario 2).
 *
 * Calls a relative `/api/health` path, which nginx
 * (docker/frontend.nginx.conf) proxies to the backend container. This is a
 * browser-side request, not a container-to-container one, so it must go
 * through the same origin the page was served from rather than a hostname
 * only the container network knows.
 *
 * Inline template/styles, not templateUrl/styleUrl (020, 021): this
 * component is consumed cross-package (`apps/frontend/src/app.routes.ts`
 * lazy-loads it as the Admin area's "General" tab), and
 * `@angular/build:unit-test` externalizes every workspace-linked package
 * during its build step, skipping Angular's own resource-inlining there —
 * see `IconComponent`'s identical note in `@vaultfolio/frontend-shared-ui`.
 */
@Component({
  selector: 'app-health-status',
  imports: [CardModule, TagModule, MessageModule, TranslatePipe, LocaleDateTimePipe, IconComponent],
  providers: [TranslatePipe],
  template: `
    <p-card [header]="'healthStatus.title' | translate">
      @if (health(); as result) {
        <div class="health-status__row">
          <p-tag
            [severity]="result.status === 'ok' ? 'success' : 'danger'"
            [value]="
              ('healthStatus.backend' | translate) +
              ': ' +
              (result.status === 'ok'
                ? ('healthStatus.statusOk' | translate)
                : ('healthStatus.statusDegraded' | translate))
            "
          />
          <p-tag
            [severity]="result.database === 'connected' ? 'success' : 'danger'"
            [value]="
              ('healthStatus.database' | translate) +
              ': ' +
              (result.database === 'connected'
                ? ('healthStatus.databaseConnected' | translate)
                : ('healthStatus.databaseUnreachable' | translate))
            "
          />
        </div>
        <p class="health-status__timestamp">
          {{ 'healthStatus.checkedAt' | translate }} {{ result.timestamp | localeDateTime }}
        </p>
      } @else if (error()) {
        <p-message severity="error">
          <ng-template #icon><app-icon name="warning" /></ng-template>
          {{ error() }}
        </p-message>
      } @else {
        <p-message severity="secondary">
          <ng-template #icon><app-icon name="spinner" [spin]="true" /></ng-template>
          {{ 'healthStatus.checking' | translate }}
        </p-message>
      }
    </p-card>
  `,
  styles: `
    :host {
      display: block;
      max-width: 640px;
      margin: 0 auto;
    }

    .health-status__row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .health-status__timestamp {
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
      margin: 0.75rem 0 0;
    }
  `,
})
export class HealthStatusComponent {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslatePipe);

  protected readonly health = signal<HealthStatus | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.http.get<HealthStatus>('/api/health').subscribe({
      next: (result) => this.health.set(result),
      error: () => this.error.set(this.translate.transform('healthStatus.error')),
    });
  }
}
