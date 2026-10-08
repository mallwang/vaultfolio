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
    retirement: 'Altersvorsorge',
    feedback: 'Feedback',
  },
  feedback: {
    draft: {
      title: 'Ungesendetes Feedback',
      description:
        'Dein Feedback „{{subject}}“ wurde nicht gesendet. Es ist als Entwurf in diesem Browser gespeichert.',
      linkLabel: 'Entwurf öffnen',
    },
  },
  insurances: {
    redundant: {
      title: 'Überlappende Versicherungsverträge',
      description:
        'Die Verträge „{{contractName}}“ und „{{otherContractName}}“ decken dasselbe Risiko ab. Erwägen Sie, einen zu entfernen.',
      linkLabel: 'Lückenprüfung anzeigen',
    },
  },
  retirement: {
    linkLabel: 'Vertrag öffnen',
    outdated: {
      title: 'Auskunft veraltet',
      description:
        'Die Auskunft zu „{{contractName}}“ ist älter als 12 Monate. Prüfen Sie, ob eine neuere vorliegt.',
    },
    ocr: {
      title: 'Werte bitte prüfen',
      description:
        'Die Werte von „{{contractName}}“ wurden per Texterkennung gelesen und können Fehler enthalten.',
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
