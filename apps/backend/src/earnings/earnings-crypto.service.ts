import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { EarningsUnavailableException } from './earnings.exceptions';

export type EarningsEncryptedTable = 'earnings_records' | 'earnings_certificates';

const FORMAT_VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Decodes `EARNINGS_ENCRYPTION_KEY`; `null` unless it is base64 of exactly 32 bytes. */
export function decodeEarningsKey(raw: string | undefined): Buffer | null {
  const value = raw?.trim() ?? '';
  if (!value || value.length % 4 !== 0 || !BASE64.test(value)) {
    return null;
  }
  const key = Buffer.from(value, 'base64');
  return key.length === KEY_BYTES ? key : null;
}

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
    const key = this.requireKey();
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad(table, id, ownerId));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      FORMAT_VERSION,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt<T>(table: EarningsEncryptedTable, id: string, ownerId: string, encoded: string): T {
    const key = this.requireKey();
    try {
      const [version, iv, tag, ciphertext, ...rest] = encoded.split(':');
      if (
        version !== FORMAT_VERSION ||
        rest.length > 0 ||
        !iv ||
        !tag ||
        ciphertext === undefined
      ) {
        throw new Error('format');
      }
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
      decipher.setAAD(aad(table, id, ownerId));
      decipher.setAuthTag(Buffer.from(tag, 'base64'));
      const plain = Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
      ]);
      return JSON.parse(plain.toString('utf8')) as T;
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

function aad(table: EarningsEncryptedTable, id: string, ownerId: string): Buffer {
  return Buffer.from(`${table}|${id}|${ownerId}`, 'utf8');
}
