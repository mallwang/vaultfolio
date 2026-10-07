import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface MaintenanceRow {
  domainId: string;
  inMaintenance: boolean;
  updatedAt: string;
  /** Display name of the acting admin; `null` when that user no longer exists. */
  updatedBy: string | null;
}

interface StateRow {
  domain_id: string;
  in_maintenance: number;
  updated_at: string;
  updated_by: string | null;
}

const SELECT_STATE = `SELECT m.domain_id, m.in_maintenance, m.updated_at, u.display_name AS updated_by
  FROM domain_maintenance m LEFT JOIN users u ON u.id = m.updated_by`;

/** Raw SQLite access to `domain_maintenance` (state) and `domain_maintenance_audit` (append-only). */
@Injectable()
export class MaintenanceRepository {
  constructor(private readonly database: DatabaseService) {}

  isInMaintenance(domainId: string): boolean {
    const [row] = this.database.querySync<{ in_maintenance: number }>(
      'SELECT in_maintenance FROM domain_maintenance WHERE domain_id = $1',
      [domainId],
    );
    return row?.in_maintenance === 1;
  }

  listInMaintenance(): string[] {
    return this.database
      .querySync<{ domain_id: string }>(
        'SELECT domain_id FROM domain_maintenance WHERE in_maintenance = 1 ORDER BY domain_id',
      )
      .map((row) => row.domain_id);
  }

  listAll(): MaintenanceRow[] {
    return this.database.querySync<StateRow>(SELECT_STATE).map(toRow);
  }

  get(domainId: string): MaintenanceRow | null {
    const [row] = this.database.querySync<StateRow>(`${SELECT_STATE} WHERE m.domain_id = $1`, [
      domainId,
    ]);
    return row ? toRow(row) : null;
  }

  /**
   * Upserts the state and appends one audit row in a single transaction. Returns `false` (and
   * writes nothing) when the state is unchanged.
   */
  set(domainId: string, inMaintenance: boolean, actorId: string): boolean {
    return this.database.transaction(() => {
      if (this.isInMaintenance(domainId) === inMaintenance) return false;
      const now = new Date().toISOString();
      const flag = inMaintenance ? 1 : 0;
      this.database.querySync(
        `INSERT INTO domain_maintenance (domain_id, in_maintenance, updated_at, updated_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(domain_id) DO UPDATE SET
           in_maintenance = excluded.in_maintenance,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`,
        [domainId, flag, now, actorId],
      );
      this.database.querySync(
        `INSERT INTO domain_maintenance_audit (id, domain_id, in_maintenance, actor_id, changed_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [randomUUID(), domainId, flag, actorId, now],
      );
      return true;
    });
  }
}

function toRow(row: StateRow): MaintenanceRow {
  return {
    domainId: row.domain_id,
    inMaintenance: row.in_maintenance === 1,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  };
}
