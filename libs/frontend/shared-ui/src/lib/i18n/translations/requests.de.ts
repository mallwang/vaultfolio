import type { TranslationDictionary } from './en';

/**
 * `requests.*` (033-parser-requests), Deutsch: gemeinsame Texte der allgemeinen Anfragen-Funktion
 * (Status, API-Fehlercodes). Typ- und Feature-Namen kommen aus der `@vaultfolio/requests`-Registry
 * (`requestTypeLabel`). Platzhalter nutzen `{{name}}`.
 */
export const requestsDe: TranslationDictionary = {
  status: {
    OPEN: 'Offen',
    IN_PROGRESS: 'In Bearbeitung',
    DONE: 'Erledigt',
    REJECTED: 'Abgelehnt',
  },
  errors: {
    UNKNOWN_REQUEST_TYPE: 'Diese Art von Anfrage wird nicht unterstützt.',
    INVALID_LAYOUT: 'Das anonymisierte Dokument hat kein gültiges Format. Bitte beginne von vorn.',
    LAYOUT_UNKNOWN_FIELD:
      'Das anonymisierte Dokument enthält unerwartete Daten. Bitte beginne von vorn.',
    LIMIT_EXCEEDED: 'Das Dokument ist zu groß zum Senden (höchstens 3 Seiten).',
    PERSONAL_DATA_DETECTED:
      'Der Server hat Daten gefunden, die persönlich aussehen. Maskiere oder entferne sie und sende erneut.',
    INVALID_RULE_DRAFT:
      'Die Regel-Markierungen sind ungültig. Entferne sie oder überspringe den Schritt.',
    REQUEST_LIMIT_OPEN:
      'Du hast bereits drei offene Anfragen. Bitte warte, bis eine bearbeitet wurde.',
    REQUEST_LIMIT_DAILY:
      'Du hast heute die maximale Anzahl an Anfragen gesendet. Bitte versuche es morgen erneut.',
    REQUEST_NOT_FOUND: 'Diese Anfrage existiert nicht.',
    SAMPLE_DELETED: 'Das Muster dieser Anfrage wurde gelöscht.',
    INVALID_REQUEST_UPDATE:
      'Die Änderung ist ungültig. Wähle einen Status oder gib eine Notiz mit höchstens 2000 Zeichen ein.',
    forbidden: 'Dafür hast du keinen Zugriff.',
    payload_too_large: 'Die Anfrage ist zu groß zum Senden.',
    UNSUPPORTED_MEDIA_TYPE: 'Die Anfrage konnte in diesem Format nicht gesendet werden.',
  },
  requestParser: {
    button: 'Parser anfragen',
    note: 'Sendet eine anonymisierte Kopie – nie echte Zahlen.',
  },
  wizard: {
    title: 'Parser anfragen',
    loading: 'Das Dokument wird auf diesem Gerät gelesen…',
    backToImport: 'Zurück zum Import',
    back: 'Zurück',
    cancel: 'Abbrechen',
    continue: 'Weiter',
    steps: {
      consent: 'Einwilligung',
      review: 'Wörter prüfen',
      rules: 'Regeln markieren',
      preview: 'Vorschau & Senden',
    },
    kinds: {
      BANK_ACCOUNT: 'Bankverbindung',
      TAX_ID: 'Steuer-ID',
      SOCIAL_SECURITY: 'Sozialversicherungsnummer',
      EMAIL: 'E-Mail-Adresse',
      PHONE: 'Telefonnummer',
      POSTCODE_CITY: 'PLZ und Ort',
    },
    consent: {
      factDeviceTitle: 'Bleibt auf deinem Gerät',
      factDeviceText:
        'Deine PDF, ihr Text und alle echten Zahlen werden nur hier gelesen. Sie werden nie gesendet.',
      factSentTitle: 'Wird nach deiner Bestätigung gesendet',
      factSentText:
        'Nur eine nachgebaute Kopie: Layout und Bezeichnungen, jede Zahl durch eine Zufallszahl gleicher Form ersetzt, jedes unbekannte Wort von dir maskiert oder behalten.',
      factWhoTitle: 'Wer sieht es, wie lange',
      factWhoText:
        'Administratoren, nur im Portal (nie per E-Mail). Gelöscht 30 Tage nach Abschluss der Anfrage.',
      checksTitle: 'Dokumentprüfung (auf diesem Gerät)',
      checkReadable: 'Lesbares Textdokument, {{pages}} Seite(n).',
      checkNoPersonal: 'Keine personenbezogenen Daten gefunden.',
      checkPersonal:
        'Personenbezogene Daten gefunden ({{kinds}}) – automatisch entfernt, keine Schwärzung nötig.',
      checkCovered: '{{count}} Wort/Wörter unter schwarzen Balken – standardmäßig maskiert.',
      consentLabel:
        'Ich verstehe, dass eine anonymisierte, nachgebaute Kopie dieses Dokuments an die Administratoren gesendet wird.',
    },
    review: {
      calloutRemoved: 'Personenbezogene Daten wurden gefunden und entfernt: {{kinds}}.',
      explain:
        'Zahlen werden durch Zufallswerte ersetzt. Bekannte Bezeichnungen bleiben. Entscheide bei jedem anderen Wort, ob es bleibt oder maskiert wird.',
      legendValue: 'Ersetzter Wert',
      legendRemoved: 'Entfernt (gesperrt)',
      legendUndecided: 'Entscheidung nötig',
      legendMasked: 'Maskiert',
      legendKept: 'Behalten',
      markedTitle: 'Markierte Wörter',
      progress: '{{done}} von {{total}} entschieden',
      keep: 'Als Bezeichnung behalten',
      mask: 'Maskieren',
      removedRow: 'Automatisch entfernt ({{count}})',
      noWords: 'Kein Wort braucht eine Entscheidung.',
    },
    rules: {
      optional:
        'Optional: Du kannst markieren, welche Zeile welche Zahl ist. Das ist ein Hinweis für die Entwicklung und wird nie ausgeführt.',
      skip: 'Markierungen überspringen',
    },
    preview: {
      callout: 'Genau das erhalten die Administratoren.',
      summaryTitle: 'Zusammenfassung',
      pages: 'Seiten',
      kept: 'Wörter behalten',
      masked: 'Wörter maskiert',
      removed: 'Personenbezogene Daten entfernt',
      values: 'Werte ersetzt',
      consentGiven: 'Einwilligung erteilt',
      send: 'Anfrage senden',
      sending: 'Wird gesendet…',
      discard: 'Verwerfen',
      blocked:
        'Senden ist gesperrt, bis jedes Wort entschieden ist und keine personenbezogenen Daten mehr übrig sind.',
    },
    sent: {
      title: 'Anfrage gesendet',
      text: 'Danke. Ein Administrator sieht sich dein anonymisiertes Muster an.',
      feature: 'Bereich',
      request: 'Anfrage',
      sentAt: 'Gesendet',
      keptUntil: 'Aufbewahrt bis',
      keptUntilValue: '30 Tage nach Abschluss der Anfrage',
      duplicate: 'Eine ähnliche Anfrage ist bereits offen – sie wird gemeinsam bearbeitet.',
    },
    refused: {
      title: 'Dieses Dokument kann nicht angefragt werden',
      chooseAnother: 'Andere Datei wählen',
      IMAGE_ONLY:
        'Die Datei hat keine Textebene (ein Scan). Konvertiere sie zuerst mit dem Begleit-Tool.',
      PASSWORD_PROTECTED: 'Die Datei ist passwortgeschützt.',
      UNREADABLE: 'Die Datei konnte nicht gelesen werden.',
      TOO_MANY_PAGES: 'Das Dokument hat mehr als 3 Seiten.',
      TOO_LARGE: 'Das Dokument ist zu groß zum Senden.',
    },
    errorGeneric: 'Die Anfrage konnte nicht gesendet werden. Bitte versuche es erneut.',
  },
};
