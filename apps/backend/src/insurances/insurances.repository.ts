import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  InsuranceContract,
  InsuranceContractInput,
  InsuranceSettings,
} from '@vaultfolio/api-contract';
import { DEFAULT_SETTINGS } from '@vaultfolio/insurances';
import { DatabaseService } from '../database/database.service';
import {
  INSURANCE_CONTRACTS_TABLE,
  INSURANCE_SETTINGS_TABLE,
  InsurancesCryptoService,
} from './insurances-crypto.service';

interface ContractRow {
  id: string;
  owner_id: string;
  payload_enc: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, owner_id, payload_enc, created_at, updated_at';

/**
 * Raw `better-sqlite3` access to the three insurance tables (data-model.md). Every method takes the
 * caller's `ownerId` and filters by it in the SQL itself: a row of another owner is
 * indistinguishable from a missing row. Contract and settings data is encrypted/decrypted here and
 * nowhere else; the reminder log is plain (ids and a date only).
 */
@Injectable()
export class InsurancesRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: InsurancesCryptoService,
  ) {}

  list(ownerId: string): InsuranceContract[] {
    return this.database
      .querySync<ContractRow>(
        `SELECT ${COLUMNS} FROM ${INSURANCE_CONTRACTS_TABLE} WHERE owner_id = $1
         ORDER BY created_at ASC, id`,
        [ownerId],
      )
      .map((row) => this.toContract(row));
  }

  count(ownerId: string): number {
    const [row] = this.database.querySync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${INSURANCE_CONTRACTS_TABLE} WHERE owner_id = $1`,
      [ownerId],
    );
    return row?.total ?? 0;
  }

  get(ownerId: string, id: string): InsuranceContract | null {
    const [row] = this.database.querySync<ContractRow>(
      `SELECT ${COLUMNS} FROM ${INSURANCE_CONTRACTS_TABLE} WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return row ? this.toContract(row) : null;
  }

  insert(ownerId: string, input: InsuranceContractInput): InsuranceContract {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.querySync(
      `INSERT INTO ${INSURANCE_CONTRACTS_TABLE}
         (id, owner_id, payload_enc, key_version, created_at, updated_at)
       VALUES ($1, $2, $3, 1, $4, $4)`,
      [id, ownerId, this.crypto.encrypt(INSURANCE_CONTRACTS_TABLE, id, ownerId, input), now],
    );
    return this.require(ownerId, id);
  }

  /** `null` when the id is not the caller's. */
  update(ownerId: string, id: string, input: InsuranceContractInput): InsuranceContract | null {
    const updated = this.database.querySync<{ id: string }>(
      `UPDATE ${INSURANCE_CONTRACTS_TABLE}
         SET payload_enc = $3, updated_at = $4
       WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [
        id,
        ownerId,
        this.crypto.encrypt(INSURANCE_CONTRACTS_TABLE, id, ownerId, input),
        new Date().toISOString(),
      ],
    );
    return updated.length > 0 ? this.require(ownerId, id) : null;
  }

  /** `true` when a row of the caller was deleted; its reminder-log rows go with it. */
  delete(ownerId: string, id: string): boolean {
    return this.database.transaction(() => {
      const removed =
        this.database.querySync(
          `DELETE FROM ${INSURANCE_CONTRACTS_TABLE} WHERE id = $1 AND owner_id = $2 RETURNING id`,
          [id, ownerId],
        ).length > 0;
      if (removed) this.clearReminders(ownerId, id);
      return removed;
    });
  }

  getSettings(ownerId: string): InsuranceSettings {
    const [row] = this.database.querySync<{ payload_enc: string }>(
      `SELECT payload_enc FROM ${INSURANCE_SETTINGS_TABLE} WHERE owner_id = $1`,
      [ownerId],
    );
    if (!row) return structuredClone(DEFAULT_SETTINGS);
    return this.crypto.decrypt<InsuranceSettings>(
      INSURANCE_SETTINGS_TABLE,
      ownerId,
      ownerId,
      row.payload_enc,
    );
  }

  saveSettings(ownerId: string, settings: InsuranceSettings): InsuranceSettings {
    this.database.querySync(
      `INSERT INTO ${INSURANCE_SETTINGS_TABLE} (owner_id, payload_enc, key_version, updated_at)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (owner_id) DO UPDATE SET payload_enc = excluded.payload_enc,
         updated_at = excluded.updated_at`,
      [
        ownerId,
        this.crypto.encrypt(INSURANCE_SETTINGS_TABLE, ownerId, ownerId, settings),
        new Date().toISOString(),
      ],
    );
    return this.getSettings(ownerId);
  }

  /** Owners that have a settings row (candidates for the reminder sweep). */
  ownersWithSettings(): string[] {
    return this.database
      .querySync<{ owner_id: string }>(`SELECT owner_id FROM ${INSURANCE_SETTINGS_TABLE}`)
      .map((row) => row.owner_id);
  }

  /** Deletes contracts, settings and reminder log of the caller; returns the contracts removed. */
  deleteAllForOwner(ownerId: string): number {
    return this.database.transaction(() => {
      const removed = this.database.querySync(
        `DELETE FROM ${INSURANCE_CONTRACTS_TABLE} WHERE owner_id = $1 RETURNING id`,
        [ownerId],
      ).length;
      this.database.querySync(`DELETE FROM ${INSURANCE_SETTINGS_TABLE} WHERE owner_id = $1`, [
        ownerId,
      ]);
      this.database.querySync('DELETE FROM insurance_reminder_log WHERE owner_id = $1', [ownerId]);
      return removed;
    });
  }

  // ---------------------------------------------------------------- reminder log

  /** `true` when the row was new, i.e. the reminder may be sent (primary-key dedup). */
  claimReminder(ownerId: string, contractId: string, deadlineDate: string): boolean {
    return (
      this.database.querySync(
        `INSERT INTO insurance_reminder_log (owner_id, contract_id, deadline_date, sent_at)
         VALUES ($1, $2, $3, $4) ON CONFLICT (contract_id, deadline_date) DO NOTHING RETURNING contract_id`,
        [ownerId, contractId, deadlineDate, new Date().toISOString()],
      ).length > 0
    );
  }

  releaseReminder(contractId: string, deadlineDate: string): void {
    this.database.querySync(
      'DELETE FROM insurance_reminder_log WHERE contract_id = $1 AND deadline_date = $2',
      [contractId, deadlineDate],
    );
  }

  clearReminders(ownerId: string, contractId: string): void {
    this.database.querySync(
      'DELETE FROM insurance_reminder_log WHERE owner_id = $1 AND contract_id = $2',
      [ownerId, contractId],
    );
  }

  private require(ownerId: string, id: string): InsuranceContract {
    const contract = this.get(ownerId, id);
    if (!contract) throw new Error('Insurance contract vanished after write');
    return contract;
  }

  private toContract(row: ContractRow): InsuranceContract {
    const payload = this.crypto.decrypt<InsuranceContractInput>(
      INSURANCE_CONTRACTS_TABLE,
      row.id,
      row.owner_id,
      row.payload_enc,
    );
    return { ...payload, id: row.id, createdAt: row.created_at, updatedAt: row.updated_at };
  }
}
