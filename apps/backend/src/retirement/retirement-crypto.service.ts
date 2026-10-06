import { Injectable } from '@nestjs/common';
import {
  DomainKeyUnavailableError,
  DomainKeyringService,
} from '../encryption/domain-keyring.service';
import { rowAad } from '../encryption/domain-encryption.registry';
import { RetirementUnavailableException } from './retirement.exceptions';

export const RETIREMENT_TABLE = 'retirement_records';

/**
 * Envelope encryption at rest for retirement figures and contract numbers via the shared
 * `DomainKeyringService`. One ciphertext per row, fresh 12-byte IV per write, AAD
 * `retirement_records|<row id>|<owner_id>` so a ciphertext cannot be moved to another row or user.
 *
 * A missing or wrong master key does not crash the app: `available` is false and every retirement
 * route answers 503; any authentication failure at runtime locks the domain too. Payloads are
 * never logged.
 */
@Injectable()
export class RetirementCryptoService {
  constructor(private readonly keyring: DomainKeyringService) {}

  /** `false` while the domain's key is missing, wrong or the domain is migrating/re-encrypting. */
  get available(): boolean {
    return this.keyring.isAvailable('retirement');
  }

  /** Data key version new rows are written with (`key_version` column). */
  get keyVersion(): number {
    return this.keyring.currentVersion('retirement');
  }

  encrypt(id: string, ownerId: string, payload: unknown): string {
    try {
      return this.keyring.encrypt('retirement', rowAad(RETIREMENT_TABLE, id, ownerId), payload);
    } catch (error) {
      throw unavailable(error);
    }
  }

  decrypt<T>(id: string, ownerId: string, encoded: string): T {
    try {
      return this.keyring.decrypt<T>('retirement', rowAad(RETIREMENT_TABLE, id, ownerId), encoded);
    } catch (error) {
      throw unavailable(error);
    }
  }
}

function unavailable(error: unknown): unknown {
  return error instanceof DomainKeyUnavailableError ? new RetirementUnavailableException() : error;
}
