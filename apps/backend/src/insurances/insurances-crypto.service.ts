import { Injectable } from '@nestjs/common';
import {
  DomainKeyUnavailableError,
  DomainKeyringService,
} from '../encryption/domain-keyring.service';
import { rowAad } from '../encryption/domain-encryption.registry';
import { InsurancesUnavailableException } from './insurances.exceptions';

export const INSURANCE_CONTRACTS_TABLE = 'insurance_contracts';
export const INSURANCE_SETTINGS_TABLE = 'insurance_settings';

type InsurancesTable = typeof INSURANCE_CONTRACTS_TABLE | typeof INSURANCE_SETTINGS_TABLE;

/**
 * Envelope encryption at rest for insurance contracts and settings via the shared
 * `DomainKeyringService`. One ciphertext per row, fresh 12-byte IV per write, AAD
 * `<table>|<row id>|<owner_id>` so a ciphertext cannot be moved to another row or user.
 *
 * A missing or wrong master key does not crash the app: `available` is false and every insurances
 * route answers 503; any authentication failure at runtime locks the domain too. Payloads are
 * never logged.
 */
@Injectable()
export class InsurancesCryptoService {
  constructor(private readonly keyring: DomainKeyringService) {}

  /** `false` while the domain's key is missing, wrong or the domain is migrating/re-encrypting. */
  get available(): boolean {
    return this.keyring.isAvailable('insurances');
  }

  /** Data key version new rows are written with (`key_version` column). */
  get keyVersion(): number {
    return this.keyring.currentVersion('insurances');
  }

  encrypt(table: InsurancesTable, id: string, ownerId: string, payload: unknown): string {
    try {
      return this.keyring.encrypt('insurances', rowAad(table, id, ownerId), payload);
    } catch (error) {
      throw unavailable(error);
    }
  }

  decrypt<T>(table: InsurancesTable, id: string, ownerId: string, encoded: string): T {
    try {
      return this.keyring.decrypt<T>('insurances', rowAad(table, id, ownerId), encoded);
    } catch (error) {
      throw unavailable(error);
    }
  }
}

function unavailable(error: unknown): unknown {
  return error instanceof DomainKeyUnavailableError ? new InsurancesUnavailableException() : error;
}
