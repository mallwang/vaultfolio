import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type { ResolvedFeatureExport } from './feature-export-definition.js';

const INFO_BLUE = '#0284c7';
const INFO_BG = '#e0f2fe';

function cellToText(value: string | number | null, format: string, locale: string): string {
  if (value === null) return '';
  if (format === 'currency') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(n)
      ? String(value)
      : new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: 'EUR',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(n);
  }
  if (format === 'decimal' || format === 'number') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isNaN(n) ? String(value) : new Intl.NumberFormat(locale).format(n);
  }
  if (format === 'date' && typeof value === 'string' && value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(locale).format(d);
  }
  return String(value);
}

function buildDocDefinition(resolved: ResolvedFeatureExport): TDocumentDefinitions {
  const locale = resolved.locale ?? 'en';
  const subtitle = resolved.subtitle ?? new Intl.DateTimeFormat(locale).format(new Date());
  const content: Content[] = [
    { text: resolved.title, style: 'title' },
    {
      text: `Vaultfolio — ${subtitle}`,
      style: 'meta',
      margin: [0, 0, 0, 16],
    },
    {
      table: { widths: ['*'], body: [[{ text: resolved.infobox, style: 'infoboxBody' }]] },
      layout: {
        fillColor: () => INFO_BG,
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => INFO_BLUE,
        vLineColor: () => INFO_BLUE,
      },
      margin: [0, 0, 0, 16],
    },
  ];

  if (resolved.chartImages && resolved.chartImages.length > 0) {
    content.push({
      // pdfmake runtime supports '*' for dynamic column widths but @types/pdfmake types width as
      // number on ContentImage — cast through unknown to satisfy the type checker.
      columns: resolved.chartImages.map(
        (dataUrl) => ({ image: dataUrl, width: '*' }) as unknown as Content,
      ),
      columnGap: 12,
      margin: [0, 0, 0, 16],
    });
  }

  const header = resolved.columns.map((column) => ({
    text: column.label,
    style: 'tableHeader',
  }));
  const body =
    resolved.rows.length > 0
      ? resolved.rows.map((row) =>
          resolved.columns.map((column) => cellToText(row[column.key], column.format, locale)),
        )
      : [resolved.columns.map(() => '')];

  content.push({
    table: {
      headerRows: 1,
      widths: resolved.columns.map(() => '*'),
      body: [header, ...body],
    },
    layout: 'lightHorizontalLines',
  });

  content.push({
    text: resolved.footer ?? 'This export is scoped to your own account data only.',
    style: 'footer',
    margin: [0, 16, 0, 0],
  });

  return {
    content,
    pageOrientation: 'landscape',
    styles: {
      title: { fontSize: 20, bold: true },
      meta: { fontSize: 9, color: '#666666' },
      infoboxBody: { fontSize: 10 },
      tableHeader: { bold: true, fontSize: 9 },
      footer: { fontSize: 8, color: '#666666', italics: true },
    },
    defaultStyle: { fontSize: 8 },
  };
}

const ROBOTO_FONTS = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

let fontsRegistered = false;

/**
 * `ResolvedFeatureExport` -> PDF bytes via `pdfmake`: title/meta, an info-colored infobox,
 * optional chart images (one per `chartImages` entry), and a data table. Called with zero rows,
 * still produces the infobox/charts with an empty (header-only) data table (FR-014).
 */
export async function exportPdf(resolved: ResolvedFeatureExport): Promise<Blob> {
  // Deferred import: pdfmake's build only works in a browser/DOM-like environment (jsdom for
  // tests) and registering its bundled Roboto vfs/fonts is a one-time, module-level side effect.
  const { default: pdfMake } = await import('pdfmake/build/pdfmake.js');
  const { default: pdfFonts } = await import('pdfmake/build/vfs_fonts.js');

  if (!fontsRegistered) {
    pdfMake.addVirtualFileSystem(pdfFonts);
    pdfMake.addFonts(ROBOTO_FONTS);
    fontsRegistered = true;
  }

  const docDefinition = buildDocDefinition(resolved);
  const document = pdfMake.createPdf(docDefinition);
  // The installed pdfmake build's `getBlob` is callback-based at runtime, despite @types/pdfmake
  // declaring a zero-arg Promise-returning overload — wrap it back into a promise ourselves.
  const getBlobWithCallback = document.getBlob as unknown as (
    callback: (blob: Blob) => void,
  ) => void;
  return new Promise<Blob>((resolve) => {
    getBlobWithCallback.call(document, resolve);
  });
}
