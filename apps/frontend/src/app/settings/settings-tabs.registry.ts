import type { SettingsTabContribution } from '@vaultfolio/frontend-domain-access';

/**
 * Every Settings tab contributed by a domain library (FR-002). Empty for
 * this spec — no domain besides holdings is built here, and holdings itself
 * contributes only a dashboard widget, not a settings tab (Assumptions,
 * data-model.md). A future domain adds one entry here — nothing else in
 * `SettingsComponent`/`app.routes.ts` needs to change beyond that.
 */
export const SETTINGS_TAB_CONTRIBUTIONS: SettingsTabContribution[] = [];
