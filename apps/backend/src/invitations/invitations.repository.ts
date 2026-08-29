import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type InvitationRole = 'ADMIN' | 'MEMBER';
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED' | 'SUPERSEDED';

export interface Invitation {
  id: string;
  email: string;
  token: string;
  role: InvitationRole;
  status: InvitationStatus;
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface InvitationRow {
  id: string;
  email: string;
  token: string;
  role: InvitationRole;
  status: InvitationStatus;
  invited_by: string;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

function rowToInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    token: row.token,
    role: row.role,
    status: row.status,
    invitedBy: row.invited_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
  };
}

/**
 * Raw `better-sqlite3` queries for the `invitations` table (data-model.md).
 * Every state-changing mutation is a status-guarded `UPDATE ... WHERE
 * status = $expected`, checking the affected-row count (research.md #4) —
 * zero rows affected means the row already moved (raced), reported to the
 * caller as `null` rather than silently no-op'ing or double-applying.
 */
@Injectable()
export class InvitationsRepository {
  constructor(private readonly database: DatabaseService) {}

  async create(input: {
    email: string;
    token: string;
    role: InvitationRole;
    invitedBy: string;
    expiresAt: string;
  }): Promise<Invitation> {
    const id = randomUUID();
    const rows = await this.database.query<InvitationRow>(
      `INSERT INTO invitations (id, email, token, role, invited_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, input.email, input.token, input.role, input.invitedBy, input.expiresAt],
    );
    return rowToInvitation(rows[0]);
  }

  async findById(id: string): Promise<Invitation | null> {
    const rows = await this.database.query<InvitationRow>(
      'SELECT * FROM invitations WHERE id = $1',
      [id],
    );
    return rows[0] ? rowToInvitation(rows[0]) : null;
  }

  async findByToken(token: string): Promise<Invitation | null> {
    const rows = await this.database.query<InvitationRow>(
      'SELECT * FROM invitations WHERE token = $1',
      [token],
    );
    return rows[0] ? rowToInvitation(rows[0]) : null;
  }

  /** Case-insensitive per `invitations_email_idx` (COLLATE NOCASE) — the current PENDING row, if any. */
  async findPendingByEmail(email: string): Promise<Invitation | null> {
    const rows = await this.database.query<InvitationRow>(
      `SELECT * FROM invitations WHERE email = $1 COLLATE NOCASE AND status = 'PENDING'`,
      [email],
    );
    return rows[0] ? rowToInvitation(rows[0]) : null;
  }

  /** All invitations, every status (admin-facing history list, FR-010). */
  async findAll(): Promise<Invitation[]> {
    const rows = await this.database.query<InvitationRow>(
      'SELECT * FROM invitations ORDER BY created_at DESC',
    );
    return rows.map(rowToInvitation);
  }

  /** `PENDING -> SUPERSEDED` (new invite to the same email, or a resend). Race-guarded. */
  async supersede(id: string): Promise<Invitation | null> {
    const rows = await this.database.query<InvitationRow>(
      `UPDATE invitations SET status = 'SUPERSEDED' WHERE id = $1 AND status = 'PENDING' RETURNING *`,
      [id],
    );
    return rows[0] ? rowToInvitation(rows[0]) : null;
  }

  /** `PENDING -> CANCELLED`. Race-guarded. */
  async cancel(id: string): Promise<Invitation | null> {
    const rows = await this.database.query<InvitationRow>(
      `UPDATE invitations SET status = 'CANCELLED' WHERE id = $1 AND status = 'PENDING' RETURNING *`,
      [id],
    );
    return rows[0] ? rowToInvitation(rows[0]) : null;
  }

  /**
   * `PENDING -> ACCEPTED`, guarded by status AND unexpired (data-model.md's
   * "Accept" rule) in the same `UPDATE` — closes the race between an earlier
   * `GET` lookup and this call.
   */
  async markAccepted(id: string): Promise<Invitation | null> {
    const rows = await this.database.query<InvitationRow>(
      `UPDATE invitations
       SET status = 'ACCEPTED', accepted_at = STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = $1 AND status = 'PENDING' AND expires_at > STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')
       RETURNING *`,
      [id],
    );
    return rows[0] ? rowToInvitation(rows[0]) : null;
  }

  /**
   * Opportunistic lazy-expire write (research.md #4/data-model.md): flips a
   * stale `PENDING` row to `EXPIRED` when encountered on read. Not required
   * for correctness (reads already treat a past-`expires_at` `PENDING` row
   * as expired) — just keeps the admin-facing list accurate without a
   * background job.
   */
  async markExpired(id: string): Promise<void> {
    await this.database.query(
      `UPDATE invitations
       SET status = 'EXPIRED'
       WHERE id = $1 AND status = 'PENDING' AND expires_at <= STRFTIME('%Y-%m-%dT%H:%M:%fZ','now')`,
      [id],
    );
  }
}
