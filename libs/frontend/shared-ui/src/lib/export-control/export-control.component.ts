import { Component, ElementRef, Input, ViewChild, computed, inject, signal } from '@angular/core';
import { TooltipModule } from 'primeng/tooltip';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { IconComponent } from '../icon/icon.component';
import { ExportDialogComponent } from './export-dialog.component';
import { FEATURE_EXPORT_REGISTRY } from './feature-export-registry.token';

/**
 * The single reusable export entry point (contracts/export-lib.md's `<app-export-control>`)
 * every data-holding feature mounts next to its own "Add" action (FR-001, FR-008/FR-009): a text
 * link that opens the export dialog with one card per format. Carries no per-feature knowledge
 * itself — it looks its `FeatureExportDefinition` up from the app-wide `FeatureExportRegistry`
 * by `featureId`.
 *
 * Inline template/styles, not templateUrl/styleUrl (per the existing `IconComponent`/
 * `EchartComponent` convention in this same library): every consumer of this component lives
 * outside `@vaultfolio/frontend-shared-ui`, and `@angular/build:unit-test` externalizes
 * workspace-linked packages during its build step, leaving templateUrl/styleUrl unresolved at
 * test runtime for any cross-package consumer's spec.
 */
@Component({
  selector: 'app-export-control',
  imports: [TooltipModule, TranslatePipe, IconComponent, ExportDialogComponent],
  template: `
    <span class="wrapper" [pTooltip]="disabledTooltip()" tooltipPosition="bottom">
      <button
        type="button"
        class="link"
        #openLink
        data-testid="export-open-link"
        [disabled]="isDisabled()"
        (click)="open()"
      >
        <app-icon name="file-export" />
        <span class="link__label">{{ 'export.link' | translate }}</span>
      </button>
    </span>
    <app-export-dialog
      [featureId]="featureId"
      [visible]="dialogVisible()"
      (visibleChange)="onVisibleChange($event)"
    />
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
    }
    .wrapper {
      display: inline-flex;
      align-items: center;
    }
    .link {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0;
      line-height: 1;
      border: 0;
      background: none;
      font: inherit;
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--p-primary-color);
      cursor: pointer;
    }
    .link:hover:not(:disabled) .link__label {
      text-decoration: underline;
    }
    .link:focus-visible {
      outline: 2px solid var(--p-primary-color);
      outline-offset: 2px;
      border-radius: 0.25rem;
    }
    .link:disabled {
      color: var(--p-text-muted-color);
      cursor: not-allowed;
    }
  `,
})
export class ExportControlComponent {
  /** Matches the registered `FeatureExportDefinition.featureId` this control exports. */
  @Input({ required: true }) featureId!: string;

  @ViewChild('openLink') private readonly openLink?: ElementRef<HTMLButtonElement>;

  private readonly registry = inject(FEATURE_EXPORT_REGISTRY);
  private readonly i18n = inject(I18nService);

  protected readonly dialogVisible = signal(false);

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

  protected onVisibleChange(visible: boolean): void {
    this.dialogVisible.set(visible);
    // The dialog is dismissed through its own close button or the mask; hand focus back to the
    // link that opened it (WCAG 2.4.3).
    if (!visible) this.openLink?.nativeElement.focus();
  }

  protected open(): void {
    if (!this.isDisabled()) this.dialogVisible.set(true);
  }
}
