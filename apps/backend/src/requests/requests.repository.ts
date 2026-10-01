import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { RequestStatusDto } from '@vaultfolio/api-contract';
import { DatabaseService } from '../database/database.service';

export interface NewRequest {
  id: string;
  feature: string;
  type: string;
  requesterId: string;
  /** Type-specific stored payload, serialised JSON. */
  payload: string | null;
  layoutFingerprint: string | null;
  possibleDuplicate: boolean;
  createdAt: string;
  attachment: {
    contentType: string;
    bytes: Uint8Array;
    sha256: string;
    pageCount: number;
  } | null;
}

export interface StoredAttachment {
  contentType: string;
  sizeBytes: number;
  pageCount: number;
  sha256: string;
  downloadCount: number;
  lastDownloadedAt: string | null;
}

export interface StoredRequest {
  id: string;
  feature: string;
  type: string;
  requesterId: string;
  requesterEmail: string;
  status: RequestStatusDto;
  payload: string | null;
  possibleDuplicate: boolean;
  note: string | null;
  createdAt: string;
  handledBy: string | null;
  handledByEmail: string | null;
  handledAt: string | null;
  closedAt: string | null;
  payloadPurgedAt: string | null;
  attachment: StoredAttachment | null;
}

export interface RequestListRow {
  id: string;
  feature: string;
  type: string;
  requesterEmail: string;
  status: RequestStatusDto;
  createdAt: string;
  possibleDuplicate: boolean;
  closedAt: string | null;
  hasSample: boolean;
}

interface RequestRow {
  id: string;
  feature: string;
  type: string;
  requester_id: string;
  requester_email: string | null;
  status: RequestStatusDto;
  payload: string | null;
  possible_duplicate: number;
  note: string | null;
  created_at: string;
  handled_by: string | null;
  handled_by_email: string | null;
  handled_at: string | null;
  closed_at: string | null;
  payload_purged_at: string | null;
  att_content_type: string | null;
  att_size_bytes: number | null;
  att_page_count: number | null;
  att_sha256: string | null;
  download_count: number;
  last_downloaded_at: string | null;
}

const CLOSED: readonly RequestStatusDto[] = ['DONE', 'REJECTED'];

const DETAIL_SELECT = `
  SELECT r.*,
         u.email AS requester_email,
         h.email AS handled_by_email,
         a.content_type AS att_content_type,
         a.size_bytes AS att_size_bytes,
         a.page_count AS att_page_count,
         a.sha256 AS att_sha256,
         (SELECT COUNT(*) FROM request_download_audit d WHERE d.request_id = r.id) AS download_count,
         (SELECT MAX(d.downloaded_at) FROM request_download_audit d WHERE d.request_id = r.id) AS last_downloaded_at
  FROM requests r
  LEFT JOIN users u ON u.id = r.requester_id
  LEFT JOIN users h ON h.id = r.handled_by
  LEFT JOIN request_attachments a ON a.request_id = r.id`;

function rowToRequest(row: RequestRow): StoredRequest {
  return {
    id: row.id,
    feature: row.feature,
    type: row.type,
    requesterId: row.requester_id,
    requesterEmail: row.requester_email ?? '',
    status: row.status,
    payload: row.payload,
    possibleDuplicate: row.possible_duplicate === 1,
    note: row.note,
    createdAt: row.created_at,
    handledBy: row.handled_by,
    handledByEmail: row.handled_by_email,
    handledAt: row.handled_at,
    closedAt: row.closed_at,
    payloadPurgedAt: row.payload_purged_at,
    attachment:
      row.att_content_type === null
        ? null
        : {
            contentType: row.att_content_type,
            sizeBytes: row.att_size_bytes as number,
            pageCount: row.att_page_count as number,
            sha256: row.att_sha256 as string,
            downloadCount: row.download_count,
            lastDownloadedAt: row.last_downloaded_at,
          },
  };
}

/**
 * Raw `better-sqlite3` access to the request tables (data-model.md). All methods are synchronous
 * so the service can combine them in one `DatabaseService.transaction()`; the repository itself
 * never logs or returns anything beyond what the admin API exposes.
 */
@Injectable()
export class RequestsRepository {
  constructor(private readonly database: DatabaseService) {}

