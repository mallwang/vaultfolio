import { Injectable, Logger } from '@nestjs/common';
import type { EncryptionDomainId } from '@vaultfolio/api-contract';
import { LEGACY_VERSION, type Keyring, decryptValue } from '@vaultfolio/encryption';
import { DatabaseService } from '../database/database.service';
import { findDomain, rowAad } from './domain-encryption.registry';
import { KeyStoreRepository } from './key-store.repository';

export const REENCRYPTION_BATCH_SIZE = 500;

/** One-time upgrade of `v1` rows (encrypted directly with the master key) onto the first data key. */
@Injectable()
export class LegacyMigrationService {
  private readonly logger = new Logger(LegacyMigrationService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly store: KeyStoreRepository,
  ) {}

  hasLegacyRows(domain: EncryptionDomainId): boolean {
    return (findDomain(domain)?.tables ?? []).some(
      (t) =>
        this.database.querySync(
          `SELECT 1 FROM ${t.table} WHERE ${t.ciphertextColumn} LIKE 'v${LEGACY_VERSION}:%' LIMIT 1`,
        ).length > 0,
    );
  }

  /** Returns the first candidate that decrypts one stored `v1` row, or `null` (nothing is written). */
  proveLegacyKey(domain: EncryptionDomainId, candidates: readonly Buffer[]): Buffer | null {
    for (const t of findDomain(domain)?.tables ?? []) {
      const [row] = this.database.querySync<{ id: string; owner_id: string; ciphertext: string }>(
        `SELECT ${t.idColumn} AS id, ${t.ownerColumn} AS owner_id, ${t.ciphertextColumn} AS ciphertext
         FROM ${t.table} WHERE ${t.ciphertextColumn} LIKE 'v${LEGACY_VERSION}:%' LIMIT 1`,
      );
      if (!row) continue;
      const aad = rowAad(t.table, row.id, row.owner_id);
      return (
        candidates.find((key) => {
          try {
            decryptValue(key, aad, row.ciphertext);
            return true;
          } catch {
            return false;
          }
        }) ?? null
      );
    }
    return null;
  }

  /** Re-encrypts every `v1` row onto the ring's current data key; idempotent and resumable. */
  migrate(domain: EncryptionDomainId, ring: Keyring): void {
    const target = ring.currentVersion;
    const run = this.store.createRun({
      domain,
      kind: 'LEGACY_MIGRATION',
      fromVersion: LEGACY_VERSION,
      toVersion: target,
      recordsTotal: this.store.countRowsBelow(domain, target ?? LEGACY_VERSION + 1),
    });
    let done = 0;
    try {
      for (;;) {
        const moved = this.store.reencryptBatch(domain, ring, REENCRYPTION_BATCH_SIZE);
        if (moved === 0) break;
        done += moved;
        this.store.updateProgress(run.id, done);
      }
      this.store.finishRun(run.id, 'SUCCEEDED');
      this.logger.log({ event: 'EncryptionLegacyMigrationDone', domain, rows: done });
    } catch (error) {
      this.store.finishRun(run.id, 'FAILED', 'DB_ERROR');
      throw error;
    }
  }
}
