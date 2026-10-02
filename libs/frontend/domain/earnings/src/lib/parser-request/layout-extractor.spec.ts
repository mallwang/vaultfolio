import {
  anonymizeLayout,
  renderSamplePdf,
  toSheet,
  toSubmission,
  validateLayoutSubmission,
} from '@vaultfolio/earnings';
import { SAP_AUG_2026, UNRELATED_PAGES } from '@vaultfolio/earnings/testing';
import {
  asFile,
  corruptPdf,
  imageOnlyPdf,
  placedWordsPdf,
  textPdf,
} from '../../testing/synthetic-pdfs';
import { type PdfJsModule, setPdfJsLoader } from '../pdf/pdf-text-extractor';
import { extractLayout, layoutFromRecognised } from './layout-extractor';

beforeAll(() => {
  setPdfJsLoader(async () => {
    // @ts-expect-error -- the worker entry ships without type declarations.
    const worker: unknown = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  });
});

async function layoutOf(bytes: Uint8Array) {
  const result = await extractLayout(asFile(bytes, 'synthetic.pdf'));
  if (!('layout' in result)) throw new Error(`refused: ${result.error}`);
  return result.layout;
}

describe('extractLayout', () => {
  it('reads page size, line order, word positions and sizes', async () => {
    const layout = await layoutOf(
      await placedWordsPdf([
        { text: 'Brutto', x: 60, y: 100, size: 10 },
        { text: '3.842,17', x: 400, y: 100, size: 10 },
        { text: 'Lohnsteuer', x: 60, y: 120, size: 10 },
      ]),
    );
    expect(layout.pages).toHaveLength(1);
    const [page] = layout.pages;
    expect(page.width).toBeCloseTo(595.28, 1);
    expect(page.height).toBeCloseTo(841.89, 1);
    expect(page.lines.map((l) => l.words.map((w) => w.text))).toEqual([
      ['Brutto', '3.842,17'],
      ['Lohnsteuer'],
    ]);
    const [brutto, amount] = page.lines[0].words;
    expect(brutto.x).toBeCloseTo(60, 0);
    expect(amount.x).toBeCloseTo(400, 0);
    expect(brutto.height).toBeCloseTo(10, 0);
    expect(brutto.width).toBeGreaterThan(20);
    // baseline from the top: below the 100 pt top offset of a 10 pt line, above the next line
    expect(page.lines[0].y).toBeGreaterThan(100);
    expect(page.lines[0].y).toBeLessThan(page.lines[1].y);
    expect(page.lines.flatMap((l) => l.words).every((w) => !w.covered)).toBe(true);
  }, 30_000);

  it('flags text under a black rectangle as covered and leaves other text alone', async () => {
    const layout = await layoutOf(
      await placedWordsPdf([
        { text: 'Mustermann', x: 100, y: 100, coveredByBlackBox: true },
        { text: 'Sichtbar', x: 100, y: 200 },
      ]),
    );
    const words = layout.pages[0].lines.flatMap((l) => l.words);
    expect(words.map((w) => [w.text, w.covered])).toEqual([
      ['Mustermann', true],
      ['Sichtbar', false],
    ]);
  }, 30_000);

  it('reads a text fixture so that every line becomes an analysed line', async () => {
    const layout = await layoutOf(await textPdf(SAP_AUG_2026.pages));
    expect(layout.pages).toHaveLength(SAP_AUG_2026.pages.length);
    expect(layout.pages[0].lines.length).toBeGreaterThan(5);
  }, 30_000);

  it('refuses an image-only document', async () => {
    expect(await extractLayout(asFile(await imageOnlyPdf(), 'scan.pdf'))).toEqual({
      error: 'IMAGE_ONLY',
    });
  });

  it('refuses a password-protected document', async () => {
    const bytes = await textPdf(UNRELATED_PAGES, { userPassword: 'secret' });
    expect(await extractLayout(asFile(bytes, 'locked.pdf'))).toEqual({
      error: 'PASSWORD_PROTECTED',
    });
  });

  it('refuses damaged bytes', async () => {
    expect(await extractLayout(asFile(corruptPdf(), 'broken.pdf'))).toEqual({
      error: 'UNREADABLE',
    });
  });

  it('refuses more than three pages', async () => {
    const bytes = await textPdf([['eins'], ['zwei'], ['drei'], ['vier']]);
    expect(await extractLayout(asFile(bytes, 'long.pdf'))).toEqual({ error: 'TOO_MANY_PAGES' });
  }, 30_000);
});

