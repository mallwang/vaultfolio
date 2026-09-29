import { Injectable, Logger } from '@nestjs/common';
import type {
  CertificateRow,
  DataCheckRow,
  EarningsEmployer,
  EarningsOverview,
  EarningsRecordDetail,
  EarningsTables,
  EarningsFilePreview,
  EarningsFileResult,
  EarningsImportPreview,
  EarningsImportResult,
  EarningsImportSummary,
  EarningsRejection,
  EarningsReplacedItem,
} from '@vaultfolio/api-contract';
import {
  careerSummary,
  certificateIdentity,
  dataCheck,
  dataCheckIssueCount,
  employerChanges,
  evaluateChecks,
  type ImportFileInput,
  latestYearComparison,
  monthGrid,
  monthlySeries,
  PERIOD_PATTERN,
  recordIdentity,
  taxesPerYear,
  validateImportFile,
  yearlySeries,
} from '@vaultfolio/earnings';
import { ResourceNotFoundException, ValidationException } from '@vaultfolio/observability';
import { type ExistingIdentity, EarningsRepository } from './earnings.repository';

export const MAX_FILES_PER_BATCH = 400;

interface FileEntry {
  clientFileId: string;
  file: ImportFileInput | null;
  preview: EarningsFilePreview;
}

function invalidBatch(
  error: 'INVALID_BATCH' | 'EARNINGS_UNKNOWN_FIELD' | 'LIMIT_EXCEEDED',
  field: string,
): never {
  throw new ValidationException({
    error,
    message: 'The import batch is malformed.',
    details: [{ field, message: error }],
  });
}

function invalidValue(field: string): never {
  throw new ValidationException({
    error: 'INVALID_VALUE',
    message: 'A value is invalid.',
    details: [{ field, message: 'INVALID_VALUE' }],
  });
}

/** Validates an optional `YYYY-MM` query value. */
export function periodParam(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !PERIOD_PATTERN.test(value)) invalidValue('period');
  return value;
}

/** Validates an optional employer id query value. */
export function employerParam(value: unknown): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^[0-9a-f-]{36}$/.test(value)) invalidValue('employer');
  return value;
}

function emptyPreview(clientFileId: string): EarningsFilePreview {
  return {
    clientFileId,
    status: 'NEW',
    employers: [],
    periods: [],
    years: [],
    recordCount: 0,
    certificateCount: 0,
    includesCorrection: false,
    replaces: [],
    duplicateOf: null,
    conflictsWith: null,
    rejection: null,
  };
}

function reject(entry: FileEntry, rejection: EarningsRejection): void {
  entry.preview.status = 'REJECTED';
  entry.preview.rejection = rejection;
  entry.preview.replaces = [];
  entry.file = null;
}

/**
 * Earnings use cases (contracts/earnings-api.md). The server never trusts the browser: every
 * submission is re-validated against the whitelist and re-checked (FR-013), for the preview and
 * again for the commit. Logs carry import metadata only — never amounts, differences or document
 * content (FR-043).
 */
@Injectable()
export class EarningsService {
  private readonly logger = new Logger(EarningsService.name);

  constructor(private readonly repository: EarningsRepository) {}

  // ---------------------------------------------------------------- import

  /** Dry run: validates and classifies every file; writes nothing (research R6). */
  preview(ownerId: string, batch: unknown): EarningsImportPreview {
    return { files: this.classify(ownerId, batch).map((e) => e.preview) };
  }

