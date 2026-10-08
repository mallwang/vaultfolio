import { InjectionToken } from '@angular/core';
import type { HintProviderContribution } from '@vaultfolio/frontend-hints';

/**
 * Lazy registry — all hint source contributions declared here. Each
 * domain lib ships its provider behind a dynamic import so no domain code
 * loads until the user is signed in and the domain is entitled.
 */
export const HINT_PROVIDER_CONTRIBUTIONS = new InjectionToken<HintProviderContribution[]>(
  'HINT_PROVIDER_CONTRIBUTIONS',
  {
    providedIn: 'root',
    factory: (): HintProviderContribution[] => [
      {
        sourceId: 'feedback',
        groupLabelKey: 'hints.groups.feedback',
        loadProvider: () =>
          import('../feedback/feedback-hint-provider').then((m) => m.FeedbackHintProvider),
      },
      {
        sourceId: 'insurances',
        domainId: 'insurances',
        groupLabelKey: 'hints.groups.insurances',
        loadProvider: () =>
          import('@vaultfolio/frontend-domain-insurances').then((m) => m.InsurancesHintProvider),
      },
      {
        sourceId: 'earnings',
        domainId: 'earnings',
        groupLabelKey: 'hints.groups.earnings',
        loadProvider: () =>
          import('@vaultfolio/frontend-domain-earnings').then((m) => m.EarningsHintProvider),
      },
      {
        sourceId: 'retirement',
        domainId: 'retirement',
        groupLabelKey: 'hints.groups.retirement',
        loadProvider: () =>
          import('@vaultfolio/frontend-domain-retirement').then((m) => m.RetirementHintProvider),
      },
    ],
  },
);
