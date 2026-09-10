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
    return Number.isNaN(d.getTime())
      ? value
      : new Intl.DateTimeFormat(locale, {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }).format(d);
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
    const [mainImage] = resolved.chartImages;
    const sideTable = resolved.chartSideTable;
    const chartCol: Content = {
      stack: [{ image: mainImage, width: 440 } as unknown as Content],
      width: 440,
    } as unknown as Content;

    if (sideTable) {
      const fmtCurrency = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      const fmtPercent = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      });
      const totalLabel = locale.startsWith('de') ? 'Gesamt' : 'Total';
      const total = sideTable.rows.reduce((sum, r) => sum + r.value, 0);
      const tableRows: Content[][] = [
        ...sideTable.rows.map((row) => [
          row.color
            ? ({
                canvas: [{ type: 'rect', x: 0, y: 2, w: 8, h: 8, color: row.color }],
              } as unknown as Content)
            : ('' as unknown as Content),
          row.label as unknown as Content,
          `${fmtPercent.format(row.percentage)} %` as unknown as Content,
          fmtCurrency.format(row.value) as unknown as Content,
        ]),
        [
          '' as unknown as Content,
          { text: totalLabel, bold: true } as unknown as Content,
          { text: `${fmtPercent.format(100)} %`, bold: true } as unknown as Content,
          { text: fmtCurrency.format(total), bold: true } as unknown as Content,
        ],
      ];
      const tableCol: Content = {
        width: '*',
        table: { widths: [12, '*', 'auto', 'auto'], body: tableRows },
        layout: 'lightHorizontalLines',
      } as unknown as Content;

      content.push({ text: sideTable.sectionTitle, style: 'sectionHeader', margin: [0, 0, 0, 8] }, {
        columns: [chartCol, tableCol],
        columnGap: 16,
        margin: [0, 0, 0, 8],
      } as unknown as Content);
    } else {
      content.push({ columns: [chartCol], margin: [0, 0, 0, 16] } as unknown as Content);
    }
  }

  const totalLabel = locale.startsWith('de') ? 'Gesamt' : 'Total';
  const header = resolved.columns.map((column) => ({
    text: column.label,
    style: 'tableHeader',
  }));
  const dataRows =
    resolved.rows.length > 0
      ? resolved.rows.map((row) =>
          resolved.columns.map((column) => cellToText(row[column.key], column.format, locale)),
        )
      : [resolved.columns.map(() => '')];

  const hasSummableCols = resolved.columns.some((c) => c.summable);
  const sumRow = hasSummableCols
    ? resolved.columns.map((column, i) => {
        if (column.summable) {
          const sum = resolved.rows.reduce((acc, row) => {
            const v = row[column.key];
            const n = typeof v === 'number' ? v : Number(v);
            return acc + (Number.isNaN(n) ? 0 : n);
          }, 0);
          return { text: cellToText(sum, column.format, locale), bold: true };
        }
        return { text: i === 0 ? totalLabel : '', bold: true };
      })
    : null;

  const body = sumRow ? [...dataRows, sumRow] : dataRows;

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
      sectionHeader: { fontSize: 14, bold: true },
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
