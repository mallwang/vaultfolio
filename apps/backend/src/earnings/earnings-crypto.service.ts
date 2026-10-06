import { Injectable } from '@nestjs/common';
import {
  DomainKeyUnavailableError,
  DomainKeyringService,
} from '../encryption/domain-keyring.service';
import { rowAad } from '../encryption/domain-encryption.registry';
import { EarningsUnavailableException } from './earnings.exceptions';

export type EarningsEncryptedTable = 'earnings_records' | 'earnings_certificates';

/**
 * Envelope encryption at rest for earnings amounts (research R5, FR-041) via the shared
 * `DomainKeyringService`. One ciphertext per row, fresh 12-byte IV per write, AAD
 * `<table>|<row id>|<owner_id>` so a ciphertext cannot be moved to another row or user.
 *
 * A missing or wrong master key does not crash the app: `available` is false and every earnings
 * route answers 503 (FR-044); any authentication failure at runtime locks the domain too.
 * Payloads are never logged.
 */
@Injectable()
export class EarningsCryptoService {
  constructor(private readonly keyring: DomainKeyringService) {}

  /** `false` while the domain's key is missing, wrong or the domain is migrating/re-encrypting. */
  get available(): boolean {
    return this.keyring.isAvailable('earnings');
  }

  /** Data key version new rows are written with (`key_version` column). */
  get keyVersion(): number {
    return this.keyring.currentVersion('earnings');
  }

  encrypt(table: EarningsEncryptedTable, id: string, ownerId: string, payload: unknown): string {
    try {
      return this.keyring.encrypt('earnings', rowAad(table, id, ownerId), payload);
    } catch (error) {
      throw unavailable(error);
    }
  }

  decrypt<T>(table: EarningsEncryptedTable, id: string, ownerId: string, encoded: string): T {
    try {
      return this.keyring.decrypt<T>('earnings', rowAad(table, id, ownerId), encoded);
    } catch (error) {
      throw unavailable(error);
    }
  }
}

function unavailable(error: unknown): unknown {
  return error instanceof DomainKeyUnavailableError ? new EarningsUnavailableException() : error;
}
