import { Component, Input, computed, inject, signal } from '@angular/core';
import { SplitButtonModule } from 'primeng/splitbutton';
import type { ButtonSeverity } from 'primeng/types/button';
import {
  FeatureExportRegistry,
  exportFeature,
  type ExportFormat,
  type ResolvedFeatureExport,
} from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { IconComponent } from '../icon/icon.component';
import { ICON_NAME_MAP } from '../icon/icon-name.map';
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
  imports: [SplitButtonModule, TranslatePipe, IconComponent],
  template: `
    <p-splitbutton
      [severity]="severity"
      [model]="menuItems()"
      [disabled]="isDisabled() || exporting()"
      [tooltip]="disabledTooltip()"
      data-testid="export-control"
      (onClick)="onDefaultAction()"
    >
      <ng-template #content>
        <app-icon name="file-export" />
        <span class="p-button-label">{{ 'export.buttonLabel' | translate }}</span>
      </ng-template>
    </p-splitbutton>
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

  protected readonly exporting = signal(false);

  protected readonly isDisabled = computed(() => {
    const definition = this.registry.getById(this.featureId);
    return definition?.isEnabled ? !definition.isEnabled() : false;
  });

  protected readonly disabledTooltip = computed(() => {
    if (!this.isDisabled()) return undefined;
    const definition = this.registry.getById(this.featureId);
    return definition?.disabledTooltipKey
      ? this.i18n.translate(definition.disabledTooltipKey)
      : undefined;
  });

  protected readonly menuItems = computed(() =>
    FORMAT_MENU.map((entry) => {
      const glyph = ICON_NAME_MAP[entry.icon] ?? '';
      return {
        // PrimeNG menu items use CSS-class-based icons, incompatible with Material Symbols
        // ligatures — embed the glyph as inline HTML with escape:false instead.
        label: `<span style="display:inline-flex;align-items:center;gap:6px"><span class="material-symbols-outlined" style="font-size:1rem;line-height:1">${glyph}</span>${this.i18n.translate(entry.labelKey)}</span>`,
        escape: false,
        title: this.i18n.translate(entry.descriptionKey),
        command: () => this.export(entry.format),
      };
    }),
  );

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

    this.exporting.set(true);
    try {
      const rows = await definition.fetchData();
      const chartImages =
        format === 'pdf' && definition.getChartOptions
          ? await Promise.all(
              definition.getChartOptions().map((option) => this.captureChartImage(option)),
            )
          : undefined;

      const title = this.i18n.translate(definition.titleKey);
      const lang = this.i18n.language();
      const subtitleDate = new Intl.DateTimeFormat(lang).format(new Date());
      const resolved: ResolvedFeatureExport = {
        featureId: definition.featureId,
        title,
        infobox: this.i18n.translate(definition.infoboxKey),
        columns: definition.columns.map((column) => ({
          key: column.key,
          label: this.i18n.translate(column.labelKey),
          format: column.format,
        })),
        rows,
        chartImages,
        locale: lang,
        subtitle: `${this.i18n.translate('export.subtitlePrefix')} ${subtitleDate}`,
        footer: this.i18n.translate('export.footerText'),
      };

      const safeTitle = title.replace(/[/\\:*?"<>|]/g, '_');
      const blob = await exportFeature(resolved, format);
      triggerDownload(blob, `${safeTitle}.${format}`);
    } finally {
      this.exporting.set(false);
    }
  }
}
