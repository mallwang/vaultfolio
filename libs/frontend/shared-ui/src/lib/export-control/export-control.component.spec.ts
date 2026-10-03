import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { FeatureExportDefinition } from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { ExportControlComponent } from './export-control.component';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';

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

  const link = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-testid="export-open-link"]',
    ) as HTMLButtonElement;

  function create(featureId: string): void {
    fixture = TestBed.createComponent(ExportControlComponent);
    fixture.componentInstance.featureId = featureId;
    fixture.detectChanges();
  }

  beforeEach(() => {
    window.matchMedia ??= vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;
    TestBed.inject(FEATURE_EXPORT_REGISTRY).register(makeDefinition());
  });

  afterEach(() => fixture?.destroy());

  it('renders a text link instead of a split button', () => {
    create('holdings');

    expect(link().textContent).toContain(TestBed.inject(I18nService).translate('export.link'));
    expect(fixture.nativeElement.querySelector('p-splitbutton')).toBeNull();
  });

  it('opens the dialog with the four cards when clicked', async () => {
    create('holdings');
    expect(document.body.querySelector('[data-testid="export-card-pdf"]')).toBeNull();

    link().click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.body.querySelectorAll('[data-testid^="export-card-"]')).toHaveLength(4);
  });

  it('returns focus to the link when the dialog is closed', () => {
    create('holdings');
    const component = fixture.componentInstance as unknown as {
      open(): void;
      onVisibleChange(visible: boolean): void;
    };
    document.body.appendChild(fixture.nativeElement);
    component.open();
    component.onVisibleChange(false);

    expect(document.activeElement).toBe(link());
  });

  describe('disabled', () => {
    beforeEach(() => {
      TestBed.inject(FEATURE_EXPORT_REGISTRY).register(
        makeDefinition({
          featureId: 'off',
          isEnabled: () => false,
          disabledTooltipKey: 'export.tooltipNotImplemented',
        }),
      );
      create('off');
    });

    it('disables the link and never opens the dialog', async () => {
      expect(link().disabled).toBe(true);

      link().click();
      (fixture.componentInstance as unknown as { open(): void }).open();
      fixture.detectChanges();
      await fixture.whenStable();

      expect(document.body.querySelector('[data-testid="export-card-pdf"]')).toBeNull();
    });

    it('carries the disabled tooltip text', () => {
      const tooltip = (
        fixture.componentInstance as unknown as { disabledTooltip(): string | undefined }
      ).disabledTooltip();
      expect(tooltip).toBe(TestBed.inject(I18nService).translate('export.tooltipNotImplemented'));
    });
  });
});
