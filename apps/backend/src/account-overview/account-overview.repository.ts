import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Account, ValidatedAccount } from '@vaultfolio/domain-accounts';
import { DatabaseService } from '../database/database.service';
import {
  ACCOUNT_OVERVIEW_TABLE,
  AccountOverviewCryptoService,
} from './account-overview-crypto.service';
import { payloadToAccount } from './account-overview.mapper';
import type { AccountPayload, AccountRow } from './account-overview.mapper';

const COLUMNS = 'id, owner_id, payload_enc, created_at, updated_at';

/**
 * Raw `better-sqlite3` queries for the `account_overview_entries` table — no ORM (Principle V,
 * matching `DatabaseService`'s established pattern). The whole entry is one AES-256-GCM
 * ciphertext; encryption/decryption happens here and nowhere else.
 *
 * Every method takes an `ownerId` and scopes its query with `AND owner_id = $N` (research.md #3)
 * — enforced here, in the query itself, so a missing filter fails closed (zero rows) rather than
 * a forgotten check leaking another user's row.
 */
@Injectable()
export class AccountOverviewRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: AccountOverviewCryptoService,
  ) {}

  async findAllByOwner(ownerId: string): Promise<Account[]> {
    const rows = await this.database.query<AccountRow>(
      `SELECT ${COLUMNS} FROM ${ACCOUNT_OVERVIEW_TABLE} WHERE owner_id = $1
       ORDER BY created_at ASC, rowid`,
      [ownerId],
    );
    return rows.map((row) => this.toAccount(row));
  }

  async findByIdForOwner(id: string, ownerId: string): Promise<Account | null> {
    const rows = await this.database.query<AccountRow>(
      `SELECT ${COLUMNS} FROM ${ACCOUNT_OVERVIEW_TABLE} WHERE id = $1 AND owner_id = $2`,
      [id, ownerId],
    );
    return rows[0] ? this.toAccount(rows[0]) : null;
  }

  async insert(value: ValidatedAccount, ownerId: string): Promise<Account> {
    const id = randomUUID();
    const now = new Date().toISOString();
    const rows = await this.database.query<AccountRow>(
      `INSERT INTO ${ACCOUNT_OVERVIEW_TABLE}
         (id, owner_id, payload_enc, key_version, created_at, updated_at)
       VALUES ($1, $2, $3, 1, $4, $4)
       RETURNING ${COLUMNS}`,
      [id, ownerId, this.crypto.encrypt(id, ownerId, toPayload(value)), now],
    );
    return this.toAccount(rows[0]);
  }

  async updateForOwner(
    id: string,
    ownerId: string,
    value: ValidatedAccount,
  ): Promise<Account | null> {
    const rows = await this.database.query<AccountRow>(
      `UPDATE ${ACCOUNT_OVERVIEW_TABLE}
       SET payload_enc = $3, updated_at = $4
       WHERE id = $1 AND owner_id = $2
       RETURNING ${COLUMNS}`,
      [id, ownerId, this.crypto.encrypt(id, ownerId, toPayload(value)), new Date().toISOString()],
    );
    return rows[0] ? this.toAccount(rows[0]) : null;
  }

  /** Hard delete — no soft-delete/undo (research.md #4). Returns whether a row was deleted. */
  async deleteForOwner(id: string, ownerId: string): Promise<boolean> {
    const rows = await this.database.query(
      `DELETE FROM ${ACCOUNT_OVERVIEW_TABLE} WHERE id = $1 AND owner_id = $2 RETURNING id`,
      [id, ownerId],
    );
    return rows.length > 0;
  }

  /** Deletes every entry of the caller; returns how many were removed. */
  async deleteAllForOwner(ownerId: string): Promise<number> {
    const rows = await this.database.query(
      `DELETE FROM ${ACCOUNT_OVERVIEW_TABLE} WHERE owner_id = $1 RETURNING id`,
      [ownerId],
    );
    return rows.length;
  }

  private toAccount(row: AccountRow): Account {
    const payload = this.crypto.decrypt<AccountPayload>(row.id, row.owner_id, row.payload_enc);
    return payloadToAccount(row, payload);
  }
}

function toPayload(value: ValidatedAccount): AccountPayload {
  return {
    name: value.name,
    category: value.category,
    status: value.status,
    provider: value.provider,
    website: value.website,
    purpose: value.purpose,
    cardUsage: value.cardUsage,
    requiredMinimum: value.requiredMinimum,
    notes: value.notes,
    cardNumber: value.cardNumber,
    validUntil: value.validUntil,
  };
}
