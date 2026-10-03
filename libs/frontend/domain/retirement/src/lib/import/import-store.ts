import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  RetirementPillar,
  RetirementRecord,
  RetirementRecordInput,
  RetirementScenario,
  RetirementSupplement,
} from '@vaultfolio/api-contract';
import type { PdfDocumentText } from '@vaultfolio/document-text';
import {
  type MissingSupplement,
  type ParsedRecord,
  type ParseOutcome,
  type ValidationIssue,
  parseStatement,
  pillarOf,
  validateRecordInput,
} from '@vaultfolio/retirement';
import {
  type PdfExtractResult,
  type RecognitionProgress,
  type RecognitionResult,
  TEXT_RECOGNISER,
  extractPdfText,
} from '@vaultfolio/frontend-document-reader';
import { parseMoneyInput } from '../retirement-format';
import { RetirementService } from '../retirement.service';

/** How a file is read on the device; replaced in specs with fixture text. */
export interface RetirementFileReader {
  extractPdfText(file: File): Promise<PdfExtractResult>;
}

export const RETIREMENT_FILE_READER = new InjectionToken<RetirementFileReader>(
  'RETIREMENT_FILE_READER',
  { providedIn: 'root', factory: () => ({ extractPdfText }) },
);

/**
 * Why a document ended without a review: not a PDF, unreadable, password protected, no automatically
 * readable text (declined/failed scan), or rejected by the parsers.
 */
export type ImportRejection =
  | 'UNSUPPORTED_FORMAT'
  | 'UNREADABLE'
  | 'PASSWORD_PROTECTED'
  | 'IMAGE_ONLY'
  | 'TOO_MANY_PAGES'
  | 'ENGINE_UNAVAILABLE'
  | 'UNRECOGNISED'
  | 'INCONSISTENT'
  | 'INCOMPLETE';

export type ImportStep =
  | 'idle'
  | 'reading'
  /** A PDF without a text layer: waiting for the user's decision on on-device recognition. */
  | 'awaiting-recognition'
  | 'recognising'
  | 'review'
  | 'rejected'
  | 'saving'
  | 'saved';

/** A record the import would replace (an existing statutory record, or the one a card named). */
export interface ReplaceTarget {
  id: string;
  origin: 'IMPORTED' | 'MANUAL';
}

type SupplementKey = MissingSupplement;

/**
 * State machine of one statement import (design.md "Import flow"): pick → text extraction →
 * consent for scans → on-device recognition → parse → review → confirm. The document and its text
 * never leave the device; confirming sends one `POST /retirement/records` with the whitelisted
 * figures, the identifier the user confirmed, the supplement and `parserId`/`parserVersion`/
 * `ocrRead` (FR-002c). A document no parser recognises, or whose figures fail the plausibility
 * checks, is rejected as a whole and nothing is saved.
 */
@Injectable()
export class ImportStore {
  private readonly api = inject(RetirementService);
  private readonly reader = inject(RETIREMENT_FILE_READER);
  private readonly recogniser = inject(TEXT_RECOGNISER);

  readonly step = signal<ImportStep>('idle');
  readonly fileName = signal('');
  readonly rejection = signal<ImportRejection | null>(null);
  readonly failedChecks = signal<string[]>([]);
  readonly recognition = signal<RecognitionProgress | null>(null);
  readonly record = signal<ParsedRecord | null>(null);
  readonly parser = signal<{ id: string; version: string } | null>(null);
  readonly ocrRead = signal(false);
  /** Raw text of the review inputs (monthly contribution etc., provider label if not printed). */
  readonly inputs = signal<Partial<Record<SupplementKey | 'providerLabel', string>>>({});
  readonly expectedScenario = signal<RetirementScenario>('3');
  readonly replaceTarget = signal<ReplaceTarget | null>(null);
  readonly errorCode = signal<string | null>(null);
  readonly savedPillar = signal<RetirementPillar | null>(null);

  /** Record id named by a card's "replace by new document" action. */
  private requestedReplace: string | null = null;
  private scan: File | null = null;
  private controller: AbortController | null = null;

  readonly hasScenarios = computed(() => {
    const figures = this.record()?.figures as { scenarioMonthly?: unknown } | undefined;
    return figures?.scenarioMonthly !== undefined;
  });

