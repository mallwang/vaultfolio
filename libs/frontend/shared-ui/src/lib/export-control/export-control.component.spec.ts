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

  it('renders the split-button with JSON/CSV/XLSX/PDF menu items', () => {
    const items = fixture.componentInstance['menuItems'];
    expect(items.map((item) => item.label)).toEqual(['JSON', 'CSV', 'Excel', 'PDF']);
  });

  it.each([
    ['JSON', 'holdings.json'],
    ['CSV', 'holdings.csv'],
    ['Excel', 'holdings.xlsx'],
    ['PDF', 'holdings.pdf'],
  ])('triggers a %s download named %s', async (label, expectedFileName) => {
    const items = fixture.componentInstance['menuItems'];
    const item = items.find((i) => i.label === label);
    await item?.command?.({} as never);

    expect(downloadedFileNames).toEqual([expectedFileName]);
  });
});
