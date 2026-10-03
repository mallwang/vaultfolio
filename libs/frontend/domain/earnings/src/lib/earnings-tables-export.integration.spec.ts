import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type {
  CareerEntry,
  EarningsOverview,
  EarningsTables,
  TaxYearRow,
} from '@vaultfolio/api-contract';
import {
  exportFeature,
  exportFileExtension,
  type ExportFormat,
  type ExportTable,
  type PdfSection,
  type ResolvedFeatureExport,
} from '@vaultfolio/export';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { createEarningsExportDefinition } from './earnings-export.definition';

/**
 * Runs the real earnings definition and the real exporters on maximum-size synthetic data and
 * checks that JSON, Excel, CSV and the PDF sections carry the same figures (FR-017, SC-007), that
 * the JSON keys do not depend on the language (SC-009) and that no per-payslip data is left.
 */
const NAMES = Array.from(
  { length: 8 },
  (_, i) => `Mitteldeutsche Beratungsgesellschaft Nr. ${i} mbH`,
);
const YEARS = Array.from({ length: 20 }, (_, i) => 2026 - i);
const money = (n: number) => n.toFixed(2);

function fixture(): { overview: EarningsOverview; tables: EarningsTables } {
  const career: CareerEntry[] = NAMES.map((label, i) => ({
    key: `e${i}`,
    label,
    firstPeriod: `${2007 + i * 2}-01`,
    lastPeriod: `${2008 + i * 2}-12`,
    monthsEmployed: 24,
    employerCount: 1,
    totals: {
      gross: money(100000 + i),
      net: money(60000 + i),
      taxes: money(22000 + i),
      social: money(18000 + i),
      bonus: money(10000 + i),
    },
    perMonth: { gross: '0.00', net: '0.00', taxes: '0.00', social: '0.00', bonus: '0.00' },
    netRatio: '0.6000',
  }));
  const cents = (k: keyof CareerEntry['totals']) =>
    career.reduce((a, e) => a + Math.round(Number(e.totals[k]) * 100), 0) / 100;
  career.push({
    ...career[0],
    key: 'ALL',
    label: 'All',
    employerCount: 8,
    totals: {
      gross: money(cents('gross')),
      net: money(cents('net')),
      taxes: money(cents('taxes')),
      social: money(cents('social')),
      bonus: money(cents('bonus')),
    },
  });
  const gross: Record<string, string> = {};
  const net: Record<string, string> = {};
  for (const y of YEARS)
    for (let m = 1; m <= 12; m++) {
      const p = `${y}-${String(m).padStart(2, '0')}`;
      gross[p] = money(12345.67 + m);
      net[p] = money(7654.32 + m);
    }
  const taxesPerYear = YEARS.map<TaxYearRow>((year, i) => ({
    year,
    employerId: `e${i % 8}`,
    employerLabel: NAMES[i % 8],
    monthsEmployed: 12,
    gross: money(123456.78),
    bonus: money(1234.56),
    taxGross: money(123456.78),
    wageTax: money(23456.78),
    soli: money(1.5),
    churchTax: money(1234.5),
    health: money(9000.1),
    care: money(2000.2),
    pension: money(11000.3),
    unemployment: money(1500.4),
    taxRatio: '0.2000',
    socialRatio: '0.1900',
  }));
  return {
    overview: {
      hasData: true,
      career,
      latestYear: null,
      yearly: [...YEARS].reverse().map((year) => ({
        year,
        monthsEmployed: 12,
        gross: money(150000 + year),
        regular: money(140000 + year),
        bonus: '10000.00',
        net: money(90000 + year),
        taxes: money(33000 + year),
        social: money(27000 + year),
        taxRatio: '0.2200',
        socialRatio: '0.1800',
      })),
      monthly: [],
      employerChanges: [],
      dataCheckIssues: 0,
    },
    tables: {
      monthGrid: {
        years: YEARS,
        metrics: { gross, net },
        bonusPeriods: [],
        missingPeriods: [],
      } as unknown as EarningsTables['monthGrid'],
      taxesPerYear,
      certificates: [],
    },
  };
}

