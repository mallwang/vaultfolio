import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type {
  EarningsEmployer,
  EarningsImportSummary,
  EarningsSourceType,
} from '@vaultfolio/api-contract';
import {
  type CertificateAmounts,
  certificateIdentity,
  type CheckResult,
  type EmployerRef,
  type ImportFileInput,
  normalizeEmployerName,
  recordIdentity,
  type RecordKind,
  type StoredCertificate,
  type StoredPayRecordAmounts,
  type StoredRecord,
} from '@vaultfolio/earnings';
import { DatabaseService } from '../database/database.service';
import { EarningsCryptoService } from './earnings-crypto.service';

export interface StoredRecordRow extends StoredRecord {
  importFileName: string;
}

export interface StoredCertificateRow extends StoredCertificate {
  importFileName: string;
}

/** Where an existing record/certificate identity came from — shown as "Replaces …" in the preview. */
export interface ExistingIdentity {
  importId: string;
  importedAt: string;
  fileName: string;
}

interface RecordRow {
  id: string;
  owner_id: string;
  import_id: string;
  employer_id: string;
  period: string;
  issued: string;
  kind: RecordKind;
  seq: number;
  amounts_enc: string;
  file_name: string;
}

interface CertificateRowDb {
  id: string;
  owner_id: string;
  import_id: string;
  employer_id: string;
  year: number;
  amounts_enc: string;
  file_name: string;
}

interface EmployerRow {
  id: string;
  detected_name: string;
  display_name: string | null;
}

/**
 * Raw `better-sqlite3` access to the four earnings tables (data-model.md). Every method takes the
 * caller's `ownerId` and filters by it in the query itself (FR-003): a row of another owner is
 * indistinguishable from a missing row. Amounts are encrypted/decrypted here and nowhere else;
 * multi-table writes run inside `DatabaseService.transaction()` (research R13).
 */
@Injectable()
export class EarningsRepository {
  constructor(
    private readonly database: DatabaseService,
    private readonly crypto: EarningsCryptoService,
  ) {}

  // ---------------------------------------------------------------- employers

  /** Employer id for a detected name (normalized), created on first mention. Synchronous — usable in a transaction. */
  findOrCreateEmployer(ownerId: string, detectedName: string): string {
    const name = normalizeEmployerName(detectedName);
    const [existing] = this.database.querySync<{ id: string }>(
      'SELECT id FROM earnings_employers WHERE owner_id = $1 AND detected_name = $2',
      [ownerId, name],
    );
    if (existing) return existing.id;
    const id = randomUUID();
    this.database.querySync(
      'INSERT INTO earnings_employers (id, owner_id, detected_name, created_at) VALUES ($1, $2, $3, $4)',
      [id, ownerId, name, new Date().toISOString()],
    );
    return id;
  }

  listEmployers(ownerId: string): EarningsEmployer[] {
    return this.database
      .querySync<EmployerRow>(
        'SELECT id, detected_name, display_name FROM earnings_employers WHERE owner_id = $1 ORDER BY detected_name',
        [ownerId],
      )
      .map((r) => ({ id: r.id, detectedName: r.detected_name, displayName: r.display_name }));
  }

  /** Employers with their display label (display name, falling back to the detected name). */
  employerRefs(ownerId: string): EmployerRef[] {
    return this.listEmployers(ownerId).map((e) => ({
      id: e.id,
      label: e.displayName ?? e.detectedName,
    }));
  }

  /** Sets (or clears with `null`) an employer's display name; `null` when the employer is not the caller's. */
  renameEmployer(
    ownerId: string,
    employerId: string,
    displayName: string | null,
  ): EarningsEmployer | null {
    const [row] = this.database.querySync<EmployerRow>(
      'SELECT id, detected_name, display_name FROM earnings_employers WHERE id = $1 AND owner_id = $2',
      [employerId, ownerId],
    );
    if (!row) return null;
    this.database.querySync(
      'UPDATE earnings_employers SET display_name = $1 WHERE id = $2 AND owner_id = $3',
      [displayName, employerId, ownerId],
    );
    return { id: row.id, detectedName: row.detected_name, displayName };
  }

