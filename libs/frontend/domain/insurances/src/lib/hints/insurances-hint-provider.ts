import { Injectable, Signal, computed, inject } from '@angular/core';
import type { Hint, HintProvider } from '@vaultfolio/frontend-hints';
import { InsurancesStore } from '../insurances-store';

/** Yields one warning per redundant (overlapping) contract pair. */
@Injectable({ providedIn: 'root' })
export class InsurancesHintProvider implements HintProvider {
  private readonly store = inject(InsurancesStore);

  readonly hints: Signal<readonly Hint[]> = computed(() => {
    if (!this.store.loaded()) return [];
    const nameOf = (id: string) => this.store.contracts().find((c) => c.id === id)?.name ?? id;
    return this.store.gaps().redundant.map((item) => ({
      id: `insurances.redundant.${item.contractId}.${item.otherContractId}`,
      severity: 'warning' as const,
      titleKey: 'hints.insurances.redundant.title',
      descriptionKey: 'hints.insurances.redundant.description',
      params: {
        contractName: nameOf(item.contractId),
        otherContractName: nameOf(item.otherContractId),
      },
      target: { commands: ['/app', 'insurances', 'gap-check'] },
      linkLabelKey: 'hints.insurances.redundant.linkLabel',
    }));
  });

  /** `true` once the first load settles (success or failure). */
  readonly ready: Signal<boolean> = computed(() => this.store.loaded() || this.store.loadFailed());

  load(): void {
    this.store.ensureLoaded();
  }

  refresh(): void {
    this.store.refresh();
  }
}
