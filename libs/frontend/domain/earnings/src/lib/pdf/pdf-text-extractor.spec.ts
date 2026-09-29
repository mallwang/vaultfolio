import { parseDocument } from '@vaultfolio/earnings';
import { LSTB_2025_BRIGHTLINE, SAP_FIXTURES, UNRELATED_PAGES } from '@vaultfolio/earnings/testing';
import { asFile, corruptPdf, imageOnlyPdf, textPdf } from '../../testing/synthetic-pdfs';
import { extractPdfText, type PdfJsModule, setPdfJsLoader, sha256Hex } from './pdf-text-extractor';

/**
 * Adapter integration (T047, T095): synthetic PDFs rendered from the shared text fixtures go
 * through the real `pdfjs-dist` (its legacy build with an in-process worker) and the real parsers,
 * and must yield exactly the records the text-level parser tests expect.
 */
beforeAll(() => {
  setPdfJsLoader(async () => {
    // @ts-expect-error -- the worker entry ships without type declarations.
    const worker: unknown = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
    (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
    return (await import('pdfjs-dist/legacy/build/pdf.mjs')) as unknown as PdfJsModule;
  });
});

async function textOf(pages: string[][]) {
  const result = await extractPdfText(asFile(await textPdf(pages), 'synthetic.pdf'));
  if (!('text' in result)) throw new Error(`extraction failed: ${result.error}`);
  return result.text;
}

describe('extractPdfText', () => {
  it.each(SAP_FIXTURES.map((f) => [f.fileName, f] as const))(
    'reconstructs %s so the SAP parser yields exactly the expected outcome',
    async (_name, fixture) => {
      const outcome = parseDocument(await textOf(fixture.pages));
      const expected =
        'records' in fixture.expected
          ? { ok: true, records: fixture.expected.records, parserId: 'sap-entgeltnachweis' }
          : { ok: false, error: fixture.expected.error };
      expect(outcome).toMatchObject(expected);
    },
    30_000,
  );

  it('keeps lines in reading order with words left to right', async () => {
    const text = await textOf([['Abrechnungsdaten für August 2026', 'Y$50 Lohnsteuer 800,00']]);
    const lines = text.pages[0].lines;

    expect(lines.map((l) => l.text)).toEqual([
      'Abrechnungsdaten für August 2026',
      'Y$50 Lohnsteuer 800,00',
    ]);
    const words = lines[1].words;
    expect(words.map((w) => w.text)).toEqual(['Y$50', 'Lohnsteuer', '800,00']);
    expect(words[0].x).toBeLessThan(words[1].x);
    expect(words[1].x + words[1].width).toBeLessThanOrEqual(words[2].x);
  });

  it('reads a wage-tax certificate PDF through the certificate parser', async () => {
    const outcome = parseDocument(await textOf(LSTB_2025_BRIGHTLINE.pages));

    expect(outcome).toMatchObject({
      ok: true,
      parserId: 'lohnsteuerbescheinigung',
      certificates: [LSTB_2025_BRIGHTLINE.expected],
    });
  }, 30_000);

  it('reports a PDF without text as IMAGE_ONLY', async () => {
    expect(await extractPdfText(asFile(await imageOnlyPdf(), 'scan.pdf'))).toEqual({
      error: 'IMAGE_ONLY',
    });
  });

  it('reports a password-protected PDF as PASSWORD_PROTECTED', async () => {
    const bytes = await textPdf(UNRELATED_PAGES, { userPassword: 'secret' });
    expect(await extractPdfText(asFile(bytes, 'locked.pdf'))).toEqual({
      error: 'PASSWORD_PROTECTED',
    });
  });

  it('reports damaged bytes as UNREADABLE', async () => {
    expect(await extractPdfText(asFile(corruptPdf(), 'broken.pdf'))).toEqual({
      error: 'UNREADABLE',
    });
  });

  it('leaves unrelated documents to the registry (UNSUPPORTED_FORMAT)', async () => {
    expect(parseDocument(await textOf(UNRELATED_PAGES))).toEqual({
      ok: false,
      error: { code: 'UNSUPPORTED_FORMAT' },
    });
  });
});

describe('sha256Hex', () => {
  it('hashes the file bytes as lower-case hex', async () => {
    const file = new File([new TextEncoder().encode('abc')], 'a.txt');
    expect(await sha256Hex(file)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });
});
