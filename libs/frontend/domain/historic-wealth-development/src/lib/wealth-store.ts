import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { forkJoin } from 'rxjs';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import { type Period, filterPeriod, sortedByDate } from '@vaultfolio/wealth';
import { WealthService } from './wealth.service';

/**
 * Shared state of the wealth area: every snapshot of the caller (ascending by date), the class
 * group settings and the period filter, so the tabs, the form and the export all read the same
 * data (SC-005). `refresh()` reloads both after a write; a failure leaves the previous data in
 * place and sets `loadFailed` (a 503 additionally flips `WealthService.unavailable`).
 *
 * The store is an app-wide singleton that outlives sign-out, so it drops everything whenever the
 * signed-in user changes — otherwise the next account would briefly see the previous one's data.
 */
@Injectable({ providedIn: 'root' })
export class WealthStore {
  private readonly service = inject(WealthService);
  private readonly currentUser = inject(CURRENT_USER_SOURCE);
  /** Bumped on every reset so a response still in flight for the previous user is discarded. */
  private generation = 0;

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

  constructor() {
    // Captured synchronously: the effect first runs after the creating component's
    // `ensureLoaded()`, and must not discard that load.
    let lastUserId = this.currentUser.current()?.id;
    effect(() => {
      const userId = this.currentUser.current()?.id;
      if (userId !== lastUserId) {
        lastUserId = userId;
        untracked(() => this.reset());
      }
    });
  }

  /** Snapshots within the chosen period, ascending. */
  readonly periodSnapshots = computed(() => filterPeriod(this._snapshots(), this.period()));

  /** Loads once; later callers get the cached data. */
  ensureLoaded(): void {
    if (!this._loaded() && !this._loading()) this.refresh();
  }

  private reset(): void {
    this.generation++;
    this._snapshots.set([]);
    this._settings.set({ classGroups: [] });
    this._loaded.set(false);
    this._loading.set(false);
    this._loadFailed.set(false);
    this.period.set('all');
  }

  refresh(): void {
    const generation = this.generation;
    this._loading.set(true);
    forkJoin({ snapshots: this.service.snapshots(), settings: this.service.settings() }).subscribe({
      next: ({ snapshots, settings }) => {
        if (generation !== this.generation) return;
        this._snapshots.set(sortedByDate(snapshots));
        this._settings.set(settings);
        this._loaded.set(true);
        this._loadFailed.set(false);
        this._loading.set(false);
      },
      error: () => {
        if (generation !== this.generation) return;
        this._loadFailed.set(true);
        this._loading.set(false);
      },
    });
  }

  setSettings(settings: WealthSettings): void {
    this._settings.set(settings);
  }
}
