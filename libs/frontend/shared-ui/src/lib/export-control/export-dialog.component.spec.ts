import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { vi } from 'vitest';
import type { FeatureExportDefinition } from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { CHART_IMAGE_CAPTURE } from './chart-image-capture';
import { ExportDialogComponent } from './export-dialog.component';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';
import { FeatureExportRunner } from './feature-export-runner';

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

describe('ExportDialogComponent', () => {
  let fixture: ComponentFixture<ExportDialogComponent>;
  let downloads: string[];

  const el = (): HTMLElement => document.body;
  const byId = (id: string) => el().querySelector<HTMLElement>(`[data-testid="${id}"]`);
  const button = (format: string) =>
    byId(`export-btn-${format}`)?.querySelector('button') as HTMLButtonElement;

  async function open(featureId = 'holdings'): Promise<void> {
    fixture = TestBed.createComponent(ExportDialogComponent);
    fixture.componentInstance.featureId = featureId;
    fixture.componentInstance.visible = true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    window.matchMedia ??= vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    TestBed.configureTestingModule({
      providers: [
        { provide: CHART_IMAGE_CAPTURE, useValue: vi.fn().mockResolvedValue('data:image/png;x') },
        MessageService,
      ],
    });
    TestBed.inject(FEATURE_EXPORT_REGISTRY).register(makeDefinition());
    downloads = [];
    HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    };
  });

  afterEach(() => {
    fixture?.destroy();
  });

  it('shows the four format cards in order without an export-all control', async () => {
    await open();

    const cards = [...el().querySelectorAll('[data-testid^="export-card-"]')].map((c) =>
      c.getAttribute('data-testid'),
    );
    expect(cards).toEqual([
      'export-card-pdf',
      'export-card-xlsx',
      'export-card-csv',
      'export-card-json',
    ]);
    expect(el().querySelectorAll('[data-testid^="export-btn-"]')).toHaveLength(4);
  });

  it.each([
    ['pdf', 'Portfolio.pdf'],
    ['xlsx', 'Portfolio.xlsx'],
    ['csv', 'Portfolio.csv'],
    ['json', 'Portfolio.json'],
  ])('shows the real file name and downloads exactly that for %s', async (format, fileName) => {
    await open();

    expect(byId(`export-filename-${format}`)?.textContent?.trim()).toBe(fileName);
    button(format).click();
    await vi.waitFor(() => expect(downloads).toEqual([fileName]), { timeout: 10_000 });
  });

  it('keeps the dialog open and lets a second format follow', async () => {
    await open();

    button('xlsx').click();
    await vi.waitFor(() => expect(downloads).toHaveLength(1));
    button('csv').click();
    await vi.waitFor(() => expect(downloads).toEqual(['Portfolio.xlsx', 'Portfolio.csv']));
    expect(byId('export-dialog')).not.toBeNull();
    expect(byId('export-dialog')).not.toBeNull();
  });

  it('disables only the running card while an export is pending', async () => {
    let release: () => void = () => undefined;
    TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
      makeDefinition({
        featureId: 'slow',
        fetchData: () => new Promise((resolve) => (release = () => resolve([]))),
      }),
    );
    await open('slow');

    button('pdf').click();
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(button('pdf').disabled).toBe(true);
    });
    expect(byId('export-btn-pdf')?.getAttribute('aria-busy')).toBe('true');
    expect(button('csv').disabled).toBe(false);

    release();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(button('pdf').disabled).toBe(false);
    });
  });

  it('does not abort a running export when the dialog is closed', async () => {
    let release: () => void = () => undefined;
    TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
      makeDefinition({
        featureId: 'slow',
        fetchData: () => new Promise((resolve) => (release = () => resolve([]))),
      }),
    );
    await open('slow');

    button('json').click();
    fixture.componentInstance.visible = false;
    fixture.detectChanges();
    release();

    await vi.waitFor(() => expect(downloads).toEqual(['Portfolio.json']));
  });

  describe('tables (ZIP) and data text', () => {
    it('shows .zip and the ZIP type text for a definition with tables', async () => {
      TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
        makeDefinition({ featureId: 'tabled', getExportTables: () => Promise.resolve([]) }),
      );
      await open('tabled');

      expect(byId('export-filename-csv')?.textContent?.trim()).toBe('Portfolio.zip');
      expect(byId('export-card-csv')?.textContent).toContain(
        TestBed.inject(I18nService).translate('export.dialog.csv.typeZip'),
      );
      expect(byId('export-filename-xlsx')?.textContent?.trim()).toBe('Portfolio.xlsx');
    });

    it('shows a single .csv without tables', async () => {
      await open();
      expect(byId('export-filename-csv')?.textContent?.trim()).toBe('Portfolio.csv');
    });

    it('uses the override text only for the overridden format', async () => {
      TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
        makeDefinition({
          featureId: 'custom',
          formatDataKeys: { csv: 'earnings.export.data.csv' },
        }),
      );
      await open('custom');
      const i18n = TestBed.inject(I18nService);

      expect(byId('export-card-csv')?.textContent).toContain(
        i18n.translate('earnings.export.data.csv'),
      );
      expect(byId('export-card-pdf')?.textContent).toContain(
        i18n.translate('export.dialog.pdf.data'),
      );
    });
  });

  it('follows the language (en and de)', async () => {
    const i18n = TestBed.inject(I18nService);
    i18n.setLanguage('en');
    await open();
    expect(byId('export-btn-pdf')?.textContent).toContain('Export as PDF');
    i18n.setLanguage('de');
    fixture.detectChanges();
    expect(byId('export-btn-pdf')?.textContent).toContain('Als PDF exportieren');
    i18n.setLanguage('en');
  });

  describe('failure', () => {
    beforeEach(() => {
      vi.spyOn(TestBed.inject(FeatureExportRunner), 'run').mockRejectedValue(new Error('boom'));
    });

    it('shows an alert banner naming the format and re-enables the button', async () => {
      await open();

      button('xlsx').click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(byId('export-dialog-error')?.textContent).toContain('Excel');
      });
      expect(byId('export-dialog-error')?.getAttribute('role')).toBe('alert');
      expect(button('xlsx').disabled).toBe(false);
    });

    it('clears the banner on the next export', async () => {
      await open();
      button('xlsx').click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(byId('export-dialog-error')).not.toBeNull();
      });

      vi.spyOn(TestBed.inject(FeatureExportRunner), 'run').mockResolvedValue('x');
      button('csv').click();
      await vi.waitFor(() => {
        fixture.detectChanges();
        expect(byId('export-dialog-error')).toBeNull();
      });
    });

    it('raises a toast when the dialog was closed before the failure', async () => {
      const add = vi.spyOn(TestBed.inject(MessageService), 'add');
      await open();
      const component = fixture.componentInstance as unknown as {
        export(format: string): Promise<void>;
      };
      fixture.componentInstance.visible = false;
      fixture.detectChanges();

      await component.export('pdf');

      expect(add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
      expect(byId('export-dialog-error')).toBeNull();
    });
  });
});