  /** Re-validates everything and saves each NEW/REPLACES file in its own transaction. */
  commit(ownerId: string, batch: unknown): EarningsImportResult {
    const files: EarningsFileResult[] = this.classify(ownerId, batch).map((entry) => {
      const { preview, file } = entry;
      if (preview.status === 'DUPLICATE') {
        this.logImport(entry, null, 'SKIPPED_DUPLICATE');
        return { clientFileId: preview.clientFileId, status: 'SKIPPED_DUPLICATE' };
      }
      if (preview.status === 'REJECTED' || !file) {
        this.logImport(entry, null, 'REJECTED', preview.rejection?.code);
        return {
          clientFileId: preview.clientFileId,
          status: 'REJECTED',
          rejection: preview.rejection ?? undefined,
        };
      }
      const { importId } = this.repository.saveImportFile(
        ownerId,
        file,
        evaluateChecks(file.records).perRecord,
      );
      this.logImport(entry, importId, 'SAVED');
      return {
        clientFileId: preview.clientFileId,
        status: 'SAVED',
        importId,
        recordCount: file.records.length,
        certificateCount: file.certificates.length,
      };
    });
    return { files };
  }

  listImports(ownerId: string): EarningsImportSummary[] {
    return this.repository.listImports(ownerId);
  }

  // ---------------------------------------------------------------- read models

  /** Career, latest-year KPIs, yearly and monthly series (FR-024–FR-028); `employerId` filters (FR-023). */
  overview(ownerId: string, employerId?: string): EarningsOverview {
    const employers = this.repository.employerRefs(ownerId);
    const records = this.repository.loadRecords(ownerId, { employerId });
    const certificates = this.repository.loadCertificates(ownerId, employerId);
    const monthly = monthlySeries(records);
    return {
      hasData: records.length > 0 || certificates.length > 0,
      career: careerSummary(records, employers),
      latestYear: latestYearComparison(records),
      yearly: yearlySeries(records),
      monthly,
      employerChanges: employerChanges(monthly),
      dataCheckIssues: dataCheckIssueCount(dataCheck(records, certificates, employers)),
    };
  }

  /** Month detail (FR-029) ordered by `seq`; without `period`: every record (029 export). */
  records(ownerId: string, period?: string): EarningsRecordDetail[] {
    const labels = new Map(this.repository.employerRefs(ownerId).map((e) => [e.id, e.label]));
    return this.repository
      .loadRecords(ownerId, { period })
      .sort(
        (a, b) =>
          a.period.localeCompare(b.period) || a.seq - b.seq || a.issued.localeCompare(b.issued),
      )
      .map((r) => ({
        id: r.id,
        employerId: r.employerId,
        employerLabel: labels.get(r.employerId) ?? '',
        period: r.period,
        issued: r.issued,
        kind: r.kind,
        seq: r.seq,
        amounts: r.amounts,
        import: { id: r.importId, fileName: r.importFileName },
      }));
  }

  /** Year × month grid, taxes per year, certificates (FR-030–FR-032). */
  tables(ownerId: string, employerId?: string): EarningsTables {
    const employers = this.repository.employerRefs(ownerId);
    const labels = new Map(employers.map((e) => [e.id, e.label]));
    const records = this.repository.loadRecords(ownerId, { employerId });
    const certificates: CertificateRow[] = this.repository
      .loadCertificates(ownerId, employerId)
      .map((c) => ({
        id: c.id,
        year: c.year,
        employerId: c.employerId,
        employerLabel: labels.get(c.employerId) ?? '',
        amounts: c.amounts,
        fileName: c.importFileName,
      }));
    return {
      monthGrid: monthGrid(records),
      taxesPerYear: taxesPerYear(records, employers),
      certificates,
    };
  }

  /** Per employer and year: YTD, certificate and completeness checks (FR-033). */
  dataCheck(ownerId: string, employerId?: string): DataCheckRow[] {
    return dataCheck(
      this.repository.loadRecords(ownerId, { employerId }),
      this.repository.loadCertificates(ownerId, employerId),
      this.repository.employerRefs(ownerId),
    );
  }

  // ---------------------------------------------------------------- data management

  deleteImport(ownerId: string, importId: string): void {
    if (!this.repository.deleteImport(ownerId, importId)) {
      throw new ResourceNotFoundException({
        error: 'EARNINGS_IMPORT_NOT_FOUND',
        message: 'This import does not exist.',
      });
    }
    this.logger.log({ event: 'EarningsImportDeleted', importId });
  }

