import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces.js';
import type {
  PdfSection,
  PdfTableColumn,
  PdfTableRow,
  ResolvedFeatureExport,
} from './feature-export-definition.js';

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

const MISSING = '–';
const SECTION_FONT_SIZE = 8;
/** Landscape A4 is 842 pt wide; section PDFs use 28 pt side margins (≈ 786 pt content width). */
export const SECTION_PAGE_MARGIN = 28;
/** Bottom margin of section PDFs, tall enough for the page footer. */
const SECTION_BOTTOM_MARGIN = 40;
const PAGE_CONTENT_WIDTH = 842 - 2 * SECTION_PAGE_MARGIN;
/**
 * Left/right padding of section table cells. pdfmake adds cell padding on top of the declared
 * column widths, so a table's real width is `sum(content widths) + 2 × padding × columns`.
 */
export const SECTION_CELL_PADDING = 2;

/** Light print style: header rule, thin row lines, no vertical lines, tight cell padding. */
const SECTION_TABLE_LAYOUT = {
  hLineWidth: (i: number, node: { table: { body: unknown[]; headerRows?: number } }) => {
    if (i === 0 || i === node.table.body.length) return 0;
    return i === node.table.headerRows ? 1.5 : 0.5;
  },
  vLineWidth: () => 0,
  hLineColor: (i: number, node: { table: { headerRows?: number } }) =>
    i === node.table.headerRows ? '#000000' : '#bbbbbb',
  paddingLeft: () => SECTION_CELL_PADDING,
  paddingRight: () => SECTION_CELL_PADDING,
};

function sectionCellText(
  value: string | number | null | undefined,
  column: PdfTableColumn,
  locale: string,
): string {
  if (value === null || value === undefined || value === '') return MISSING;
  if (column.format === 'text') return String(value);
  const n = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(n)) return String(value);
  switch (column.format) {
    case 'currency':
      return cellToText(n, 'currency', locale);
    case 'currencyWhole':
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(n);
    case 'percent':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(n);
    default:
      return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(n);
  }
}

/** Numeric columns share the remaining width evenly; labels size to their content. */
export function sectionColumnWidth(column: PdfTableColumn): number | 'auto' | '*' {
  return column.width ?? (column.format === 'text' ? 'auto' : '*');
}

function sectionCell(
  row: PdfTableRow,
  column: PdfTableColumn,
  locale: string,
  fontSize: number,
): Content {
  const isText = column.format === 'text';
  const text = sectionCellText(row.cells[column.key], column, locale);
  // A period without a main value is one dash, not two stacked ones.
  const hasMain = text !== MISSING;
  if (column.secondaryKey && hasMain) {
    return {
      stack: [
        { text, bold: row.emphasis === 'total' },
        { text: sectionCellText(row.cells[column.secondaryKey], column, locale), color: '#666666' },
      ],
      alignment: column.align ?? 'right',
      noWrap: true,
      fontSize,
    } as unknown as Content;
  }
  return {
    text,
    alignment: column.align ?? (isText ? 'left' : 'right'),
    // Amounts must never break mid-number; only labels (employer names) may wrap.
    noWrap: !isText,
    bold: row.emphasis === 'total',
    fontSize,
  } as unknown as Content;
}

function sectionContent(section: PdfSection, locale: string): Content[] {
  if (section.kind === 'text') {
    return [
      ...(section.title
        ? [{ text: section.title, style: 'sectionHeader', margin: [0, 8, 0, 4] }]
        : []),
      { text: section.text, margin: [0, 0, 0, 8] },
    ] as Content[];
  }
  const fontSize = section.fontSize ?? SECTION_FONT_SIZE;
  const header = section.columns.map((column) => ({
    text: column.label,
    style: 'tableHeader',
    fontSize,
    alignment: column.align ?? (column.format === 'text' ? 'left' : 'right'),
  }));
  const body = section.rows.map((row) =>
    section.columns.map((column) => sectionCell(row, column, locale, fontSize)),
  );
  return [
    {
      text: section.title,
      style: 'sectionHeader',
      // By default every table starts on its own page, so a heading is never separated from its
      // table; `keepWithNext` still moves a table that does not fit to the next page.
      ...(section.startOnNewPage === false ? {} : { pageBreak: 'before' }),
      margin: [0, section.startOnNewPage === false ? 8 : 0, 0, section.subtitle ? 0 : 4],
      keepWithNext: true,
    },
    ...(section.subtitle
      ? [{ text: section.subtitle, style: 'meta', margin: [0, 0, 0, 4], keepWithNext: true }]
      : []),
    {
      table: {
        headerRows: 1,
        keepWithHeaderRows: 1,
        dontBreakRows: true,
        widths: section.columns.map(sectionColumnWidth),
        body: [header, ...body],
      },
      layout: SECTION_TABLE_LAYOUT,
      margin: [0, 0, 0, 8],
    },
  ] as unknown as Content[];
}

function genericTable(resolved: ResolvedFeatureExport, locale: string): Content {
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

  return {
    table: {
      headerRows: 1,
      widths: resolved.columns.map(() => '*'),
      body: [header, ...body],
    },
    layout: 'lightHorizontalLines',
  };
}

function chartWidthOf(resolved: ResolvedFeatureExport): number {
  return resolved.pdfSections?.length ? PAGE_CONTENT_WIDTH : 440;
}

function footerOf(resolved: ResolvedFeatureExport): string {
  return resolved.footer ?? 'This export is scoped to your own account data only.';
}

/** Margins with room for the page footer, which repeats the notice on every page. */
function sectionPageSetup(footerText: string): Partial<TDocumentDefinitions> {
  return {
    pageMargins: [
      SECTION_PAGE_MARGIN,
      SECTION_PAGE_MARGIN,
      SECTION_PAGE_MARGIN,
      SECTION_BOTTOM_MARGIN,
    ],
    footer: () => ({
      text: footerText,
      style: 'footer',
      margin: [SECTION_PAGE_MARGIN, 12, SECTION_PAGE_MARGIN, 0],
    }),
  };
}

export function buildDocDefinition(resolved: ResolvedFeatureExport): TDocumentDefinitions {
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
    // A section PDF draws its chart across the whole page; the generic layout keeps it narrow
    // so the allocation table fits beside it.
    const chartWidth = chartWidthOf(resolved);
    const chartCol: Content = {
      stack: [{ image: mainImage, width: chartWidth } as unknown as Content],
      width: chartWidth,
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

  const sections = resolved.pdfSections ?? [];
  if (sections.length > 0) {
    for (const section of sections) content.push(...sectionContent(section, locale));
  } else {
    content.push(genericTable(resolved, locale));
  }

  const footerText = footerOf(resolved);
  if (sections.length === 0) {
    content.push({ text: footerText, style: 'footer', margin: [0, 16, 0, 0] });
  }

  return {
    content,
    pageOrientation: 'landscape',
    ...(sections.length > 0 ? sectionPageSetup(footerText) : {}),
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
