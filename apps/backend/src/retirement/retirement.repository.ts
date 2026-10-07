import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  RetirementFigures,
  RetirementImportInfo,
  RetirementPillar,
  RetirementRecord,
  RetirementRecordInput,
  RetirementStatus,
  RetirementSupplement,
} from '@vaultfolio/api-contract';
import { pillarOf } from '@vaultfolio/retirement';
import { DatabaseService } from '../database/database.service';
import { RETIREMENT_TABLE, RetirementCryptoService } from './retirement-crypto.service';
import { RetirementStatutoryExistsException } from './retirement.exceptions';

/** What is stored encrypted in `payload_enc`. */
export interface RetirementPayload {
  identifier?: string;
  figures: RetirementFigures;
  supplement?: RetirementSupplement;
}

/** Row data for an insert/update: the validated body without the `replaces` instruction. */
export type RetirementRecordData = Omit<RetirementRecordInput, 'replaces'>;

interface Row {
  id: string;
  owner_id: string;
  pillar: RetirementPillar;
  contract_type: RetirementRecord['contractType'];
  origin: RetirementRecord['origin'];
  status: RetirementStatus;
  provider_label: string | null;
  statement_date: string;
  payout_start: string | null;
  parser_id: string | null;
  parser_version: string | null;
  ocr_read: number;
  payload_enc: string;
  created_at: string;
  updated_at: string;
}

const COLUMNS = `id, owner_id, pillar, contract_type, origin, status, provider_label, statement_date,
  payout_start, parser_id, parser_version, ocr_read, payload_enc, created_at, updated_at`;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}

function payloadOf(data: RetirementRecordData): RetirementPayload {
  const payload: RetirementPayload = { figures: data.figures };
  if (data.identifier !== undefined) payload.identifier = data.identifier;
  if (data.supplement !== undefined) payload.supplement = data.supplement;
  return payload;
}

/**
 * Raw `better-sqlite3` access to `retirement_records` (data-model.md). Every method takes the
 * caller's `ownerId` and filters by it in the SQL itself: a row of another owner is
 * indistinguishable from a missing row. Figures and identifiers are encrypted/decrypted here and
 * nowhere else; multi-statement writes run inside `DatabaseService.transaction()`.
 */
