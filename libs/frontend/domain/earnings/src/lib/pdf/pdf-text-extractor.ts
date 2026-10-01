import type { PdfDocumentText, PdfLine, PdfPageText, PdfWord } from '@vaultfolio/earnings';
import { readBytes } from './read-blob';

export type PdfExtractError = 'IMAGE_ONLY' | 'PASSWORD_PROTECTED' | 'UNREADABLE';
export type PdfExtractResult = { text: PdfDocumentText } | { error: PdfExtractError };

/** The subset of the `pdfjs-dist` module the adapter uses (the real module in the app, a test build in specs). */
export interface PdfJsModule {
  GlobalWorkerOptions: { workerSrc: string };
  /** Operator codes of `getOperatorList()` (used to find shapes drawn over text). */
  OPS?: Record<string, number>;
  getDocument(src: { data: Uint8Array; isEvalSupported?: boolean; disableFontFace?: boolean }): {
    promise: Promise<PdfJsDocument>;
    destroy(): Promise<void>;
  };
}

interface PdfJsDocument {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
}

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}

/** Baseline tolerance for grouping text runs into one line (points). */
const LINE_TOLERANCE = 2;
/** Runs closer than this continue the previous word (split glyph runs), in points. */
const WORD_GAP = 1;

let loader: () => Promise<PdfJsModule> = async () => {
  // Loaded on first use only, so PDF.js stays out of the app's initial bundle (T124).
  const pdfjs = (await import('pdfjs-dist')) as unknown as PdfJsModule;
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'assets/pdfjs/pdf.worker.min.mjs',
    document.baseURI,
  ).href;
  return pdfjs;
};

/** The PDF.js module as loaded for this app (or the test build). */
export function loadPdfJs(): Promise<PdfJsModule> {
  return loader();
}

/** Replaces how PDF.js is loaded — for specs running the Node build of `pdfjs-dist`. */
export function setPdfJsLoader(load: () => Promise<PdfJsModule>): void {
  loader = load;
}

/**
 * Reads the text of a PDF in the browser (FR-008: neither the file nor its text leaves the device).
 * Text runs are grouped into lines by baseline (±2 pt), lines top to bottom, words left to right
 * with their x position and width for column-sensitive parsers. A PDF without any text is a scan
 * (`IMAGE_ONLY`, FR-014).
 */
export async function extractPdfText(file: Blob): Promise<PdfExtractResult> {
  const data = await readBytes(file);
  let pdfjs: PdfJsModule;
  try {
    pdfjs = await loader();
  } catch {
    return { error: 'UNREADABLE' };
  }
  const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true });
  try {
    const doc = await task.promise;
    const pages: PdfPageText[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      pages.push({ lines: toLines(content.items.filter(isTextItem)) });
    }
    if (pages.every((p) => p.lines.length === 0)) return { error: 'IMAGE_ONLY' };
    return { text: { pages } };
  } catch (error: unknown) {
    const name = (error as { name?: string } | null)?.name;
    return { error: name === 'PasswordException' ? 'PASSWORD_PROTECTED' : 'UNREADABLE' };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

/** Lower-case hex SHA-256 of the file bytes — the import fingerprint (FR-015). */
export async function sha256Hex(file: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', (await readBytes(file)) as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isTextItem(item: unknown): item is TextItem {
  const candidate = item as Partial<TextItem>;
  return typeof candidate?.str === 'string' && Array.isArray(candidate.transform);
}

function toLines(items: TextItem[]): PdfLine[] {
  const runs = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5], width: i.width }))
    // PDF y grows upwards: top of the page first.
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: { y: number; runs: typeof runs }[] = [];
  for (const run of runs) {
    const group = groups.find((g) => Math.abs(g.y - run.y) <= LINE_TOLERANCE);
    if (group) group.runs.push(run);
    else groups.push({ y: run.y, runs: [run] });
  }

  return groups.map((group) => {
    const words: PdfWord[] = [];
    group.runs.sort((a, b) => a.x - b.x);
    for (const run of group.runs) {
      const charWidth = run.str.length > 0 ? run.width / run.str.length : 0;
      for (const m of run.str.matchAll(/\S+/g)) {
        const x = run.x + (m.index ?? 0) * charWidth;
        const width = m[0].length * charWidth;
        const previous = words.at(-1);
        if (previous && m.index === 0 && x - (previous.x + previous.width) < WORD_GAP) {
          previous.text += m[0];
          previous.width = x + width - previous.x;
        } else {
          words.push({ text: m[0], x, width });
        }
      }
    }
    return { text: words.map((w) => w.text).join(' '), words, y: group.y };
  });
}
