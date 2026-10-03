import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { FeatureExportDefinition, ResolvedFeatureExport } from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { ExportControlComponent } from './export-control.component';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';
import { CHART_IMAGE_CAPTURE } from './chart-image-capture';

// Calls through to the real exporter unless a test overrides the implementation.
const mocks = vi.hoisted(() => ({
  exportFeatureMock: vi.fn(),
  captureMock: vi.fn(),
  actualExport: undefined as undefined | ((...args: never[]) => unknown),
}));
const { exportFeatureMock } = mocks;
vi.mock('@vaultfolio/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@vaultfolio/export')>();
  mocks.actualExport = actual.exportFeature as never;
  return { ...actual, exportFeature: mocks.exportFeatureMock };
});

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

describe('ExportControlComponent', () => {
  let fixture: ComponentFixture<ExportControlComponent>;
  let downloadedFileNames: string[];

  beforeEach(async () => {
    exportFeatureMock.mockReset();
    mocks.captureMock.mockReset();
    mocks.captureMock.mockResolvedValue('data:image/png;base64,x');
    exportFeatureMock.mockImplementation((...args: never[]) => mocks.actualExport?.(...args));
    // PrimeNG's TieredMenu (inside SplitButton) calls matchMedia().addEventListener() on init;
    // jsdom doesn't implement matchMedia, so we stub it.
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    await TestBed.configureTestingModule({
      imports: [ExportControlComponent],
      providers: [
        {
          provide: CHART_IMAGE_CAPTURE,
          useValue: mocks.captureMock,
        },
      ],
    }).compileComponents();

    TestBed.inject(FEATURE_EXPORT_REGISTRY).register(makeDefinition());

    fixture = TestBed.createComponent(ExportControlComponent);
    fixture.componentInstance.featureId = 'holdings';

    downloadedFileNames = [];
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      downloadedFileNames.push(this.download);
    };

    fixture.detectChanges();
  });

  it('renders the split-button with PDF/Excel/CSV/JSON menu items', () => {
    const items = fixture.componentInstance['menuItems']();
    // Labels are HTML strings (escape:false with embedded icon glyph) — check containment.
    expect(items).toHaveLength(4);
    expect(items.every((item) => item.escape === false)).toBe(true);
    expect(items[0].label).toContain('PDF');
    expect(items[1].label).toContain('Excel');
    expect(items[2].label).toContain('CSV');
    expect(items[3].label).toContain('JSON');
  });

  it.each([
    ['PDF', 0, 'Holdings.pdf'],
    ['Excel', 1, 'Holdings.xlsx'],
    ['CSV', 2, 'Holdings.csv'],
    ['JSON', 3, 'Holdings.json'],
  ])('triggers a %s download named %s', async (label, index, expectedFileName) => {
    const items = fixture.componentInstance['menuItems']();
    await items[index]?.command?.();

    expect(downloadedFileNames).toEqual([expectedFileName]);
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
      fixture = TestBed.createComponent(ExportControlComponent);
      fixture.componentInstance.featureId = 'sectioned';
      fixture.detectChanges();
    });

    it('awaits sections before chart options and skips the generic fetch for the PDF', async () => {
      await fixture.componentInstance['menuItems']()[0].command?.();

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
      const sized = TestBed.createComponent(ExportControlComponent);
      sized.componentInstance.featureId = 'sized';
      sized.detectChanges();

      await sized.componentInstance['menuItems']()[0].command?.();

      expect(mocks.captureMock).toHaveBeenCalledWith({ a: 1 }, { width: 1000, height: 330 });
    });

    it.each([
      ['Excel', 1],
      ['CSV', 2],
      ['JSON', 3],
    ])('keeps the generic fetch and infobox and ignores sections for %s', async (_l, index) => {
      await fixture.componentInstance['menuItems']()[index].command?.();

      expect(calls).toEqual(['fetchData']);
      expect(exported[0].pdfSections).toBeUndefined();
      expect(exported[0].rows).toEqual([{ name: 'Gold' }]);
      expect(exported[0].infobox).toBe(
        TestBed.inject(I18nService).translate('holdingsExport.infobox'),
      );
    });
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
      fixture = TestBed.createComponent(ExportControlComponent);
      fixture.componentInstance.featureId = 'tabled';
      fixture.detectChanges();
    });

    it.each([
      ['Excel', 1, 'Holdings.xlsx'],
      ['CSV', 2, 'Holdings.zip'],
      ['JSON', 3, 'Holdings.json'],
    ])('passes the tables and skips fetchData for %s (%s)', async (_l, index, fileName) => {
      await fixture.componentInstance['menuItems']()[index].command?.();

      expect(calls).toEqual(['getExportTables']);
      expect(exported[0].tables).toEqual(tables);
      expect(exported[0].rows).toEqual([]);
      expect(downloadedFileNames).toEqual([fileName]);
    });

    it('ignores the tables for the PDF', async () => {
      await fixture.componentInstance['menuItems']()[0].command?.();

      expect(calls).toEqual(['fetchData']);
      expect(exported[0].tables).toBeUndefined();
      expect(downloadedFileNames).toEqual(['Holdings.pdf']);
    });
  });
});
