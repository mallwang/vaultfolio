import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import { type Period, filterPeriod, sortedByDate } from '@vaultfolio/wealth';
import { WealthService } from './wealth.service';

/**
 * Shared state of the wealth area: every snapshot of the caller (ascending by date), the class
 * group settings and the period filter, so the tabs, the form and the export all read the same
 * data (SC-005). `refresh()` reloads both after a write; a failure leaves the previous data in
 * place and sets `loadFailed` (a 503 additionally flips `WealthService.unavailable`).
 */
@Injectable({ providedIn: 'root' })
export class WealthStore {
  private readonly service = inject(WealthService);

  private readonly _snapshots = signal<WealthSnapshot[]>([]);
  private readonly _settings = signal<WealthSettings>({ classGroups: [] });
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);
  private readonly _loadFailed = signal(false);

  readonly snapshots = this._snapshots.asReadonly();
  readonly settings = this._settings.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadFailed = this._loadFailed.asReadonly();
  readonly period = signal<Period>('all');

  /** Snapshots within the chosen period, ascending. */
  readonly periodSnapshots = computed(() => filterPeriod(this._snapshots(), this.period()));

  /** Loads once; later callers get the cached data. */
  ensureLoaded(): void {
    if (!this._loaded() && !this._loading()) this.refresh();
  }

  refresh(): void {
    this._loading.set(true);
    forkJoin({ snapshots: this.service.snapshots(), settings: this.service.settings() }).subscribe({
      next: ({ snapshots, settings }) => {
        this._snapshots.set(sortedByDate(snapshots));
        this._settings.set(settings);
        this._loaded.set(true);
        this._loadFailed.set(false);
        this._loading.set(false);
      },
      error: () => {
        this._loadFailed.set(true);
        this._loading.set(false);
      },
    });
  }

  setSettings(settings: WealthSettings): void {
    this._settings.set(settings);
  }
}
