import { InjectionToken } from '@angular/core';

/** Where a dashboard tile's expanded/collapsed state lives; provided by the app's dashboard. */
export interface DashboardTileExpansion {
  /** Reads a signal, so templates and computeds re-evaluate when the state changes. */
  isExpanded(tileId: string): boolean;
  setExpanded(tileId: string, expanded: boolean): void;
}

export const DASHBOARD_TILE_EXPANSION = new InjectionToken<DashboardTileExpansion>(
  'DASHBOARD_TILE_EXPANSION',
);
