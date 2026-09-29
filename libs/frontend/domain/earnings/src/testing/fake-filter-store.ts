import { computed, signal } from '@angular/core';
import type { EarningsOverview } from '@vaultfolio/api-contract';

/** Minimal stand-in for `EarningsFilterStore` in tab specs. */
export function fakeFilterStore(overview: EarningsOverview | null = null) {
  const employerId = signal<string | null>(null);
  const version = signal(0);
  const current = signal(overview);
  return {
    employerId,
    overview: current,
    query: computed(() => ({ employerId: employerId(), version: version() })),
    hasData: computed(() => current()?.hasData ?? null),
    dataCheckIssues: computed(() => current()?.dataCheckIssues ?? 0),
    reload: () => version.update((v) => v + 1),
  };
}
