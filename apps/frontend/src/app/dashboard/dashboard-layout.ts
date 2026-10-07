import type { DashboardWidgetContribution } from '@vaultfolio/frontend-domain-access';

/** One entry of the tile catalog — a domain's contributed widget the user has access to. */
export interface DashboardTileDefinition {
  /** Stable id, persisted in the browser's layout. */
  id: string;
  titleKey: string;
  /** The domain that owns the tile; its maintenance mode replaces the tile's content. */
  domainId: string;
  widget: DashboardWidgetContribution;
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
  return ordered.map((tile) => ({ ...tile, hidden: hidden.has(tile.id) }));
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
