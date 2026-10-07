import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  EncryptionDomainId,
  EncryptionRunKind,
  EncryptionRunStatus,
  RotationRun,
} from '@vaultfolio/api-contract';
import type { Keyring } from '@vaultfolio/encryption';
import { DatabaseService } from '../database/database.service';
import { type EncryptedTable, findDomain, rowAad } from './domain-encryption.registry';

export type DataKeyStatus = 'current' | 'retired' | 'destroyed';

export interface StoredDataKey {
  domain: string;
  version: number;
  wrappedDek: string | null;
  kekFingerprint: string | null;
  status: DataKeyStatus;
}

interface DataKeyRow {
  domain: string;
  version: number;
  wrapped_dek: string | null;
  kek_fingerprint: string | null;
  status: DataKeyStatus;
}

interface RunRow {
  id: string;
  domain: EncryptionDomainId;
  kind: EncryptionRunKind;
  status: EncryptionRunStatus;
  started_at: string;
  finished_at: string | null;
  triggered_by_email: string | null;
  from_version: number | null;
  to_version: number | null;
  records_total: number;
  records_done: number;
  error_code: string | null;
}

export interface NewRun {
  domain: EncryptionDomainId;
  kind: EncryptionRunKind;
  triggeredByUserId?: string | null;
  triggeredByEmail?: string | null;
  fromVersion?: number | null;
  toVersion?: number | null;
  recordsTotal?: number;
}

/** SQL expression for the key version named by the ciphertext prefix (`v<N>:...`); authoritative. */
function versionExpression(column: string): string {
  return `CAST(SUBSTR(${column}, 2, INSTR(${column}, ':') - 2) AS INTEGER)`;
}

const RUN_COLUMNS =
  'id, domain, kind, status, started_at, finished_at, triggered_by_email, from_version, to_version, records_total, records_done, error_code';

/** Persistence of wrapped data keys and rotation history (data-model.md). Never holds plain keys. */
@Injectable()
export class KeyStoreRepository {
  constructor(private readonly database: DatabaseService) {}

  listDataKeys(domain: string): StoredDataKey[] {
    return this.database
      .querySync<DataKeyRow>(
        'SELECT domain, version, wrapped_dek, kek_fingerprint, status FROM encryption_data_keys WHERE domain = $1 ORDER BY version',
        [domain],
      )
      .map((r) => ({
        domain: r.domain,
        version: r.version,
        wrappedDek: r.wrapped_dek,
        kekFingerprint: r.kek_fingerprint,
        status: r.status,
      }));
  }

  /** Highest version ever issued for the domain (destroyed tombstones included). */
  highestVersion(domain: string): number {
    const [row] = this.database.querySync<{ v: number | null }>(
      'SELECT MAX(version) AS v FROM encryption_data_keys WHERE domain = $1',
      [domain],
    );
    return row?.v ?? 1;
  }

