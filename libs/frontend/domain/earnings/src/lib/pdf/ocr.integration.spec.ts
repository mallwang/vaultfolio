// @vitest-environment node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { parseDocument } from '@vaultfolio/earnings';
import { SAP_AUG_2026 } from '@vaultfolio/earnings/testing';
import { textPdf } from '../../testing/synthetic-pdfs';
import { recognisedWordsToPage, type RecognisedWord } from '@vaultfolio/frontend-document-reader';

/**
 * Opt-in real-engine check (034 T019, quickstart §2): renders a synthetic payslip of a supported
 * layout to pixels — as a scan would be — reads it with the real tesseract.js (German model from
 * node_modules, the same data the app serves from `assets/tesseract/`) and asserts that the word
 * geometry survives the conversion and that the unchanged SAP parser accepts the recognised text.
 * Skipped when the engine, the language data or the canvas binding are not installed.
 */
const ROOT = path.resolve(__dirname, '../../../../../../../node_modules');
const LANG_DIR = path.join(ROOT, '@tesseract.js-data/deu/4.0.0_best_int');
const available =
  existsSync(path.join(LANG_DIR, 'deu.traineddata.gz')) &&
  existsSync(path.join(ROOT, 'tesseract.js-core')) &&
  existsSync(path.join(ROOT, '@napi-rs/canvas'));

const SCALE = 3;

interface Canvas {
  width: number;
  height: number;
  toBuffer(mime: 'image/png'): Buffer;
}

async function renderFirstPage(pdf: Uint8Array): Promise<Canvas> {
  const { createCanvas } = (await import('@napi-rs/canvas')) as unknown as {
    createCanvas(w: number, h: number): Canvas & { getContext(kind: '2d'): unknown };
  };
  // @ts-expect-error -- the worker entry ships without type declarations.
  const worker: unknown = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  const pdfjs = (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as {
    getDocument(src: unknown): { promise: Promise<{ getPage(n: number): Promise<unknown> }> };
  };
  const doc = await pdfjs.getDocument({ data: pdf, isEvalSupported: false }).promise;
  const page = (await doc.getPage(1)) as {
    getViewport(o: { scale: number }): { width: number; height: number };
    render(o: unknown): { promise: Promise<void> };
  };
  const viewport = page.getViewport({ scale: SCALE });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({ canvasContext: context, canvas, viewport }).promise;
  return canvas;
}

describe.skipIf(!available)('real text recognition (opt-in)', () => {
  it('reads a rendered payslip so that the SAP parser accepts the recognised text', async () => {
    const pdf = await textPdf(SAP_AUG_2026.pages);
    const canvas = await renderFirstPage(pdf);

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('deu', 1, {
      langPath: LANG_DIR,
      gzip: true,
      cacheMethod: 'none',
    });
    const result = await worker.recognize(canvas.toBuffer('image/png'), {}, { blocks: true });
    await worker.terminate();

    const words = (result.data.blocks ?? []).flatMap((b) =>
      b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
    ) as unknown as RecognisedWord[];
    const page = recognisedWordsToPage(words, SCALE, canvas.height);

    // geometry: rows run top to bottom, words left to right, inside the A4 page in points
    const ys = page.lines.map((l) => l.y);
    expect(ys).toEqual([...ys].sort((a, b) => b - a));
    for (const line of page.lines) {
      const xs = line.words.map((w) => w.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      expect(line.y).toBeGreaterThan(0);
      expect(line.y).toBeLessThan(842);
    }

    const outcome = parseDocument({ pages: [page], origin: 'RECOGNISED' });
    expect(outcome.ok).toBe(true);
  }, 120_000);
});
