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
    retirement: 'Retirement',
    feedback: 'Feedback',
  },
  feedback: {
    draft: {
      title: 'Unsent feedback',
      description:
        'Your feedback “{{subject}}” was not sent. It is saved as a draft in this browser.',
      linkLabel: 'Open draft',
    },
  },
  insurances: {
    redundant: {
      title: 'Overlapping insurance contracts',
      description:
        'The contracts “{{contractName}}” and “{{otherContractName}}” cover the same risk. Consider removing one.',
      linkLabel: 'View gap check',
    },
  },
  retirement: {
    linkLabel: 'Open contract',
    outdated: {
      title: 'Statement outdated',
      description:
        'The statement for “{{contractName}}” is older than 12 months. Check whether a newer one exists.',
    },
    ocr: {
      title: 'Please check the figures',
      description:
        'The figures of “{{contractName}}” were read by text recognition and may contain errors.',
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
