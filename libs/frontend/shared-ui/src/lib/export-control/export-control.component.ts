import { Component, Input, inject } from '@angular/core';
import { SplitButtonModule } from 'primeng/splitbutton';
import type { MenuItem } from 'primeng/api';
import type { ButtonSeverity } from 'primeng/types/button';
import {
  FeatureExportRegistry,
  exportFeature,
  type ExportFormat,
  type ResolvedFeatureExport,
} from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { CHART_IMAGE_CAPTURE } from './chart-image-capture';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';

interface FormatMenuEntry {
  format: ExportFormat;
  icon: string;
  labelKey: string;
  descriptionKey: string;
}

/** design.md's format menu, top to bottom: JSON, CSV, Excel, then PDF (the "report" format). */
const FORMAT_MENU: FormatMenuEntry[] = [
  {
    format: 'json',
    icon: 'file-json',
    labelKey: 'export.formatJson',
    descriptionKey: 'export.formatJsonDescription',
  },
  {
    format: 'csv',
    icon: 'file-csv',
    labelKey: 'export.formatCsv',
    descriptionKey: 'export.formatCsvDescription',
  },
  {
    format: 'xlsx',
    icon: 'file-excel',
    labelKey: 'export.formatXlsx',
    descriptionKey: 'export.formatXlsxDescription',
  },
  {
    format: 'pdf',
    icon: 'file-pdf',
    labelKey: 'export.formatPdf',
    descriptionKey: 'export.formatPdfDescription',
  },
];

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The single reusable Export split-button (contracts/export-lib.md's `<app-export-control>`)
 * every data-holding feature mounts next to its own "Add" action (FR-001, FR-008/FR-009).
 * Carries no per-feature knowledge itself — it looks its `FeatureExportDefinition` up from the
 * app-wide `FeatureExportRegistry` by `featureId`.
 *
 * Inline template/styles, not templateUrl/styleUrl (per the existing `IconComponent`/
 * `EchartComponent` convention in this same library): every consumer of this component lives
 * outside `@vaultfolio/frontend-shared-ui`, and `@angular/build:unit-test` externalizes
 * workspace-linked packages during its build step, leaving templateUrl/styleUrl unresolved at
 * test runtime for any cross-package consumer's spec.
 */
@Component({
  selector: 'app-export-control',
  imports: [SplitButtonModule, TranslatePipe],
  template: `
    <p-splitbutton
      [label]="'export.buttonLabel' | translate"
      icon="download"
      [severity]="severity"
      [model]="menuItems"
      [disabled]="exporting"
      data-testid="export-control"
      (onClick)="onDefaultAction()"
    />
  `,
})
export class ExportControlComponent {
  /** Matches the registered `FeatureExportDefinition.featureId` this control exports. */
  @Input({ required: true }) featureId!: string;

  /** PrimeNG button severity — 'info' per design.md for every current call site. */
  @Input() severity: ButtonSeverity = 'info';

  private readonly registry: FeatureExportRegistry = inject(FEATURE_EXPORT_REGISTRY);
  private readonly i18n = inject(I18nService);
  private readonly captureChartImage = inject(CHART_IMAGE_CAPTURE);

  protected exporting = false;

  protected get menuItems(): MenuItem[] {
    return FORMAT_MENU.map((entry) => ({
      label: this.i18n.translate(entry.labelKey),
      icon: entry.icon,
      // PrimeNG's MenuItem doesn't have a description slot out of the box; the format's
      // description text (design.md's "Raw structured data" etc.) surfaces as a title
      // tooltip until a dedicated item template is warranted.
      title: this.i18n.translate(entry.descriptionKey),
      command: () => this.export(entry.format),
    }));
  }

  /** Default (non-caret) click: no single default format per design.md — just opens the menu. */
  protected onDefaultAction(): void {
    // No-op: p-splitbutton's own caret already owns opening the menu; the left segment has no
    // separate default action per design.md ("no single default format").
  }

  protected async export(format: ExportFormat): Promise<void> {
    const definition = this.registry.getById(this.featureId);
    if (!definition) {
      return;
    }

    this.exporting = true;
    try {
      const rows = await definition.fetchData();
      const chartImages =
        format === 'pdf' && definition.getChartOptions
          ? await Promise.all(
              definition.getChartOptions().map((option) => this.captureChartImage(option)),
            )
          : undefined;

      const resolved: ResolvedFeatureExport = {
        featureId: definition.featureId,
        title: this.i18n.translate(definition.titleKey),
        infobox: this.i18n.translate(definition.infoboxKey),
        columns: definition.columns.map((column) => ({
          key: column.key,
          label: this.i18n.translate(column.labelKey),
          format: column.format,
        })),
        rows,
        chartImages,
      };

      const blob = await exportFeature(resolved, format);
      triggerDownload(blob, `${definition.featureId}.${format}`);
    } finally {
      this.exporting = false;
    }
  }
}
