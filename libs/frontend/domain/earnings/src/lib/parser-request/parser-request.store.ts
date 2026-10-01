import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import type { SubmitRequestResponse } from '@vaultfolio/api-contract';
import {
  type AnalyzedLayout,
  type AnonymizedLayout,
  type SubmittedRuleDraft,
  type WordDecision,
  anonymizeLayout,
  pendingDecisions,
  scanDocument,
  toSubmission,
  wordKey,
} from '@vaultfolio/earnings';
import { firstValueFrom } from 'rxjs';
import { type LayoutRefusal, extractLayout } from './layout-extractor';
import { ParserRequestService } from './parser-request.service';

export type WizardStep = 'consent' | 'review' | 'rules' | 'preview' | 'sent';

export interface DecisionWord {
  key: string;
  original: string;
  mark: 'NEEDS_DECISION' | 'KEPT' | 'MASKED';
}

/** Deterministic random source (mulberry32), seeded once per document so re-computing the preview keeps the same replacement values. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/**
 * In-memory state of one parser request (FR-009): the chosen file, its on-device analysis, the
 * user's decisions and consent. Nothing is persisted; `reset()` clears everything and runs when
 * the wizard is left. The only thing that ever leaves is the final Layout Submission.
 */
@Injectable({ providedIn: 'root' })
export class ParserRequestStore {
  private readonly api = inject(ParserRequestService);
  private seed = randomSeed();

  readonly file = signal<File | null>(null);
  readonly analysis = signal<AnalyzedLayout | null>(null);
  readonly refusal = signal<LayoutRefusal | null>(null);
  readonly decisions = signal<ReadonlyMap<string, WordDecision>>(new Map());
  readonly ruleDraft = signal<SubmittedRuleDraft | undefined>(undefined);
  readonly consent = signal(false);
  readonly step = signal<WizardStep>('consent');
  readonly sending = signal(false);
  readonly errorCode = signal<string | null>(null);
  readonly sent = signal<SubmitRequestResponse | null>(null);

  readonly loading = computed(() => this.file() !== null && !this.analysis() && !this.refusal());

  /** The sheet as it would be sent right now. */
  readonly anon = computed<AnonymizedLayout | null>(() => {
    const analysis = this.analysis();
    return analysis ? anonymizeLayout(analysis, this.decisions(), seeded(this.seed)) : null;
  });

  readonly pendingDecisions = computed(() => {
    const anon = this.anon();
    return anon ? pendingDecisions(anon) : 0;
  });

  readonly removedKinds = computed(() => this.anon()?.removedKinds ?? []);

  readonly coveredCount = computed(
    () =>
      this.analysis()
        ?.pages.flatMap((p) => p.lines.flatMap((l) => l.words))
        .filter((w) => w.covered).length ?? 0,
  );

  /** Words the user can decide on, in reading order. */
  readonly decisionWords = computed<DecisionWord[]>(() => {
    const anon = this.anon();
    const analysis = this.analysis();
    if (!anon || !analysis) return [];
    const words: DecisionWord[] = [];
    anon.pages.forEach((page, p) =>
      page.lines.forEach((line, l) =>
        line.words.forEach((word, i) => {
          if (word.mark === 'NEEDS_DECISION' || word.mark === 'KEPT' || word.mark === 'MASKED') {
            words.push({
              key: wordKey(p, l, i),
              original: analysis.pages[p].lines[l].words[i].text,
              mark: word.mark,
            });
          }
        }),
      ),
    );
    return words;
  });

  readonly removedCount = computed(() => this.countMarks('REMOVED'));
  readonly valueCount = computed(() => this.countMarks('VALUE'));
  readonly maskedCount = computed(
    () => this.countMarks('MASKED') + this.countMarks('NEEDS_DECISION'),
  );
  readonly keptCount = computed(() => this.countMarks('KEPT') + this.countMarks('LABEL'));

  readonly preview = computed(() => {
    const anon = this.anon();
    return anon ? toSubmission(anon, this.ruleDraft()) : null;
  });

  /** Anything the personal-data scan still finds blocks sending (R3). */
  readonly remainingHits = computed(() => {
    const preview = this.preview();
    return preview ? scanDocument(preview).length : 0;
  });

  readonly canSend = computed(
    () =>
      this.pendingDecisions() === 0 &&
      this.remainingHits() === 0 &&
      this.consent() &&
      !this.sending(),
  );

  /** Starts a request for `file`: reads it on the device; the result is analysis or a refusal. */
  async open(file: File): Promise<void> {
    this.reset();
    this.file.set(file);
    this.seed = randomSeed();
    const result = await extractLayout(file);
    // the wizard may have been left while the file was read
    if (this.file() !== file) return;
    if ('error' in result) this.refusal.set(result.error);
    else this.analysis.set(result.layout);
  }

  decide(key: string, decision: WordDecision): void {
    this.decisions.update((map) => new Map(map).set(key, decision));
  }

  /** Clicking a word on the sheet cycles its decision. */
  cycle(page: number, line: number, index: number): void {
    const word = this.anon()?.pages[page]?.lines[line]?.words[index];
    if (!word || word.locked) return;
    if (word.mark === 'NEEDS_DECISION' || word.mark === 'MASKED')
      this.decide(wordKey(page, line, index), 'KEEP');
    else if (word.mark === 'KEPT') this.decide(wordKey(page, line, index), 'MASK');
  }

  async submit(): Promise<void> {
    const preview = this.preview();
    if (!preview || !this.canSend()) return;
    this.sending.set(true);
    this.errorCode.set(null);
    try {
      this.sent.set(await firstValueFrom(this.api.submit(preview)));
      this.step.set('sent');
    } catch (error) {
      this.errorCode.set(
        error instanceof HttpErrorResponse && typeof error.error?.error === 'string'
          ? error.error.error
          : 'generic',
      );
    } finally {
      this.sending.set(false);
    }
  }

  reset(): void {
    this.file.set(null);
    this.analysis.set(null);
    this.refusal.set(null);
    this.decisions.set(new Map());
    this.ruleDraft.set(undefined);
    this.consent.set(false);
    this.step.set('consent');
    this.sending.set(false);
    this.errorCode.set(null);
    this.sent.set(null);
  }

  private countMarks(mark: string): number {
    return (
      this.anon()?.pages.reduce(
        (n, p) =>
          n + p.lines.reduce((m, l) => m + l.words.filter((w) => w.mark === mark).length, 0),
        0,
      ) ?? 0
    );
  }
}
