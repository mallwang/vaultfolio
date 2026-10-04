import {
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AutoCompleteModule, type AutoCompleteCompleteEvent } from 'primeng/autocomplete';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import type { WealthSnapshot } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import {
  type BalanceGroup,
  type ClassRef,
  type Side,
  type StandardClassId,
  type ValidationIssue,
  type WealthEntry,
  classKey,
  copyTemplateOf,
  groupsOf,
  matchStandardByLabel,
  normalizeMoney,
  suggestionsOf,
  totalsOf,
  validateSnapshotInput,
} from '@vaultfolio/wealth';
import { fill, formatDate, formatMoney, parseAmountInput } from '../wealth-format';
import { WealthStore } from '../wealth-store';
import { WealthService, wealthErrorOf } from '../wealth.service';

interface Row {
  key: number;
  side: Side;
  name: string;
  /** What the user sees in the class field (translated label for a standard class). */
  classText: string;
  /** `classText` as of the last blur; drives the one-time group prompt. */
  classCommitted: string;
  amount: string;
}

const AREA_PATH = '/app/historic-wealth-development';
const COPY_PARAM = 'copyFrom';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Snapshot form (design.md "Stichtag erfassen", FR-001–FR-007, FR-017, FR-022, FR-025): date,
 * copy-from-existing, note, and one panel per side with Name / Klasse / Betrag rows. Amounts are
 * typed in the user's notation and always positive — the panel decides the side. The class is free
 * text with suggestions; a label equal to a translated standard class is stored as that standard
 * id. The same whitelist validation the server runs is executed first, so mistakes show inline
 * before anything is sent.
 *
 * Inline template/styles: consumed cross-package as a lazily loaded route target (see
 * `IconComponent`'s note in `@vaultfolio/frontend-shared-ui`).
 */
@Component({
  selector: 'app-wealth-snapshot-form',
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    FormsModule,
    RouterLink,
    AutoCompleteModule,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    IconComponent,
    TranslatePipe,
  ],
  template: `
    <a class="back" [routerLink]="areaPath" data-testid="wealth-form-back">
      <app-icon name="chevron-left" /> {{ 'wealth.form.back' | translate }}
    </a>
    <h1 class="title" data-testid="wealth-form-title">
      {{ (mode() === 'create' ? 'wealth.form.titleNew' : 'wealth.form.titleEdit') | translate }}
    </h1>

    @if (loadFailed()) {
      <p-message severity="error" data-testid="wealth-form-load-error">{{
        'wealth.form.loadFailed' | translate
      }}</p-message>
    } @else {
      <div class="layout">
        <div class="panels">
          <section class="panel" data-testid="wealth-form-snapshot-panel">
            <h2>{{ 'wealth.form.snapshotPanel' | translate }}</h2>
            <div class="grid">
              <label class="field">
                <span>{{ 'wealth.form.date' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="date"
                  [ngModel]="date()"
                  (ngModelChange)="setDate($event)"
                  [max]="maxDate"
                  min="1900-01-01"
                  name="snapshotDate"
                  [attr.aria-invalid]="!!fieldError('snapshotDate')"
                  data-testid="wealth-form-date"
                />
                @if (fieldError('snapshotDate'); as message) {
                  <small class="error" data-testid="wealth-form-date-error">{{ message }}</small>
                }
              </label>
              @if (mode() === 'create') {
                <div class="copy">
                  <label class="field">
                    <span>{{ 'wealth.form.copyFrom' | translate }}</span>
                    <p-select
                      [options]="copyOptions()"
                      optionLabel="label"
                      optionValue="value"
                      [ngModel]="copySource()"
                      (ngModelChange)="copyFromSnapshot($event)"
                      [showClear]="false"
                      fluid
                      data-testid="wealth-form-copy-from"
                    />
                  </label>
                  <label class="check">
                    <p-checkbox
                      [binary]="true"
                      [ngModel]="copyAmounts()"
                      (ngModelChange)="setCopyAmounts($event)"
                      name="copyAmounts"
                      data-testid="wealth-form-copy-amounts"
                    />
                    {{ 'wealth.form.copyAmounts' | translate }}
                  </label>
                </div>
              }
              <label class="field field--wide">
                <span>{{ 'wealth.form.note' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="text"
                  maxlength="500"
                  [ngModel]="note()"
                  (ngModelChange)="note.set($event)"
                  name="note"
                  data-testid="wealth-form-note"
                />
                @if (fieldError('note'); as message) {
                  <small class="error">{{ message }}</small>
                }
              </label>
            </div>
            @if (dateTaken(); as taken) {
              <p-message severity="error" data-testid="wealth-form-date-taken">
                {{ dateTakenText() }}
                <a
                  class="inline-link"
                  [routerLink]="[areaPath, taken, 'edit']"
                  data-testid="wealth-form-open-existing"
                  >{{ 'wealth.form.openExisting' | translate }}</a
                >
              </p-message>
            }
          </section>

          @for (side of sides; track side) {
            <section class="panel" [attr.data-testid]="'wealth-form-panel-' + side.toLowerCase()">
              <h2>
                {{
                  (side === 'ASSET' ? 'wealth.form.assetsPanel' : 'wealth.form.liabilitiesPanel')
                    | translate
                }}
              </h2>
              <div class="rows" cdkDropList (cdkDropListDropped)="onDrop(side, $event)">
                <div class="row row--head" aria-hidden="true">
                  <span></span>
                  <span>{{ 'wealth.form.name' | translate }}</span>
                  <span>{{ 'wealth.form.class' | translate }}</span>
                  <span>{{ 'wealth.form.amount' | translate }}</span>
                  <span></span>
                </div>
                @for (row of rowsOf(side); track row.key; let i = $index) {
                  <div class="row" cdkDrag [attr.data-testid]="'wealth-form-row-' + row.key">
                    <button
                      type="button"
                      class="handle"
                      cdkDragHandle
                      [attr.aria-label]="'wealth.form.move' | translate"
                      [attr.data-testid]="'wealth-form-handle-' + row.key"
                      (keydown)="onHandleKeydown($event, side, i)"
                    >
                      <app-icon name="drag-handle" />
                    </button>
                    <label class="cell">
                      <span class="cell__label">{{ 'wealth.form.name' | translate }}</span>
                      <input
                        pInputText
                        fluid
                        type="text"
                        maxlength="100"
                        [ngModel]="row.name"
                        (ngModelChange)="patchRow(row.key, { name: $event })"
                        [name]="'name-' + row.key"
                        [attr.aria-invalid]="!!rowError(row.key, 'name')"
                        [attr.data-testid]="'wealth-form-name-' + row.key"
                      />
                      @if (rowError(row.key, 'name'); as message) {
                        <small class="error">{{ message }}</small>
                      }
                    </label>
                    <label class="cell">
                      <span class="cell__label">{{ 'wealth.form.class' | translate }}</span>
                      <p-autocomplete
                        [suggestions]="classSuggestions()"
                        (completeMethod)="filterClasses(side, $event)"
                        [dropdown]="true"
                        [maxlength]="50"
                        fluid
                        [ngModel]="row.classText"
                        (ngModelChange)="patchRow(row.key, { classText: $event ?? '' })"
                        (onSelect)="commitClass(row.key)"
                        (onBlur)="commitClass(row.key)"
                        [name]="'class-' + row.key"
                        [invalid]="!!rowError(row.key, 'class')"
                        [attr.data-testid]="'wealth-form-class-' + row.key"
                      />
                      @if (rowError(row.key, 'class'); as message) {
                        <small class="error">{{ message }}</small>
                      }
                    </label>
                    <label class="cell">
                      <span class="cell__label">{{ 'wealth.form.amount' | translate }}</span>
                      <input
                        pInputText
                        type="text"
                        inputmode="decimal"
                        class="amount"
                        [ngModel]="row.amount"
                        (ngModelChange)="patchRow(row.key, { amount: $event })"
                        [name]="'amount-' + row.key"
                        [attr.aria-invalid]="!!rowError(row.key, 'amount')"
                        [attr.data-testid]="'wealth-form-amount-' + row.key"
                      />
                      @if (rowError(row.key, 'amount'); as message) {
                        <small class="error">{{ message }}</small>
                      }
                    </label>
                    <button
                      type="button"
                      pButton
                      severity="secondary"
                      [text]="true"
                      class="remove"
                      [attr.aria-label]="'wealth.form.remove' | translate"
                      [attr.data-testid]="'wealth-form-remove-' + row.key"
                      (click)="removeRow(row.key)"
                    >
                      <app-icon name="close" />
                    </button>
                  </div>
                }
              </div>
              @if (side === 'ASSET' && entriesError(); as message) {
                <small class="error" data-testid="wealth-form-entries-error">{{ message }}</small>
              }
              <div class="panel__footer">
                <button
                  type="button"
                  pButton
                  [outlined]="true"
                  size="small"
                  [attr.data-testid]="'wealth-form-add-' + side.toLowerCase()"
                  (click)="addRow(side)"
                >
                  <app-icon name="plus" />
                  {{
                    (side === 'ASSET' ? 'wealth.form.addAsset' : 'wealth.form.addLiability')
                      | translate
                  }}
                </button>
                <div
                  class="suggestions"
                  role="group"
                  [attr.aria-label]="'wealth.form.suggestions' | translate"
                >
                  @for (label of suggestionLabels(side); track label) {
                    <button
                      type="button"
                      class="chip"
                      [attr.data-testid]="
                        'wealth-form-suggest-' + side.toLowerCase() + '-' + $index
                      "
                      (click)="addRow(side, label)"
                    >
                      {{ label }}
                    </button>
                  }
                </div>
              </div>
              @for (prompt of groupPrompts(side); track prompt.key) {
                <p-message
                  severity="info"
                  class="group-prompt"
                  [attr.data-testid]="'wealth-form-group-prompt-' + prompt.index"
                >
                  <div class="prompt">
                    <span>{{ groupPromptText(prompt.label) }}</span>
                    <p-select
                      [options]="groupOptions(side)"
                      optionLabel="label"
                      optionValue="value"
                      [ngModel]="promptChoice(prompt.key, side)"
                      [ariaLabel]="'wealth.balance.groupTarget' | translate"
                      (ngModelChange)="choosePromptGroup(prompt.key, $event)"
                      [attr.data-testid]="'wealth-form-group-select-' + prompt.index"
                    />
                    <button
                      type="button"
                      pButton
                      size="small"
                      [attr.data-testid]="'wealth-form-group-apply-' + prompt.index"
                      (click)="applyGroup(side, prompt)"
                    >
                      {{ 'wealth.form.groupApply' | translate }}
                    </button>
                  </div>
                </p-message>
              }
            </section>
          }
        </div>

        <aside class="summary" aria-live="polite" data-testid="wealth-form-summary">
          <dl>
            <div>
              <dt>{{ 'wealth.form.sumAssets' | translate }}</dt>
              <dd data-testid="wealth-form-sum-assets">{{ sum().assets }}</dd>
            </div>
            <div>
              <dt>{{ 'wealth.form.sumLiabilities' | translate }}</dt>
              <dd data-testid="wealth-form-sum-liabilities">{{ sum().liabilities }}</dd>
            </div>
            <div class="net">
              <dt>{{ 'wealth.form.sumNet' | translate }}</dt>
              <dd data-testid="wealth-form-sum-net">{{ sum().net }}</dd>
            </div>
          </dl>
          @if (submitError(); as message) {
            <p-message severity="error" data-testid="wealth-form-error">{{ message }}</p-message>
          }
          <button
            type="button"
            pButton
            class="save"
            [disabled]="saving() || !!dateTaken()"
            data-testid="wealth-form-save"
            (click)="save()"
          >
            {{ (saving() ? 'wealth.form.saving' : 'wealth.form.save') | translate }}
          </button>
          <a
            pButton
            severity="secondary"
            [outlined]="true"
            [routerLink]="areaPath"
            data-testid="wealth-form-cancel"
            >{{ 'wealth.form.cancel' | translate }}</a
          >
        </aside>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
      max-width: 1300px;
      margin-inline: auto;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      font-size: 0.875rem;
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .title {
      margin: 0.5rem 0 1rem;
      font-size: 1.4rem;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 18rem;
      gap: 1.25rem;
      align-items: start;
    }
    .panels {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .panel {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    .panel h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
      gap: 0.75rem;
    }
    .field,
    .cell {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      min-width: 0;
    }
    /* The native date input is 2px taller than the p-select beside it; pin both to one height. */
    input[type='date'] {
      height: 2.1875rem;
    }
    .copy {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
    }
    .field--wide {
      grid-column: 1 / -1;
    }
    .rows {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .row {
      display: grid;
      grid-template-columns: 1.5rem minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr) 2.5rem;
      gap: 0.5rem;
      align-items: start;
    }
    .row--head {
      font-size: 0.75rem;
      color: var(--p-text-muted-color);
    }
    .handle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 2.1875rem;
      padding: 0;
      border: 0;
      background: transparent;
      color: var(--p-text-muted-color);
      cursor: grab;
    }
    .handle:hover,
    .handle:focus-visible {
      color: var(--p-primary-color);
    }
    .cdk-drag-preview {
      box-sizing: border-box;
      display: grid;
      grid-template-columns: 1.5rem minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.8fr) 2.5rem;
      gap: 0.5rem;
      padding: 0.25rem;
      border-radius: 0.5rem;
      background: var(--p-content-background);
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.2);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    .cdk-drag-animating {
      transition: transform 200ms ease;
    }
    .rows.cdk-drop-list-dragging .row:not(.cdk-drag-placeholder) {
      transition: transform 200ms ease;
    }
    .cell__label {
      display: none;
    }
    .amount {
      text-align: right;
    }
    .error {
      color: var(--p-red-500);
    }
    .panel__footer {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    .suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.375rem;
    }
    .chip {
      border: 1px solid var(--p-content-border-color);
      border-radius: 999px;
      background: transparent;
      color: var(--p-text-muted-color);
      padding: 0.125rem 0.625rem;
      font: inherit;
      font-size: 0.75rem;
      cursor: pointer;
    }
    .chip:hover {
      color: var(--p-primary-color);
      border-color: var(--p-primary-color);
    }
    .group-prompt {
      display: block;
      margin-top: 0.75rem;
    }
    .prompt {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem;
    }
    .inline-link {
      margin-inline-start: 0.5rem;
      color: var(--p-primary-color);
    }
    .summary {
      position: sticky;
      top: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    .summary dl {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .summary dl > div {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }
    .summary dt {
      color: var(--p-text-muted-color);
    }
    .summary dd {
      margin: 0;
      font-variant-numeric: tabular-nums;
    }
    .summary .net {
      border-top: 1px solid var(--p-content-border-color);
      padding-top: 0.5rem;
      font-weight: 600;
    }
    .save,
    a.p-button {
      text-align: center;
      justify-content: center;
      text-decoration: none;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .summary {
        position: static;
      }
      .row {
        grid-template-columns: minmax(0, 1fr) 2.5rem;
      }
      .handle {
        grid-row: 2;
        grid-column: 2;
      }
      .row--head {
        display: none;
      }
      .cell__label {
        display: block;
        color: var(--p-text-muted-color);
        font-size: 0.75rem;
      }
      .remove {
        grid-row: 1;
        grid-column: 2;
      }
    }
  `,
})
export class SnapshotFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly service = inject(WealthService);
  protected readonly store = inject(WealthStore);
  private readonly i18n = inject(I18nService);

  protected readonly areaPath = AREA_PATH;
  protected readonly sides: readonly Side[] = ['ASSET', 'LIABILITY'];
  protected readonly maxDate = todayIso();

  protected readonly mode = signal<'create' | 'edit'>('create');
  protected readonly loadFailed = signal(false);
  protected readonly saving = signal(false);
  protected readonly submitError = signal<string | null>(null);

  protected readonly date = signal(todayIso());
  protected readonly note = signal('');
  protected readonly rows = signal<Row[]>([]);
  protected readonly copySource = signal<string | null>(null);
  /** Whether copying a snapshot also takes over its amounts (to compare against them). */
  protected readonly copyAmounts = signal(true);
  /** `entries[i]` of the last submission → row key, so API/lib issues land on the right row. */
  private submittedKeys: number[] = [];
  private readonly issues = signal<ValidationIssue[]>([]);
  private readonly serverExistingId = signal<string | null>(null);
  private readonly answeredGroups = signal<ReadonlySet<string>>(new Set());
  private readonly promptChoices = signal<Readonly<Record<string, BalanceGroup>>>({});

  private editId: string | null = null;
  private nextKey = 1;
  /** `?copyFrom=<id>` from the table action; applied once the snapshots are loaded. */
  private pendingCopy: string | null = null;

  constructor() {
    effect(() => {
      if (this.store.loaded() && this.pendingCopy) {
        const id = this.pendingCopy;
        this.pendingCopy = null;
        untracked(() => this.copyFromSnapshot(id));
      }
    });
  }

  protected readonly sum = computed(() => {
    const lang = this.i18n.language();
    const entries: WealthEntry[] = [];
    for (const row of this.rows()) {
      const amount = normalizeMoney(parseAmountInput(row.amount) ?? '');
      if (amount !== null) {
        entries.push({ side: row.side, class: { custom: 'x' }, name: 'x', amount });
      }
    }
    const totals = totalsOf({ entries });
    return {
      assets: formatMoney(totals.assets, lang),
      liabilities: formatMoney(totals.liabilities, lang),
      net: formatMoney(totals.net, lang),
    };
  });

  /** Id of another snapshot already holding the chosen date (client check, then the server's 409). */
  protected readonly dateTaken = computed(() => {
    const date = this.date();
    const local = this.store
      .snapshots()
      .find((s) => s.snapshotDate === date && s.id !== this.editId);
    return local?.id ?? this.serverExistingId();
  });

  protected readonly copyOptions = computed(() => {
    const lang = this.i18n.language();
    return [
      { label: this.i18n.translate('wealth.form.copyFromNone'), value: null as string | null },
      ...[...this.store.snapshots()]
        .reverse()
        .map((s) => ({ label: formatDate(s.snapshotDate, lang), value: s.id as string | null })),
    ];
  });

  ngOnInit(): void {
    this.store.ensureLoaded();
    // The router reuses this component between `/new` and `/:id/edit`, so (re)initialise per URL.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.reset();
      const id = params.get('id');
      if (id) {
        this.mode.set('edit');
        this.editId = id;
        this.service.snapshot(id).subscribe({
          next: (snapshot) => this.load(snapshot),
          error: () => this.loadFailed.set(true),
        });
        return;
      }
      this.rows.set([this.newRow('ASSET'), this.newRow('LIABILITY')]);
      this.pendingCopy = this.route.snapshot.queryParamMap.get(COPY_PARAM);
    });
  }

  private reset(): void {
    this.mode.set('create');
    this.editId = null;
    this.loadFailed.set(false);
    this.submitError.set(null);
    this.issues.set([]);
    this.serverExistingId.set(null);
    this.copySource.set(null);
    this.date.set(todayIso());
    this.note.set('');
    this.rows.set([]);
    this.submittedKeys = [];
  }

  protected dateTakenText(): string {
    return fill(this.i18n.translate('wealth.form.dateTaken'), {
      date: formatDate(this.date(), this.i18n.language()),
    });
  }

  protected rowsOf(side: Side): Row[] {
    return this.rows().filter((row) => row.side === side);
  }

  protected setDate(value: string): void {
    this.date.set(value);
    this.serverExistingId.set(null);
  }

  protected patchRow(key: number, patch: Partial<Row>): void {
    this.rows.update((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  protected commitClass(key: number): void {
    this.rows.update((rows) =>
      rows.map((row) => (row.key === key ? { ...row, classCommitted: row.classText } : row)),
    );
  }

  protected addRow(side: Side, classText = ''): void {
    this.rows.update((rows) => [...rows, this.newRow(side, classText)]);
  }

  protected removeRow(key: number): void {
    this.rows.update((rows) => rows.filter((row) => row.key !== key));
  }

  protected onDrop(side: Side, event: CdkDragDrop<unknown>): void {
    this.moveRow(side, event.previousIndex, event.currentIndex);
  }

  /** Keyboard alternative to dragging: arrow keys on the focused handle move the row. */
  protected onHandleKeydown(event: KeyboardEvent, side: Side, index: number): void {
    const step = { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (!step) return;
    event.preventDefault();
    this.moveRow(side, index, index + step);
  }

  /** Reorders within one side; the order of the two sides relative to each other is irrelevant. */
  private moveRow(side: Side, from: number, to: number): void {
    const sideRows = this.rowsOf(side);
    if (from === to || to < 0 || to >= sideRows.length) return;
    const [moved] = sideRows.splice(from, 1);
    sideRows.splice(to, 0, moved);
    const other = this.rows().filter((row) => row.side !== side);
    this.rows.set(side === 'ASSET' ? [...sideRows, ...other] : [...other, ...sideRows]);
  }

  protected copyFromSnapshot(id: string | null): void {
    this.copySource.set(id);
    if (!id) return;
    const source = this.store.snapshots().find((s) => s.id === id);
    if (!source) return;
    const amounts = this.copyAmounts();
    this.rows.set(
      copyTemplateOf(source).map((entry, index) =>
        this.rowOf(entry, amounts ? this.amountText(source.entries[index].amount) : ''),
      ),
    );
  }

  protected setCopyAmounts(value: boolean): void {
    this.copyAmounts.set(value);
    this.copyFromSnapshot(this.copySource());
  }

  protected readonly classSuggestions = signal<string[]>([]);

  protected filterClasses(side: Side, event: AutoCompleteCompleteEvent): void {
    const query = event.query.trim().toLowerCase();
    this.classSuggestions.set(
      this.suggestionLabels(side).filter((label) => label.toLowerCase().includes(query)),
    );
  }

  protected suggestionLabels(side: Side): string[] {
    return suggestionsOf(side, this.store.snapshots()).map((ref) => this.labelOf(ref));
  }

  protected fieldError(field: string): string | null {
    const issue = this.issues().find((i) => i.field === field);
    return issue ? this.i18n.translate(`wealth.fieldErrors.${issue.code}`) : null;
  }

  protected entriesError(): string | null {
    const issue = this.issues().find((i) => i.field === 'entries');
    if (!issue) return null;
    return this.i18n.translate(
      issue.code === 'REQUIRED' ? 'wealth.form.noEntries' : `wealth.fieldErrors.${issue.code}`,
    );
  }

  protected rowError(key: number, field: 'name' | 'class' | 'amount'): string | null {
    const index = this.submittedKeys.indexOf(key);
    if (index < 0) return null;
    const issue = this.issues().find(
      (i) =>
        i.field === `entries[${index}].${field}` ||
        i.field.startsWith(`entries[${index}].${field}.`),
    );
    return issue ? this.i18n.translate(`wealth.fieldErrors.${issue.code}`) : null;
  }

  /** New custom classes the user typed that have no balance group yet (asked once, FR-025). */
  protected groupPrompts(side: Side): { key: string; label: string; index: string }[] {
    const known = new Set<string>(
      this.store.settings().classGroups.map((a) => classKey(a.side, a.class)),
    );
    for (const snapshot of this.store.snapshots()) {
      if (snapshot.id === this.editId) continue;
      for (const entry of snapshot.entries) known.add(classKey(entry.side, entry.class));
    }
    const answered = this.answeredGroups();
    const seen = new Set<string>();
    const prompts: { key: string; label: string; index: string }[] = [];
    for (const row of this.rowsOf(side)) {
      const text = row.classCommitted.trim();
      if (!text || this.standardOf(side, text)) continue;
      const key = classKey(side, { custom: text });
      if (known.has(key) || answered.has(key) || seen.has(key)) continue;
      seen.add(key);
      prompts.push({ key, label: text, index: `${side.toLowerCase()}-${prompts.length}` });
    }
    return prompts;
  }

  protected groupPromptText(label: string): string {
    return fill(this.i18n.translate('wealth.form.groupPrompt'), { name: label });
  }

  protected groupOptions(side: Side): { label: string; value: BalanceGroup }[] {
    return groupsOf(side).map((value) => ({
      label: this.i18n.translate(`wealth.groups.${value}`),
      value,
    }));
  }

  protected promptChoice(key: string, side: Side): BalanceGroup {
    return this.promptChoices()[key] ?? (side === 'ASSET' ? 'OTHER_ASSET' : 'OTHER_LIABILITY');
  }

  protected choosePromptGroup(key: string, group: BalanceGroup): void {
    this.promptChoices.update((choices) => ({ ...choices, [key]: group }));
  }

  protected applyGroup(side: Side, prompt: { key: string; label: string }): void {
    this.service
      .upsertClassGroup({
        side,
        class: { custom: prompt.label },
        group: this.promptChoice(prompt.key, side),
      })
      .subscribe({
        next: (settings) => {
          this.store.setSettings(settings);
          this.answeredGroups.update((set) => new Set(set).add(prompt.key));
        },
        error: (error: unknown) =>
          this.submitError.set(this.i18n.translate(this.errorKey(wealthErrorOf(error).code))),
      });
  }

  protected save(): void {
    this.submitError.set(null);
    this.serverExistingId.set(null);
    const { input, keys } = this.buildInput();
    this.submittedKeys = keys;
    const result = validateSnapshotInput(input, todayIso());
    if (!result.ok) {
      this.issues.set(result.issues);
      return;
    }
    this.issues.set([]);
    this.saving.set(true);
    const request =
      this.editId === null
        ? this.service.create(result.value)
        : this.service.update(this.editId, result.value);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.store.refresh();
        void this.router.navigate([AREA_PATH]);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.onSaveError(error);
      },
    });
  }

  private onSaveError(error: unknown): void {
    const failure = wealthErrorOf(error);
    if (failure.existingId) {
      this.serverExistingId.set(failure.existingId);
      return;
    }
    if (failure.details.length > 0) {
      this.issues.set(
        failure.details.map((d) => ({
          field: d.field,
          code: d.message as ValidationIssue['code'],
        })),
      );
    }
    this.submitError.set(this.i18n.translate(this.errorKey(failure.code)));
  }

  private errorKey(code: string): string {
    const key = `wealth.errors.${code}`;
    return this.i18n.translate(key) === key ? 'wealth.form.saveFailed' : key;
  }

  /** Rows → request body (assets first, then liabilities); `keys[i]` is the row of `entries[i]`. */
  private buildInput(): { input: unknown; keys: number[] } {
    // Untouched rows (the empty starter rows) are not part of the snapshot.
    const ordered = [...this.rowsOf('ASSET'), ...this.rowsOf('LIABILITY')].filter(
      (row) => row.name.trim() || row.classText.trim() || row.amount.trim(),
    );
    const keys = ordered.map((row) => row.key);
    const entries = ordered.map((row) => ({
      side: row.side,
      class: this.classRefOf(row),
      name: row.name,
      // Left unparsed on purpose when invalid: the whitelist validation names the field.
      amount: parseAmountInput(row.amount) ?? row.amount,
    }));
    const note = this.note().trim();
    const input: Record<string, unknown> = { snapshotDate: this.date(), entries };
    if (note) input['note'] = note;
    return { input, keys };
  }

  private classRefOf(row: Row): ClassRef | undefined {
    const text = row.classText.trim();
    if (!text) return undefined;
    const standard = this.standardOf(row.side, text);
    return standard ? { standard } : { custom: text };
  }

  private standardOf(side: Side, text: string): StandardClassId | null {
    return matchStandardByLabel(side, text, (id) => this.i18n.translate(`wealth.classes.${id}`));
  }

  private labelOf(ref: ClassRef): string {
    return 'standard' in ref ? this.i18n.translate(`wealth.classes.${ref.standard}`) : ref.custom;
  }

  private newRow(side: Side, classText = ''): Row {
    return {
      key: this.nextKey++,
      side,
      name: '',
      classText,
      classCommitted: classText,
      amount: '',
    };
  }

  private rowOf(entry: WealthEntry, amount: string): Row {
    const classText = this.labelOf(entry.class);
    return {
      key: this.nextKey++,
      side: entry.side,
      name: entry.name,
      classText,
      classCommitted: classText,
      amount,
    };
  }

  private load(snapshot: WealthSnapshot): void {
    this.date.set(snapshot.snapshotDate);
    this.note.set(snapshot.note ?? '');
    this.rows.set(
      snapshot.entries.map((entry) => this.rowOf(entry, this.amountText(entry.amount))),
    );
  }

  private amountText(amount: string): string {
    return this.i18n.language() === 'de' ? amount.replace('.', ',') : amount;
  }
}
