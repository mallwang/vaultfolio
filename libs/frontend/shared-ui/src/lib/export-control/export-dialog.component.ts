import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { exportFileName, type ExportFormat } from '@vaultfolio/export';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { IconComponent } from '../icon/icon.component';
import { EXPORT_FORMAT_CATALOG } from './export-format-catalog';
import { ExportFormatPreviewComponent } from './export-format-preview.component';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';
import { FeatureExportRunner } from './feature-export-runner';

/**
 * Modal with one card per export format: what the file looks like, its real file name, what it
 * contains and what it suits. Each card exports on its own; the dialog stays open so several
 * formats can be downloaded in one visit.
 *
 * Inline template/styles, like `ExportControlComponent` (see there for why).
 */
@Component({
  selector: 'app-export-dialog',
  imports: [DialogModule, ButtonModule, TranslatePipe, IconComponent, ExportFormatPreviewComponent],
  template: `
    <p-dialog
      [header]="'export.dialog.title' | translate"
      [modal]="true"
      [dismissableMask]="true"
      [draggable]="false"
      [visible]="visibleSignal()"
      [style]="{ width: '64rem' }"
      [breakpoints]="{ '1200px': '92vw' }"
      [pt]="{
        root: { 'data-testid': 'export-dialog' },
        pcCloseButton: { root: { 'data-testid': 'export-dialog-close' } },
      }"
      (visibleChange)="onVisibleChange($event)"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      <div class="dialog-body">
        <p class="hint">{{ featureTitle() }} · {{ 'export.dialog.hint' | translate }}</p>
        @if (errorFormat(); as failed) {
          <div class="error" role="alert" data-testid="export-dialog-error">
            {{ errorText(failed) }}
          </div>
        }
        <div class="cards">
          @for (card of cards(); track card.format) {
            <section class="card" [attr.data-testid]="'export-card-' + card.format">
              <div class="card__top">
                <app-export-format-preview [format]="card.format" />
                <div>
                  <h3 class="card__name">
                    <app-icon [name]="card.icon" />{{ card.nameKey | translate }}
                  </h3>
                  <p class="card__intro">{{ card.introKey | translate }}</p>
                </div>
              </div>
              <dl class="card__facts">
                <dt>{{ 'export.dialog.label.file' | translate }}</dt>
                <dd class="card__file" [attr.data-testid]="'export-filename-' + card.format">
                  {{ card.fileName }}
                </dd>
                <dt>{{ 'export.dialog.label.type' | translate }}</dt>
                <dd>{{ card.typeText }}</dd>
                <dt>{{ 'export.dialog.label.data' | translate }}</dt>
                <dd>{{ card.dataText }}</dd>
                <dt>{{ 'export.dialog.label.goodFor' | translate }}</dt>
                <dd class="card__good">{{ card.goodForKey | translate }}</dd>
                <dt>{{ 'export.dialog.label.lessSuited' | translate }}</dt>
                <dd class="card__less">{{ card.lessSuitedKey | translate }}</dd>
              </dl>
              <p-button
                styleClass="card__button"
                [fluid]="true"
                [label]="(card.busy ? 'export.dialog.creating' : card.buttonKey) | translate"
                [loading]="card.busy"
                [disabled]="card.busy"
                [attr.aria-busy]="card.busy"
                [attr.data-testid]="'export-btn-' + card.format"
                (onClick)="export(card.format)"
              />
            </section>
          }
        </div>
      </div>
    </p-dialog>
  `,
  styles: `
    .dialog-body {
      font-size: 0.875rem;
    }
    .hint {
      margin: 0 0 0.75rem;
      color: var(--p-text-muted-color);
    }
    .error {
      margin-bottom: 1rem;
      padding: 0.75rem 1rem;
      border-radius: 0.375rem;
      border: 1px solid var(--p-red-500);
      color: var(--p-red-500);
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }
    @media (max-width: 640px) {
      .cards {
        grid-template-columns: minmax(0, 1fr);
      }
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 0.5rem;
    }
    .card__top {
      display: grid;
      grid-template-columns: 2fr 3fr;
      gap: 1rem;
      align-items: start;
    }
    .card__name {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      margin: 0;
      font-size: 1rem;
    }
    .card__intro {
      margin: 0.25rem 0 0;
      color: var(--p-text-muted-color);
    }
    .card__facts {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 0.25rem 0.75rem;
      margin: 0 0 0.75rem;
      flex: 1;
    }
    .card__facts dt {
      color: var(--p-text-muted-color);
    }
    .card__facts dd {
      margin: 0;
    }
    .card__file {
      word-break: break-all;
    }
    .card__good::before {
      content: '✓ ';
      color: var(--p-green-500);
    }
    .card__less::before {
      content: '✕ ';
      color: var(--p-orange-500);
    }
  `,
})
export class ExportDialogComponent {
  // Decorator inputs rather than `input()`/`model()`: cross-package consumer specs run this
  // library without the Angular compiler's signal-input transform (see `ExportControlComponent`).
  @Input({ required: true }) set featureId(value: string) {
    this.featureIdSignal.set(value);
  }
  @Input() set visible(value: boolean) {
    this.visibleSignal.set(value);
  }
  @Output() readonly visibleChange = new EventEmitter<boolean>();

