import type { TranslationDictionary } from './en';

/**
 * `encryption.*` (040-encryption-key-rotation), English: admin screen for key status, master key
 * rotation, data re-encryption and key destruction. Placeholders use `{{name}}`.
 */
export const encryptionEn: TranslationDictionary = {
  title: 'Encryption keys',
  subtitle:
    'Per-domain key status. Key values are never shown here and are only set through the server environment.',
  loadError: 'Unable to load the encryption status. Please try again.',
  domain: {
    earnings: 'Earnings',
    retirement: 'Retirement',
    wealth: 'Wealth',
    holdings: 'Portfolio',
    insurances: 'Insurances',
    'account-overview': 'Account overview',
    feedback: 'Feedback',
  },
  state: {
    READY: 'Ready',
    KEY_MISSING: 'Key missing',
    KEY_MISMATCH: 'Wrong key',
    MIGRATING: 'Upgrading',
    REENCRYPTING: 'Re-encrypting',
  },
  stateHint: {
    KEY_MISSING:
      'The master key is not configured or invalid. The domain is unavailable until it is set and the server restarted.',
    KEY_MISMATCH:
      'The configured master key does not open the stored data. The domain is locked and nothing was changed. Restore the correct key (or set the old one as the previous key) and restart.',
    MIGRATING: 'Existing data is being upgraded to the new key scheme.',
    REENCRYPTING: 'All data of this domain is being re-encrypted. It is unavailable meanwhile.',
  },
  dataKeyVersion: 'Data key version',
  retiredKeys: 'Retired data keys',
  columnStatus: 'Status',
  columnActions: 'Actions',
  none: 'None',
  rowsPerVersion: 'Records per key version',
  rotationPending:
    'Some keys are still wrapped with the previous master key. Run the master key rotation.',
  previousKeyRemovable:
    'The previous master key is no longer needed and can be removed from the server configuration.',
  lastRun: 'Last operation',
  noRuns: 'No operation yet',
  progress: '{{done}} of {{total}} records',
  rotateMasterKey: 'Rotate master key',
  reencrypt: 'Re-encrypt data',
  destroyKey: 'Destroy key v{{version}}',
  rotatedMasterKey: 'Master key rotated.',
  reencryptionStarted: 'Re-encryption started.',
  destroyedKey: 'Data key destroyed.',
  reencryptDialog: {
    header: 'Re-encrypt {{domain}}',
    message:
      'A new data key is generated and all data of this domain is re-encrypted. The domain is unavailable until this finishes. Type the domain id to confirm.',
    confirmLabel: 'Domain id',
    hint: 'The domain id is shown in the table below the domain name (e.g. "earnings").',
    submit: 'Start re-encryption',
  },
  destroyConfirm: {
    header: 'Destroy data key',
    message:
      'Data key v{{version}} of {{domain}} will be destroyed irreversibly. This is only possible when no record uses it any more.',
    accept: 'Destroy key',
    reject: 'Keep it',
  },
  errors: {
    ENCRYPTION_DOMAIN_NOT_READY: 'The domain is not ready for this operation.',
    ENCRYPTION_OPERATION_RUNNING: 'Another operation is already running for this domain.',
    ENCRYPTION_KEY_NOT_RETIRED: 'Only a retired data key can be destroyed.',
    ENCRYPTION_KEY_IN_USE: 'Records still use this key. Re-encrypt the data first.',
    ENCRYPTION_CONFIRMATION_MISMATCH: 'The confirmation does not match the domain id.',
    generic: 'The operation failed. Please try again.',
  },
  history: {
    title: 'History',
    empty: 'No operations recorded yet.',
    columnTime: 'Time',
    columnDomain: 'Domain',
    columnKind: 'Operation',
    columnStatus: 'Result',
    columnBy: 'Triggered by',
    columnRecords: 'Records',
    system: 'System (startup)',
    kind: {
      MASTER_KEY: 'Master key rotation',
      DATA_KEY: 'Data re-encryption',
      KEY_DESTROY: 'Key destroyed',
      LEGACY_MIGRATION: 'Upgrade migration',
    },
    status: {
      RUNNING: 'Running',
      SUCCEEDED: 'Succeeded',
      FAILED: 'Failed',
      INTERRUPTED: 'Interrupted',
    },
  },
};
