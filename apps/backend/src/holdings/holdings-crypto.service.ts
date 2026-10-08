import { Injectable } from '@nestjs/common';
import {
  DomainKeyUnavailableError,
  DomainKeyringService,
} from '../encryption/domain-keyring.service';
import { rowAad } from '../encryption/domain-encryption.registry';
import { HoldingsUnavailableException } from './holdings.exceptions';

export const HOLDINGS_TABLE = 'holdings';

/**
 * Envelope encryption at rest for holdings via the shared `DomainKeyringService`. One ciphertext
 * per row, AAD `holdings|<id>|<owner_id>`. A missing or wrong key makes `available` false and
 * every holdings route answers 503; payloads are never logged.
 */
@Injectable()
export class HoldingsCryptoService {
  constructor(private readonly keyring: DomainKeyringService) {}

  get available(): boolean {
    return this.keyring.isAvailable('holdings');
  }

  /** Data key version new rows are written with (`key_version` column). */
  get keyVersion(): number {
    return this.keyring.currentVersion('holdings');
  }

  encrypt(id: string, ownerId: string, payload: unknown): string {
    try {
      return this.keyring.encrypt('holdings', rowAad(HOLDINGS_TABLE, id, ownerId), payload);
    } catch (error) {
      throw unavailable(error);
    }
  }

  decrypt<T>(id: string, ownerId: string, encoded: string): T {
    try {
      return this.keyring.decrypt<T>('holdings', rowAad(HOLDINGS_TABLE, id, ownerId), encoded);
    } catch (error) {
      throw unavailable(error);
    }
  }

  /**
   * Like `decrypt`, but a single row that fails to authenticate yields `null` and does not lock
   * the domain (the keyring would), so one corrupt record leaves the others readable. A domain
   * that is already unavailable still throws.
   */
  tryDecrypt<T>(id: string, ownerId: string, encoded: string): T | null {
    if (!this.available) {
      throw new HoldingsUnavailableException();
    }
    const runtime = this.keyring.runtime('holdings');
    const mismatchBefore = runtime.mismatch;
    try {
      return this.keyring.decrypt<T>('holdings', rowAad(HOLDINGS_TABLE, id, ownerId), encoded);
    } catch (error) {
      if (error instanceof DomainKeyUnavailableError) {
        runtime.mismatch = mismatchBefore;
        return null;
      }
      throw error;
    }
  }
}

function unavailable(error: unknown): unknown {
  return error instanceof DomainKeyUnavailableError ? new HoldingsUnavailableException() : error;
}