/** R7/T019: the generated sample, read back with the real PDF.js, shows exactly the sheet’s text. */
describe('renderSamplePdf read back with PDF.js', () => {
  it('shows every sheet item at its position', async () => {
    const submission = {
      schemaVersion: 1 as const,
      pages: [
        {
          width: 595.3,
          height: 841.9,
          lines: [
            {
              y: 96,
              size: 9,
              words: [
                { text: 'Brutto', x: 56.7 },
                { text: '3.842,17', x: 391.4 },
              ],
            },
            {
              y: 108,
              size: 9,
              words: [
                { text: 'a(b)c', x: 56.7 },
                { text: '€5', x: 200 },
              ],
            },
          ],
        },
      ],
    };
    expect(validateLayoutSubmission(submission).ok).toBe(true);
    const sheet = toSheet(submission);
    const layout = await layoutOf(renderSamplePdf(sheet));

    const read = layout.pages[0].lines.flatMap((line) =>
      line.words.map((word) => ({ text: word.text, x: word.x, y: line.y })),
    );
    for (const item of sheet.pages[0].items) {
      const match = read.find((word) => word.text === item.text);
      expect(match).toBeDefined();
      expect(match?.x).toBeCloseTo(item.x, 0);
      expect(Math.abs((match?.y ?? 0) - item.y)).toBeLessThan(0.5);
    }
    expect(read).toHaveLength(sheet.pages[0].items.length);
  }, 30_000);
});

describe('layoutFromRecognised (034)', () => {
  const recognised = {
    origin: 'RECOGNISED' as const,
    pages: [
      {
        width: 595,
        height: 842,
        lines: [
          {
            text: 'Brutto 3.842,17',
            y: 700,
            words: [
              { text: 'Brutto', x: 60, width: 30, height: 10 },
              { text: '3.842,l7', x: 400, width: 40, height: 10, lowConfidence: true },
            ],
          },
          {
            text: 'IBAN DE0O37601008500040094',
            y: 680,
            words: [
              { text: 'IBAN', x: 60, width: 20, height: 10 },
              { text: 'DE0O37601008500040094', x: 100, width: 110, height: 10 },
            ],
          },
        ],
      },
    ],
  };

  it('turns recognised text into the same analysis a text layer yields, y from the top', () => {
    const result = layoutFromRecognised(recognised);
    if (!('layout' in result)) throw new Error('refused');
    const [page] = result.layout.pages;
    expect(page.width).toBe(595);
    expect(page.lines.map((l) => l.y)).toEqual([142, 162]);
    expect(page.lines[0].words[1]).toMatchObject({
      x: 400,
      height: 10,
      covered: false,
      lowConfidence: true,
    });
    expect(page.lines[0].words[0].lowConfidence).toBeUndefined();
  });

  it('refuses a recognition result without text', () => {
    expect(layoutFromRecognised({ origin: 'RECOGNISED', pages: [{ lines: [] }] })).toEqual({
      error: 'IMAGE_ONLY',
    });
  });

  it('keeps the wire format unchanged: no recognition provenance in the submission, misread IBAN removed', () => {
    const result = layoutFromRecognised(recognised);
    if (!('layout' in result)) throw new Error('refused');
    const anon = anonymizeLayout(result.layout, new Map(), () => 0.5, { lenient: true });
    expect(anon.removedKinds).toContain('BANK_ACCOUNT');
    const submission = toSubmission(anon);
    expect(validateLayoutSubmission(submission).ok).toBe(true);
    const json = JSON.stringify(submission);
    expect(json).not.toContain('DE0O37601008500040094');
    expect(json).not.toContain('lowConfidence');
    expect(json).not.toContain('RECOGNISED');
    // strict mode would have let the misread identifier through
    const strict = anonymizeLayout(result.layout, new Map(), () => 0.5);
    expect(strict.removedKinds).not.toContain('BANK_ACCOUNT');
  });
});
