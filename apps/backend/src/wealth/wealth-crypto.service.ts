import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { decodeFieldKey, decryptField, encryptField } from '../shared/field-crypto';
import { WealthUnavailableException } from './wealth.exceptions';

export const WEALTH_SNAPSHOTS_TABLE = 'wealth_snapshots';
export const WEALTH_SETTINGS_TABLE = 'wealth_settings';

type WealthTable = typeof WEALTH_SNAPSHOTS_TABLE | typeof WEALTH_SETTINGS_TABLE;

/**
 * AES-256-GCM encryption at rest for wealth snapshots and settings. One ciphertext per row, fresh
 * 12-byte IV per write, AAD `<table>|<row id>|<owner_id>` so a ciphertext cannot be moved to
 * another row or user. Format: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 *
 * A missing or invalid `WEALTH_ENCRYPTION_KEY` does not crash the app: the service reports
 * `available === false` and every wealth route answers 503. At boot it also decrypts one stored
 * row of each table, so a different key over existing data fails closed too; any authentication
 * failure at runtime flips the service to unavailable. Payloads are never logged.
 */
@Injectable()
export class WealthCryptoService implements OnModuleInit {
  private readonly logger = new Logger(WealthCryptoService.name);
  private key: Buffer | null = null;
  private keyRejected = false;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.key = decodeFieldKey(process.env.WEALTH_ENCRYPTION_KEY);
    if (!this.key) {
      this.logger.warn(
        'WEALTH_ENCRYPTION_KEY is missing or not base64 of 32 bytes — the Wealth domain is unavailable',
      );
      return;
    }
    this.verifyKeyAgainstStoredData();
  }

  get available(): boolean {
    return this.key !== null && !this.keyRejected;
  }

  encrypt(table: WealthTable, id: string, ownerId: string, payload: unknown): string {
    return encryptField(this.requireKey(), aad(table, id, ownerId), payload);
  }

  decrypt<T>(table: WealthTable, id: string, ownerId: string, encoded: string): T {
    const key = this.requireKey();
    try {
      return decryptField<T>(key, aad(table, id, ownerId), encoded);
    } catch {
      // Fail closed: never return partial data, never log the ciphertext or the row.
      this.keyRejected = true;
      this.logger.error({ event: 'WealthDecryptFailed', table, id });
      throw new WealthUnavailableException();
    }
  }

  private requireKey(): Buffer {
    if (!this.key || this.keyRejected) {
      throw new WealthUnavailableException();
    }
    return this.key;
  }

  /** Decrypts one stored row per table (if any) to detect a changed key at boot. */
  private verifyKeyAgainstStoredData(): void {
    try {
      const [snapshot] = this.database.querySync<{
        id: string;
        owner_id: string;
        payload_enc: string;
      }>(`SELECT id, owner_id, payload_enc FROM ${WEALTH_SNAPSHOTS_TABLE} LIMIT 1`);
      if (snapshot) {
        this.decrypt(WEALTH_SNAPSHOTS_TABLE, snapshot.id, snapshot.owner_id, snapshot.payload_enc);
      }
      const [settings] = this.database.querySync<{ owner_id: string; payload_enc: string }>(
        `SELECT owner_id, payload_enc FROM ${WEALTH_SETTINGS_TABLE} LIMIT 1`,
      );
      if (settings) {
        this.decrypt(
          WEALTH_SETTINGS_TABLE,
          settings.owner_id,
          settings.owner_id,
          settings.payload_enc,
        );
      }
    } catch (error) {
      if (error instanceof WealthUnavailableException) {
        this.logger.error('WEALTH_ENCRYPTION_KEY does not match the stored wealth data');
      }
      // Database not ready or tables not created yet: nothing to verify here.
    }
  }
}

function aad(table: WealthTable, id: string, ownerId: string): string {
  return `${table}|${id}|${ownerId}`;
}
