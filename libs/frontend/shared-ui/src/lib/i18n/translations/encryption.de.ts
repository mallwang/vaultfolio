import type { TranslationDictionary } from './en';

/**
 * `encryption.*` (040-encryption-key-rotation), German: admin screen for key status, master key
 * rotation, data re-encryption and key destruction. Placeholders use `{{name}}`.
 */
export const encryptionDe: TranslationDictionary = {
  title: 'Verschlüsselungsschlüssel',
  subtitle:
    'Schlüsselstatus je Bereich. Schlüsselwerte werden hier nie angezeigt und nur über die Server-Umgebung gesetzt.',
  loadError: 'Der Verschlüsselungsstatus konnte nicht geladen werden. Bitte erneut versuchen.',
  domain: {
    earnings: 'Einkommen',
    retirement: 'Altersvorsorge',
    wealth: 'Vermögen',
    insurances: 'Versicherungen',
    'account-overview': 'Kontenübersicht',
    feedback: 'Feedback',
  },
  state: {
    READY: 'Bereit',
    KEY_MISSING: 'Schlüssel fehlt',
    KEY_MISMATCH: 'Falscher Schlüssel',
    MIGRATING: 'Wird aktualisiert',
    REENCRYPTING: 'Wird neu verschlüsselt',
  },
  stateHint: {
    KEY_MISSING:
      'Der Hauptschlüssel ist nicht gesetzt oder ungültig. Der Bereich ist nicht verfügbar, bis er gesetzt und der Server neu gestartet wurde.',
    KEY_MISMATCH:
      'Der konfigurierte Hauptschlüssel öffnet die gespeicherten Daten nicht. Der Bereich ist gesperrt, es wurde nichts verändert. Den richtigen Schlüssel wiederherstellen (oder den alten als vorherigen Schlüssel setzen) und neu starten.',
    MIGRATING: 'Vorhandene Daten werden auf das neue Schlüsselverfahren umgestellt.',
    REENCRYPTING:
      'Alle Daten dieses Bereichs werden neu verschlüsselt. Er ist währenddessen nicht verfügbar.',
  },
  dataKeyVersion: 'Version des Datenschlüssels',
  retiredKeys: 'Ausgemusterte Datenschlüssel',
  columnStatus: 'Status',
  columnActions: 'Aktionen',
  none: 'Keine',
  rowsPerVersion: 'Datensätze je Schlüsselversion',
  rotationPending:
    'Einige Schlüssel sind noch mit dem vorherigen Hauptschlüssel verpackt. Die Hauptschlüssel-Rotation ausführen.',
  previousKeyRemovable:
    'Der vorherige Hauptschlüssel wird nicht mehr benötigt und kann aus der Server-Konfiguration entfernt werden.',
  lastRun: 'Letzter Vorgang',
  noRuns: 'Noch kein Vorgang',
  progress: '{{done}} von {{total}} Datensätzen',
  rotateMasterKey: 'Hauptschlüssel rotieren',
  reencrypt: 'Daten neu verschlüsseln',
  destroyKey: 'Schlüssel v{{version}} vernichten',
  rotatedMasterKey: 'Hauptschlüssel rotiert.',
  reencryptionStarted: 'Neuverschlüsselung gestartet.',
  destroyedKey: 'Datenschlüssel vernichtet.',
  reencryptDialog: {
    header: '{{domain}} neu verschlüsseln',
    message:
      'Es wird ein neuer Datenschlüssel erzeugt und alle Daten dieses Bereichs werden neu verschlüsselt. Der Bereich ist bis zum Abschluss nicht verfügbar. Zur Bestätigung die Bereichs-ID eingeben.',
    confirmLabel: 'Bereichs-ID',
    hint: 'Die Bereichs-ID steht in der Tabelle unter dem Namen des Bereichs (z. B. „earnings“).',
    submit: 'Neuverschlüsselung starten',
  },
  destroyConfirm: {
    header: 'Datenschlüssel vernichten',
    message:
      'Datenschlüssel v{{version}} von {{domain}} wird unwiderruflich vernichtet. Das ist nur möglich, wenn kein Datensatz ihn mehr verwendet.',
    accept: 'Schlüssel vernichten',
    reject: 'Behalten',
  },
  errors: {
    ENCRYPTION_DOMAIN_NOT_READY: 'Der Bereich ist für diesen Vorgang nicht bereit.',
    ENCRYPTION_OPERATION_RUNNING: 'Für diesen Bereich läuft bereits ein Vorgang.',
    ENCRYPTION_KEY_NOT_RETIRED: 'Nur ein ausgemusterter Datenschlüssel kann vernichtet werden.',
    ENCRYPTION_KEY_IN_USE:
      'Datensätze verwenden diesen Schlüssel noch. Zuerst die Daten neu verschlüsseln.',
    ENCRYPTION_CONFIRMATION_MISMATCH: 'Die Bestätigung stimmt nicht mit der Bereichs-ID überein.',
    generic: 'Der Vorgang ist fehlgeschlagen. Bitte erneut versuchen.',
  },
  history: {
    title: 'Verlauf',
    empty: 'Noch keine Vorgänge aufgezeichnet.',
    columnTime: 'Zeit',
    columnDomain: 'Bereich',
    columnKind: 'Vorgang',
    columnStatus: 'Ergebnis',
    columnBy: 'Ausgelöst von',
    columnRecords: 'Datensätze',
    system: 'System (Start)',
    kind: {
      MASTER_KEY: 'Hauptschlüssel-Rotation',
      DATA_KEY: 'Neuverschlüsselung der Daten',
      KEY_DESTROY: 'Schlüssel vernichtet',
      LEGACY_MIGRATION: 'Upgrade-Migration',
    },
    status: {
      RUNNING: 'Läuft',
      SUCCEEDED: 'Erfolgreich',
      FAILED: 'Fehlgeschlagen',
      INTERRUPTED: 'Unterbrochen',
    },
  },
};
