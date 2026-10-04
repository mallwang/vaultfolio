import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import {
  exportFeature,
  type ExportFormat,
  type FeatureExportDefinition,
  type ResolvedFeatureExport,
} from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';
import { EXPORT_FEATURE, FeatureExportRunner } from './feature-export-runner';
import { CHART_IMAGE_CAPTURE } from './chart-image-capture';
import { PDF_LOGO } from './pdf-logo';

// Calls through to the real exporter unless a test overrides the implementation.
const captureMock = vi.fn();

function makeDefinition(overrides: Partial<FeatureExportDefinition> = {}): FeatureExportDefinition {
  return {
    featureId: 'holdings',
    titleKey: 'holdingsExport.title',
    infoboxKey: 'holdingsExport.infobox',
    columns: [{ key: 'name', labelKey: 'holdingsExport.columnName', format: 'text' }],
    fetchData: () => Promise.resolve([{ name: 'Gold' }]),
    ...overrides,
  };
}

const LOGO =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('FeatureExportRunner', () => {
  const exportFeatureMock = vi.fn(exportFeature);
  let runner: FeatureExportRunner;
  let downloadedFileNames: string[];

  beforeEach(async () => {
    exportFeatureMock.mockReset();
    captureMock.mockReset();
    captureMock.mockResolvedValue('data:image/png;base64,x');
    exportFeatureMock.mockImplementation(exportFeature);

    await TestBed.configureTestingModule({
      providers: [
        { provide: EXPORT_FEATURE, useValue: exportFeatureMock },
        { provide: PDF_LOGO, useValue: () => Promise.resolve(LOGO) },
        {
          provide: CHART_IMAGE_CAPTURE,
          useValue: captureMock,
        },
      ],
    }).compileComponents();

    TestBed.inject(FEATURE_EXPORT_REGISTRY).register(makeDefinition());

    runner = TestBed.inject(FeatureExportRunner);

    downloadedFileNames = [];
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      downloadedFileNames.push(this.download);
    };
  });

  it('hands the logo to the PDF only', async () => {
    await runner.run('holdings', 'pdf');
    await runner.run('holdings', 'csv');
    expect(exportFeatureMock.mock.calls[0][0].logo).toBe(LOGO);
    expect(exportFeatureMock.mock.calls[1][0].logo).toBeUndefined();
  });

  it.each<[ExportFormat, string]>([
    ['pdf', 'Holdings.pdf'],
    ['xlsx', 'Holdings.xlsx'],
    ['csv', 'Holdings.csv'],
    ['json', 'Holdings.json'],
  ])('triggers a %s download named %s', async (format, expectedFileName) => {
    const result = await runner.run('holdings', format);

    expect(downloadedFileNames).toEqual([expectedFileName]);
    expect(result).toBe(expectedFileName);
  });

  it('rejects for an unknown feature id without downloading', async () => {
    await expect(runner.run('unknown', 'pdf')).rejects.toThrow();
    expect(downloadedFileNames).toEqual([]);
  });

  it('rejects when the exporter fails', async () => {
    exportFeatureMock.mockRejectedValueOnce(new Error('boom'));
    await expect(runner.run('holdings', 'pdf')).rejects.toThrow('boom');
    expect(downloadedFileNames).toEqual([]);
  });

  describe('PDF sections', () => {
    let calls: string[];
    let exported: ResolvedFeatureExport[];

    beforeEach(() => {
      calls = [];
      exported = [];
      exportFeatureMock.mockImplementation((resolved: ResolvedFeatureExport) => {
        exported.push(resolved);
        return Promise.resolve(new Blob(['x']));
      });
      TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
        makeDefinition({
          featureId: 'sectioned',
          pdfInfoboxKey: 'earnings.export.pdfInfobox',
          fetchData: () => {
            calls.push('fetchData');
            return Promise.resolve([{ name: 'Gold' }]);
          },
          getPdfSections: () => {
            calls.push('getPdfSections');
            return Promise.resolve([{ kind: 'text', text: 'section' }]);
          },
          getChartOptions: () => {
            calls.push('getChartOptions');
            return [{}];
          },
        }),
      );
    });

    it('awaits sections before chart options and skips the generic fetch for the PDF', async () => {
      await runner.run('sectioned', 'pdf');

      expect(calls).toEqual(['getPdfSections', 'getChartOptions']);
      expect(exported[0].pdfSections).toEqual([{ kind: 'text', text: 'section' }]);
      expect(exported[0].rows).toEqual([]);
      expect(exported[0].infobox).toBe(
        TestBed.inject(I18nService).translate('earnings.export.pdfInfobox'),
      );
    });

    it('passes the definition chart size to the chart capture', async () => {
      TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
        makeDefinition({
          featureId: 'sized',
          getChartOptions: () => [{ a: 1 }],
          pdfChartSize: { width: 1000, height: 330 },
        }),
      );
      await runner.run('sized', 'pdf');

      expect(captureMock).toHaveBeenCalledWith({ a: 1 }, { width: 1000, height: 330 });
    });

    it.each<ExportFormat>(['xlsx', 'csv', 'json'])(
      'keeps the generic fetch and infobox and ignores sections for %s',
      async (format) => {
        await runner.run('sectioned', format);

        expect(calls).toEqual(['fetchData']);
        expect(exported[0].pdfSections).toBeUndefined();
        expect(exported[0].rows).toEqual([{ name: 'Gold' }]);
        expect(exported[0].infobox).toBe(
          TestBed.inject(I18nService).translate('holdingsExport.infobox'),
        );
      },
    );
  });

  describe('export tables', () => {
    let calls: string[];
    let exported: ResolvedFeatureExport[];
    const tables = [{ id: 't', title: 'T', columns: [], rows: [] }];

    beforeEach(() => {
      calls = [];
      exported = [];
      exportFeatureMock.mockImplementation((resolved: ResolvedFeatureExport) => {
        exported.push(resolved);
        return Promise.resolve(new Blob(['x']));
      });
      TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
        makeDefinition({
          featureId: 'tabled',
          fetchData: () => {
            calls.push('fetchData');
            return Promise.resolve([{ name: 'Gold' }]);
          },
          getExportTables: () => {
            calls.push('getExportTables');
            return Promise.resolve(tables);
          },
        }),
      );
    });

    it.each<[ExportFormat, string]>([
      ['xlsx', 'Holdings.xlsx'],
      ['csv', 'Holdings.zip'],
      ['json', 'Holdings.json'],
    ])('passes the tables and skips fetchData for %s (%s)', async (format, fileName) => {
      await runner.run('tabled', format);

      expect(calls).toEqual(['getExportTables']);
      expect(exported[0].tables).toEqual(tables);
      expect(exported[0].rows).toEqual([]);
      expect(downloadedFileNames).toEqual([fileName]);
    });

    it('ignores the tables for the PDF', async () => {
      await runner.run('tabled', 'pdf');

      expect(calls).toEqual(['fetchData']);
      expect(exported[0].tables).toBeUndefined();
      expect(downloadedFileNames).toEqual(['Holdings.pdf']);
    });
  });
});
