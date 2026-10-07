import { Injectable } from '@nestjs/common';
import {
  DomainKeyUnavailableError,
  DomainKeyringService,
} from '../encryption/domain-keyring.service';
import { rowAad } from '../encryption/domain-encryption.registry';
import { WealthUnavailableException } from './wealth.exceptions';

export const WEALTH_SNAPSHOTS_TABLE = 'wealth_snapshots';
export const WEALTH_SETTINGS_TABLE = 'wealth_settings';

type WealthTable = typeof WEALTH_SNAPSHOTS_TABLE | typeof WEALTH_SETTINGS_TABLE;

/**
 * Envelope encryption at rest for wealth snapshots and settings via the shared
 * `DomainKeyringService`. One ciphertext per row, fresh 12-byte IV per write, AAD
 * `<table>|<row id>|<owner_id>` so a ciphertext cannot be moved to another row or user.
 *
 * A missing or wrong master key does not crash the app: `available` is false and every wealth
 * route answers 503; any authentication failure at runtime locks the domain too. Payloads are
 * never logged.
 */
@Injectable()
export class WealthCryptoService {
  constructor(private readonly keyring: DomainKeyringService) {}

  /** `false` while the domain's key is missing, wrong or the domain is migrating/re-encrypting. */
  get available(): boolean {
    return this.keyring.isAvailable('wealth');
  }

  /** Data key version new rows are written with (`key_version` column). */
  get keyVersion(): number {
    return this.keyring.currentVersion('wealth');
  }

  encrypt(table: WealthTable, id: string, ownerId: string, payload: unknown): string {
    try {
      return this.keyring.encrypt('wealth', rowAad(table, id, ownerId), payload);
    } catch (error) {
      throw unavailable(error);
    }
  }

  decrypt<T>(table: WealthTable, id: string, ownerId: string, encoded: string): T {
    try {
      return this.keyring.decrypt<T>('wealth', rowAad(table, id, ownerId), encoded);
    } catch (error) {
      throw unavailable(error);
    }
  }
}

function unavailable(error: unknown): unknown {
  return error instanceof DomainKeyUnavailableError ? new WealthUnavailableException() : error;
}
