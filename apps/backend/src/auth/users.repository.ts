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
}
