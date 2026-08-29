import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type UserRole = 'ADMIN' | 'MEMBER';
export type UserStatus = 'ACTIVE' | 'ARCHIVED';

export interface User {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  failedAttempts: number;
  lockedUntil: string | null;
  archivedAt: string | null;
  retentionExpiresAt: string | null;
  pendingEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  password_hash: string;
  role: UserRole;
  status: UserStatus;
  failed_attempts: number;
  locked_until: string | null;
  archived_at: string | null;
  retention_expires_at: string | null;
  pending_email: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    passwordHash: row.password_hash,
    role: row.role,
    status: row.status,
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
    archivedAt: row.archived_at,
    retentionExpiresAt: row.retention_expires_at,
    pendingEmail: row.pending_email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Raw `better-sqlite3` queries for the `users` table — no ORM (Principle V,
 * matching `HoldingsRepository`'s established pattern).
 */
@Injectable()
export class UsersRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Case-insensitive per `users_email_idx` (COLLATE NOCASE) — data-model.md. */
  async findByEmail(email: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      'SELECT * FROM users WHERE email = $1 COLLATE NOCASE',
      [email],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async findById(id: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async create(input: {
    email: string;
    displayName: string;
    passwordHash: string;
    role: UserRole;
  }): Promise<User> {
    const id = randomUUID();
    const rows = await this.database.query<UserRow>(
      `INSERT INTO users (id, email, display_name, password_hash, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, input.email, input.displayName, input.passwordHash, input.role],
    );
    return rowToUser(rows[0]);
  }

  async incrementFailedAttempts(id: string): Promise<void> {
    await this.database.query(
      `UPDATE users
       SET failed_attempts = failed_attempts + 1,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1`,
      [id],
    );
  }

  async resetFailedAttempts(id: string): Promise<void> {
    await this.database.query(
      `UPDATE users
       SET failed_attempts = 0, locked_until = NULL,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1`,
      [id],
    );
  }

  async setLockedUntil(id: string, lockedUntil: string): Promise<void> {
    await this.database.query(
      `UPDATE users
       SET locked_until = $2, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1`,
      [id, lockedUntil],
    );
  }

  /** Every account, active and archived (006, FR-001) — the admin accounts list. */
  async findAll(): Promise<User[]> {
    const rows = await this.database.query<UserRow>('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(rowToUser);
  }

  /** All `ACTIVE` accounts with the given role — e.g. the admin-notification recipient list (007). */
  async findAllByRole(role: UserRole): Promise<User[]> {
    const rows = await this.database.query<UserRow>(
      `SELECT * FROM users WHERE role = $1 AND status = 'ACTIVE' ORDER BY created_at ASC`,
      [role],
    );
    return rows.map(rowToUser);
  }

  /** `ARCHIVED` accounts whose retention window has passed — the retention-sweep service's candidate set (006, FR-005). */
  async findArchivedPastRetention(): Promise<User[]> {
    const rows = await this.database.query<UserRow>(
      `SELECT * FROM users
       WHERE status = 'ARCHIVED' AND retention_expires_at IS NOT NULL
         AND retention_expires_at <= STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')`,
    );
    return rows.map(rowToUser);
  }

  /**
   * Number of currently-`ACTIVE` `ADMIN` accounts, optionally excluding one
   * id — used by the last-admin invariant (`canRemoveLastAdmin`,
   * research.md #3). `excludingUserId` lets a caller ask "how many other
   * active admins are there besides this one".
   */
  async countActiveAdmins(excludingUserId?: string): Promise<number> {
    const rows = await this.database.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM users
       WHERE status = 'ACTIVE' AND role = 'ADMIN' AND ($1 IS NULL OR id <> $1)`,
      [excludingUserId ?? null],
    );
    return Number(rows[0]?.count ?? 0);
  }

  async updateRole(id: string, role: UserRole): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET role = $2, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1
       RETURNING *`,
      [id, role],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  /**
   * Archives an account (006, FR-003): sets `status = 'ARCHIVED'`,
   * `archived_at = now`, `retention_expires_at`. Guarded to only affect a
   * currently-`ACTIVE` row (race guard, research.md #4) — returns `null`
   * (zero rows affected) if the account was already archived.
   */
  async archive(id: string, retentionExpiresAt: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET status = 'ARCHIVED',
           archived_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'),
           retention_expires_at = $2,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1 AND status = 'ACTIVE'
       RETURNING *`,
      [id, retentionExpiresAt],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  /**
   * Reactivates an archived account (006, FR-003): clears `archived_at`/
   * `retention_expires_at`, sets `status = 'ACTIVE'`. Guarded to only affect
   * a currently-`ARCHIVED` row (race guard, research.md #4) — returns `null`
   * if the account was already active (or never existed).
   */
  async reactivate(id: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET status = 'ACTIVE', archived_at = NULL, retention_expires_at = NULL,
           updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1 AND status = 'ARCHIVED'
       RETURNING *`,
      [id],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  /**
   * Permanently deletes an account and cascades its owned data (006,
   * self-delete path / retention sweep) — mirrors `SessionsRepository`'s
   * `deleteAllForUser` primitive by deleting sessions and owned holdings
   * before the `users` row itself, since this schema has no `ON DELETE
   * CASCADE` (Principle V/YAGNI: explicit deletes, no FK cascade config to
   * reason about). Statements run sequentially against the single embedded
   * SQLite connection (no concurrent interleaving, research.md #4).
   */
  /** Updates the caller's own display name (008, FR-001). */
  async updateDisplayName(id: string, displayName: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET display_name = $2, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1
       RETURNING *`,
      [id, displayName],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  /** Applies a confirmed email change (008, FR-002): sets the new email and clears `pending_email`. */
  async updateEmail(id: string, email: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET email = $2, pending_email = NULL, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1
       RETURNING *`,
      [id, email],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  /** Records an outstanding email-change request's target address (008, FR-002). */
  async setPendingEmail(id: string, pendingEmail: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET pending_email = $2, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1
       RETURNING *`,
      [id, pendingEmail],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  /** Clears an outstanding email-change request (008 — confirm, cancel, or supersede). */
  async clearPendingEmail(id: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET pending_email = NULL, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1
       RETURNING *`,
      [id],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  /** Updates the account's password hash (008 — password change or reset). */
  async updatePasswordHash(id: string, passwordHash: string): Promise<User | null> {
    const rows = await this.database.query<UserRow>(
      `UPDATE users
       SET password_hash = $2, updated_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1
       RETURNING *`,
      [id, passwordHash],
    );
    return rows[0] ? rowToUser(rows[0]) : null;
  }

  async deleteById(id: string): Promise<void> {
    // invitations.invited_by is deliberately NOT cascaded here — an admin's
    // sent invitations remain as an audit trail after the admin's own
    // account is gone (data-model.md's "Relationships": "no CASCADE,
    // explicit deletion only, Principle V").
    await this.database.query('DELETE FROM sessions WHERE user_id = $1', [id]);
    await this.database.query('DELETE FROM holdings WHERE owner_id = $1', [id]);
    await this.database.query('DELETE FROM users WHERE id = $1', [id]);
  }
}