@Injectable()
export class RetirementRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: RetirementCryptoService,
  ) {}

  /** Newest statement first; `pillar` optional. */
  list(ownerId: string, pillar?: RetirementPillar): RetirementRecord[] {
    const rows = pillar
      ? this.database.querySync<Row>(
          `SELECT ${COLUMNS} FROM ${RETIREMENT_TABLE} WHERE owner_id = $1 AND pillar = $2
           ORDER BY statement_date DESC, created_at DESC, id`,
          [ownerId, pillar],
        )
      : this.database.querySync<Row>(
          `SELECT ${COLUMNS} FROM ${RETIREMENT_TABLE} WHERE owner_id = $1
           ORDER BY statement_date DESC, created_at DESC, id`,
          [ownerId],
        );
    return rows.map((row) => this.toRecord(row));
  }

  get(ownerId: string, id: string): RetirementRecord | null {
    const [row] = this.database.querySync<Row>(
      `SELECT ${COLUMNS} FROM ${RETIREMENT_TABLE} WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return row ? this.toRecord(row) : null;
  }

  hasStatutory(ownerId: string): boolean {
    return (
      this.database.querySync(
        `SELECT 1 AS found FROM ${RETIREMENT_TABLE} WHERE owner_id = $1 AND pillar = 'STATUTORY' LIMIT 1`,
        [ownerId],
      ).length > 0
    );
  }

  insert(ownerId: string, data: RetirementRecordData): RetirementRecord {
    const id = randomUUID();
    const now = new Date().toISOString();
    try {
      this.database.querySync(
        `INSERT INTO ${RETIREMENT_TABLE} (id, owner_id, pillar, contract_type, origin, status,
           provider_label, statement_date, payout_start, parser_id, parser_version, ocr_read,
           payload_enc, key_version, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, ${this.crypto.keyVersion}, $14, $14)`,
        [
          id,
          ownerId,
          pillarOf(data.contractType),
          data.contractType,
          data.origin,
          data.status,
          data.providerLabel ?? null,
          data.statementDate,
          data.payoutStart ?? null,
          data.import?.parserId ?? null,
          data.import?.parserVersion ?? null,
          data.import?.ocrRead ? 1 : 0,
          this.crypto.encrypt(id, ownerId, payloadOf(data)),
          now,
        ],
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new RetirementStatutoryExistsException();
      throw error;
    }
    return this.requireRecord(ownerId, id);
  }

  /** Rewrites the editable columns and the payload of a record; `null` when it is not the caller's. */
  update(ownerId: string, id: string, data: RetirementRecordData): RetirementRecord | null {
    const [existing] = this.database.querySync<{ id: string }>(
      `UPDATE ${RETIREMENT_TABLE}
         SET status = $3, provider_label = $4, statement_date = $5, payout_start = $6,
             payload_enc = $7, key_version = ${this.crypto.keyVersion}, updated_at = $8
       WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [
        id,
        ownerId,
        data.status,
        data.providerLabel ?? null,
        data.statementDate,
        data.payoutStart ?? null,
        this.crypto.encrypt(id, ownerId, payloadOf(data)),
        new Date().toISOString(),
      ],
    );
    return existing ? this.requireRecord(ownerId, id) : null;
  }

  /** Imported records: replaces the supplement and optionally the status. */
  updateSupplement(
    ownerId: string,
    id: string,
    supplement: RetirementSupplement,
    status?: RetirementStatus,
  ): RetirementRecord | null {
    const current = this.get(ownerId, id);
    if (!current) return null;
    const payload: RetirementPayload = { figures: current.figures, supplement };
    if (current.identifier !== null) payload.identifier = current.identifier;
    this.database.querySync(
      `UPDATE ${RETIREMENT_TABLE} SET status = $3, payload_enc = $4, key_version = ${this.crypto.keyVersion}, updated_at = $5
       WHERE id = $1 AND owner_id = $2`,
      [
        id,
        ownerId,
        status ?? current.status,
        this.crypto.encrypt(id, ownerId, payload),
        new Date().toISOString(),
      ],
    );
    return this.requireRecord(ownerId, id);
  }

  /** `true` when a row of the caller was deleted. */
  delete(ownerId: string, id: string): boolean {
    return (
      this.database.querySync(
        `DELETE FROM ${RETIREMENT_TABLE} WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [id, ownerId],
      ).length > 0
    );
  }

  /** Deletes every row of the caller; returns how many were removed. */
  deleteAll(ownerId: string): number {
    return this.database.querySync(
      `DELETE FROM ${RETIREMENT_TABLE} WHERE owner_id = $1 RETURNING id`,
      [ownerId],
    ).length;
  }

  /**
   * Deletes `oldId` (the caller's) and inserts `data` in one transaction; `null` — with nothing
   * changed — when `oldId` is not the caller's or is not of the same pillar and type.
   */
  replace(ownerId: string, oldId: string, data: RetirementRecordData): RetirementRecord | null {
    return this.database.transaction(() => {
      const old = this.get(ownerId, oldId);
      if (old?.contractType !== data.contractType) return null;
      this.delete(ownerId, oldId);
      return this.insert(ownerId, data);
    });
  }

  private requireRecord(ownerId: string, id: string): RetirementRecord {
    const record = this.get(ownerId, id);
    if (!record) throw new Error('Retirement record vanished after write');
    return record;
  }

  private toRecord(row: Row): RetirementRecord {
    const payload = this.crypto.decrypt<RetirementPayload>(row.id, row.owner_id, row.payload_enc);
    const info: RetirementImportInfo | null =
      row.origin === 'IMPORTED' && row.parser_id !== null && row.parser_version !== null
        ? {
            parserId: row.parser_id,
            parserVersion: row.parser_version,
            ocrRead: row.ocr_read === 1,
          }
        : null;
    return {
      id: row.id,
      pillar: row.pillar,
      contractType: row.contract_type,
      origin: row.origin,
      status: row.status,
      providerLabel: row.provider_label,
      statementDate: row.statement_date,
      payoutStart: row.payout_start,
      identifier: payload.identifier ?? null,
      figures: payload.figures,
      supplement: payload.supplement ?? null,
      import: info,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
