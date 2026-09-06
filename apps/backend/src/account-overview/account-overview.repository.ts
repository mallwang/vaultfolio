import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Account, ValidatedAccount } from '@vaultfolio/domain-accounts';
import { DatabaseService } from '../database/database.service';
import { rowToAccount, validatedAccountToRow } from './account-overview.mapper';
import type { AccountRow } from './account-overview.mapper';

/**
 * Raw `better-sqlite3` queries for the `accounts` table — no ORM (Principle
 * V, matching `DatabaseService`'s established pattern), mirrors
 * `holdings.repository.ts`.
 *
 * Every method takes an `ownerId` and scopes its query with
 * `AND owner_id = $N` (research.md #3) — enforced here, in the query itself,
 * so a missing filter fails closed (zero rows) rather than a forgotten check
 * leaking another user's row.
 */
@Injectable()
export class AccountOverviewRepository {
  constructor(private readonly database: DatabaseService) {}

  async findAllByOwner(ownerId: string): Promise<Account[]> {
    const rows = await this.database.query<AccountRow>(
      'SELECT * FROM accounts WHERE owner_id = $1 ORDER BY created_at ASC',
      [ownerId],
    );
    return rows.map(rowToAccount);
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<Account | null> {
    const rows = await this.database.query<AccountRow>(
      'SELECT * FROM accounts WHERE id = $1 AND owner_id = $2',
      [id, ownerId],
    );
    return rows[0] ? rowToAccount(rows[0]) : null;
  }

  async insert(value: ValidatedAccount, ownerId: string): Promise<Account> {
    const row = validatedAccountToRow(value);
    const id = randomUUID();
    const rows = await this.database.query<AccountRow>(
      `INSERT INTO accounts
         (id, name, category, provider, website, purpose, card_usage, required_minimum, notes, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        row.name,
        row.category,
        row.provider,
        row.website,
        row.purpose,
        row.card_usage,
        row.required_minimum,
        row.notes,
        ownerId,
      ],
    );
    return rowToAccount(rows[0]);
  }

  async updateForOwner(
    id: string,
    ownerId: string,
    value: ValidatedAccount,
  ): Promise<Account | null> {
    const row = validatedAccountToRow(value);
    const rows = await this.database.query<AccountRow>(
      `UPDATE accounts
       SET name = $3, category = $4, provider = $5, website = $6, purpose = $7,
           card_usage = $8, required_minimum = $9, notes = $10,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1 AND owner_id = $2
       RETURNING *`,
      [
        id,
        ownerId,
        row.name,
        row.category,
        row.provider,
        row.website,
        row.purpose,
        row.card_usage,
        row.required_minimum,
        row.notes,
      ],
    );
    return rows[0] ? rowToAccount(rows[0]) : null;
  }

  /** Hard delete — no soft-delete/undo (research.md #4). Returns whether a row was deleted. */
  async deleteForOwner(id: string, ownerId: string): Promise<boolean> {
    const rows = await this.database.query(
      'DELETE FROM accounts WHERE id = $1 AND owner_id = $2 RETURNING id',
      [id, ownerId],
    );
    return rows.length > 0;
  }
}
