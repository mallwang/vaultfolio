import type { PdfPageText } from '@vaultfolio/document-text';
import { recognisedWordsToPage, type RecognisedWord } from './ocr-layout';
import { loadPdfJs } from './pdf-text-extractor';
import { readBytes } from './read-blob';
import {
  MAX_RECOGNITION_PAGES,
  type RecognitionProgress,
  type RecognitionResult,
  type TextRecogniser,
} from './text-recogniser';

/** Render scale: about 216 dpi for a 72-dpi page, the time/accuracy sweet spot of the spike (034 R1). */
export const RENDER_SCALE = 3;
/** A page is rendered at a lower scale when it would exceed this many pixels. */
export const MAX_PAGE_PIXELS = 25_000_000;

/** The subset of `tesseract.js` the adapter uses. */
interface TesseractModule {
  createWorker(
    langs: string,
    oem: number,
    options: Record<string, unknown>,
  ): Promise<TesseractWorker>;
}

interface TesseractWorker {
  recognize(
    image: unknown,
    options: Record<string, unknown>,
    output: Record<string, boolean>,
  ): Promise<{ data: { blocks: TesseractBlock[] | null } }>;
  terminate(): Promise<unknown>;
}

interface TesseractBlock {
  paragraphs: { lines: { words: RecognisedWord[] }[] }[];
}

/** The subset of PDF.js needed to rasterise a page. */
interface RenderablePage {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: { width: number; height: number };
  }): { promise: Promise<void> };
}

interface RenderableDocument {
  numPages: number;
  getPage(n: number): Promise<RenderablePage>;
}

/** `LSTM_ONLY` engine mode of tesseract.js. */
const OEM_LSTM_ONLY = 1;

let loadTesseract = async (): Promise<TesseractModule> => {
  // Loaded on consent only, so engine and glue code stay out of the initial bundle (034 R3).
  const module = (await import('tesseract.js')) as unknown as TesseractModule & {
    default?: TesseractModule;
  };
  return module.default ?? module;
};

/** Replaces how tesseract.js is loaded — for specs. */
export function setTesseractLoader(load: () => Promise<TesseractModule>): void {
  loadTesseract = load;
}

/** Same-origin location of the engine, worker and German data (FR-004: no CDN, no network). */
function assetUrl(path: string): string {
  return new URL(`assets/tesseract/${path}`, document.baseURI).href;
}

/** Pixels per point so that a page stays within `MAX_PAGE_PIXELS` (never above `RENDER_SCALE`). */
export function scaleFor(widthPt: number, heightPt: number): number {
  return Math.min(RENDER_SCALE, Math.sqrt(MAX_PAGE_PIXELS / (widthPt * heightPt)));
}

class Cancelled extends Error {}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) return reject(new Cancelled());
    const onAbort = () => reject(new Cancelled());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/**
 * Renders each page with PDF.js and reads it with tesseract.js (German, LSTM) in one worker that is
 * reused across the pages and terminated afterwards. Everything runs on the device: engine, worker
 * and language data come from `assets/tesseract/` of the app's own origin, nothing is cached
 * (`cacheMethod: 'none'`) and nothing derived from the document is logged (034 FR-004).
 */
class TesseractRecogniser implements TextRecogniser {
  async recognise(
    file: Blob,
    options: { signal: AbortSignal; onProgress: (progress: RecognitionProgress) => void },
  ): Promise<RecognitionResult> {
    const { signal, onProgress } = options;
    let worker: TesseractWorker | null = null;
    let destroyDocument: (() => Promise<void>) | null = null;
    try {
      if (signal.aborted) return { error: 'CANCELLED' };
      const pdfjs = await abortable(loadPdfJs(), signal);
      const data = await readBytes(file);
      const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true });
      destroyDocument = () => task.destroy().catch(() => undefined);
      const doc = (await abortable(task.promise, signal)) as unknown as RenderableDocument;
      const pageCount = doc.numPages;
      // The limit is enforced before any rendering or engine start (FR-013).
      if (pageCount > MAX_RECOGNITION_PAGES) return { error: 'TOO_MANY_PAGES' };

      let tesseract: TesseractModule;
      let currentProgress: RecognitionProgress = {
        phase: 'LOADING',
        page: 1,
        pageCount,
        fraction: 0,
      };
      const emit = (patch: Partial<RecognitionProgress>) => {
        currentProgress = { ...currentProgress, ...patch };
        onProgress(currentProgress);
      };
      emit({});
      try {
        tesseract = await abortable(loadTesseract(), signal);
        const creating = tesseract.createWorker('deu', OEM_LSTM_ONLY, {
          workerPath: assetUrl('worker.min.js'),
          corePath: assetUrl('').replace(/\/$/, ''),
          langPath: assetUrl('').replace(/\/$/, ''),
          gzip: true,
          cacheMethod: 'none',
          logger: (m: { status?: string; progress?: number }) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              emit({ phase: 'RECOGNISING', fraction: m.progress });
            }
          },
        });
        // A worker that finishes starting after a cancel must not linger.
        void creating.then(
          (created) => (signal.aborted ? created.terminate() : undefined),
          () => undefined,
        );
        worker = await abortable(creating, signal);
      } catch (error: unknown) {
        if (error instanceof Cancelled) throw error;
        return { error: 'ENGINE_UNAVAILABLE' };
      }

      const pages: PdfPageText[] = [];
      for (let n = 1; n <= pageCount; n++) {
        emit({ phase: 'RENDERING', page: n, fraction: 0 });
        const page = await abortable(doc.getPage(n), signal);
        const base = page.getViewport({ scale: 1 });
        const scale = scaleFor(base.width, base.height);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        try {
          const context = canvas.getContext('2d');
          if (!context) return { error: 'ENGINE_UNAVAILABLE' };
          await abortable(
            page.render({ canvasContext: context, canvas, viewport }).promise,
            signal,
          );
          emit({ phase: 'RECOGNISING', page: n, fraction: 0 });
          const result = await abortable(worker.recognize(canvas, {}, { blocks: true }), signal);
          const words = (result.data.blocks ?? []).flatMap((b) =>
            b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
          );
          pages.push(recognisedWordsToPage(words, scale, canvas.height, canvas.width));
          emit({ fraction: 1 });
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      }

      if (pages.every((p) => p.lines.length === 0)) return { error: 'NO_TEXT' };
      return { text: { pages, origin: 'RECOGNISED' } };
    } catch (error: unknown) {
      return { error: error instanceof Cancelled ? 'CANCELLED' : 'NO_TEXT' };
    } finally {
      await worker?.terminate().catch(() => undefined);
      await destroyDocument?.();
    }
  }
}

export function createTesseractRecogniser(): TextRecogniser {
  return new TesseractRecogniser();
}
