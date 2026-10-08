/** Admin encryption API contract (040-encryption-key-rotation). Counts and versions only, never key material. */
export const ENCRYPTION_DOMAIN_IDS = [
  'earnings',
  'retirement',
  'wealth',
  'insurances',
  'holdings',
  'account-overview',
  'feedback',
] as const;
export type EncryptionDomainId = (typeof ENCRYPTION_DOMAIN_IDS)[number];

export const ENCRYPTION_DOMAIN_STATES = [
  'READY',
  'KEY_MISSING',
  'KEY_MISMATCH',
  'MIGRATING',
  'REENCRYPTING',
] as const;
export type EncryptionDomainState = (typeof ENCRYPTION_DOMAIN_STATES)[number];

export const ENCRYPTION_RUN_KINDS = [
  'MASTER_KEY',
  'DATA_KEY',
  'KEY_DESTROY',
  'LEGACY_MIGRATION',
] as const;
export type EncryptionRunKind = (typeof ENCRYPTION_RUN_KINDS)[number];

export const ENCRYPTION_RUN_STATUSES = ['RUNNING', 'SUCCEEDED', 'FAILED', 'INTERRUPTED'] as const;
export type EncryptionRunStatus = (typeof ENCRYPTION_RUN_STATUSES)[number];

export interface RotationRun {
  id: string;
  domain: EncryptionDomainId;
  kind: EncryptionRunKind;
  status: EncryptionRunStatus;
  startedAt: string;
  finishedAt: string | null;
  triggeredByEmail: string | null;
  fromVersion: number | null;
  toVersion: number | null;
  recordsTotal: number;
  recordsDone: number;
  errorCode: string | null;
}

export interface DomainKeyStatus {
  domain: EncryptionDomainId;
  state: EncryptionDomainState;
  currentVersion: number | null;
  retiredVersions: number[];
  rotationPending: boolean;
  previousKeyRemovable: boolean;
  rowsPerVersion: Record<string, number>;
  lastRun: RotationRun | null;
  runningRun: RotationRun | null;
}

export interface EncryptionStatusResponse {
  domains: DomainKeyStatus[];
}

export interface EncryptionHistoryResponse {
  runs: RotationRun[];
}

export interface StartReencryptionRequest {
  confirm: string;
}
