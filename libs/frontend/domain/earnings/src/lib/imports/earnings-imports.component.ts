import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { EarningsEmployer, EarningsImportSummary } from '@vaultfolio/api-contract';
import { ConfirmationService, MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EarningsFilterStore } from '../earnings-area/earnings-filter.store';
import { EarningsService } from '../earnings.service';
import { fill, formatDate, formatMonth } from '../earnings-format';
import { PrivacyInfoComponent } from '../privacy-note/privacy-info.component';

/**
 * Imports tab (design.md "Imports tab"): privacy teaser opening the note as a modal (FR-035/FR-042), import
 * history with delete (FR-021, FR-037), employer display names (FR-020 — figures are never
 * editable) and the danger zone to delete all earnings data (FR-038). The history is grouped by
 * the year its data belongs to — all years collapsed until opened — so it stays short.
 */
@Component({
  selector: 'app-earnings-imports',
  imports: [
    FormsModule,
    ButtonModule,
    ConfirmDialogModule,
    InputTextModule,
    MessageModule,
    TableModule,
    TagModule,
    ToastModule,
    IconComponent,
    TranslatePipe,
    PrivacyInfoComponent,
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

    <app-earnings-privacy-info />

    <section class="panel">
      <div class="panel__head">
        <h2>{{ 'earnings.imports.title' | translate }}</h2>
        @if (years().length > 1) {
          <button
            pButton
            type="button"
            text
            size="small"
            data-testid="earnings-imports-toggle-all"
            (click)="toggleAll()"
          >
            <app-icon [name]="allOpen() ? 'chevron-down' : 'chevron-right'" />
            {{
              (allOpen() ? 'earnings.imports.collapseAll' : 'earnings.imports.expandAll')
                | translate
            }}
          </button>
        }
      </div>
      <p class="muted">{{ 'earnings.imports.sub' | translate }}</p>
      <div class="scroll">
        <p-table
          [value]="rows()"
          [loading]="loading()"
          rowGroupMode="subheader"
          groupRowsBy="year"
          [groupRowsByOrder]="-1"
          [tableStyle]="{ 'min-width': '52rem' }"
        >
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
          <ng-template #groupheader let-item>
            <tr class="group">
              <td colspan="7">
                <button
                  type="button"
                  class="group__toggle"
                  [attr.aria-expanded]="isOpen(item.year)"
                  [attr.data-testid]="'earnings-imports-year-' + item.year"
                  (click)="toggle(item.year)"
                >
                  <app-icon [name]="isOpen(item.year) ? 'chevron-down' : 'chevron-right'" />
                  <strong>{{ item.year }}</strong>
                  <span class="muted">{{ countLabel(item.year) }}</span>
                </button>
              </td>
            </tr>
          </ng-template>
          <ng-template #body let-item>
            @if (isOpen(item.year)) {
              <tr [attr.data-testid]="'earnings-imports-row-' + item.id">
                <td class="file">
                  {{ item.fileName }}
                  @if (item.correctedCount > 0) {
                    <p-tag
                      severity="success"
                      [value]="correctedLabel(item.correctedCount)"
                      data-testid="earnings-history-corrected"
                    />
                  }
                </td>
                <td>
                  {{ 'earnings.sourceType.' + item.sourceType | translate }}
                  @if (item.recognisedText) {
                    <p-tag
                      severity="warn"
                      [value]="'earnings.ocr.badge' | translate"
                      data-testid="ocr-badge"
                    />
                  }
                </td>
                <td>{{ periodsOf(item) }}</td>
                <td>{{ countOf(item) }}</td>
                <td>
                  {{ 'earnings.format.' + item.parserId | translate }} {{ item.parserVersion }}
                </td>
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
            }
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
              [attr.maxlength]="maxName"
              [attr.aria-label]="'earnings.imports.displayName' | translate"
              [placeholder]="employer.detectedName"
              [attr.data-testid]="'earnings-employer-name-' + employer.id"
              [(ngModel)]="names[employer.id]"
            />
            <button
              pButton
              type="button"
              outlined
              [disabled]="isUnchanged(employer) || isTooLong(employer)"
              [attr.data-testid]="'earnings-employer-save-' + employer.id"
              (click)="rename(employer)"
            >
              <app-icon name="save" /> {{ 'common.save' | translate }}
            </button>
            @if (isTooLong(employer)) {
              <p-message
                class="employer__warning"
                severity="error"
                [attr.data-testid]="'earnings-employer-toolong-' + employer.id"
              >
                {{ tooLongText(employer) }}
              </p-message>
            }
            @if (isLong(employer)) {
              <p-message
                class="employer__warning"
                severity="warn"
                [attr.data-testid]="'earnings-employer-long-' + employer.id"
              >
                {{ longNameText(employer) }}
              </p-message>
            }
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
      max-width: 1100px;
      margin: 0 auto;
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .panel__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .group__toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      width: 100%;
      padding: 0;
      border: 0;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .group td {
      background: var(--p-content-hover-background);
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
      min-width: 12rem;
      overflow-wrap: anywhere;
    }
    .employer {
      display: grid;
      /* Capped name column keeps the input close to the name; the input takes the rest of the row. */
      grid-template-columns: minmax(0, 26rem) minmax(10rem, 1fr) auto;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-top: 1px solid var(--p-content-border-color);
    }
    .employer__detected {
      display: flex;
      flex-direction: column;
      /* Limited width: a long name wraps instead of pushing the input and Save to the right. */
      max-width: 26rem;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .employer__warning {
      grid-column: 1 / -1;
      /* Its text must not size the grid tracks, or input and Save get stretched in warned rows. */
      contain: inline-size;
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
export class EarningsImportsComponent implements OnInit {
  private readonly api = inject(EarningsService);
  private readonly filter = inject(EarningsFilterStore, { optional: true });
  private readonly i18n = inject(I18nService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly messages = inject(MessageService);

  protected readonly imports = signal<EarningsImportSummary[]>([]);
  /** Imports with the year they are grouped under; within a year newest period, then newest import first. */
  protected readonly rows = computed(() =>
    this.imports()
      .map((item) => ({ ...item, year: yearOf(item) }))
      .sort(
        (a, b) =>
          periodKey(b).localeCompare(periodKey(a)) || b.importedAt.localeCompare(a.importedAt),
      ),
  );
  protected readonly years = computed(() =>
    [...new Set(this.rows().map((r) => r.year))].sort((a, b) => b - a),
  );
  /** Years the user opened; none until then. */
  private readonly shownYears = signal<ReadonlySet<number>>(new Set());
  protected readonly allOpen = computed(() =>
    this.years().every((year) => this.shownYears().has(year)),
  );
  protected readonly employers = signal<EarningsEmployer[]>([]);
  protected readonly loading = signal(true);
  protected readonly maxName = MAX_EMPLOYER_NAME;
  protected names: Record<string, string> = {};

  ngOnInit(): void {
    this.load();
  }

  protected isOpen(year: number): boolean {
    return this.shownYears().has(year);
  }

  protected toggle(year: number): void {
    const open = new Set(this.shownYears());
    if (!open.delete(year)) open.add(year);
    this.shownYears.set(open);
  }

  protected toggleAll(): void {
    this.shownYears.set(new Set(this.allOpen() ? [] : this.years()));
  }

  protected countLabel(year: number): string {
    const count = this.rows().filter((r) => r.year === year).length;
    return count === 1
      ? this.i18n.translate('earnings.imports.countOne')
      : fill(this.i18n.translate('earnings.imports.count'), { count });
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

  protected correctedLabel(count: number): string {
    return count === 1
      ? this.i18n.translate('earnings.imports.correctedTagOne')
      : fill(this.i18n.translate('earnings.imports.correctedTag'), { count });
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

  /** Judged by the name shown across Earnings: the saved display name, else the detected one. */
  protected isLong(employer: EarningsEmployer): boolean {
    return (employer.displayName ?? employer.detectedName).length > LONG_EMPLOYER_NAME;
  }

  protected longNameText(employer: EarningsEmployer): string {
    return fill(this.i18n.translate('earnings.imports.longName'), {
      count: (employer.displayName ?? employer.detectedName).length,
    });
  }

  /** The name shown across Earnings: the saved display name, else the detected one. */
  private shownName(employer: EarningsEmployer): string {
    return employer.displayName ?? employer.detectedName;
  }

  /** An empty field means "use the detected name", so it counts as that name. */
  private targetName(employer: EarningsEmployer): string {
    return (this.names[employer.id] ?? '').trim().replace(/\s+/g, ' ') || employer.detectedName;
  }

  protected isTooLong(employer: EarningsEmployer): boolean {
    return this.targetName(employer).length > MAX_EMPLOYER_NAME;
  }

  protected tooLongText(employer: EarningsEmployer): string {
    const count = this.targetName(employer).length;
    return fill(this.i18n.translate('earnings.imports.nameTooLong'), {
      count,
      max: MAX_EMPLOYER_NAME,
      over: count - MAX_EMPLOYER_NAME,
    });
  }

  protected isUnchanged(employer: EarningsEmployer): boolean {
    return this.targetName(employer) === this.shownName(employer);
  }

  protected rename(employer: EarningsEmployer): void {
    if (this.isUnchanged(employer)) return;
    const target = this.targetName(employer);
    // Saving the detected name clears the override instead of storing a copy of it.
    this.api.renameEmployer(employer.id, target === employer.detectedName ? '' : target).subscribe({
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
        this.names = Object.fromEntries(employers.map((e) => [e.id, this.shownName(e)]));
      },
    });
  }
}

/** The longest display name the backend accepts. */
const MAX_EMPLOYER_NAME = 120;

/** Names longer than this get a warning: they wrap over several lines in tables and the PDF. */
const LONG_EMPLOYER_NAME = 50;

/** The year an import is grouped under: its latest period or certificate year, else its import date. */
function yearOf(item: EarningsImportSummary): number {
  if (item.lastPeriod) return Number(item.lastPeriod.slice(0, 4));
  if (item.years.length > 0) return Math.max(...item.years);
  return Number(item.importedAt.slice(0, 4));
}

/** Sort key within a year: the latest period; a certificate covers its whole year, so it sorts as December. */
function periodKey(item: EarningsImportSummary & { year: number }): string {
  return item.lastPeriod ?? `${item.year}-12`;
}
