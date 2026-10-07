import type { TranslationDictionary } from './en';

/** `hints.*` (043-notification-center), English: bell, panel, actions. */
export const hintsEn: TranslationDictionary = {
  bell: {
    label: 'Notifications',
    badgeLabel: '{{count}} notification',
    badgeLabelPlural: '{{count}} notifications',
    dot: 'Dismissed notifications',
  },
  panel: {
    title: 'Notifications',
    empty: 'No notifications',
    hiddenTitle: 'Dismissed',
    showHidden: 'Show dismissed ({{count}})',
    hideHidden: 'Hide dismissed',
  },
  hint: {
    hide: 'Dismiss',
    restore: 'Restore',
  },
  groups: {
    insurances: 'Insurances',
    earnings: 'Earnings',
  },
  insurances: {
    redundant: {
      title: 'Overlapping insurance contracts',
      description:
        'Contracts {{contractId}} and {{otherContractId}} cover the same risk. Consider removing one.',
      linkLabel: 'View gap check',
    },
  },
  earnings: {
    dataCheck: {
      title: 'Earnings discrepancy detected',
      description:
        'Discrepancy found for {{employerLabel}} ({{year}}). Please review your earnings data.',
      descriptionMissing: 'Earnings data for {{employerLabel}} ({{year}}) is missing.',
      linkLabel: 'View data check',
    },
  },
};
