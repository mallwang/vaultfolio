import { Injectable, computed, inject, linkedSignal } from '@angular/core';
import { isDomainEntitled } from '@vaultfolio/frontend-domain-access';
import { CurrentUserStore } from '../auth/current-user.store';
import {
  parseDashboardLayout,
  reorderVisible,
  resolveTiles,
  type DashboardLayout,
  type DashboardTile,
  type DashboardTileDefinition,
} from './dashboard-layout';
import { DASHBOARD_WIDGET_CONTRIBUTIONS } from './dashboard-widgets.registry';

const STORAGE_KEY_PREFIX = 'vaultfolio.dashboard-layout.';

/** The tiles that are not contributed by a domain library (still "coming soon" shells). */
const STATIC_TILES: DashboardTileDefinition[] = [
  {
    id: 'totalValue',
    titleKey: 'dashboard.totalValue',
    source: { kind: 'placeholder', icon: 'wallet', bodyKey: 'dashboard.totalValueBody' },
    entitled: true,
  },
  {
    id: 'todaysChange',
    titleKey: 'dashboard.todaysChange',
    source: { kind: 'placeholder', icon: 'trending-up', bodyKey: 'dashboard.todaysChangeBody' },
    entitled: true,
  },
];

/**
 * The user's Dashboard arrangement (tile order + switched-off tiles), kept in this browser's
 * `localStorage` — per signed-in user, so several accounts on one device do not share a layout.
 * Nothing is sent to the server.
 */
@Injectable({ providedIn: 'root' })
export class DashboardLayoutStore {
  private readonly currentUser = inject(CurrentUserStore);

  private readonly storageKey = computed(() => {
    const user = this.currentUser.current();
    return user ? STORAGE_KEY_PREFIX + user.id : null;
  });

  private readonly layout = linkedSignal<DashboardLayout>(() =>
    parseDashboardLayout(this.read(this.storageKey())),
  );

  /** Every tile in the user's order, including switched-off ones and ones the account lacks. */
  readonly tiles = computed<DashboardTile[]>(() => {
    const user = this.currentUser.current();
    const catalog: DashboardTileDefinition[] = [
      ...STATIC_TILES,
      ...DASHBOARD_WIDGET_CONTRIBUTIONS.map((widget) => ({
        id: widget.domainId,
        titleKey: widget.titleKey,
        source: { kind: 'widget', widget } as const,
        entitled: isDomainEntitled(user, widget.domainId),
      })),
    ];
    return resolveTiles(catalog, this.layout());
  });

  /** What the Dashboard grid renders. */
  readonly visibleTiles = computed(() => this.tiles().filter((tile) => !tile.hidden));

  moveVisible(fromIndex: number, toIndex: number): void {
    this.save({
      order: reorderVisible(this.tiles(), fromIndex, toIndex),
      hidden: this.layout().hidden,
    });
  }

  setTileVisible(id: string, visible: boolean): void {
    const hidden = this.layout().hidden.filter((hiddenId) => hiddenId !== id);
    if (!visible) hidden.push(id);
    this.save({ order: this.tiles().map((tile) => tile.id), hidden });
  }

  /** `true` once the user has reordered or switched off anything. */
  readonly isCustomized = computed(() => {
    const { order, hidden } = this.layout();
    return order.length > 0 || hidden.length > 0;
  });

  reset(): void {
    this.save({ order: [], hidden: [] });
  }

  private save(layout: DashboardLayout): void {
    this.layout.set(layout);
    const key = this.storageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(layout));
    } catch {
      // Storage unavailable (private mode, quota): the layout still applies for this session.
    }
  }

  private read(key: string | null): string | null {
    if (!key) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}