  private readonly featureIdSignal = signal('');
  protected readonly visibleSignal = signal(false);

  private readonly registry = inject(FEATURE_EXPORT_REGISTRY);
  private readonly i18n = inject(I18nService);
  private readonly runner = inject(FeatureExportRunner);
  private readonly messages = inject(MessageService, { optional: true });

  protected readonly busyFormats = signal<ReadonlySet<ExportFormat>>(new Set());
  protected readonly errorFormat = signal<ExportFormat | null>(null);

  private readonly definition = computed(() => this.registry.getById(this.featureIdSignal()));

  protected readonly featureTitle = computed(() => {
    const definition = this.definition();
    return definition ? this.i18n.translate(definition.titleKey) : '';
  });

  protected readonly cards = computed(() => {
    const definition = this.definition();
    const hasTables = Boolean(definition?.getExportTables);
    // Reading the language makes the card texts follow a language switch.
    this.i18n.language();
    return EXPORT_FORMAT_CATALOG.map((entry) => {
      const typeKey =
        entry.format === 'csv' && hasTables ? 'export.dialog.csv.typeZip' : entry.typeKey;
      return {
        ...entry,
        fileName: exportFileName(this.featureTitle(), entry.format, hasTables),
        typeText: this.i18n.translate(typeKey),
        dataText: this.i18n.translate(definition?.formatDataKeys?.[entry.format] ?? entry.dataKey),
        busy: this.busyFormats().has(entry.format),
      };
    });
  });

  protected onVisibleChange(visible: boolean): void {
    this.visibleSignal.set(visible);
    this.visibleChange.emit(visible);
    if (visible) this.errorFormat.set(null);
  }

  protected errorText(format: ExportFormat): string {
    return this.failureText('export.dialog.error', format);
  }

  protected async export(format: ExportFormat): Promise<void> {
    if (this.busyFormats().has(format)) return;
    this.errorFormat.set(null);
    this.busyFormats.update((set) => new Set(set).add(format));
    try {
      await this.runner.run(this.featureIdSignal(), format);
    } catch {
      if (this.visibleSignal()) {
        this.errorFormat.set(format);
      } else {
        this.messages?.add({
          severity: 'error',
          summary: this.failureText('export.dialog.errorToast', format),
        });
      }
    } finally {
      this.busyFormats.update((set) => {
        const next = new Set(set);
        next.delete(format);
        return next;
      });
    }
  }

  private failureText(key: string, format: ExportFormat): string {
    const name = this.i18n.translate(`export.dialog.${format}.name`);
    return this.i18n.translate(key).replace('{{format}}', name);
  }
}
