import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { decodeFieldKey, decryptField, encryptField } from '../shared/field-crypto';
import { AccountOverviewUnavailableException } from './account-overview.exceptions';

export const ACCOUNT_OVERVIEW_TABLE = 'account_overview_entries';

/**
 * AES-256-GCM encryption at rest for account-overview entries. One ciphertext per row, fresh
 * 12-byte IV per write, AAD `<table>|<row id>|<owner_id>` so a ciphertext cannot be moved to
 * another row or user. Format: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 *
 * A missing or invalid `ACCOUNT_OVERVIEW_ENCRYPTION_KEY` does not crash the app: the service
 * reports `available === false` and every account-overview route answers 503. At boot it also
 * decrypts one stored row, so a different key over existing data fails closed too; any
 * authentication failure at runtime flips the service to unavailable. Payloads are never logged.
 */
@Injectable()
export class AccountOverviewCryptoService implements OnModuleInit {
  private readonly logger = new Logger(AccountOverviewCryptoService.name);
  private key: Buffer | null = null;
  private keyRejected = false;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.key = decodeFieldKey(process.env.ACCOUNT_OVERVIEW_ENCRYPTION_KEY);
    if (!this.key) {
      this.logger.warn(
        'ACCOUNT_OVERVIEW_ENCRYPTION_KEY is missing or not base64 of 32 bytes — the account overview is unavailable',
      );
      return;
    }
    this.verifyKeyAgainstStoredData();
  }

  get available(): boolean {
    return this.key !== null && !this.keyRejected;
  }

  encrypt(id: string, ownerId: string, payload: unknown): string {
    return encryptField(this.requireKey(), aad(id, ownerId), payload);
  }

  decrypt<T>(id: string, ownerId: string, encoded: string): T {
    const key = this.requireKey();
    try {
      return decryptField<T>(key, aad(id, ownerId), encoded);
    } catch {
      // Fail closed: never return partial data, never log the ciphertext or the row.
      this.keyRejected = true;
      this.logger.error({ event: 'AccountOverviewDecryptFailed', id });
      throw new AccountOverviewUnavailableException();
    }
  }

  private requireKey(): Buffer {
    if (!this.key || this.keyRejected) {
      throw new AccountOverviewUnavailableException();
    }
    return this.key;
  }

  /** Decrypts one stored row (if any) to detect a changed key at boot. */
  private verifyKeyAgainstStoredData(): void {
    try {
      const [row] = this.database.querySync<{
        id: string;
        owner_id: string;
        payload_enc: string;
      }>(`SELECT id, owner_id, payload_enc FROM ${ACCOUNT_OVERVIEW_TABLE} LIMIT 1`);
      if (row) {
        this.decrypt(row.id, row.owner_id, row.payload_enc);
      }
    } catch (error) {
      if (error instanceof AccountOverviewUnavailableException) {
        this.logger.error('ACCOUNT_OVERVIEW_ENCRYPTION_KEY does not match the stored account data');
      }
      // Database not ready or table not created yet: nothing to verify here.
    }
  }
}

function aad(id: string, ownerId: string): string {
  return `${ACCOUNT_OVERVIEW_TABLE}|${id}|${ownerId}`;
}
