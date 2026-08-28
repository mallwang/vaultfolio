import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { AssetType, Holding, ValidatedHolding } from '@vaultfolio/domain-holdings';
import { DatabaseService } from '../database/database.service';
import { rowToHolding, validatedHoldingToRow } from './holdings.mapper';
import type { HoldingRow } from './holdings.mapper';

/**
 * Raw `better-sqlite3` queries for the `holdings` table — no ORM (Principle
 * V, matching `DatabaseService`'s established pattern). Owns the ETF/Gold
 * upsert-lookup query (`holdings_upsert_lookup_idx`) as well as plain
 * insert/update/delete, per research.md #4.
 */
@Injectable()
export class HoldingsRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAll(): Promise<Holding[]> {
    const rows = await this.database.query<HoldingRow>(
      'SELECT * FROM holdings ORDER BY created_at ASC',
    );
    return rows.map(rowToHolding);
  }

  async findById(id: string): Promise<Holding | null> {
    const rows = await this.database.query<HoldingRow>('SELECT * FROM holdings WHERE id = $1', [
      id,
    ]);
    return rows[0] ? rowToHolding(rows[0]) : null;
  }

  /**
   * The ETF/Gold "same asset" lookup (FR-011a): ETF matches on
   * `(asset_type, isin, management)`; Gold matches on `(asset_type,
   * management)` alone — pass `isin: null` for Gold.
   */
  async findUpsertMatch(
    assetType: AssetType,
    management: string,
    isin: string | null,
  ): Promise<Holding | null> {
    const rows =
      isin === null
        ? await this.database.query<HoldingRow>(
            'SELECT * FROM holdings WHERE asset_type = $1 AND management = $2 AND isin IS NULL',
            [assetType, management],
          )
        : await this.database.query<HoldingRow>(
            'SELECT * FROM holdings WHERE asset_type = $1 AND management = $2 AND isin = $3',
            [assetType, management, isin],
          );
    return rows[0] ? rowToHolding(rows[0]) : null;
  }

  async insert(value: ValidatedHolding): Promise<Holding> {
    const row = validatedHoldingToRow(value);
    const id = randomUUID();
    const rows = await this.database.query<HoldingRow>(
      `INSERT INTO holdings
         (id, asset_type, management, quantity, purchase_price, purchase_date, isin, name,
          weight_grams, current_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
      ],
    );
    return rowToHolding(rows[0]);
  }

  /** Replaces an existing row's fields in place (both an ETF/Gold upsert and a user-initiated edit). */
  async updateById(id: string, value: ValidatedHolding): Promise<Holding | null> {
    const row = validatedHoldingToRow(value);
    const rows = await this.database.query<HoldingRow>(
      `UPDATE holdings
       SET management = $2, quantity = $3, purchase_price = $4, purchase_date = $5,
           isin = $6, name = $7, weight_grams = $8, current_value = $9,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1
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
      ],
    );
    return rows[0] ? rowToHolding(rows[0]) : null;
  }

  /** Hard delete — no soft-delete/undo (spec.md Assumptions). Returns whether a row was deleted. */
  async deleteById(id: string): Promise<boolean> {
    const rows = await this.database.query('DELETE FROM holdings WHERE id = $1 RETURNING id', [id]);
    return rows.length > 0;
  }
}
