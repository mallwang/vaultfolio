import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type SignupStatus = 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED';

export interface SignupRequest {
  id: string;
  email: string;
  passwordHash: string;
  token: string;
  status: SignupStatus;
  createdAt: string;
  expiresAt: string;
  verifiedAt: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
}

export interface EmailBlacklistEntry {
  email: string;
  reason: string | null;
  createdAt: string;
  signupRequestId: string | null;
}

interface SignupRequestRow {
  id: string;
  email: string;
  password_hash: string;
  token: string;
  status: SignupStatus;
  created_at: string;
  expires_at: string;
  verified_at: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
}

interface EmailBlacklistRow {
  email: string;
  reason: string | null;
  created_at: string;
  signup_request_id: string | null;
}

function rowToSignupRequest(row: SignupRequestRow): SignupRequest {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    token: row.token,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    verifiedAt: row.verified_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  };
}

function rowToBlacklistEntry(row: EmailBlacklistRow): EmailBlacklistEntry {
  return {
    email: row.email,
    reason: row.reason,
    createdAt: row.created_at,
    signupRequestId: row.signup_request_id,
  };
}

/**
 * Raw `better-sqlite3` queries for `signup_requests`/`email_blacklist`
 * (data-model.md), mirroring `InvitationsRepository`'s conventions exactly:
 * every state-changing mutation is a status-guarded `UPDATE ... WHERE
 * status = $expected RETURNING *`, checking the affected-row count
 * (research.md #3/#4) — zero rows affected means the row already moved
 * (raced), reported to the caller as `null` rather than silently no-op'ing.
 */
@Injectable()
export class SignupsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: {
    email: string;
    passwordHash: string;
    token: string;
    expiresAt: string;
  }): Promise<SignupRequest> {
    const id = randomUUID();
    const rows = await this.database.query<SignupRequestRow>(
      `INSERT INTO signup_requests (id, email, password_hash, token, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [id, input.email, input.passwordHash, input.token, input.expiresAt],
    );
    return rowToSignupRequest(rows[0]);
  }

  async findById(id: string): Promise<SignupRequest | null> {
    const rows = await this.database.query<SignupRequestRow>(
      'SELECT * FROM signup_requests WHERE id = $1',
      [id],
    );
    return rows[0] ? rowToSignupRequest(rows[0]) : null;
  }

  async findByToken(token: string): Promise<SignupRequest | null> {
    const rows = await this.database.query<SignupRequestRow>(
      'SELECT * FROM signup_requests WHERE token = $1',
      [token],
    );
    return rows[0] ? rowToSignupRequest(rows[0]) : null;
  }

  /** Case-insensitive per `signup_requests_email_idx` — a still-active (PENDING/VERIFIED) request, if any (data-model.md's combined availability lookup). */
  async findActiveByEmail(email: string): Promise<SignupRequest | null> {
    const rows = await this.database.query<SignupRequestRow>(
      `SELECT * FROM signup_requests
       WHERE email = $1 COLLATE NOCASE AND status IN ('PENDING','VERIFIED')`,
      [email],
    );
    return rows[0] ? rowToSignupRequest(rows[0]) : null;
  }

  /** All sign-up requests, every status (admin-facing history list, FR-005). */
  async findAll(): Promise<SignupRequest[]> {
    const rows = await this.database.query<SignupRequestRow>(
      'SELECT * FROM signup_requests ORDER BY created_at DESC',
    );
    return rows.map(rowToSignupRequest);
  }

  /** Every currently-`PENDING` request past `expires_at` — the expiry sweep's candidate set. */
  async findExpiredPending(): Promise<SignupRequest[]> {
    const rows = await this.database.query<SignupRequestRow>(
      `SELECT * FROM signup_requests
       WHERE status = 'PENDING' AND expires_at <= STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')`,
    );
    return rows.map(rowToSignupRequest);
  }

  /**
   * `PENDING -> VERIFIED`, guarded by status AND unexpired in the same
   * `UPDATE` (data-model.md's "Validation rules") — closes the race between
   * an earlier `GET` lookup and this call.
   */
  async markVerified(id: string): Promise<SignupRequest | null> {
    const rows = await this.database.query<SignupRequestRow>(
      `UPDATE signup_requests
       SET status = 'VERIFIED', verified_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1 AND status = 'PENDING' AND expires_at > STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       RETURNING *`,
      [id],
    );
    return rows[0] ? rowToSignupRequest(rows[0]) : null;
  }

  /** `VERIFIED -> APPROVED`. Race-guarded (FR-008/FR-012). */
  async markApproved(id: string, resolvedBy: string): Promise<SignupRequest | null> {
    const rows = await this.database.query<SignupRequestRow>(
      `UPDATE signup_requests
       SET status = 'APPROVED', resolved_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'), resolved_by = $2
       WHERE id = $1 AND status = 'VERIFIED'
       RETURNING *`,
      [id, resolvedBy],
    );
    return rows[0] ? rowToSignupRequest(rows[0]) : null;
  }

  /** `VERIFIED -> REJECTED`. Race-guarded (FR-008/FR-012). */
  async markRejected(id: string, resolvedBy: string): Promise<SignupRequest | null> {
    const rows = await this.database.query<SignupRequestRow>(
      `UPDATE signup_requests
       SET status = 'REJECTED', resolved_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now'), resolved_by = $2
       WHERE id = $1 AND status = 'VERIFIED'
       RETURNING *`,
      [id, resolvedBy],
    );
    return rows[0] ? rowToSignupRequest(rows[0]) : null;
  }

  /** Permanently removes a sign-up entry (FR-011). Does not touch `email_blacklist` — callers clear it separately. */
  async deleteById(id: string): Promise<void> {
    await this.database.query('DELETE FROM signup_requests WHERE id = $1', [id]);
  }

  /** Opportunistic lazy-expire write, mirroring `InvitationsRepository.markExpired` — not required for correctness (reads already treat a past-`expires_at` `PENDING` row as expired). */
  async markExpired(id: string): Promise<void> {
    await this.database.query('DELETE FROM signup_requests WHERE id = $1 AND status = $2', [
      id,
      'PENDING',
    ]);
  }

  async findBlacklistEntry(email: string): Promise<EmailBlacklistEntry | null> {
    const rows = await this.database.query<EmailBlacklistRow>(
      'SELECT * FROM email_blacklist WHERE email = $1 COLLATE NOCASE',
      [email],
    );
    return rows[0] ? rowToBlacklistEntry(rows[0]) : null;
  }

  async createBlacklistEntry(input: {
    email: string;
    reason: string | null;
    signupRequestId: string;
  }): Promise<EmailBlacklistEntry> {
    const rows = await this.database.query<EmailBlacklistRow>(
      `INSERT INTO email_blacklist (email, reason, signup_request_id)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [input.email, input.reason, input.signupRequestId],
    );
    return rowToBlacklistEntry(rows[0]);
  }

  /** Clears the blacklist entry originating from a given (now-deleted) sign-up request (FR-011). */
  async deleteBlacklistEntryBySignupRequestId(signupRequestId: string): Promise<void> {
    await this.database.query('DELETE FROM email_blacklist WHERE signup_request_id = $1', [
      signupRequestId,
    ]);
  }
}
