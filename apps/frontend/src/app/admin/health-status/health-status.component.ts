import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import type { HealthStatus } from '@vaultfolio/api-contract';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { TagModule } from 'primeng/tag';
import { IconComponent } from '../../shared/icon/icon.component';
import { TranslatePipe } from '../../core/i18n/translate.pipe';

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
 */
@Component({
  selector: 'app-health-status',
  imports: [CardModule, TagModule, MessageModule, TranslatePipe, IconComponent],
  providers: [TranslatePipe],
  templateUrl: './health-status.component.html',
  styleUrl: './health-status.component.css',
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
