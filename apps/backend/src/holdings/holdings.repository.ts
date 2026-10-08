import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import type { Holding, ValidatedHolding } from '@vaultfolio/domain-holdings';
import { DatabaseService } from '../database/database.service';
import { HOLDINGS_TABLE, HoldingsCryptoService } from './holdings-crypto.service';
import { HoldingsUnavailableException } from './holdings.exceptions';
import {
  payloadToHolding,
  validatedHoldingToPayload,
  type HoldingPayload,
  type HoldingRow,
} from './holdings.mapper';

const COLUMNS = 'id, owner_id, payload_enc, key_version, created_at, updated_at';

/**
 * Raw `better-sqlite3` access to `holdings`. Every method filters by `owner_id` in the SQL: a row of
 * another owner is indistinguishable from a missing one. Payloads are encrypted/decrypted here only.
 */
@Injectable()
export class HoldingsRepository {
  private readonly logger = new Logger(HoldingsRepository.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: HoldingsCryptoService,
  ) {}

  /**
   * The caller's holdings. A row that fails to decrypt is skipped and logged (id only, never
   * content); if no row is readable at all the key is wrong and the domain is unavailable.
   */
  findAll(ownerId: string): Holding[] {
    const rows = this.database.querySync<HoldingRow>(
      `SELECT ${COLUMNS} FROM ${HOLDINGS_TABLE} WHERE owner_id = $1 ORDER BY created_at ASC, id`,
      [ownerId],
    );
    const holdings: Holding[] = [];
    for (const row of rows) {
      const holding = this.toHolding(row);
      if (holding) holdings.push(holding);
      else this.logger.error({ id: row.id, outcome: 'undecryptable' });
    }
    if (rows.length > 0 && holdings.length === 0) throw new HoldingsUnavailableException();
    return holdings;
  }

  findById(id: string, ownerId: string): Holding | null {
    const [row] = this.database.querySync<HoldingRow>(
      `SELECT ${COLUMNS} FROM ${HOLDINGS_TABLE} WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    if (!row) return null;
    const holding = this.toHolding(row);
    if (!holding) throw new HoldingsUnavailableException();
    return holding;
  }

  insert(value: ValidatedHolding, ownerId: string): Holding {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.database.querySync(
      `INSERT INTO ${HOLDINGS_TABLE} (${COLUMNS})
       VALUES ($1, $2, $3, ${this.crypto.keyVersion}, $4, $4)`,
      [id, ownerId, this.crypto.encrypt(id, ownerId, validatedHoldingToPayload(value)), now],
    );
    return this.require(id, ownerId);
  }

  /** In place (keeps `id` and `created_at`); `null` when the id is not the caller's. */
  update(id: string, value: ValidatedHolding, ownerId: string): Holding | null {
    const updated = this.database.querySync<{ id: string }>(
      `UPDATE ${HOLDINGS_TABLE}
         SET payload_enc = $3, key_version = ${this.crypto.keyVersion}, updated_at = $4
       WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [
        id,
        ownerId,
        this.crypto.encrypt(id, ownerId, validatedHoldingToPayload(value)),
        new Date().toISOString(),
      ],
    );
    return updated.length > 0 ? this.require(id, ownerId) : null;
  }

  /** Hard delete; whether a row of the caller existed. */
  delete(id: string, ownerId: string): boolean {
    return (
      this.database.querySync(
        `DELETE FROM ${HOLDINGS_TABLE} WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [id, ownerId],
      ).length > 0
    );
  }

  private require(id: string, ownerId: string): Holding {
    const holding = this.findById(id, ownerId);
    if (!holding) throw new Error('Holding vanished after write');
    return holding;
  }

  private toHolding(row: HoldingRow): Holding | null {
    const payload = this.crypto.tryDecrypt<HoldingPayload>(row.id, row.owner_id, row.payload_enc);
    return payload ? payloadToHolding(row, payload) : null;
  }
}