  deleteAll(ownerId: string): void {
    this.repository.deleteAllForOwner(ownerId);
    this.logger.log({ event: 'EarningsDeletedAll' });
  }

  listEmployers(ownerId: string): EarningsEmployer[] {
    return this.repository.listEmployers(ownerId);
  }

  /** Display name only — no figure is editable (FR-004, FR-020). */
  renameEmployer(ownerId: string, employerId: string, body: unknown): EarningsEmployer {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) invalidValue('');
    for (const key of Object.keys(body)) {
      if (key !== 'displayName') {
        throw new ValidationException({
          error: 'EARNINGS_UNKNOWN_FIELD',
          message: 'The request contains a field that is not allowed.',
          details: [{ field: key, message: 'EARNINGS_UNKNOWN_FIELD' }],
        });
      }
    }
    const raw = (body as { displayName?: unknown }).displayName;
    if (typeof raw !== 'string') invalidValue('displayName');
    const displayName = raw.trim().replace(/\s+/g, ' ');
    if (displayName.length > 120) invalidValue('displayName');
    const employer = this.repository.renameEmployer(ownerId, employerId, displayName || null);
    if (!employer) {
      throw new ResourceNotFoundException({
        error: 'EARNINGS_EMPLOYER_NOT_FOUND',
        message: 'This employer does not exist.',
      });
    }
    return employer;
  }

  private logImport(
    entry: FileEntry,
    importId: string | null,
    outcome: string,
    code?: string,
  ): void {
    const file = entry.file;
    this.logger.log({
      event: 'EarningsImport',
      importId,
      clientFileId: entry.clientFileId,
      fileSha256: file?.fileSha256 ?? null,
      parserId: file?.parserId ?? null,
      parserVersion: file?.parserVersion ?? null,
      records: file?.records.length ?? 0,
      certificates: file?.certificates.length ?? 0,
      outcome,
      ...(code ? { code } : {}),
    });
  }

  /** Envelope check, per-file validation, and NEW / REPLACES / DUPLICATE / REJECTED classification. */
  private classify(ownerId: string, batch: unknown): FileEntry[] {
    if (typeof batch !== 'object' || batch === null || Array.isArray(batch))
      invalidBatch('INVALID_BATCH', '');
    for (const key of Object.keys(batch)) {
      if (key !== 'files') invalidBatch('EARNINGS_UNKNOWN_FIELD', key);
    }
    const rawFiles = (batch as { files?: unknown }).files;
    if (!Array.isArray(rawFiles) || rawFiles.length === 0) invalidBatch('INVALID_BATCH', 'files');
    if (rawFiles.length > MAX_FILES_PER_BATCH) invalidBatch('LIMIT_EXCEEDED', 'files');

    const seenIds = new Set<string>();
    const entries: FileEntry[] = rawFiles.map((raw, i) => {
      const id = (raw as { clientFileId?: unknown } | null)?.clientFileId;
      if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(id) || seenIds.has(id)) {
        invalidBatch('INVALID_BATCH', `files[${i}].clientFileId`);
      }
      seenIds.add(id);
      const entry: FileEntry = { clientFileId: id, file: null, preview: emptyPreview(id) };
      const result = validateImportFile(raw);
      if (!result.ok) {
        reject(entry, {
          code: result.error.code,
          ...(result.error.params ? { params: result.error.params } : {}),
        });
        return entry;
      }
      const file = result.value;
      entry.file = file;
      Object.assign(entry.preview, {
        employers: [
          ...new Set([
            ...file.records.map((r) => r.employer),
            ...file.certificates.map((c) => c.employer),
          ]),
        ],
        periods: [...new Set(file.records.map((r) => r.period))].sort(),
        years: [...new Set(file.certificates.map((c) => c.year))].sort((a, b) => a - b),
        recordCount: file.records.length,
        certificateCount: file.certificates.length,
        includesCorrection: file.records.some((r) => r.kind === 'CORRECTION'),
      });
      return entry;
    });

    this.markDuplicates(ownerId, entries);
    this.resolveBatchConflicts(entries);
    this.markReplacements(ownerId, entries);
    return entries;
  }

  /** Same fingerprint as a stored import, or as an earlier file of this batch (FR-015). */
  private markDuplicates(ownerId: string, entries: FileEntry[]): void {
    const firstBySha = new Map<string, FileEntry>();
    for (const entry of entries) {
      if (!entry.file) continue;
      const stored = this.repository.findImportBySha(ownerId, entry.file.fileSha256);
      const earlier = firstBySha.get(entry.file.fileSha256);
      if (stored || earlier) {
        entry.preview.status = 'DUPLICATE';
        entry.preview.duplicateOf = stored;
        entry.preview.conflictsWith = earlier?.clientFileId ?? null;
        entry.file = null;
        continue;
      }
      firstBySha.set(entry.file.fileSha256, entry);
    }
  }

  /**
   * Two files of one batch with the same record or certificate identity (spec Edge Cases): the
   * later-issued one wins (a later file wins a tie), the other is rejected with BATCH_CONFLICT and
   * both point at each other via `conflictsWith`.
   */
  private resolveBatchConflicts(entries: FileEntry[]): void {
    const claims = new Map<string, { entry: FileEntry; issued: string; label: string }[]>();
    entries.forEach((entry) => {
      const file = entry.file;
      if (!file) return;
      for (const r of file.records) {
        const list = claims.get(`r|${recordIdentity(r)}`) ?? [];
        list.push({ entry, issued: r.issued, label: r.period });
        claims.set(`r|${recordIdentity(r)}`, list);
      }
      for (const c of file.certificates) {
        const list = claims.get(`c|${certificateIdentity(c)}`) ?? [];
        list.push({ entry, issued: String(c.year), label: String(c.year) });
        claims.set(`c|${certificateIdentity(c)}`, list);
      }
    });
    for (const list of claims.values()) {
      const live = list.filter((c) => c.entry.file);
      if (live.length < 2) continue;
      const winner = live.reduce((best, c) => (c.issued >= best.issued ? c : best));
      for (const loser of live) {
        if (loser === winner) continue;
        reject(loser.entry, {
          code: 'BATCH_CONFLICT',
          params: { period: loser.label, with: winner.entry.clientFileId },
        });
        loser.entry.preview.conflictsWith = winner.entry.clientFileId;
        winner.entry.preview.conflictsWith ??= loser.entry.clientFileId;
      }
    }
  }

  /** Stored identities a file would replace (FR-016), announced before confirmation. */
  private markReplacements(ownerId: string, entries: FileEntry[]): void {
    const live = entries.filter((e) => e.file);
    if (live.length === 0) return;
    const records = this.repository.recordIdentities(ownerId);
    const certificates = this.repository.certificateIdentities(ownerId);
    const item = (
      existing: ExistingIdentity,
      values: Omit<EarningsReplacedItem, 'importedAt' | 'fileName'>,
    ): EarningsReplacedItem => ({
      ...values,
      importedAt: existing.importedAt,
      fileName: existing.fileName,
    });
    for (const entry of live) {
      const file = entry.file as ImportFileInput;
      const replaces: EarningsReplacedItem[] = [];
      for (const r of file.records) {
        const existing = records.get(recordIdentity(r));
        if (existing) {
          replaces.push(
            item(existing, {
              employer: r.employer,
              period: r.period,
              kind: r.kind,
              seq: r.seq,
              year: null,
            }),
          );
        }
      }
      for (const c of file.certificates) {
        const existing = certificates.get(certificateIdentity(c));
        if (existing) {
          replaces.push(
            item(existing, {
              employer: c.employer,
              period: null,
              kind: null,
              seq: null,
              year: c.year,
            }),
          );
        }
      }
      entry.preview.replaces = replaces;
      entry.preview.status = replaces.length > 0 ? 'REPLACES' : 'NEW';
    }
  }
}
