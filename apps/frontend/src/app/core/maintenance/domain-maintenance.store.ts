import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import type { DomainMaintenanceListResponse } from '@vaultfolio/api-contract';
import { catchError, map, of, type Observable } from 'rxjs';
import { CurrentUserStore } from '../../auth/current-user.store';

/**
 * Which domains are in maintenance (041-domain-maintenance-mode), as one list loaded per page load
 * (and once per signed-in user). No polling or push: a change shows up on the next page load, or
 * when a request answers `503 DOMAIN_MAINTENANCE` (see `httpErrorInterceptor`). A failed load
 * leaves the list empty, so a backend hiccup never blocks the app.
 */
@Injectable({ providedIn: 'root' })
export class DomainMaintenanceStore {
  private readonly http = inject(HttpClient);
  private readonly currentUser = inject(CurrentUserStore);

  private readonly ids = signal<readonly string[]>([]);
  private readonly loadedState = signal(false);
  private loadedFor: string | null = null;

  /** `true` once the list has been fetched (successfully or not) for the current user. */
  readonly loaded = this.loadedState.asReadonly();

  /** Reads a signal, so it is safe inside `computed`/templates. */
  isInMaintenance(domainId: string): boolean {
    return this.ids().includes(domainId);
  }

  /** Loads the list unless it was already loaded for the signed-in user. */
  ensureLoaded(): void {
    const userId = this.currentUser.current()?.id ?? null;
    if (userId === null || userId === this.loadedFor) return;
    this.refresh();
  }

  refresh(): void {
    this.loadedFor = this.currentUser.current()?.id ?? null;
    this.fetch().subscribe((ids) => {
      this.ids.set(ids);
      this.loadedState.set(true);
    });
  }

  private fetch(): Observable<string[]> {
    return this.http.get<DomainMaintenanceListResponse>('/api/domains/maintenance').pipe(
      map((response) => response.domains),
      catchError(() => of<string[]>([])),
    );
  }
}
