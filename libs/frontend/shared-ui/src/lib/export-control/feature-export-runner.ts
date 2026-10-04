import { Injectable, InjectionToken, inject } from '@angular/core';
import {
  exportFeature,
  exportFileName,
  type ExportFormat,
  type ResolvedFeatureExport,
} from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { CHART_IMAGE_CAPTURE } from './chart-image-capture';
import { PDF_LOGO } from './pdf-logo';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';

/** Seam for the file generation, so specs can observe what the runner hands to the exporter. */
export const EXPORT_FEATURE = new InjectionToken<typeof exportFeature>('EXPORT_FEATURE', {
  providedIn: 'root',
  factory: () => exportFeature,
});

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Runs one feature export end to end: fetches the data of the registered `FeatureExportDefinition`,
 * resolves its translations, generates the file and downloads it. Stateless per call and
 * root-provided, so several formats can run at once and a run survives its dialog being closed.
 */
@Injectable({ providedIn: 'root' })
export class FeatureExportRunner {
  private readonly registry = inject(FEATURE_EXPORT_REGISTRY);
  private readonly i18n = inject(I18nService);
  private readonly captureChartImage = inject(CHART_IMAGE_CAPTURE);
  private readonly generate = inject(EXPORT_FEATURE);
  private readonly loadLogo = inject(PDF_LOGO);

  /** Resolves with the downloaded file name; rejects when the export fails. */
  async run(featureId: string, format: ExportFormat): Promise<string> {
    const definition = this.registry.getById(featureId);
    if (!definition) {
      throw new Error(`No export definition registered for "${featureId}"`);
    }

    // The PDF of a definition with sections shows those instead of the generic table; they are
    // awaited first because the definition may derive its chart data from the same fetch.
    const pdfSections =
      format === 'pdf' && definition.getPdfSections ? await definition.getPdfSections() : undefined;
    // JSON/CSV/Excel of a definition with tables serialize those instead of the generic rows.
    const tables =
      format !== 'pdf' && definition.getExportTables
        ? await definition.getExportTables()
        : undefined;
    const rows = pdfSections || tables ? [] : await definition.fetchData();
    const chartImages =
      format === 'pdf' && definition.getChartOptions
        ? await Promise.all(
            definition
              .getChartOptions()
              .map((option) => this.captureChartImage(option, definition.pdfChartSize)),
          )
        : undefined;

    const chartSideTable =
      format === 'pdf' && definition.getChartSideTable ? definition.getChartSideTable() : undefined;

    const logo = await this.logoFor(format);
    const title = this.i18n.translate(definition.titleKey);
    const lang = this.i18n.language();
    const subtitleDate = new Intl.DateTimeFormat(lang, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date());
    const resolved: ResolvedFeatureExport = {
      featureId: definition.featureId,
      title,
      infobox: this.i18n.translate(
        format === 'pdf' && definition.pdfInfoboxKey
          ? definition.pdfInfoboxKey
          : definition.infoboxKey,
      ),
      columns: definition.columns.map((column) => ({
        key: column.key,
        label: this.i18n.translate(column.labelKey),
        format: column.format,
        summable: column.summable,
      })),
      rows,
      ...(pdfSections ? { pdfSections } : {}),
      ...(tables ? { tables } : {}),
      chartImages,
      chartSideTable,
      ...(logo ? { logo } : {}),
      orientation: definition.pdfOrientation, // only the PDF exporter reads it
      locale: lang,
      subtitle: `${this.i18n.translate('export.subtitlePrefix')} ${subtitleDate}`,
      footer: this.i18n.translate('export.footerText'),
    };

    const blob = await this.generate(resolved, format);
    const fileName = exportFileName(title, format, Boolean(tables));
    triggerDownload(blob, fileName);
    return fileName;
  }

  private logoFor(format: ExportFormat): Promise<string | undefined> {
    return format === 'pdf' ? this.loadLogo() : Promise.resolve(undefined);
  }
}
