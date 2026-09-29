import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import type { EarningsEmployer, EarningsImportSummary } from '@vaultfolio/api-contract';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { EarningsService } from '../earnings.service';
import { fill, formatDate, formatMonth } from '../earnings-format';
import { PrivacyNoteComponent } from '../privacy-note/privacy-note.component';

/**
 * Imports tab (design.md "Imports tab"): privacy note (anchor `#privacy`, FR-035/FR-042), import
 * history with delete (FR-021, FR-037), employer display names (FR-020 — figures are never
 * editable) and the danger zone to delete all earnings data (FR-038).
 */
@Component({
  selector: 'app-earnings-imports',
  imports: [
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    InputTextModule,
    TableModule,
    ToastModule,
    IconComponent,
    TranslatePipe,
    PrivacyNoteComponent,
  ],
  providers: [ConfirmationService, MessageService],
  template: `
    <p-toast />
    <p-confirmdialog
      [pt]="{
        pcAcceptButton: { root: { 'data-testid': 'earnings-confirm-accept' } },
        pcRejectButton: { root: { 'data-testid': 'earnings-confirm-reject' } },
      }"
    >
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>

    <app-earnings-privacy-note id="privacy" />

    <section class="panel">
      <h2>{{ 'earnings.imports.title' | translate }}</h2>
      <p class="muted">{{ 'earnings.imports.sub' | translate }}</p>
      <div class="scroll">
        <p-table [value]="imports()" [loading]="loading()" [tableStyle]="{ 'min-width': '52rem' }">
          <ng-template #header>
            <tr>
              <th scope="col">{{ 'earnings.imports.file' | translate }}</th>
              <th scope="col">{{ 'earnings.imports.type' | translate }}</th>
              <th scope="col">{{ 'earnings.imports.periods' | translate }}</th>
              <th scope="col">{{ 'earnings.imports.records' | translate }}</th>
              <th scope="col">{{ 'earnings.imports.parser' | translate }}</th>
              <th scope="col">{{ 'earnings.imports.importedOn' | translate }}</th>
              <th scope="col">
                <span class="sr-only">{{ 'earnings.imports.deleteImport' | translate }}</span>
              </th>
            </tr>
          </ng-template>
          <ng-template #body let-item>
            <tr [attr.data-testid]="'earnings-imports-row-' + item.id">
              <td class="file">{{ item.fileName }}</td>
              <td>{{ 'earnings.sourceType.' + item.sourceType | translate }}</td>
              <td>{{ periodsOf(item) }}</td>
              <td>{{ countOf(item) }}</td>
              <td>{{ 'earnings.format.' + item.parserId | translate }} {{ item.parserVersion }}</td>
              <td>{{ dateOf(item.importedAt) }}</td>
              <td>
                <button
                  pButton
                  type="button"
                  text
                  severity="danger"
                  [attr.aria-label]="'earnings.imports.deleteImport' | translate"
                  [attr.data-testid]="'earnings-import-delete-' + item.id"
                  (click)="confirmDelete(item)"
                >
                  <app-icon name="trash" />
                </button>
              </td>
            </tr>
          </ng-template>
          <ng-template #emptymessage>
            <tr>
              <td colspan="7" class="muted">{{ 'earnings.imports.none' | translate }}</td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </section>

    @if (employers().length > 0) {
      <section class="panel">
        <h2>{{ 'earnings.imports.employerNames' | translate }}</h2>
        <p class="muted">{{ 'earnings.imports.employerNamesSub' | translate }}</p>
        @for (employer of employers(); track employer.id) {
          <div class="employer" [attr.data-testid]="'earnings-employer-row-' + employer.id">
            <div class="employer__detected">
              <span class="muted">{{ 'earnings.imports.detectedAs' | translate }}</span>
              <strong>{{ employer.detectedName }}</strong>
            </div>
            <input
              pInputText
              type="text"
              maxlength="100"
              [attr.aria-label]="'earnings.imports.displayName' | translate"
              [placeholder]="employer.detectedName"
              [attr.data-testid]="'earnings-employer-name-' + employer.id"
              [(ngModel)]="names[employer.id]"
            />
            <button
              pButton
              type="button"
              outlined
              [attr.data-testid]="'earnings-employer-save-' + employer.id"
              (click)="rename(employer)"
            >
              <app-icon name="save" /> {{ 'common.save' | translate }}
            </button>
          </div>
        }
      </section>
    }

    <section class="panel danger" data-testid="earnings-danger-zone">
      <h2>{{ 'earnings.imports.dangerTitle' | translate }}</h2>
      <p class="muted">{{ 'earnings.imports.dangerSub' | translate }}</p>
      <button
        pButton
        type="button"
        severity="danger"
        data-testid="earnings-delete-all"
        (click)="confirmDeleteAll()"
      >
        <app-icon name="trash" /> {{ 'earnings.imports.deleteAll' | translate }}
      </button>
    </section>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
      font-size: 0.875rem;
    }
    .scroll {
      overflow-x: auto;
    }
    .file {
      overflow-wrap: anywhere;
    }
    .employer {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(10rem, 16rem) auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-top: 1px solid var(--p-content-border-color);
    }
    .employer__detected {
      display: flex;
      flex-direction: column;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .danger {
      align-items: flex-start;
      padding: 1rem;
      border: 1px solid var(--p-red-400);
      border-radius: var(--p-content-border-radius);
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
    @media (max-width: 640px) {
      .employer {
        grid-template-columns: 1fr auto;
      }
      .employer__detected {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class EarningsImportsComponent implements OnInit, AfterViewInit {
  private readonly api = inject(EarningsService);
  private readonly filter = inject(EarningsFilterStore, { optional: true });
  private readonly i18n = inject(I18nService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly imports = signal<EarningsImportSummary[]>([]);
  protected readonly employers = signal<EarningsEmployer[]>([]);
  protected readonly loading = signal(true);
  protected names: Record<string, string> = {};

  ngOnInit(): void {
    this.load();
  }

  ngAfterViewInit(): void {
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((fragment) => {
      if (fragment === 'privacy') {
        (this.host.nativeElement as HTMLElement)
          .querySelector('#privacy')
          ?.scrollIntoView?.({ block: 'start' });
      }
    });
  }

  protected periodsOf(item: EarningsImportSummary): string {
    const lang = this.i18n.language();
    if (item.firstPeriod && item.lastPeriod) {
      const first = formatMonth(item.firstPeriod, lang);
      const last = formatMonth(item.lastPeriod, lang);
      return first === last ? first : `${first} – ${last}`;
    }
    return item.years.join(', ') || '–';
  }

  protected countOf(item: EarningsImportSummary): string {
    this.i18n.language();
    // A companion-tool export can carry monthly records and certificates at once — show both.
    const parts: string[] = [];
    if (item.recordCount > 0) parts.push(String(item.recordCount));
    if (item.certificateCount === 1)
      parts.push(this.i18n.translate('earnings.imports.certificatesOne'));
    if (item.certificateCount > 1) {
      parts.push(
        fill(this.i18n.translate('earnings.imports.certificates'), {
          count: item.certificateCount,
        }),
      );
    }
    return parts.length > 0 ? parts.join(' · ') : this.i18n.translate('earnings.imports.replaced');
  }

  protected dateOf(iso: string): string {
    return formatDate(iso, this.i18n.language());
  }

  protected confirmDelete(item: EarningsImportSummary): void {
    this.confirmation.confirm({
      header: this.i18n.translate('earnings.imports.deleteHeader'),
      message: fill(this.i18n.translate('earnings.imports.deleteMessage'), { file: item.fileName }),
      acceptLabel: this.i18n.translate('earnings.imports.delete'),
      rejectLabel: this.i18n.translate('earnings.import.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.api.deleteImport(item.id).subscribe({
          next: () => this.changed('earnings.imports.deleted'),
          error: () => this.failed(),
        }),
    });
  }

  protected confirmDeleteAll(): void {
    this.confirmation.confirm({
      header: this.i18n.translate('earnings.imports.deleteAllHeader'),
      message: this.i18n.translate('earnings.imports.deleteAllMessage'),
      acceptLabel: this.i18n.translate('earnings.imports.deleteAll'),
      rejectLabel: this.i18n.translate('earnings.import.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () =>
        this.api.deleteAll().subscribe({
          next: () => this.changed('earnings.imports.deletedAll'),
          error: () => this.failed(),
        }),
    });
  }

  protected rename(employer: EarningsEmployer): void {
    this.api.renameEmployer(employer.id, this.names[employer.id] ?? '').subscribe({
      next: () => this.changed('earnings.imports.renamed'),
      error: () => this.failed(),
    });
  }

  private changed(summaryKey: string): void {
    this.messages.add({ severity: 'success', summary: this.i18n.translate(summaryKey) });
    this.load();
    this.filter?.reload();
  }

  private failed(): void {
    this.messages.add({
      severity: 'error',
      summary: this.i18n.translate('earnings.errors.generic'),
    });
  }

  private load(): void {
    this.api.imports().subscribe({
      next: (imports) => {
        this.imports.set(imports);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.api.employers().subscribe({
      next: (employers) => {
        this.employers.set(employers);
        this.names = Object.fromEntries(employers.map((e) => [e.id, e.displayName ?? '']));
      },
    });
  }
}
