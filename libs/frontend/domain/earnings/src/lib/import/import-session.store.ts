import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import type {
  EarningsFilePreview,
  EarningsFileResult,
  EarningsImportFile,
  EarningsPayAmountKey,
  EarningsPayRecordInput,
  EarningsRejection,
  EarningsSourceType,
} from '@vaultfolio/api-contract';
import {
  type CheckFailure,
  type ParseOutcome,
  applyCorrection,
  collectCheckFailures,
  editableKeys,
  parseDocument,
  parseMoneyInput,
  readEarningsExport,
  toImportFile,
} from '@vaultfolio/earnings';
import { firstValueFrom } from 'rxjs';
import { EarningsService } from '../earnings.service';
import { type PdfExtractResult, extractPdfText, sha256Hex } from '../pdf/pdf-text-extractor';
import { readText } from '../pdf/read-blob';

/** How files are read on the device; replaced in specs with fixture text. */
export interface EarningsFileReader {
  extractPdfText(file: File): Promise<PdfExtractResult>;
  sha256Hex(file: File): Promise<string>;
}

export const EARNINGS_FILE_READER = new InjectionToken<EarningsFileReader>('EARNINGS_FILE_READER', {
  providedIn: 'root',
  factory: () => ({ extractPdfText, sha256Hex }),
});

/**
 * `needs-correction`: a payslip that failed an arithmetic check on the device. Its figures are
 * shown in the correction grid; it stays rejected (never sent) until every check passes (FR-012a).
 */
export type ImportRowState = 'reading' | 'local-rejected' | 'needs-correction' | 'candidate';

/** One editable figure of a record: record index and figure name. */
export interface FigureRef {
  recordIndex: number;
  key: EarningsPayAmountKey;
}

/** Key of a figure in `inputs` / `inputErrors`. */
export function figureId(recordIndex: number, key: EarningsPayAmountKey): string {
  return `${recordIndex}:${key}`;
}

export interface ImportRow {
  clientFileId: string;
  fileName: string;
  state: ImportRowState;
  sourceType: EarningsSourceType | null;
  parserId: string | null;
  employer: string | null;
  /** The whitelisted body sent for this file — exactly the "figures that will be sent". */
  body: EarningsImportFile | null;
  /** Rejected on the device (unreadable, unsupported, failed check) — never sent. */
  localRejection: EarningsRejection | null;
  preview: EarningsFilePreview | null;
  result: EarningsFileResult | null;
  /**
   * Correction state (browser only, FR-012a): the current records, the records as read, the
   * failing checks, the figures that may be edited (fixed by the original failure), the text the
   * user typed per figure and the figures whose text is not an amount. `null` for files that
   * passed every check when read.
   */
  draft: EarningsPayRecordInput[] | null;
  originalRecords: EarningsPayRecordInput[] | null;
  failures: CheckFailure[];
  editable: FigureRef[];
  inputs: Record<string, string>;
  inputErrors: Record<string, true>;
}

export type ImportPhase =
  'idle' | 'reading' | 'checking' | 'ready' | 'importing' | 'done' | 'error';

const EXPORT_JSON = /\.json$/i;
const PDF = /\.pdf$/i;

/**
 * One import session (FR-005–FR-017, FR-022): reads the dropped files one after another on the
 * device (yielding between files so the page stays responsive), keeps only the whitelisted figures
 * of each readable file, asks the server to classify them (preview), and on confirmation saves the
 * files the preview marked New or Replaces. No document bytes or text are ever sent.
 */
@Injectable()
export class ImportSessionStore {
  private readonly api = inject(EarningsService);
  private readonly reader = inject(EARNINGS_FILE_READER);
  private counter = 0;

  readonly rows = signal<ImportRow[]>([]);
  readonly phase = signal<ImportPhase>('idle');
  readonly errorCode = signal<string | null>(null);

  readonly total = computed(() => this.rows().length);
  readonly read = computed(() => this.rows().filter((r) => r.state !== 'reading').length);
  readonly ready = computed(() =>
    this.rows().filter((r) => r.preview?.status === 'NEW' || r.preview?.status === 'REPLACES'),
  );
  readonly readyRecords = computed(() =>
    this.ready().reduce(
      (n, r) => n + (r.preview?.recordCount ?? 0) + (r.preview?.certificateCount ?? 0),
      0,
    ),
  );
  readonly skipped = computed(
    () => this.rows().filter((r) => r.preview?.status === 'DUPLICATE').length,
  );
  readonly rejected = computed(
    () =>
      this.rows().filter(
        (r) =>
          r.state === 'local-rejected' ||
          r.state === 'needs-correction' ||
          r.preview?.status === 'REJECTED',
      ).length,
  );
  /** Figures the user corrected in the files that are ready to import. */
  readonly correctedFigures = computed(() =>
    this.ready().reduce((n, r) => n + correctedCount(r), 0),
  );
  readonly savedCount = computed(
    () => this.rows().filter((r) => r.result?.status === 'SAVED').length,
  );

