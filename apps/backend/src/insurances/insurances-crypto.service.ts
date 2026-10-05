import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { decodeFieldKey, decryptField, encryptField } from '../shared/field-crypto';
import { InsurancesUnavailableException } from './insurances.exceptions';

export const INSURANCE_CONTRACTS_TABLE = 'insurance_contracts';
export const INSURANCE_SETTINGS_TABLE = 'insurance_settings';

type InsurancesTable = typeof INSURANCE_CONTRACTS_TABLE | typeof INSURANCE_SETTINGS_TABLE;

/**
 * AES-256-GCM encryption at rest for insurance contracts and settings. One ciphertext per row, fresh
 * 12-byte IV per write, AAD `<table>|<row id>|<owner_id>` so a ciphertext cannot be moved to
 * another row or user. Format: `v1:<iv b64>:<tag b64>:<ciphertext b64>`.
 *
 * A missing or invalid `INSURANCES_ENCRYPTION_KEY` does not crash the app: the service reports
 * `available === false` and every insurances route answers 503. At boot it also decrypts one stored
 * row of each table, so a different key over existing data fails closed too; any authentication
 * failure at runtime flips the service to unavailable. Payloads are never logged.
 */
@Injectable()
export class InsurancesCryptoService implements OnModuleInit {
  private readonly logger = new Logger(InsurancesCryptoService.name);
  private key: Buffer | null = null;
  private keyRejected = false;

  constructor(private readonly database: DatabaseService) {}

  onModuleInit(): void {
    this.key = decodeFieldKey(process.env.INSURANCES_ENCRYPTION_KEY);
    if (!this.key) {
      this.logger.warn(
        'INSURANCES_ENCRYPTION_KEY is missing or not base64 of 32 bytes — the Insurances domain is unavailable',
      );
      return;
    }
    this.verifyKeyAgainstStoredData();
  }

  get available(): boolean {
    return this.key !== null && !this.keyRejected;
  }

  encrypt(table: InsurancesTable, id: string, ownerId: string, payload: unknown): string {
    return encryptField(this.requireKey(), aad(table, id, ownerId), payload);
  }

  decrypt<T>(table: InsurancesTable, id: string, ownerId: string, encoded: string): T {
    const key = this.requireKey();
    try {
      return decryptField<T>(key, aad(table, id, ownerId), encoded);
    } catch {
      // Fail closed: never return partial data, never log the ciphertext or the row.
      this.keyRejected = true;
      this.logger.error({ event: 'InsurancesDecryptFailed', table, id });
      throw new InsurancesUnavailableException();
    }
  }

  private requireKey(): Buffer {
    if (!this.key || this.keyRejected) {
      throw new InsurancesUnavailableException();
    }
    return this.key;
  }

  /** Decrypts one stored row per table (if any) to detect a changed key at boot. */
  private verifyKeyAgainstStoredData(): void {
    try {
      const [contract] = this.database.querySync<{
        id: string;
        owner_id: string;
        payload_enc: string;
      }>(`SELECT id, owner_id, payload_enc FROM ${INSURANCE_CONTRACTS_TABLE} LIMIT 1`);
      if (contract) {
        this.decrypt(
          INSURANCE_CONTRACTS_TABLE,
          contract.id,
          contract.owner_id,
          contract.payload_enc,
        );
      }
      const [settings] = this.database.querySync<{ owner_id: string; payload_enc: string }>(
        `SELECT owner_id, payload_enc FROM ${INSURANCE_SETTINGS_TABLE} LIMIT 1`,
      );
      if (settings) {
        this.decrypt(
          INSURANCE_SETTINGS_TABLE,
          settings.owner_id,
          settings.owner_id,
          settings.payload_enc,
        );
      }
    } catch (error) {
      if (error instanceof InsurancesUnavailableException) {
        this.logger.error('INSURANCES_ENCRYPTION_KEY does not match the stored insurances data');
      }
      // Database not ready or tables not created yet: nothing to verify here.
    }
  }
}

function aad(table: InsurancesTable, id: string, ownerId: string): string {
  return `${table}|${id}|${ownerId}`;
}
