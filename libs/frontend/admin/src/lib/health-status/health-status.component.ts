import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import type { HealthStatus } from '@vaultfolio/api-contract';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import {
  APP_VERSION,
  IconComponent,
  LocaleDateTimePipe,
  TranslatePipe,
} from '@vaultfolio/frontend-shared-ui';

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
  imports: [
    TableModule,
    TagModule,
    MessageModule,
    TranslatePipe,
    LocaleDateTimePipe,
    IconComponent,
  ],
  providers: [TranslatePipe],
  template: `
    <section class="health-status">
      <h2>{{ 'healthStatus.title' | translate }}</h2>
      @if (health(); as result) {
        <p data-testid="admin-health-checked-at">
          {{ 'healthStatus.checkedAt' | translate }} {{ result.timestamp | localeDateTime }}
        </p>
      }
      @if (health(); as result) {
        <p-table [value]="[1]" [tableStyle]="{ 'min-width': '30rem' }">
          <ng-template #header>
            <tr>
              <th scope="col">{{ 'healthStatus.columnCategory' | translate }}</th>
              <th scope="col">{{ 'healthStatus.columnStatus' | translate }}</th>
            </tr>
          </ng-template>
          <ng-template #body>
            @if (appVersion) {
              <tr data-testid="admin-app-version">
                <td>{{ 'healthStatus.version' | translate }}</td>
                <td>
                  <strong>v{{ appVersion }}</strong>
                </td>
              </tr>
            }
            <tr>
              <td>{{ 'healthStatus.backend' | translate }}</td>
              <td>
                <p-tag
                  [severity]="result.status === 'ok' ? 'success' : 'danger'"
                  [value]="
                    result.status === 'ok'
                      ? ('healthStatus.statusOk' | translate)
                      : ('healthStatus.statusDegraded' | translate)
                  "
                />
              </td>
            </tr>
            <tr>
              <td>{{ 'healthStatus.database' | translate }}</td>
              <td>
                <p-tag
                  [severity]="result.database === 'connected' ? 'success' : 'danger'"
                  [value]="
                    result.database === 'connected'
                      ? ('healthStatus.databaseConnected' | translate)
                      : ('healthStatus.databaseUnreachable' | translate)
                  "
                />
              </td>
            </tr>
          </ng-template>
        </p-table>
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
    </section>
  `,
  styles: `
    :host {
      display: block;
      max-width: 1100px;
      margin: 0 auto;
    }

    .health-status {
      display: block;
    }

    .health-status p-table {
      display: block;
      margin-top: 1rem;
    }
  `,
})
export class HealthStatusComponent {
  private readonly http = inject(HttpClient);
  private readonly translate = inject(TranslatePipe);
  protected readonly appVersion = inject(APP_VERSION);

  protected readonly health = signal<HealthStatus | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.http.get<HealthStatus>('/api/health').subscribe({
      next: (result) => this.health.set(result),
      error: () => this.error.set(this.translate.transform('healthStatus.error')),
    });
  }
}