  /** Adds files and reads them sequentially, then previews the whole candidate set. */
  async addFiles(files: readonly File[]): Promise<void> {
    if (files.length === 0) return;
    if (this.phase() === 'done') this.reset();
    const added = files.map((file) => ({ file, row: this.newRow(file) }));
    this.rows.update((rows) => [...rows, ...added.map((a) => a.row)]);
    this.phase.set('reading');

    for (const { file, row } of added) {
      const next = await this.readFile(file, row);
      this.patch(row.clientFileId, next);
      await yieldToBrowser();
    }
    await this.preview();
  }

  remove(clientFileId: string): void {
    this.rows.update((rows) => rows.filter((r) => r.clientFileId !== clientFileId));
    if (this.rows().length === 0) {
      this.reset();
      return;
    }
    void this.preview();
  }

  /**
   * The user typed `text` into a figure of a file that failed a check (FR-012a). Only figures
   * taking part in the failing check can be edited; unparsable text is remembered as an input
   * error and keeps the file out of the import; checks re-run on every edit.
   */
  editFigure(
    clientFileId: string,
    recordIndex: number,
    key: EarningsPayAmountKey,
    text: string,
  ): void {
    const row = this.rows().find((r) => r.clientFileId === clientFileId);
    if (!row?.draft || !isEditable(row, recordIndex, key)) return;
    const id = figureId(recordIndex, key);
    const value = parseMoneyInput(text);
    const inputs = { ...row.inputs, [id]: text };
    if (value === null) {
      this.update(row, row.draft, inputs, { ...row.inputErrors, [id]: true });
      return;
    }
    const inputErrors = without(row.inputErrors, id);
    const draft = applyCorrection(
      row.draft,
      { recordIndex, key, value },
      row.editable,
      row.originalRecords ?? undefined,
    );
    if (draft) this.update(row, draft, inputs, inputErrors);
  }

  /** Puts the read value of a corrected figure back; the marker disappears again. */
  restoreFigure(clientFileId: string, recordIndex: number, key: EarningsPayAmountKey): void {
    const row = this.rows().find((r) => r.clientFileId === clientFileId);
    const original = row?.originalRecords?.[recordIndex]?.amounts[key];
    if (!row?.draft || !isEditable(row, recordIndex, key) || original == null) return;
    const id = figureId(recordIndex, key);
    const inputs = without(row.inputs, id);
    const inputErrors = without(row.inputErrors, id);
    const draft = applyCorrection(
      row.draft,
      { recordIndex, key, value: original },
      row.editable,
      row.originalRecords ?? undefined,
    );
    if (draft) this.update(row, draft, inputs, inputErrors);
  }

  reset(): void {
    this.rows.set([]);
    this.phase.set('idle');
    this.errorCode.set(null);
  }

  /** Saves every file the preview marked New or Replaces (the server re-validates each). */
  async commit(): Promise<boolean> {
    const files = this.ready().map((r) => r.body as EarningsImportFile);
    if (files.length === 0 || this.phase() !== 'ready') return false;
    this.phase.set('importing');
    try {
      const result = await firstValueFrom(this.api.commit({ files }));
      const byId = new Map(result.files.map((f) => [f.clientFileId, f]));
      this.rows.update((rows) =>
        rows.map((r) => ({ ...r, result: byId.get(r.clientFileId) ?? null })),
      );
      this.phase.set('done');
      return true;
    } catch (error) {
      this.fail(error);
      return false;
    }
  }

  private previewSeq = 0;

  /**
   * Re-derives a correctable row from its draft: failing checks, status, the body that would be
   * sent. A file is a candidate only when every check passes and every typed amount parses.
   */
  private update(
    row: ImportRow,
    draft: EarningsPayRecordInput[],
    inputs: Record<string, string>,
    inputErrors: Record<string, true>,
  ): void {
    const failures = collectCheckFailures(draft);
    const passes = failures.length === 0 && Object.keys(inputErrors).length === 0;
    const body = row.body
      ? (toImportFile(
          { records: draft, certificates: row.body.certificates },
          {
            clientFileId: row.body.clientFileId,
            fileName: row.body.fileName,
            sourceType: row.body.sourceType,
            fileSha256: row.body.fileSha256,
            parserId: row.body.parserId,
            parserVersion: row.body.parserVersion,
          },
        ) as EarningsImportFile)
      : null;
    const first = failures[0];
    this.patch(row.clientFileId, {
      draft,
      inputs,
      inputErrors,
      failures,
      body,
      state: passes ? 'candidate' : 'needs-correction',
      preview: null,
      localRejection: first
        ? {
            code: 'CHECK_FAILED',
            params: { check: first.check, period: first.period, difference: first.difference },
          }
        : null,
    });
    void this.preview();
  }