  /** Review inputs that failed to parse as an amount. */
  readonly invalidInputs = computed(() =>
    Object.entries(this.inputs())
      .filter(
        ([key, text]) => key !== 'providerLabel' && text?.trim() && parseMoneyInput(text) === null,
      )
      .map(([key]) => key),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.controller?.abort());
  }

  /** Records named by a card action; the import then replaces that record after confirmation. */
  requestReplace(id: string | null): void {
    this.requestedReplace = id;
  }

  async pick(file: File): Promise<void> {
    this.reset();
    this.fileName.set(file.name);
    this.step.set('reading');
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      return this.reject('UNSUPPORTED_FORMAT');
    }
    try {
      const extracted = await this.reader.extractPdfText(file);
      if ('error' in extracted) {
        if (extracted.error === 'IMAGE_ONLY') {
          // a scan: nothing is recognised before the user agrees (per file)
          this.scan = file;
          this.step.set('awaiting-recognition');
          return;
        }
        return this.reject(extracted.error);
      }
      await this.interpret(extracted.text, false);
    } catch {
      this.reject('UNREADABLE');
    }
  }

  async acceptRecognition(): Promise<void> {
    const file = this.scan;
    if (!file || this.step() !== 'awaiting-recognition') return;
    const controller = new AbortController();
    this.controller = controller;
    this.step.set('recognising');
    let result: RecognitionResult;
    try {
      result = await this.recogniser.recognise(file, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (!controller.signal.aborted) this.recognition.set(progress);
        },
      });
    } catch {
      result = { error: 'ENGINE_UNAVAILABLE' };
    }
    this.controller = null;
    if (this.step() !== 'recognising') return; // reset while running
    this.recognition.set(null);
    if ('error' in result) {
      let reason: ImportRejection = 'IMAGE_ONLY';
      if (result.error === 'TOO_MANY_PAGES' || result.error === 'ENGINE_UNAVAILABLE') {
        reason = result.error;
      }
      return this.reject(reason);
    }
    await this.interpret(result.text, true);
  }

  declineRecognition(): void {
    if (this.step() === 'awaiting-recognition') this.reject('IMAGE_ONLY');
  }

  cancelRecognition(): void {
    this.controller?.abort();
  }

  reset(): void {
    this.controller?.abort();
    this.controller = null;
    this.scan = null;
    this.step.set('idle');
    this.fileName.set('');
    this.rejection.set(null);
    this.failedChecks.set([]);
    this.recognition.set(null);
    this.record.set(null);
    this.parser.set(null);
    this.ocrRead.set(false);
    this.inputs.set({});
    this.expectedScenario.set('3');
    this.replaceTarget.set(null);
    this.errorCode.set(null);
    this.savedPillar.set(null);
  }

  setInput(key: SupplementKey | 'providerLabel', text: string): void {
    this.inputs.update((v) => ({ ...v, [key]: text }));
  }

  /** The body the whitelist accepts (or its issues), assembled from the review state. */
  private readonly assembled = computed<{
    value: RetirementRecordInput | null;
    issues: ValidationIssue[];
  }>(() => {
    const record = this.record();
    const parser = this.parser();
    if (!record || !parser) return { value: null, issues: [] };
    const inputs = this.inputs();
    const supplement: RetirementSupplement = {};
    for (const key of record.missingSupplement) {
      const parsed = parseMoneyInput(inputs[key] ?? '');
      if (parsed !== null) supplement[key] = parsed;
    }
    if (this.hasScenarios()) supplement.expectedScenario = this.expectedScenario();
    const providerLabel = record.providerLabel ?? (inputs.providerLabel ?? '').trim();

    const body: Record<string, unknown> = {
      contractType: record.contractType,
      origin: 'IMPORTED',
      status: 'ACTIVE',
      statementDate: record.statementDate,
      figures: record.figures,
      import: { parserId: parser.id, parserVersion: parser.version, ocrRead: this.ocrRead() },
    };
    if (providerLabel) body['providerLabel'] = providerLabel;
    if (record.payoutStart) body['payoutStart'] = record.payoutStart;
    if (record.identifier) body['identifier'] = record.identifier;
    if (Object.keys(supplement).length > 0) body['supplement'] = supplement;
    const target = this.replaceTarget();
    if (target) body['replaces'] = target.id;

    const result = validateRecordInput(body, { now: new Date() });
    return result.ok ? { value: result.value, issues: [] } : { value: null, issues: result.issues };
  });

  /** Why the review cannot be confirmed yet (field paths and codes only). */
  readonly issues = computed(() => this.assembled().issues);

  /** Whether the review can be confirmed: valid inputs and a body the whitelist accepts. */
  readonly canConfirm = computed(
    () =>
      this.step() === 'review' &&
      this.invalidInputs().length === 0 &&
      this.assembled().value !== null,
  );

  /** The body `POST /retirement/records` receives: whitelisted figures only, never file or text. */
  buildBody(): RetirementRecordInput | null {
    return this.assembled().value;
  }

  async confirm(): Promise<boolean> {
    const body = this.buildBody();
    if (!body || this.step() !== 'review') return false;
    this.step.set('saving');
    this.errorCode.set(null);
    try {
      const saved = await firstValueFrom(this.api.create(body));
      this.savedPillar.set(saved.pillar);
      this.step.set('saved');
      return true;
    } catch (error) {
      this.errorCode.set(
        error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
          ? (error.error.error as string)
          : 'saveFailed',
      );
      this.step.set('review');
      return false;
    }
  }

  private async interpret(text: PdfDocumentText, recognised: boolean): Promise<void> {
    const outcome: ParseOutcome = parseStatement(text);
    if (!outcome.ok) {
      this.failedChecks.set(outcome.failedChecks ?? []);
      return this.reject(outcome.error);
    }
    this.ocrRead.set(recognised);
    this.parser.set(outcome.parser);
    this.record.set(outcome.record);
    if (outcome.record.defaults?.expectedScenario) {
      this.expectedScenario.set(outcome.record.defaults.expectedScenario);
    }
    await this.findReplaceTarget(outcome.record);
    this.step.set('review');
  }

  /** A card action names the record to replace; a second statutory record always replaces the first. */
  private async findReplaceTarget(record: ParsedRecord): Promise<void> {
    try {
      const existing = await firstValueFrom(this.api.records(pillarOf(record.contractType)));
      let wanted: RetirementRecord | undefined;
      if (this.requestedReplace) {
        wanted = existing.find(
          (r) => r.id === this.requestedReplace && r.contractType === record.contractType,
        );
      } else if (record.contractType === 'STATUTORY_PENSION') {
        wanted = existing[0];
      }
      this.replaceTarget.set(wanted ? { id: wanted.id, origin: wanted.origin } : null);
    } catch {
      this.replaceTarget.set(null);
    }
  }

  private reject(reason: ImportRejection): void {
    this.rejection.set(reason);
    this.step.set('rejected');
  }
}
