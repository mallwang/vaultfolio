import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import type {
  InsuranceContract,
  InsuranceLinkedSocialLine,
  InsuranceSettings,
  InsurancesData,
} from '@vaultfolio/api-contract';
import { CURRENT_USER_SOURCE } from '@vaultfolio/frontend-domain-access';
import {
  DEFAULT_SETTINGS,
  type GapResult,
  type Summary,
  checkGaps,
  effectiveSocialLines,
  summarize,
} from '@vaultfolio/insurances';
import { InsurancesService } from './insurances.service';

const DEFAULT_WARN_DAYS = 30;

function emptyData(): InsurancesData {
  return {
    contracts: [],
    linkedSocial: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    today: new Date().toISOString().slice(0, 10),
  };
}

/**
 * Shared state of the insurances area: contracts, linked social lines, settings and server date,
 * plus every derived view (summary, gap check) computed with `@vaultfolio/insurances`, so the tabs,
 * the dashboard tile and the export read the same figures. `refresh()` reloads after a write; a
 * failure keeps the previous data and sets `loadFailed` (a 503 also flips
 * `InsurancesService.unavailable`).
 *
 * The store outlives sign-out, so it drops everything whenever the signed-in user changes.
 */
@Injectable({ providedIn: 'root' })
export class InsurancesStore {
  private readonly service = inject(InsurancesService);
  private readonly currentUser = inject(CURRENT_USER_SOURCE);
  /** Bumped on every reset so a response still in flight for the previous user is discarded. */
  private generation = 0;

  private readonly _data = signal<InsurancesData>(emptyData());
  private readonly _loaded = signal(false);
  private readonly _loading = signal(false);
  private readonly _loadFailed = signal(false);

  readonly data = this._data.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly loadFailed = this._loadFailed.asReadonly();
  readonly year = signal(new Date().getFullYear());

  readonly contracts = computed<InsuranceContract[]>(() => this._data().contracts);
  readonly settings = computed<InsuranceSettings>(() => this._data().settings);
  readonly today = computed(() => this._data().today);
  /** Linked lines not suppressed by a manual contract of the same statutory type. */
  readonly linkedSocial = computed<InsuranceLinkedSocialLine[]>(() =>
    effectiveSocialLines(this._data().contracts, this._data().linkedSocial),
  );
  /** Window for highlighting: the reminder lead time, 30 days while reminders are off. */
  readonly warnDays = computed(() => {
    const { reminders } = this.settings();
    return reminders.enabled ? reminders.leadDays : DEFAULT_WARN_DAYS;
  });

  readonly summary = computed<Summary>(() =>
    summarize({
      contracts: this.contracts(),
      linkedSocial: this._data().linkedSocial,
      includeSocial: this.settings().includeSocial,
      year: this.year(),
      today: this.today(),
      warnDays: this.warnDays(),
    }),
  );

  readonly gaps = computed<GapResult>(() =>
    checkGaps({
      contracts: this.contracts(),
      profile: this.settings().profile,
      dismissedRequirements: this.settings().dismissedRequirements,
      linkedKinds: this.linkedSocial().map((line) => line.kind),
      today: this.today(),
    }),
  );

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

  /** Loads once; later callers get the cached data. */
  ensureLoaded(): void {
    if (!this._loaded() && !this._loading()) this.refresh();
  }

  refresh(): void {
    const generation = this.generation;
    this._loading.set(true);
    this.service.data().subscribe({
      next: (data) => {
        if (generation !== this.generation) return;
        this._data.set(data);
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

  setSettings(settings: InsuranceSettings): void {
    this._data.update((data) => ({ ...data, settings }));
  }

  private reset(): void {
    this.generation++;
    this._data.set(emptyData());
    this._loaded.set(false);
    this._loading.set(false);
    this._loadFailed.set(false);
    this.year.set(new Date().getFullYear());
  }
}
