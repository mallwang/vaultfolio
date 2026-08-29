import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface Session {
  id: string;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
  expiresAt: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: string;
  last_active_at: string;
  expires_at: string;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: row.created_at,
    lastActiveAt: row.last_active_at,
    expiresAt: row.expires_at,
  };
}

/**
 * Raw `better-sqlite3` queries for the `sessions` table. A row past
 * `expires_at` (absolute lifetime, FR-004) is treated as a lookup-miss and
 * deleted lazily on read — data-model.md's "Read" lifecycle step.
 * Inactivity-timeout expiry (`last_active_at` sliding window) is enforced by
 * the caller (`AuthGuard`), which knows the configured
 * `SESSION_INACTIVITY_TIMEOUT_MINUTES` and calls `deleteById` itself on a
 * stale row.
 */
@Injectable()
export class SessionsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(userId: string, expiresAt: string): Promise<Session> {
    const id = randomBytes(32).toString('base64url');
    const rows = await this.database.query<SessionRow>(
      `INSERT INTO sessions (id, user_id, expires_at)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [id, userId, expiresAt],
    );
    return rowToSession(rows[0]);
  }

  async findById(id: string): Promise<Session | null> {
    const rows = await this.database.query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [
      id,
    ]);
    const row = rows[0];
    if (!row) {
      return null;
    }

    if (new Date(row.expires_at).getTime() <= Date.now()) {
      await this.deleteById(id);
      return null;
    }

    return rowToSession(row);
  }

  async touch(id: string): Promise<void> {
    await this.database.query(
      `UPDATE sessions SET last_active_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = $1`,
      [id],
    );
  }

  async deleteById(id: string): Promise<void> {
    await this.database.query('DELETE FROM sessions WHERE id = $1', [id]);
  }

  /** research.md #4/FR-012: invalidation primitive for later slices (account archived, password changed). */
  async deleteAllForUser(userId: string): Promise<void> {
    await this.database.query('DELETE FROM sessions WHERE user_id = $1', [userId]);
  }
}