describe('earnings tables export (integration)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  async function resolve(lang: 'de' | 'en', empty = false) {
    TestBed.inject(I18nService).setLanguage(lang);
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    const data = fixture();
    const flushAll = () => {
      http
        .expectOne('/api/earnings/overview')
        .flush(
          empty ? { ...data.overview, hasData: false, career: [], yearly: [] } : data.overview,
        );
      http.expectOne('/api/earnings/tables').flush(data.tables);
    };
    const tablesPromise = definition.getExportTables?.();
    flushAll();
    const tables = (await tablesPromise) as ExportTable[];
    const sectionsPromise = definition.getPdfSections?.();
    flushAll();
    const sections = (await sectionsPromise) as PdfSection[];
    const resolved: ResolvedFeatureExport = {
      featureId: 'earnings',
      title: 'Earnings',
      infobox: '',
      columns: [],
      rows: [],
      tables,
      locale: lang,
    };
    return { tables, sections, resolved };
  }

  /** exceljs and jszip need a Buffer; a bare ArrayBuffer is not recognised under jsdom. */
  async function readBuffer(blob: Blob): Promise<Buffer> {
    return Buffer.from(await blob.arrayBuffer());
  }

  const jsonOf = async (r: ResolvedFeatureExport) =>
    JSON.parse(await (await exportFeature(r, 'json')).text()) as Record<string, unknown>;

  it('has the same JSON key structure in German and English', async () => {
    const [deJson, enJson] = await Promise.all([
      resolve('de').then((x) => jsonOf(x.resolved)),
      resolve('en').then((x) => jsonOf(x.resolved)),
    ]);
    const shape = (o: Record<string, unknown>) =>
      Object.fromEntries(
        Object.entries(o).map(([k, v]) => [
          k,
          Object.keys((Array.isArray(v) ? v[0] : v) as Record<string, unknown>),
        ]),
      );
    expect(Object.keys(enJson)).toEqual([
      'grossPerYear',
      'employers',
      'careerTotal',
      'monthlyOverview',
      'taxesPerYear',
    ]);
    expect(shape(deJson)).toEqual(shape(enJson));
  });

  it('carries the same career total and year figures in JSON, Excel, CSV and the PDF sections', async () => {
    const { resolved, sections } = await resolve('en');
    const json = await jsonOf(resolved);
    const total = json['careerTotal'] as Record<string, string>;
    const year2026 = (json['grossPerYear'] as Record<string, unknown>[])[0];
    expect(total['gross']).toBe(money(NAMES.reduce((a, _, i) => a + 100000 + i, 0)));
    expect(year2026).toMatchObject({ year: 2026, gross: '152026.00' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load((await readBuffer(await exportFeature(resolved, 'xlsx'))) as never);
    expect(workbook.worksheets).toHaveLength(4);
    const employers = workbook.worksheets[1];
    expect(employers.getRow(employers.rowCount).getCell(2).value).toBe(Number(total['gross']));
    expect(workbook.worksheets[0].getRow(2).getCell(3).value).toBe(152026);

    const csvBlob = await exportFeature(resolved, 'csv');
    expect(exportFileExtension(resolved, 'csv')).toBe('zip');
    const zip = await JSZip.loadAsync(await readBuffer(csvBlob));
    expect(Object.keys(zip.files).sort()).toEqual([
      '01-gross-per-year.csv',
      '02-employers.csv',
      '03-monthly-overview.csv',
      '04-all-taxes-and-contributions-per-year.csv',
    ]);
    const employersCsv = (await zip.files['02-employers.csv'].async('string')).split('\r\n');
    expect(employersCsv.at(-1)).toContain(`Career total,${total['gross']},`);

    const pdfEmployers = sections[0] as Extract<PdfSection, { kind: 'table' }>;
    expect(pdfEmployers.rows.at(-1)?.cells['gross']).toBe(total['gross']);
  });

  it('exports no per-payslip shape: no file names, corrections, issue dates or kinds', async () => {
    const { resolved } = await resolve('en');
    const text = JSON.stringify(await jsonOf(resolved));
    for (const word of ['fileName', 'source', 'corrected', 'issued', '.pdf', 'payout']) {
      expect(text).not.toContain(word);
    }
  });

  it('writes JSON with empty sections and a null career total without data', async () => {
    const { resolved } = await resolve('en', true);
    const json = await jsonOf(resolved);
    expect(json['careerTotal']).toBeNull();
    expect(json['employers']).toEqual([]);
    expect(json['taxesPerYear']).toEqual([]);
  });

  it.each<ExportFormat>(['xlsx', 'csv'])(
    'writes a valid empty %s file without data',
    async (format) => {
      const { resolved } = await resolve('en', true);
      const blob = await exportFeature(resolved, format);
      expect(blob.size).toBeGreaterThan(0);
    },
  );
});