  private async preview(): Promise<void> {
    const seq = ++this.previewSeq;
    const candidates = this.rows().filter((r) => r.state === 'candidate');
    if (this.rows().some((r) => r.state === 'reading')) return;
    if (candidates.length === 0) {
      this.rows.update((rows) => rows.map((r) => ({ ...r, preview: null })));
      this.phase.set('ready');
      return;
    }
    this.phase.set('checking');
    try {
      const preview = await firstValueFrom(
        this.api.preview({ files: candidates.map((r) => r.body as EarningsImportFile) }),
      );
      if (seq !== this.previewSeq) return; // a newer edit superseded this answer
      const byId = new Map(preview.files.map((f) => [f.clientFileId, f]));
      this.rows.update((rows) =>
        rows.map((r) => ({ ...r, preview: byId.get(r.clientFileId) ?? null })),
      );
      this.errorCode.set(null);
      this.phase.set('ready');
    } catch (error) {
      if (seq === this.previewSeq) this.fail(error);
    }
  }

  private async readFile(file: File, row: ImportRow): Promise<Partial<ImportRow>> {
    try {
      if (EXPORT_JSON.test(file.name) || file.type === 'application/json') {
        let json: unknown;
        try {
          json = JSON.parse(await readText(file));
        } catch {
          return rejected({ code: 'UNREADABLE' });
        }
        return this.toCandidate(file, row, readEarningsExport(json), 'EXPORT_JSON');
      }
      if (!PDF.test(file.name) && file.type !== 'application/pdf') {
        return rejected({ code: 'UNSUPPORTED_FORMAT' });
      }
      const extracted = await this.reader.extractPdfText(file);
      if ('error' in extracted) return rejected({ code: extracted.error });
      const outcome = parseDocument(extracted.text);
      const sourceType = outcome.documentType === 'CERTIFICATE' ? 'CERTIFICATE_PDF' : 'PAYSLIP_PDF';
      return this.toCandidate(file, row, outcome, sourceType);
    } catch {
      return rejected({ code: 'UNREADABLE' });
    }
  }

  private async toCandidate(
    file: File,
    row: ImportRow,
    outcome: ParseOutcome & { parserId?: string; parserVersion?: string },
    sourceType: EarningsSourceType,
  ): Promise<Partial<ImportRow>> {
    if (!outcome.ok) {
      const base = { ...rejected(outcome.error), parserId: outcome.parserId ?? null, sourceType };
      const partial = outcome.partial;
      if (outcome.error.code !== 'CHECK_FAILED' || !partial || sourceType !== 'PAYSLIP_PDF') {
        return base;
      }
      // FR-012a: show the figures of a payslip that failed a check so they can be corrected
      const failures = collectCheckFailures(partial.records);
      const editable = editableKeys(failures);
      if (editable.length === 0) return base;
      return {
        ...base,
        state: 'needs-correction',
        employer: partial.employer || null,
        body: toImportFile(partial, {
          clientFileId: row.clientFileId,
          fileName: file.name,
          sourceType,
          fileSha256: await this.reader.sha256Hex(file),
          parserId: outcome.parserId as string,
          parserVersion: outcome.parserVersion as string,
        }) as EarningsImportFile,
        draft: partial.records,
        originalRecords: partial.records,
        failures,
        editable,
      };
    }
    const body = toImportFile(outcome, {
      clientFileId: row.clientFileId,
      fileName: file.name,
      sourceType,
      fileSha256: await this.reader.sha256Hex(file),
      parserId: outcome.parserId as string,
      parserVersion: outcome.parserVersion as string,
    }) as EarningsImportFile;
    return {
      state: 'candidate',
      sourceType,
      parserId: body.parserId,
      employer: outcome.employer || null,
      body,
    };
  }

  private newRow(file: File): ImportRow {
    this.counter += 1;
    return {
      clientFileId: `file-${this.counter}`,
      fileName: file.name,
      state: 'reading',
      sourceType: null,
      parserId: null,
      employer: null,
      body: null,
      localRejection: null,
      preview: null,
      result: null,
      draft: null,
      originalRecords: null,
      failures: [],
      editable: [],
      inputs: {},
      inputErrors: {},
    };
  }

  private patch(clientFileId: string, next: Partial<ImportRow>): void {
    this.rows.update((rows) =>
      rows.map((r) => (r.clientFileId === clientFileId ? { ...r, ...next } : r)),
    );
  }

  private fail(error: unknown): void {
    const code =
      error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
        ? error.error.error
        : 'generic';
    this.errorCode.set(code);
    this.phase.set('error');
  }
}

/** A copy of `record` without `key`. */
function without<T>(record: Record<string, T>, key: string): Record<string, T> {
  return Object.fromEntries(Object.entries(record).filter(([k]) => k !== key));
}

function isEditable(row: ImportRow, recordIndex: number, key: EarningsPayAmountKey): boolean {
  return row.editable.some((e) => e.recordIndex === recordIndex && e.key === key);
}

/** Number of figures the user corrected in a row (names listed in the records' `corrected`). */
export function correctedCount(row: Pick<ImportRow, 'draft'>): number {
  return (row.draft ?? []).reduce((n, r) => n + (r.corrected?.length ?? 0), 0);
}

function rejected(rejection: EarningsRejection): Partial<ImportRow> {
  return { state: 'local-rejected', localRejection: rejection };
}

/** Lets the browser paint between files (FR-022). */
function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
