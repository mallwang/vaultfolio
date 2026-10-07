import type { TranslationDictionary } from './en';

/** `maintenance.*` (041-domain-maintenance-mode), English: notices, tile, nav marker and the admin Domains tab. */
export const maintenanceEn: TranslationDictionary = {
  notice: {
    title: 'Temporarily unavailable',
    body: 'This area is currently under maintenance. Your data is safe and unchanged. Please try again later.',
  },
  tile: {
    title: 'Maintenance',
    body: 'This area is temporarily unavailable due to maintenance.',
  },
  adminBanner: 'This area is in maintenance and shows a maintenance notice to members.',
  adminBadge: 'In maintenance – not visible to members',
  navMarker: 'In maintenance',
  admin: {
    title: 'Domains',
    subtitle:
      'Put a domain into maintenance to show members a notice and reject their requests. Admins keep full access, and no data is changed.',
    loadError: 'Unable to load the domains. Please try again.',
    saveError: 'The maintenance state could not be changed. Please try again.',
    columnDomain: 'Domain',
    columnStatus: 'Status',
    columnChanged: 'Last changed',
    columnSwitch: 'Maintenance mode',
    active: 'Active',
    inMaintenance: 'In maintenance',
    neverChanged: '–',
    changedBy: '{{date}} by {{name}}',
    toggleLabel: 'Maintenance mode for {{domain}}',
    confirm: {
      header: 'Put {{domain}} into maintenance?',
      message:
        'Members will see a maintenance notice and their requests to this domain are rejected until you switch it back. No data is changed.',
      accept: 'Put into maintenance',
      reject: 'Cancel',
    },
  },
};
