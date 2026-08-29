import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type AccountActionTokenPurpose = 'EMAIL_CHANGE' | 'PASSWORD_RESET';
export type AccountActionTokenStatus = 'PENDING' | 'USED' | 'EXPIRED' | 'SUPERSEDED';

export interface AccountActionToken {
  id: string;
  userId: string;
  purpose: AccountActionTokenPurpose;
  newEmail: string | null;
  token: string;
  status: AccountActionTokenStatus;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
}

interface AccountActionTokenRow {
  id: string;
  user_id: string;
  purpose: AccountActionTokenPurpose;
  new_email: string | null;
  token: string;
  status: AccountActionTokenStatus;
  created_at: string;
  expires_at: string;
  used_at: string | null;
}

function rowToToken(row: AccountActionTokenRow): AccountActionToken {
  return {
    id: row.id,
    userId: row.user_id,
    purpose: row.purpose,
    newEmail: row.new_email,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedAt: row.used_at,
  };
}

/**
 * Raw `better-sqlite3` queries for the `account_action_tokens` table
 * (data-model.md's "Entity: Account Action Token"), mirroring
 * `InvitationsRepository`'s status-guarded `UPDATE ... RETURNING *` pattern
 * exactly. Lookups always filter by `(token, purpose)` together, never
 * `token` alone (research.md #3) — a `PASSWORD_RESET` token must never
 * satisfy an `EMAIL_CHANGE` lookup or vice versa.
 */
@Injectable()
export class AccountActionTokensRepository {
  constructor(private readonly database: DatabaseService) {}

  /**
   * Creates a new `PENDING` row, first superseding any existing `PENDING`
   * row for the same `(user_id, purpose)` — scoped strictly to that purpose,
   * never cross-purpose (data-model.md's "Supersede rule"). Statements run
   * sequentially against the single embedded SQLite connection, matching
   * this codebase's established convention (no explicit `BEGIN`/`COMMIT`
   * wrapper — see `UsersRepository.deleteById`'s note).
   */
  async create(input: {
    userId: string;
    purpose: AccountActionTokenPurpose;
    newEmail?: string | null;
    token: string;
    expiresAt: string;
  }): Promise<AccountActionToken> {
    await this.database.query(
      `UPDATE account_action_tokens
       SET status = 'SUPERSEDED'
       WHERE user_id = $1 AND purpose = $2 AND status = 'PENDING'`,
      [input.userId, input.purpose],
    );

    const id = randomUUID();
    const rows = await this.database.query<AccountActionTokenRow>(
      `INSERT INTO account_action_tokens (id, user_id, purpose, new_email, token, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.userId, input.purpose, input.newEmail ?? null, input.token, input.expiresAt],
    );
    return rowToToken(rows[0]);
  }

  /** Never matches a token of a different purpose (research.md #3). */
  async findByTokenAndPurpose(
    token: string,
    purpose: AccountActionTokenPurpose,
  ): Promise<AccountActionToken | null> {
    const rows = await this.database.query<AccountActionTokenRow>(
      'SELECT * FROM account_action_tokens WHERE token = $1 AND purpose = $2',
      [token, purpose],
    );
    return rows[0] ? rowToToken(rows[0]) : null;
  }

  /** The current PENDING row for this user+purpose, if any — backs the "pending" banner / supersede check. */
  async findPendingByUserAndPurpose(
    userId: string,
    purpose: AccountActionTokenPurpose,
  ): Promise<AccountActionToken | null> {
    const rows = await this.database.query<AccountActionTokenRow>(
      `SELECT * FROM account_action_tokens
       WHERE user_id = $1 AND purpose = $2 AND status = 'PENDING'`,
      [userId, purpose],
    );
    return rows[0] ? rowToToken(rows[0]) : null;
  }

  /**
   * `PENDING -> USED`, guarded by status AND unexpired in the same `UPDATE`
   * (closes the check-then-act race, data-model.md) — a token that fails the
   * guard (expired/used/superseded) changes nothing and returns `null`.
   */
  async markUsed(id: string): Promise<AccountActionToken | null> {
    const rows = await this.database.query<AccountActionTokenRow>(
      `UPDATE account_action_tokens
       SET status = 'USED', used_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1 AND status = 'PENDING' AND expires_at > STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       RETURNING *`,
      [id],
    );
    return rows[0] ? rowToToken(rows[0]) : null;
  }

  /** `PENDING -> SUPERSEDED` (design.md's "Cancel request"). Race-guarded. */
  async markSuperseded(id: string): Promise<AccountActionToken | null> {
    const rows = await this.database.query<AccountActionTokenRow>(
      `UPDATE account_action_tokens SET status = 'SUPERSEDED'
       WHERE id = $1 AND status = 'PENDING' RETURNING *`,
      [id],
    );
    return rows[0] ? rowToToken(rows[0]) : null;
  }
}