  insertDataKey(
    domain: string,
    version: number,
    wrappedDek: string,
    kekFingerprint: string,
    status: DataKeyStatus,
  ): void {
    this.database.querySync(
      `INSERT INTO encryption_data_keys (domain, version, wrapped_dek, kek_fingerprint, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [domain, version, wrappedDek, kekFingerprint, status, new Date().toISOString()],
    );
  }

  updateWrapping(
    domain: string,
    version: number,
    wrappedDek: string,
    kekFingerprint: string,
  ): void {
    this.database.querySync(
      `UPDATE encryption_data_keys SET wrapped_dek = $3, kek_fingerprint = $4
       WHERE domain = $1 AND version = $2 AND status != 'destroyed'`,
      [domain, version, wrappedDek, kekFingerprint],
    );
  }

  retireCurrent(domain: string): void {
    this.database.querySync(
      `UPDATE encryption_data_keys SET status = 'retired', retired_at = $2
       WHERE domain = $1 AND status = 'current'`,
      [domain, new Date().toISOString()],
    );
  }

  markDestroyed(domain: string, version: number): void {
    this.database.querySync(
      `UPDATE encryption_data_keys
       SET status = 'destroyed', wrapped_dek = NULL, kek_fingerprint = NULL, destroyed_at = $3
       WHERE domain = $1 AND version = $2 AND status = 'retired'`,
      [domain, version, new Date().toISOString()],
    );
  }

  /** Rows per key version across the domain's tables (counts only). */
  countRowsPerVersion(domain: string): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const table of findDomain(domain)?.tables ?? []) {
      const rows = this.database.querySync<{ v: number; c: number }>(
        `SELECT ${versionExpression(table.ciphertextColumn)} AS v, COUNT(*) AS c FROM ${table.table} GROUP BY v`,
      );
      for (const { v, c } of rows) {
        counts[String(v)] = (counts[String(v)] ?? 0) + c;
      }
    }
    return counts;
  }

  countRowsAtVersion(domain: string, version: number): number {
    return this.countRowsPerVersion(domain)[String(version)] ?? 0;
  }

  /** Rows of `table` whose ciphertext is not on `targetVersion` yet (at most `limit`). */
  selectRowsBelow(
    table: EncryptedTable,
    targetVersion: number,
    limit: number,
  ): { id: string; ownerId: string; ciphertext: string }[] {
    return this.database
      .querySync<{ id: string; owner_id: string; ciphertext: string }>(
        `SELECT ${table.idColumn} AS id, ${table.ownerColumn} AS owner_id, ${table.ciphertextColumn} AS ciphertext
         FROM ${table.table}
         WHERE ${table.ciphertextColumn} NOT LIKE $1
         LIMIT $2`,
        [`v${targetVersion}:%`, limit],
      )
      .map((r) => ({ id: r.id, ownerId: r.owner_id, ciphertext: r.ciphertext }));
  }

  countRowsBelow(domain: string, targetVersion: number): number {
    let total = 0;
    for (const table of findDomain(domain)?.tables ?? []) {
      const [row] = this.database.querySync<{ c: number }>(
        `SELECT COUNT(*) AS c FROM ${table.table} WHERE ${table.ciphertextColumn} NOT LIKE $1`,
        [`v${targetVersion}:%`],
      );
      total += row?.c ?? 0;
    }
    return total;
  }

  writeCiphertext(table: EncryptedTable, id: string, ciphertext: string, version: number): void {
    this.database.querySync(
      `UPDATE ${table.table} SET ${table.ciphertextColumn} = $1, key_version = $2 WHERE ${table.idColumn} = $3`,
      [ciphertext, version, id],
    );
  }

  /**
   * Moves up to `limit` rows of the domain onto the ring's current key version in one transaction
   * (all or nothing). Returns how many rows moved; 0 means every row is current.
   */
  reencryptBatch(domain: string, ring: Keyring, limit: number): number {
    const target = ring.currentVersion;
    if (target === null) {
      throw new Error('No current data key');
    }
    return this.database.transaction(() => {
      let moved = 0;
      for (const table of findDomain(domain)?.tables ?? []) {
        for (const row of this.selectRowsBelow(table, target, limit - moved)) {
          const aad = rowAad(table.table, row.id, row.ownerId);
          const payload = ring.decrypt<unknown>(aad, row.ciphertext);
          this.writeCiphertext(table, row.id, ring.encrypt(aad, payload), target);
          moved += 1;
        }
        if (moved >= limit) break;
      }
      return moved;
    });
  }

  /** Runs still `RUNNING` from a previous process can never finish: mark them interrupted. */
  markLeftoverRunsInterrupted(): void {
    this.database.querySync(
      `UPDATE encryption_rotation_runs SET status = 'INTERRUPTED', finished_at = $1 WHERE status = 'RUNNING'`,
      [new Date().toISOString()],
    );
  }

  createRun(input: NewRun): RotationRun {
    const id = randomUUID();
    this.database.querySync(
      `INSERT INTO encryption_rotation_runs
         (id, domain, kind, status, started_at, triggered_by_user_id, triggered_by_email, from_version, to_version, records_total)
       VALUES ($1, $2, $3, 'RUNNING', $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.domain,
        input.kind,
        new Date().toISOString(),
        input.triggeredByUserId ?? null,
        input.triggeredByEmail ?? null,
        input.fromVersion ?? null,
        input.toVersion ?? null,
        input.recordsTotal ?? 0,
      ],
    );
    return this.getRun(id) as RotationRun;
  }

  updateProgress(id: string, recordsDone: number, recordsTotal?: number): void {
    this.database.querySync(
      'UPDATE encryption_rotation_runs SET records_done = $2, records_total = COALESCE($3, records_total) WHERE id = $1',
      [id, recordsDone, recordsTotal ?? null],
    );
  }

  updateToVersion(id: string, toVersion: number | null): void {
    this.database.querySync('UPDATE encryption_rotation_runs SET to_version = $2 WHERE id = $1', [
      id,
      toVersion,
    ]);
  }

  finishRun(id: string, status: EncryptionRunStatus, errorCode?: string | null): RotationRun {
    this.database.querySync(
      'UPDATE encryption_rotation_runs SET status = $2, finished_at = $3, error_code = $4 WHERE id = $1',
      [id, status, new Date().toISOString(), errorCode ?? null],
    );
    return this.getRun(id) as RotationRun;
  }

  getRun(id: string): RotationRun | null {
    const [row] = this.database.querySync<RunRow>(
      `SELECT ${RUN_COLUMNS} FROM encryption_rotation_runs WHERE id = $1`,
      [id],
    );
    return row ? toRun(row) : null;
  }

  runningRun(domain: string): RotationRun | null {
    const [row] = this.database.querySync<RunRow>(
      `SELECT ${RUN_COLUMNS} FROM encryption_rotation_runs WHERE domain = $1 AND status = 'RUNNING'`,
      [domain],
    );
    return row ? toRun(row) : null;
  }

  lastRun(domain: string): RotationRun | null {
    return this.history(domain, 1)[0] ?? null;
  }

  history(domain: string | undefined, limit: number): RotationRun[] {
    const where = domain ? 'WHERE domain = $1' : '';
    const params = domain ? [domain, limit] : [limit];
    return this.database
      .querySync<RunRow>(
        `SELECT ${RUN_COLUMNS} FROM encryption_rotation_runs ${where}
         ORDER BY started_at DESC, rowid DESC LIMIT $${params.length}`,
        params,
      )
      .map(toRun);
  }
}

function toRun(row: RunRow): RotationRun {
  return {
    id: row.id,
    domain: row.domain,
    kind: row.kind,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    triggeredByEmail: row.triggered_by_email,
    fromVersion: row.from_version,
    toVersion: row.to_version,
    recordsTotal: row.records_total,
    recordsDone: row.records_done,
    errorCode: row.error_code,
  };
}
