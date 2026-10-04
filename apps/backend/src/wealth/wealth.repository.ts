import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  WealthClassGroupAssignment,
  WealthEntry,
  WealthSettings,
  WealthSnapshot,
  WealthSnapshotInput,
} from '@vaultfolio/api-contract';
import { DatabaseService } from '../database/database.service';
import {
  WEALTH_SETTINGS_TABLE,
  WEALTH_SNAPSHOTS_TABLE,
  WealthCryptoService,
} from './wealth-crypto.service';
import { WealthSnapshotDateExistsException } from './wealth.exceptions';

/** What is stored encrypted in `wealth_snapshots.payload_enc`. */
interface SnapshotPayload {
  note?: string;
  entries: WealthEntry[];
}

/** What is stored encrypted in `wealth_settings.payload_enc`. */
interface SettingsPayload {
  classGroups: WealthClassGroupAssignment[];
}

interface SnapshotRow {
  id: string;
  owner_id: string;
  snapshot_date: string;
  payload_enc: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = 'id, owner_id, snapshot_date, payload_enc, created_at, updated_at';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

function payloadOf(input: WealthSnapshotInput): SnapshotPayload {
  const payload: SnapshotPayload = { entries: input.entries };
  if (input.note !== undefined) payload.note = input.note;
  return payload;
}

/**
 * Raw `better-sqlite3` access to `wealth_snapshots` and `wealth_settings` (data-model.md). Every
 * method takes the caller's `ownerId` and filters by it in the SQL itself: a row of another owner
 * is indistinguishable from a missing row. Names, classes, amounts and notes are
 * encrypted/decrypted here and nowhere else.
 */
@Injectable()
export class WealthRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: WealthCryptoService,
  ) {}

  /** Ascending by snapshot date. */
  list(ownerId: string): WealthSnapshot[] {
    return this.database
      .querySync<SnapshotRow>(
        `SELECT ${COLUMNS} FROM ${WEALTH_SNAPSHOTS_TABLE} WHERE owner_id = $1
         ORDER BY snapshot_date ASC, id`,
        [ownerId],
      )
      .map((row) => this.toSnapshot(row));
  }

  count(ownerId: string): number {
    const [row] = this.database.querySync<{ total: number }>(
      `SELECT COUNT(*) AS total FROM ${WEALTH_SNAPSHOTS_TABLE} WHERE owner_id = $1`,
      [ownerId],
    );
    return row?.total ?? 0;
  }

  get(ownerId: string, id: string): WealthSnapshot | null {
    const [row] = this.database.querySync<SnapshotRow>(
      `SELECT ${COLUMNS} FROM ${WEALTH_SNAPSHOTS_TABLE} WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return row ? this.toSnapshot(row) : null;
  }

  /** Throws `WealthSnapshotDateExistsException` when the owner already has that date. */
  insert(ownerId: string, input: WealthSnapshotInput): WealthSnapshot {
    const id = randomUUID();
    const now = new Date().toISOString();
    try {
      this.database.querySync(
        `INSERT INTO ${WEALTH_SNAPSHOTS_TABLE}
           (id, owner_id, snapshot_date, payload_enc, key_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 1, $5, $5)`,
        [
          id,
          ownerId,
          input.snapshotDate,
          this.crypto.encrypt(WEALTH_SNAPSHOTS_TABLE, id, ownerId, payloadOf(input)),
          now,
        ],
      );
    } catch (error) {
      throw this.mapUnique(error, ownerId, input.snapshotDate);
    }
    return this.requireSnapshot(ownerId, id);
  }

  /** Replaces date, note and entries; `null` when the id is not the caller's. */
  update(ownerId: string, id: string, input: WealthSnapshotInput): WealthSnapshot | null {
    let updated: { id: string }[];
    try {
      updated = this.database.querySync<{ id: string }>(
        `UPDATE ${WEALTH_SNAPSHOTS_TABLE}
           SET snapshot_date = $3, payload_enc = $4, updated_at = $5
         WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [
          id,
          ownerId,
          input.snapshotDate,
          this.crypto.encrypt(WEALTH_SNAPSHOTS_TABLE, id, ownerId, payloadOf(input)),
          new Date().toISOString(),
        ],
      );
    } catch (error) {
      throw this.mapUnique(error, ownerId, input.snapshotDate);
    }
    return updated.length > 0 ? this.requireSnapshot(ownerId, id) : null;
  }

  /** `true` when a row of the caller was deleted. */
  delete(ownerId: string, id: string): boolean {
    return (
      this.database.querySync(
        `DELETE FROM ${WEALTH_SNAPSHOTS_TABLE} WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [id, ownerId],
      ).length > 0
    );
  }

  getSettings(ownerId: string): WealthSettings {
    const [row] = this.database.querySync<{ payload_enc: string }>(
      `SELECT payload_enc FROM ${WEALTH_SETTINGS_TABLE} WHERE owner_id = $1`,
      [ownerId],
    );
    if (!row) return { classGroups: [] };
    const payload = this.crypto.decrypt<SettingsPayload>(
      WEALTH_SETTINGS_TABLE,
      ownerId,
      ownerId,
      row.payload_enc,
    );
    return { classGroups: payload.classGroups };
  }

  saveSettings(ownerId: string, settings: WealthSettings): WealthSettings {
    this.database.querySync(
      `INSERT INTO ${WEALTH_SETTINGS_TABLE} (owner_id, payload_enc, key_version, updated_at)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (owner_id) DO UPDATE SET payload_enc = excluded.payload_enc,
         updated_at = excluded.updated_at`,
      [
        ownerId,
        this.crypto.encrypt(WEALTH_SETTINGS_TABLE, ownerId, ownerId, {
          classGroups: settings.classGroups,
        } satisfies SettingsPayload),
        new Date().toISOString(),
      ],
    );
    return this.getSettings(ownerId);
  }

  /** Deletes every snapshot and the settings row of the caller; returns the snapshots removed. */
  deleteAllForOwner(ownerId: string): number {
    return this.database.transaction(() => {
      const removed = this.database.querySync(
        `DELETE FROM ${WEALTH_SNAPSHOTS_TABLE} WHERE owner_id = $1 RETURNING id`,
        [ownerId],
      ).length;
      this.database.querySync(`DELETE FROM ${WEALTH_SETTINGS_TABLE} WHERE owner_id = $1`, [
        ownerId,
      ]);
      return removed;
    });
  }

  private mapUnique(error: unknown, ownerId: string, date: string): unknown {
    if (!isUniqueViolation(error)) return error;
    const [existing] = this.database.querySync<{ id: string }>(
      `SELECT id FROM ${WEALTH_SNAPSHOTS_TABLE} WHERE owner_id = $1 AND snapshot_date = $2`,
      [ownerId, date],
    );
    return existing ? new WealthSnapshotDateExistsException(existing.id) : error;
  }

  private requireSnapshot(ownerId: string, id: string): WealthSnapshot {
    const snapshot = this.get(ownerId, id);
    if (!snapshot) throw new Error('Wealth snapshot vanished after write');
    return snapshot;
  }

  private toSnapshot(row: SnapshotRow): WealthSnapshot {
    const payload = this.crypto.decrypt<SnapshotPayload>(
      WEALTH_SNAPSHOTS_TABLE,
      row.id,
      row.owner_id,
      row.payload_enc,
    );
    const snapshot: WealthSnapshot = {
      id: row.id,
      snapshotDate: row.snapshot_date,
      entries: payload.entries,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    if (payload.note !== undefined) snapshot.note = payload.note;
    return snapshot;
  }
}
