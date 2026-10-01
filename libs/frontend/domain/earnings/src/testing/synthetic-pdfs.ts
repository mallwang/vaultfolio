import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js';

/**
 * Test-time generator of synthetic PDFs (T047, T095): renders the page lines of the shared
 * fixtures (`@vaultfolio/earnings/testing`, invented figures only) into real PDFs, so specs can run
 * them through the real `pdfjs-dist` and the parsers. Never used at runtime; never fed real
 * documents.
 */

const ROBOTO_FONTS = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

interface PdfMakeDocument {
  getBuffer(callback: (buffer: Uint8Array) => void): void;
}

let pdfMakeReady: Promise<{ createPdf(definition: TDocumentDefinitions): PdfMakeDocument }> | null =
  null;

function pdfMake(): NonNullable<typeof pdfMakeReady> {
  pdfMakeReady ??= (async () => {
    const { default: make } = await import('pdfmake/build/pdfmake.js');
    const { default: fonts } = await import('pdfmake/build/vfs_fonts.js');
    make.addVirtualFileSystem(fonts);
    make.addFonts(ROBOTO_FONTS);
    return make as unknown as { createPdf(definition: TDocumentDefinitions): PdfMakeDocument };
  })();
  return pdfMakeReady;
}

async function render(definition: TDocumentDefinitions): Promise<Uint8Array> {
  const document = (await pdfMake()).createPdf(definition);
  // pdfmake's getBuffer is callback-based at runtime (see libs/export's pdf-exporter).
  return new Promise((resolve) => document.getBuffer((buffer) => resolve(new Uint8Array(buffer))));
}

/** One line of text per fixture line, one PDF page per fixture page. */
export function textPdf(
  pages: string[][],
  options: { userPassword?: string } = {},
): Promise<Uint8Array> {
  const content: Content[] = pages.flatMap((lines, index) =>
    lines.map((line, lineIndex) => ({
      text: line,
      ...(index > 0 && lineIndex === 0 ? { pageBreak: 'before' as const } : {}),
    })),
  );
  return render({
    content,
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    // Small enough that the longest fixture line never wraps into a second line.
    defaultStyle: { fontSize: 7 },
    ...(options.userPassword
      ? { userPassword: options.userPassword, ownerPassword: `${options.userPassword}-owner` }
      : {}),
  } as TDocumentDefinitions);
}

/** A page with only vector graphics — stands in for a scanned payslip (no text layer). */
export function imageOnlyPdf(): Promise<Uint8Array> {
  return render({
    content: [{ canvas: [{ type: 'rect', x: 0, y: 0, w: 400, h: 600, color: '#dddddd' }] }],
    pageSize: 'A4',
  });
}

/** Bytes that start like a PDF but are not one. */
export function corruptPdf(): Uint8Array {
  return new TextEncoder().encode(
    '%PDF-1.7\n1 0 obj << /Type /Catalog >>\ngarbage without xref\n%%EOF',
  );
}

export function asFile(bytes: Uint8Array, name: string): File {
  return new File([bytes as BlobPart], name, { type: 'application/pdf' });
}

/** One word at an absolute position (top-left origin, points) with an optional black box drawn over it. */
export interface PlacedWord {
  text: string;
  x: number;
  y: number;
  size?: number;
  coveredByBlackBox?: boolean;
}

/** A single page with words at exact positions; used to test layout reading incl. hidden text. */
export function placedWordsPdf(words: PlacedWord[]): Promise<Uint8Array> {
  const content: Content[] = words.flatMap((word): Content[] => {
    const size = word.size ?? 10;
    const text: Content = {
      text: word.text,
      absolutePosition: { x: word.x, y: word.y },
      fontSize: size,
    };
    if (!word.coveredByBlackBox) return [text];
    return [
      text,
      {
        canvas: [
          {
            type: 'rect',
            x: 0,
            y: 0,
            w: word.text.length * size * 0.65 + 4,
            h: size + 4,
            color: '#000000',
          },
        ],
        absolutePosition: { x: word.x - 2, y: word.y - 2 },
      },
    ];
  });
  return render({ content, pageSize: 'A4', pageMargins: [0, 0, 0, 0] });
}
