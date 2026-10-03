import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { decodeFieldKey, decryptField, encryptField } from '../shared/field-crypto';
import { EarningsUnavailableException } from './earnings.exceptions';

export type EarningsEncryptedTable = 'earnings_records' | 'earnings_certificates';

/** Decodes `EARNINGS_ENCRYPTION_KEY`; `null` unless it is base64 of exactly 32 bytes. */
export const decodeEarningsKey = decodeFieldKey;

/**
 * AES-256-GCM encryption at rest for earnings amounts (research R5, FR-041). One ciphertext per
 * row, fresh 12-byte IV per write, AAD `<table>|<row id>|<owner_id>` so a ciphertext cannot be
 * moved to another row or user. Format: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 *
 * A missing or invalid key does not crash the app: the service reports `available === false` and
 * every earnings route answers 503 (FR-044). At boot it also decrypts one stored row, so a
 * different key over existing data fails closed too; any authentication failure at runtime flips
 * the service to unavailable. Payloads are never logged.
 */
@Injectable()
export class EarningsCryptoService implements OnModuleInit {
  private readonly logger = new Logger(EarningsCryptoService.name);
  private key: Buffer | null = null;
  private keyRejected = false;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.key = decodeEarningsKey(process.env.EARNINGS_ENCRYPTION_KEY);
    if (!this.key) {
      this.logger.warn(
        'EARNINGS_ENCRYPTION_KEY is missing or not base64 of 32 bytes — the Earnings domain is unavailable',
      );
      return;
    }
    this.verifyKeyAgainstStoredData();
  }

  get available(): boolean {
    return this.key !== null && !this.keyRejected;
  }

  encrypt(table: EarningsEncryptedTable, id: string, ownerId: string, payload: unknown): string {
    return encryptField(this.requireKey(), aad(table, id, ownerId), payload);
  }

  decrypt<T>(table: EarningsEncryptedTable, id: string, ownerId: string, encoded: string): T {
    const key = this.requireKey();
    try {
      return decryptField<T>(key, aad(table, id, ownerId), encoded);
    } catch {
      // Fail closed: never return partial data, never log the ciphertext or the row.
      this.keyRejected = true;
      this.logger.error({ event: 'EarningsDecryptFailed', table, id });
      throw new EarningsUnavailableException();
    }
  }

  private requireKey(): Buffer {
    if (!this.key || this.keyRejected) {
      throw new EarningsUnavailableException();
    }
    return this.key;
  }

  /** Decrypts one stored record and certificate (if any) to detect a changed key at boot. */
  private verifyKeyAgainstStoredData(): void {
    try {
      for (const table of ['earnings_records', 'earnings_certificates'] as const) {
        const [row] = this.database.querySync<{
          id: string;
          owner_id: string;
          amounts_enc: string;
        }>(`SELECT id, owner_id, amounts_enc FROM ${table} LIMIT 1`);
        if (row) {
          this.decrypt(table, row.id, row.owner_id, row.amounts_enc);
        }
      }
    } catch (error) {
      if (error instanceof EarningsUnavailableException) {
        this.logger.error('EARNINGS_ENCRYPTION_KEY does not match the stored earnings data');
      }
      // Database not ready: nothing to verify here; the health check reports it.
    }
  }
}

function aad(table: EarningsEncryptedTable, id: string, ownerId: string): string {
  return `${table}|${id}|${ownerId}`;
}
