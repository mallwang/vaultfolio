import type { TranslationDictionary } from './en';

/** `hints.*` (043-notification-center), Deutsch: Glocke, Panel, Aktionen. */
export const hintsDe: TranslationDictionary = {
  bell: {
    label: 'Benachrichtigungen',
    badgeLabel: '{{count}} Benachrichtigung',
    badgeLabelPlural: '{{count}} Benachrichtigungen',
    dot: 'Ausgeblendete Benachrichtigungen',
  },
  panel: {
    title: 'Benachrichtigungen',
    empty: 'Keine Benachrichtigungen',
    hiddenTitle: 'Ausgeblendet',
    showHidden: 'Ausgeblendete anzeigen ({{count}})',
    hideHidden: 'Ausgeblendete verbergen',
  },
  hint: {
    hide: 'Ausblenden',
    restore: 'Wiederherstellen',
  },
  groups: {
    insurances: 'Versicherungen',
    earnings: 'Einkommen',
  },
  insurances: {
    redundant: {
      title: 'Überlappende Versicherungsverträge',
      description:
        'Verträge {{contractId}} und {{otherContractId}} decken dasselbe Risiko ab. Erwägen Sie, einen zu entfernen.',
      linkLabel: 'Lückenprüfung anzeigen',
    },
  },
  earnings: {
    dataCheck: {
      title: 'Einkommensdiskrepanz erkannt',
      description:
        'Diskrepanz für {{employerLabel}} ({{year}}) gefunden. Bitte überprüfen Sie Ihre Einkommensdaten.',
      descriptionMissing: 'Einkommensdaten für {{employerLabel}} ({{year}}) fehlen.',
      linkLabel: 'Datenprüfung anzeigen',
    },
  },
};
