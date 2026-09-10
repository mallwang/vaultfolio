import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FeatureExportDefinition } from '@vaultfolio/export';
import { ExportControlComponent } from './export-control.component';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';
import { CHART_IMAGE_CAPTURE } from './chart-image-capture';

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
    await TestBed.configureTestingModule({
      imports: [ExportControlComponent],
      providers: [
        {
          provide: CHART_IMAGE_CAPTURE,
          useValue: () => Promise.resolve('data:image/png;base64,x'),
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
});
