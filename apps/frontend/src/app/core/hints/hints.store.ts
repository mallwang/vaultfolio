import {
  Injectable,
  Injector,
  Signal,
  computed,
  inject,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import {
  type Hint,
  type HiddenHintState,
  type HintProvider,
  type HintView,
  hide,
  parseHiddenState,
  restore,
  viewOf,
} from '@vaultfolio/frontend-hints';
import { isDomainEntitled } from '@vaultfolio/frontend-domain-access';
import { filter, throttleTime } from 'rxjs';
import { CurrentUserStore } from '../../auth/current-user.store';
import { DomainMaintenanceStore } from '../maintenance/domain-maintenance.store';
import { HINT_PROVIDER_CONTRIBUTIONS } from './hint-providers.registry';
import { HintsStorage } from './hints-storage';

interface LoadedProvider {
  sourceId: string;
  domainId?: string;
  groupLabelKey: string;
  instance: HintProvider;
}

/**
 * Orchestrates provider lifecycle (load on sign-in, refresh on
 * NavigationEnd throttled 60 s, on panel open) and computes the combined
 * hint view. Hide/restore actions mutate hidden state and persist it.
 * Providers with a `domainId` are skipped when the domain is not entitled
 * or is in maintenance (T027).
 */
@Injectable({ providedIn: 'root' })
export class HintsStore {
  private readonly router = inject(Router);
  private readonly currentUser = inject(CurrentUserStore);
  private readonly maintenance = inject(DomainMaintenanceStore);
  private readonly storage = inject(HintsStorage);
  private readonly injector = inject(Injector);
  private readonly contributions = inject(HINT_PROVIDER_CONTRIBUTIONS);

  private readonly providers = signal<readonly LoadedProvider[]>([]);
  private readonly hiddenState = signal<HiddenHintState>(parseHiddenState(null));
  private lastRefresh = 0;

  /** Active + hidden hints, badge and dot derived from all providers. */
  readonly view: Signal<HintView> = computed(() => {
    const allHints: Hint[] = [];
    for (const p of this.providers()) {
      try {
        allHints.push(...p.instance.hints());
      } catch {
        // ponytail: failure isolation — one bad provider contributes nothing
      }
    }
    return viewOf(allHints, this.hiddenState());
  });

  /** Load all entitled, non-maintenance providers for the current user. Call on sign-in. */
  async load(): Promise<void> {
    const user = this.currentUser.current();
    if (!user) return;

    this.hiddenState.set(this.storage.load());

    const results = await Promise.all(
      this.contributions.map(async (contrib): Promise<LoadedProvider | null> => {
        // T027: skip domains the user is not entitled to or that are in maintenance
        if (contrib.domainId) {
          if (!isDomainEntitled(user, contrib.domainId)) return null;
          if (this.maintenance.isInMaintenance(contrib.domainId)) return null;
        }
        try {
          const ProviderClass = await contrib.loadProvider();
          const instance = runInInjectionContext(this.injector, () =>
            inject(ProviderClass),
          ) as HintProvider;
          instance.load();
          return {
            sourceId: contrib.sourceId,
            domainId: contrib.domainId,
            groupLabelKey: contrib.groupLabelKey,
            instance,
          };
        } catch {
          // ponytail: one failing provider import must not block others
          return null;
        }
      }),
    );
    this.providers.set(results.filter((p): p is LoadedProvider => p !== null));
    try {
      this.watchNavigation();
    } catch {
      // injector destroyed while providers were loading (sign-out/teardown): nothing to watch
    }
  }

  /** Refresh all loaded providers (throttled to once per 60 s). */
  refresh(): void {
    const now = Date.now();
    if (now - this.lastRefresh < 60_000) return;
    this.lastRefresh = now;
    for (const p of this.providers()) {
      try {
        p.instance.refresh?.();
      } catch {
        /* isolation */
      }
    }
  }

  /** Force refresh (e.g. on panel open) regardless of throttle. */
  forceRefresh(): void {
    this.lastRefresh = 0;
    this.refresh();
  }

  hide(hintId: string): void {
    const hint = [...this.view().active, ...this.view().hidden].find((h) => h.id === hintId);
    if (!hint) return;
    const sourceId =
      this.providers().find((p) => {
        try {
          return p.instance.hints().some((h: Hint) => h.id === hintId);
        } catch {
          return false;
        }
      })?.sourceId ?? '';
    const next = hide(this.hiddenState(), hint, sourceId);
    this.hiddenState.set(next);
    this.storage.save(next);
  }

  restore(hintId: string): void {
    const next = restore(this.hiddenState(), hintId);
    this.hiddenState.set(next);
    this.storage.save(next);
  }

  reset(): void {
    this.providers.set([]);
    this.hiddenState.set(parseHiddenState(null));
  }

  private watchNavigation(): void {
    runInInjectionContext(this.injector, () => {
      const nav$ = this.router.events.pipe(
        filter((e) => e instanceof NavigationEnd),
        throttleTime(60_000),
      );
      toSignal(nav$, { initialValue: null });
      nav$.subscribe(() => this.refresh());
    });
  }
}
