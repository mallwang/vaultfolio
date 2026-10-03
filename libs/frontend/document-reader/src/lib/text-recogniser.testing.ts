import { type PdfDocumentText, textDocument } from '@vaultfolio/document-text';
import type { RecognitionProgress, RecognitionResult, TextRecogniser } from './text-recogniser';

export interface FakeRecogniserScript {
  /** Resolved with `origin: 'RECOGNISED'`; a plain page-of-lines array or a ready document. */
  text?: string[][] | PdfDocumentText;
  error?: Extract<RecognitionResult, { error: unknown }>['error'];
  progress?: RecognitionProgress[];
  /** Milliseconds to wait before resolving (abortable). */
  delayMs?: number;
}

/** Scriptable recogniser for store/component specs: scripted text, progress ticks, errors, delay and abort. */
export class FakeTextRecogniser implements TextRecogniser {
  readonly calls: Blob[] = [];
  /** The abort signal of the latest call, to assert that leaving the page stops recognition. */
  lastSignal: AbortSignal | null = null;
  script: FakeRecogniserScript = { text: [[]] };

  async recognise(
    file: Blob,
    options: { signal: AbortSignal; onProgress: (p: RecognitionProgress) => void },
  ): Promise<RecognitionResult> {
    this.calls.push(file);
    this.lastSignal = options.signal;
    for (const tick of this.script.progress ?? []) options.onProgress(tick);
    if (this.script.delayMs) {
      const aborted = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), this.script.delayMs);
        options.signal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolve(true);
        });
      });
      if (aborted) return { error: 'CANCELLED' };
    }
    if (options.signal.aborted) return { error: 'CANCELLED' };
    if (this.script.error) return { error: this.script.error };
    const text = this.script.text ?? [[]];
    const document = Array.isArray(text) ? textDocument(text) : text;
    return { text: { ...document, origin: 'RECOGNISED' } };
  }
}
