import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AssetType, Holding, ValidatedHolding } from '@vaultfolio/domain-holdings';
import { DatabaseService } from '../database/database.service';
import { rowToHolding, validatedHoldingToRow } from './holdings.mapper';
import type { HoldingRow } from './holdings.mapper';

/**
 * Raw `better-sqlite3` queries for the `holdings` table — no ORM (Principle
 * V, matching `DatabaseService`'s established pattern). Owns the
 * ETF/Precious-metal upsert-lookup query (`holdings_upsert_lookup_idx`) as
 * well as plain insert/update/delete, per research.md #2.
 *
 * Every method takes an `ownerId` and scopes its query with
 * `AND owner_id = $N` (005-auth-sessions-isolation, data-model.md's "Query
 * scoping" note) — enforced here, in the query itself, so a missing filter
 * fails closed (zero rows) rather than a forgotten check leaking another
 * user's row. A row that exists but belongs to another owner is
 * indistinguishable from a row that doesn't exist at all (no 403 vs 404
 * signal — FR-010/contracts/auth-api.md).
 */
@Injectable()
export class HoldingsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAll(ownerId: string): Promise<Holding[]> {
    const rows = await this.database.query<HoldingRow>(
      'SELECT * FROM holdings WHERE owner_id = $1 ORDER BY created_at ASC',
      [ownerId],
    );
    return rows.map(rowToHolding);
  }

  async findById(id: string, ownerId: string): Promise<Holding | null> {
    const rows = await this.database.query<HoldingRow>(
      'SELECT * FROM holdings WHERE id = $1 AND owner_id = $2',
      [id, ownerId],
    );
    return rows[0] ? rowToHolding(rows[0]) : null;
  }

  /**
   * The ETF/Precious-metal "same asset" lookup (FR-005): ETF matches on
   * `(asset_type, isin, management)`; Precious metal matches on `(asset_type,
   * name, management)` — pass the matching identifier column's value via
   * `identifier` for either type (research.md #2). Never called for
   * SHARE/CRYPTO, which always insert. Scoped to `ownerId` so one user's
   * holding can never be silently "matched" and overwritten by another
   * user's submission.
   */
  async findUpsertMatch(
    assetType: AssetType,
    management: string,
    identifier: string | null,
    ownerId: string,
  ): Promise<Holding | null> {
    const rows =
      assetType === 'ETF'
        ? await this.database.query<HoldingRow>(
            'SELECT * FROM holdings WHERE asset_type = $1 AND management = $2 AND isin = $3 AND owner_id = $4',
            [assetType, management, identifier, ownerId],
          )
        : await this.database.query<HoldingRow>(
            'SELECT * FROM holdings WHERE asset_type = $1 AND management = $2 AND name = $3 AND owner_id = $4',
            [assetType, management, identifier, ownerId],
          );
    return rows[0] ? rowToHolding(rows[0]) : null;
  }

  async insert(value: ValidatedHolding, ownerId: string): Promise<Holding> {
    const row = validatedHoldingToRow(value);
    const id = randomUUID();
    const rows = await this.database.query<HoldingRow>(
      `INSERT INTO holdings
         (id, asset_type, management, quantity, purchase_price, purchase_date, isin, name,
          weight_grams, current_value, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        id,
        row.asset_type,
        row.management,
        row.quantity,
        row.purchase_price,
        row.purchase_date,
        row.isin,
        row.name,
        row.weight_grams,
        row.current_value,
        ownerId,
      ],
    );
    return rowToHolding(rows[0]);
  }

  /** Replaces an existing row's fields in place (both an ETF/Gold upsert and a user-initiated edit). */
  async updateById(id: string, value: ValidatedHolding, ownerId: string): Promise<Holding | null> {
    const row = validatedHoldingToRow(value);
    const rows = await this.database.query<HoldingRow>(
      `UPDATE holdings
       SET management = $2, quantity = $3, purchase_price = $4, purchase_date = $5,
           isin = $6, name = $7, weight_grams = $8, current_value = $9,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1 AND owner_id = $10
       RETURNING *`,
      [
        id,
        row.management,
        row.quantity,
        row.purchase_price,
        row.purchase_date,
        row.isin,
        row.name,
        row.weight_grams,
        row.current_value,
        ownerId,
      ],
    );
    return rows[0] ? rowToHolding(rows[0]) : null;
  }

  /** Hard delete — no soft-delete/undo (spec.md Assumptions). Returns whether a row was deleted. */
  async deleteById(id: string, ownerId: string): Promise<boolean> {
    const rows = await this.database.query(
      'DELETE FROM holdings WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, ownerId],
    );
    return rows.length > 0;
  }
}
