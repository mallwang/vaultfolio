import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import type { HealthStatus } from 'api-contract';

/**
 * Minimal page that calls GET /health and renders the result — proves the
 * frontend/backend/database tiers are wired together end-to-end (FR-002,
 * FR-003, User Story 1 Acceptance Scenario 2).
 *
 * The backend is reached at the host-mapped port from docker-compose.yml
 * (http://localhost:3000), since this is a browser-side request, not a
 * container-to-container one.
 */
@Component({
  selector: 'app-health-status',
  templateUrl: './health-status.component.html',
  styleUrl: './health-status.component.css',
})
export class HealthStatusComponent {
  private readonly http = inject(HttpClient);

  protected readonly health = signal<HealthStatus | null>(null);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.http.get<HealthStatus>('http://localhost:3000/health').subscribe({
      next: (result) => this.health.set(result),
      error: () => this.error.set('Unable to reach the backend health check.'),
    });
  }
}
