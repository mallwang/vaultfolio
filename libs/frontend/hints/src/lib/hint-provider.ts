import type { Signal, Type } from '@angular/core';
import type { Hint } from './hint.js';

export interface HintProvider {
  readonly hints: Signal<readonly Hint[]>;
  readonly ready: Signal<boolean>;
  load(): void;
  refresh?(): void;
}

export interface HintProviderContribution {
  sourceId: string;
  domainId?: string;
  groupLabelKey: string;
  loadProvider: () => Promise<Type<HintProvider>>;
}