  // ---------------------------------------------------------------- reads

  loadRecords(
    ownerId: string,
    filter: { employerId?: string; period?: string } = {},
  ): StoredRecordRow[] {
    const params: unknown[] = [ownerId];
    let where = 'r.owner_id = $1';
    if (filter.employerId) {
      params.push(filter.employerId);
      where += ` AND r.employer_id = $${params.length}`;
    }
    if (filter.period) {
      params.push(filter.period);
      where += ` AND r.period = $${params.length}`;
    }
    const rows = this.database.querySync<RecordRow>(
      `SELECT r.*, i.file_name FROM earnings_records r
         JOIN earnings_imports i ON i.id = r.import_id AND i.owner_id = r.owner_id
        WHERE ${where}
        ORDER BY r.period, r.seq, r.issued`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      importId: r.import_id,
      employerId: r.employer_id,
      period: r.period,
      issued: r.issued,
      kind: r.kind,
      seq: r.seq,
      amounts: this.crypto.decrypt<StoredPayRecordAmounts>(
        'earnings_records',
        r.id,
        r.owner_id,
        r.amounts_enc,
      ),
      importFileName: r.file_name,
    }));
  }

  loadCertificates(ownerId: string, employerId?: string): StoredCertificateRow[] {
    const params: unknown[] = [ownerId];
    let where = 'c.owner_id = $1';
    if (employerId) {
      params.push(employerId);
      where += ' AND c.employer_id = $2';
    }
    const rows = this.database.querySync<CertificateRowDb>(
      `SELECT c.*, i.file_name FROM earnings_certificates c
         JOIN earnings_imports i ON i.id = c.import_id AND i.owner_id = c.owner_id
        WHERE ${where}
        ORDER BY c.year, c.employer_id`,
      params,
    );
    return rows.map((c) => ({
      id: c.id,
      importId: c.import_id,
      employerId: c.employer_id,
      year: c.year,
      amounts: this.crypto.decrypt<CertificateAmounts>(
        'earnings_certificates',
        c.id,
        c.owner_id,
        c.amounts_enc,
      ),
      importFileName: c.file_name,
    }));
  }

  hasData(ownerId: string): boolean {
    const [row] = this.database.querySync<{ n: number }>(
      `SELECT (SELECT COUNT(*) FROM earnings_records WHERE owner_id = $1)
            + (SELECT COUNT(*) FROM earnings_certificates WHERE owner_id = $1) AS n`,
      [ownerId],
    );
    return (row?.n ?? 0) > 0;
  }

  // ---------------------------------------------------------------- import lookups

  findImportBySha(ownerId: string, sha: string): ExistingIdentity | null {
    const [row] = this.database.querySync<{ id: string; imported_at: string; file_name: string }>(
      'SELECT id, imported_at, file_name FROM earnings_imports WHERE owner_id = $1 AND file_sha256 = $2',
      [ownerId, sha],
    );
    return row ? { importId: row.id, importedAt: row.imported_at, fileName: row.file_name } : null;
  }

  /** Every stored record identity (`recordIdentity` of the detected employer name) → its import. */
  recordIdentities(ownerId: string): Map<string, ExistingIdentity> {
    const rows = this.database.querySync<{
      detected_name: string;
      period: string;
      kind: RecordKind;
      seq: number;
      import_id: string;
      imported_at: string;
      file_name: string;
    }>(
      `SELECT e.detected_name, r.period, r.kind, r.seq, r.import_id, i.imported_at, i.file_name
         FROM earnings_records r
         JOIN earnings_employers e ON e.id = r.employer_id AND e.owner_id = r.owner_id
         JOIN earnings_imports i ON i.id = r.import_id AND i.owner_id = r.owner_id
        WHERE r.owner_id = $1`,
      [ownerId],
    );
    return new Map(
      rows.map((r) => [
        recordIdentity({ employer: r.detected_name, period: r.period, kind: r.kind, seq: r.seq }),
        { importId: r.import_id, importedAt: r.imported_at, fileName: r.file_name },
      ]),
    );
  }

  /** Every stored certificate identity (`certificateIdentity`) → its import. */
  certificateIdentities(ownerId: string): Map<string, ExistingIdentity> {
    const rows = this.database.querySync<{
      detected_name: string;
      year: number;
      import_id: string;
      imported_at: string;
      file_name: string;
    }>(
      `SELECT e.detected_name, c.year, c.import_id, i.imported_at, i.file_name
         FROM earnings_certificates c
         JOIN earnings_employers e ON e.id = c.employer_id AND e.owner_id = c.owner_id
         JOIN earnings_imports i ON i.id = c.import_id AND i.owner_id = c.owner_id
        WHERE c.owner_id = $1`,
      [ownerId],
    );
    return new Map(
      rows.map((r) => [
        certificateIdentity({ employer: r.detected_name, year: r.year }),
        { importId: r.import_id, importedAt: r.imported_at, fileName: r.file_name },
      ]),
    );
  }

  // ---------------------------------------------------------------- writes

  /**
   * Saves one validated file in one transaction (research R6): the import row, its employers, and
   * every record/certificate — replacing an existing identity by delete-then-insert (FR-016).
   * `checks[i]` are the server-computed check results of `file.records[i]`.
   */
  saveImportFile(
    ownerId: string,
    file: ImportFileInput,
    checks: CheckResult[][],
  ): { importId: string } {
    return this.database.transaction(() => {
      const importId = randomUUID();
      this.database.querySync(
        `INSERT INTO earnings_imports (id, owner_id, file_name, source_type, file_sha256, parser_id, parser_version, imported_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          importId,
          ownerId,
          file.fileName,
          file.sourceType,
          file.fileSha256,
          file.parserId,
          file.parserVersion,
          new Date().toISOString(),
        ],
      );
      const now = new Date().toISOString();
      file.records.forEach((r, i) => {
        const employerId = this.findOrCreateEmployer(ownerId, r.employer);
        this.database.querySync(
          'DELETE FROM earnings_records WHERE owner_id = $1 AND employer_id = $2 AND period = $3 AND kind = $4 AND seq = $5',
          [ownerId, employerId, r.period, r.kind, r.seq],
        );
        const id = randomUUID();
        const amounts: StoredPayRecordAmounts = { ...r.amounts, checks: checks[i] ?? [] };
        this.database.querySync(
          `INSERT INTO earnings_records (id, owner_id, import_id, employer_id, period, issued, kind, seq, amounts_enc, key_version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10)`,
          [
            id,
            ownerId,
            importId,
            employerId,
            r.period,
            r.issued,
            r.kind,
            r.seq,
            this.crypto.encrypt('earnings_records', id, ownerId, amounts),
            now,
          ],
        );
      });
      for (const c of file.certificates) {
        const employerId = this.findOrCreateEmployer(ownerId, c.employer);
        this.database.querySync(
          'DELETE FROM earnings_certificates WHERE owner_id = $1 AND employer_id = $2 AND year = $3',
          [ownerId, employerId, c.year],
        );
        const id = randomUUID();
        this.database.querySync(
          `INSERT INTO earnings_certificates (id, owner_id, import_id, employer_id, year, amounts_enc, key_version, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
          [
            id,
            ownerId,
            importId,
            employerId,
            c.year,
            this.crypto.encrypt('earnings_certificates', id, ownerId, c.amounts),
            now,
          ],
        );
      }
      return { importId };
    });
  }

  /** Import history, newest first; counts and periods derived from the rows still attributed to each import. */
  listImports(ownerId: string): EarningsImportSummary[] {
    const imports = this.database.querySync<{
      id: string;
      file_name: string;
      source_type: EarningsSourceType;
      parser_id: string;
      parser_version: string;
      imported_at: string;
      record_count: number;
      certificate_count: number;
      first_period: string | null;
      last_period: string | null;
    }>(
      `SELECT i.id, i.file_name, i.source_type, i.parser_id, i.parser_version, i.imported_at,
              (SELECT COUNT(*) FROM earnings_records r WHERE r.import_id = i.id AND r.owner_id = i.owner_id) AS record_count,
              (SELECT COUNT(*) FROM earnings_certificates c WHERE c.import_id = i.id AND c.owner_id = i.owner_id) AS certificate_count,
              (SELECT MIN(period) FROM earnings_records r WHERE r.import_id = i.id AND r.owner_id = i.owner_id) AS first_period,
              (SELECT MAX(period) FROM earnings_records r WHERE r.import_id = i.id AND r.owner_id = i.owner_id) AS last_period
         FROM earnings_imports i
        WHERE i.owner_id = $1
        ORDER BY i.imported_at DESC, i.rowid DESC`,
      [ownerId],
    );
    const employers = this.database.querySync<{ import_id: string; label: string }>(
      `SELECT DISTINCT x.import_id, COALESCE(e.display_name, e.detected_name) AS label
         FROM (SELECT import_id, employer_id FROM earnings_records WHERE owner_id = $1
               UNION SELECT import_id, employer_id FROM earnings_certificates WHERE owner_id = $1) x
         JOIN earnings_employers e ON e.id = x.employer_id AND e.owner_id = $1
        ORDER BY label`,
      [ownerId],
    );
    const years = this.database.querySync<{ import_id: string; year: number }>(
      'SELECT DISTINCT import_id, year FROM earnings_certificates WHERE owner_id = $1 ORDER BY year',
      [ownerId],
    );
    return imports.map((i) => ({
      id: i.id,
      fileName: i.file_name,
      sourceType: i.source_type,
      parserId: i.parser_id,
      parserVersion: i.parser_version,
      importedAt: i.imported_at,
      recordCount: i.record_count,
      certificateCount: i.certificate_count,
      employers: employers.filter((e) => e.import_id === i.id).map((e) => e.label),
      firstPeriod: i.first_period,
      lastPeriod: i.last_period,
      years: years.filter((y) => y.import_id === i.id).map((y) => y.year),
    }));
  }

  /** Deletes an import with exactly its remaining records/certificates and any employer left without data. */
  deleteImport(ownerId: string, importId: string): boolean {
    return this.database.transaction(() => {
      const [existing] = this.database.querySync<{ id: string }>(
        'SELECT id FROM earnings_imports WHERE id = $1 AND owner_id = $2',
        [importId, ownerId],
      );
      if (!existing) return false;
      this.database.querySync(
        'DELETE FROM earnings_records WHERE import_id = $1 AND owner_id = $2',
        [importId, ownerId],
      );
      this.database.querySync(
        'DELETE FROM earnings_certificates WHERE import_id = $1 AND owner_id = $2',
        [importId, ownerId],
      );
      this.database.querySync('DELETE FROM earnings_imports WHERE id = $1 AND owner_id = $2', [
        importId,
        ownerId,
      ]);
      this.database.querySync(
        `DELETE FROM earnings_employers
          WHERE owner_id = $1
            AND id NOT IN (SELECT employer_id FROM earnings_records WHERE owner_id = $1)
            AND id NOT IN (SELECT employer_id FROM earnings_certificates WHERE owner_id = $1)`,
        [ownerId],
      );
      return true;
    });
  }

  /** Deletes all of the owner's earnings data — records, certificates, imports, employers (FR-038). */
  deleteAllForOwner(ownerId: string): void {
    this.database.transaction(() => {
      for (const table of [
        'earnings_records',
        'earnings_certificates',
        'earnings_imports',
        'earnings_employers',
      ]) {
        this.database.querySync(`DELETE FROM ${table} WHERE owner_id = $1`, [ownerId]);
      }
    });
  }
}
