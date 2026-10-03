import type { DashboardWidgetContribution } from '@vaultfolio/frontend-domain-access';

/** What a tile shows: a fixed "coming soon" shell, or a domain's contributed widget. */
type DashboardTileSource =
  | { kind: 'placeholder'; icon: string; bodyKey: string }
  | { kind: 'widget'; widget: DashboardWidgetContribution };

/** One entry of the full tile catalog — every tile the Dashboard can ever show. */
export interface DashboardTileDefinition {
  /** Stable id, persisted in the browser's layout. Widgets use their `domainId`. */
  id: string;
  titleKey: string;
  source: DashboardTileSource;
  /** `false` when the user's account has no access to the tile's domain (feature disabled). */
  entitled: boolean;
}

/** The user's persisted preference: tile order plus the tiles they switched off. */
export interface DashboardLayout {
  order: string[];
  hidden: string[];
}

const EMPTY_DASHBOARD_LAYOUT: DashboardLayout = { order: [], hidden: [] };

/** A catalog tile placed in the user's order, with the user's own visibility choice. */
export interface DashboardTile extends DashboardTileDefinition {
  hidden: boolean;
}

/**
 * Puts the catalog into the user's saved order. Tiles the layout does not know yet (e.g. a newly
 * shipped widget) go to the end; ids in the layout that are no longer in the catalog are ignored.
 * A tile the account is not entitled to stays in its slot (the template renders a placeholder
 * there) so the layout survives a domain being switched off and on again.
 */
export function resolveTiles(
  catalog: DashboardTileDefinition[],
  layout: DashboardLayout,
): DashboardTile[] {
  const byId = new Map(catalog.map((tile) => [tile.id, tile]));
  const ordered: DashboardTileDefinition[] = [];
  for (const id of layout.order) {
    const tile = byId.get(id);
    if (tile) {
      ordered.push(tile);
      byId.delete(id);
    }
  }
  ordered.push(...byId.values());
  const hidden = new Set(layout.hidden);
  // An entitlement-less tile cannot be switched off by the user, so a stale "hidden" flag from
  // before the domain was disabled must not hide its placeholder.
  return ordered.map((tile) => ({ ...tile, hidden: tile.entitled && hidden.has(tile.id) }));
}

/** Full order after moving a visible tile; hidden tiles keep their slots. */
export function reorderVisible(
  tiles: DashboardTile[],
  fromVisibleIndex: number,
  toVisibleIndex: number,
): string[] {
  const visible = tiles.filter((tile) => !tile.hidden).map((tile) => tile.id);
  if (
    fromVisibleIndex === toVisibleIndex ||
    fromVisibleIndex < 0 ||
    fromVisibleIndex >= visible.length ||
    toVisibleIndex < 0 ||
    toVisibleIndex >= visible.length
  ) {
    return tiles.map((tile) => tile.id);
  }
  const [moved] = visible.splice(fromVisibleIndex, 1);
  visible.splice(toVisibleIndex, 0, moved);
  let next = 0;
  return tiles.map((tile) => (tile.hidden ? tile.id : visible[next++]));
}

/** Validates untrusted JSON read from `localStorage`. */
export function parseDashboardLayout(raw: string | null): DashboardLayout {
  if (!raw) return EMPTY_DASHBOARD_LAYOUT;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return EMPTY_DASHBOARD_LAYOUT;
    const { order, hidden } = data as Record<string, unknown>;
    return { order: stringList(order), hidden: stringList(hidden) };
  } catch {
    return EMPTY_DASHBOARD_LAYOUT;
  }
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}