  /** Inserts the request and its attachment in one transaction. */
  insert(input: NewRequest): void {
    this.database.transaction(() => {
      this.database.querySync(
        `INSERT INTO requests (id, feature, type, requester_id, status, payload, layout_fingerprint, possible_duplicate, created_at)
         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8)`,
        [
          input.id,
          input.feature,
          input.type,
          input.requesterId,
          input.payload,
          input.layoutFingerprint,
          input.possibleDuplicate ? 1 : 0,
          input.createdAt,
        ],
      );
      if (input.attachment) {
        this.database.querySync(
          `INSERT INTO request_attachments (request_id, content_type, size_bytes, sha256, page_count, content, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            input.id,
            input.attachment.contentType,
            input.attachment.bytes.byteLength,
            input.attachment.sha256,
            input.attachment.pageCount,
            Buffer.from(input.attachment.bytes),
            input.createdAt,
          ],
        );
      }
    });
  }

  findById(id: string): StoredRequest | null {
    const [row] = this.database.querySync<RequestRow>(`${DETAIL_SELECT} WHERE r.id = $1`, [id]);
    return row ? rowToRequest(row) : null;
  }

  /** Newest first; `statuses` filters when given and non-empty. */
  list(statuses?: readonly RequestStatusDto[]): RequestListRow[] {
    const filter = statuses && statuses.length > 0 ? statuses : null;
    const params: unknown[] = filter ? [...filter] : [];
    const placeholders = (filter ?? []).map((_s, i) => '$' + (i + 1)).join(', ');
    const where = filter ? `WHERE r.status IN (${placeholders})` : '';
    const rows = this.database.querySync<RequestRow>(
      `${DETAIL_SELECT} ${where} ORDER BY r.created_at DESC, r.id DESC`,
      params,
    );
    return rows.map((row) => {
      const request = rowToRequest(row);
      return {
        id: request.id,
        feature: request.feature,
        type: request.type,
        requesterEmail: request.requesterEmail,
        status: request.status,
        createdAt: request.createdAt,
        possibleDuplicate: request.possibleDuplicate,
        closedAt: request.closedAt,
        hasSample: request.attachment !== null,
      };
    });
  }

  /** OPEN + IN_PROGRESS across all requests (tab badge). */
  openCount(): number {
    return this.count("SELECT COUNT(*) AS n FROM requests WHERE status IN ('OPEN', 'IN_PROGRESS')");
  }

  countOpenByRequester(requesterId: string): number {
    return this.count(
      "SELECT COUNT(*) AS n FROM requests WHERE requester_id = $1 AND status IN ('OPEN', 'IN_PROGRESS')",
      [requesterId],
    );
  }

  countSince(requesterId: string, sinceIso: string): number {
    return this.count(
      'SELECT COUNT(*) AS n FROM requests WHERE requester_id = $1 AND created_at >= $2',
      [requesterId, sinceIso],
    );
  }

  hasOpenWithFingerprint(fingerprint: string): boolean {
    return (
      this.count(
        "SELECT COUNT(*) AS n FROM requests WHERE layout_fingerprint = $1 AND status IN ('OPEN', 'IN_PROGRESS')",
        [fingerprint],
      ) > 0
    );
  }

  /**
   * Applies a status and/or note change: `handled_by/handled_at` on every change, `closed_at` set
   * on entering a closed status from an open one and cleared on reopening. Null for an unknown id.
   */
  update(
    id: string,
    change: { status?: RequestStatusDto; note?: string },
    adminId: string,
    nowIso: string,
  ): { previousStatus: RequestStatusDto; request: StoredRequest } | null {
    return this.database.transaction(() => {
      const current = this.findById(id);
      if (!current) return null;
      const status = change.status ?? current.status;
      const note = change.note ?? current.note;
      let closedAt = current.closedAt;
      if (CLOSED.includes(status)) closedAt = closedAt ?? nowIso;
      else closedAt = null;
      this.database.querySync(
        `UPDATE requests SET status = $1, note = $2, handled_by = $3, handled_at = $4, closed_at = $5 WHERE id = $6`,
        [status, note, adminId, nowIso, closedAt, id],
      );
      return {
        previousStatus: current.status,
        request: this.findById(id) as StoredRequest,
      };
    });
  }

  findAttachmentContent(id: string): Buffer | null {
    const [row] = this.database.querySync<{ content: Buffer }>(
      'SELECT content FROM request_attachments WHERE request_id = $1',
      [id],
    );
    return row ? row.content : null;
  }

  recordDownload(requestId: string, adminId: string, nowIso: string): void {
    this.database.querySync(
      'INSERT INTO request_download_audit (id, request_id, admin_id, downloaded_at) VALUES ($1, $2, $3, $4)',
      [randomUUID(), requestId, adminId, nowIso],
    );
  }

  downloadStats(requestId: string): { downloadCount: number; lastDownloadedAt: string | null } {
    const [row] = this.database.querySync<{ n: number; last: string | null }>(
      'SELECT COUNT(*) AS n, MAX(downloaded_at) AS last FROM request_download_audit WHERE request_id = $1',
      [requestId],
    );
    return { downloadCount: row?.n ?? 0, lastDownloadedAt: row?.last ?? null };
  }

  /**
   * Retention sweep: deletes the attachment and clears the payload of every closed request whose
   * `closed_at` is at or before the cutoff and that was not purged yet; rows and status history
   * stay. Returns the purged request ids.
   */
  purgeClosedBefore(cutoffIso: string, nowIso: string): string[] {
    return this.database.transaction(() => {
      const due = this.database
        .querySync<{ id: string }>(
          'SELECT id FROM requests WHERE closed_at IS NOT NULL AND closed_at <= $1 AND payload_purged_at IS NULL',
          [cutoffIso],
        )
        .map((row) => row.id);
      for (const id of due) {
        this.database.querySync('DELETE FROM request_attachments WHERE request_id = $1', [id]);
        this.database.querySync(
          'UPDATE requests SET payload = NULL, payload_purged_at = $1 WHERE id = $2',
          [nowIso, id],
        );
      }
      return due;
    });
  }

  private count(sql: string, params: readonly unknown[] = []): number {
    const [row] = this.database.querySync<{ n: number }>(sql, params);
    return row?.n ?? 0;
  }
}
