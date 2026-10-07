import type { TranslationDictionary } from './en';

/** `maintenance.*` (041-domain-maintenance-mode), German: notices, tile, nav marker and the admin Domains tab. */
export const maintenanceDe: TranslationDictionary = {
  notice: {
    title: 'Vorübergehend nicht verfügbar',
    body: 'Dieser Bereich wird gerade gewartet. Deine Daten sind sicher und unverändert. Bitte versuche es später erneut.',
  },
  tile: {
    title: 'Wartungsarbeiten',
    body: 'Dieser Bereich ist wegen Wartungsarbeiten vorübergehend nicht verfügbar.',
  },
  adminBanner: 'Dieser Bereich ist im Wartungsmodus und zeigt Mitgliedern einen Wartungshinweis.',
  adminBadge: 'In Wartung – für Mitglieder nicht sichtbar',
  navMarker: 'In Wartung',
  admin: {
    title: 'Domänen',
    subtitle:
      'Setze eine Domäne in den Wartungsmodus, um Mitgliedern einen Hinweis zu zeigen und ihre Anfragen abzulehnen. Admins behalten vollen Zugriff, es werden keine Daten verändert.',
    loadError: 'Die Domänen konnten nicht geladen werden. Bitte erneut versuchen.',
    saveError: 'Der Wartungsstatus konnte nicht geändert werden. Bitte erneut versuchen.',
    columnDomain: 'Domäne',
    columnStatus: 'Status',
    columnChanged: 'Zuletzt geändert',
    columnSwitch: 'Wartungsmodus',
    active: 'Aktiv',
    inMaintenance: 'In Wartung',
    neverChanged: '–',
    changedBy: '{{date}} von {{name}}',
    toggleLabel: 'Wartungsmodus für {{domain}}',
    confirm: {
      header: '{{domain}} in Wartung setzen?',
      message:
        'Mitglieder sehen einen Wartungshinweis und ihre Anfragen an diese Domäne werden abgelehnt, bis du den Wartungsmodus wieder beendest. Es werden keine Daten verändert.',
      accept: 'In Wartung setzen',
      reject: 'Abbrechen',
    },
  },
};
