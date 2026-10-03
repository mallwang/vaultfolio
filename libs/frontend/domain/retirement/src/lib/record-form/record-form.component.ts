import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import type {
  RetirementManualRecordInput,
  RetirementRecord,
  RetirementScenario,
  RetirementStatus,
  RetirementSupplementPatch,
} from '@vaultfolio/api-contract';
import {
  type ContractType,
  type FieldSpec,
  SCENARIOS,
  STATUSES,
  type ValidationIssue,
  figureFieldsOf,
  isContractType,
  needsProviderLabel,
  pillarOf,
  supplementKeysOf,
  validateRecordInput,
  validateSupplementPatch,
} from '@vaultfolio/retirement';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import {
  type FigureKind,
  type FormSection,
  figureKind,
  sectionOf,
  sortFigureKeys,
} from '../retirement-fields';
import { parseMoneyInput, toMoneyInput } from '../retirement-format';
import { returnLabelKey, returnLink } from '../return-link';
import { RetirementService } from '../retirement.service';

/** Type chips of design.md; "occupational" groups the six occupational contract types. */
type Chip =
  | 'STATUTORY_PENSION'
  | 'OCCUPATIONAL'
  | 'RIESTER'
  | 'PRIVATE_PENSION_INSURANCE'
  | 'ALTERSVORSORGEDEPOT';

const CHIPS: readonly Chip[] = [
  'STATUTORY_PENSION',
  'OCCUPATIONAL',
  'RIESTER',
  'PRIVATE_PENSION_INSURANCE',
  'ALTERSVORSORGEDEPOT',
];
const OCCUPATIONAL_TYPES: readonly ContractType[] = [
  'DIRECT_INSURANCE',
  'PENSIONSKASSE',
  'DIREKTZUSAGE',
  'UNTERSTUETZUNGSKASSE',
  'PENSIONSFONDS',
  'CAPITAL_ACCOUNT',
];
const SECTIONS: readonly FormSection[] = ['contract', 'benefits', 'contributions'];

function chipOf(type: ContractType): Chip {
  return pillarOf(type) === 'OCCUPATIONAL' ? 'OCCUPATIONAL' : (type as Chip);
}

/** Canonical decimal (≤ 4 places) from typed text, or `null`. */
function parseDecimalInput(text: string): string | null {
  const t = text.trim().replace(',', '.');
  return /^\d+(\.\d{1,4})?$/.test(t) ? t : null;
}

/**
 * Manual entry and editing of one record (design.md "Manual entry form", FR-003–FR-006). The
 * fields adapt to the contract type through the library's per-type field map; the same whitelist
 * validation the server runs is executed first, so mistakes are shown inline before anything is
 * sent. Imported records open in supplement-only mode: only what the statement does not print (and
 * the status) can be changed.
 */
@Component({
  selector: 'app-retirement-record-form',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    ButtonModule,
    InputTextModule,
    MessageModule,
    SelectModule,
    IconComponent,
    TranslatePipe,
  ],
  template: `
    <a class="back" [routerLink]="backLink" data-testid="retirement-form-back">
      <app-icon name="chevron-left" /> {{ backLabelKey | translate }}
    </a>
    <h1 class="title" data-testid="retirement-form-title">
      {{
        (mode() === 'create' ? 'retirement.form.titleNew' : 'retirement.form.titleEdit') | translate
      }}
    </h1>

    @if (loadFailed()) {
      <p-message severity="error" data-testid="retirement-form-load-error">{{
        'retirement.errors.RETIREMENT_RECORD_NOT_FOUND' | translate
      }}</p-message>
    } @else {
      @if (mode() === 'create') {
        <div class="chips" role="group" [attr.aria-label]="'retirement.form.type' | translate">
          @for (chip of chips; track chip) {
            <button
              type="button"
              class="chip"
              [class.chip--active]="chip === activeChip()"
              [attr.aria-pressed]="chip === activeChip()"
              [attr.data-testid]="'retirement-form-chip-' + chip"
              (click)="selectChip(chip)"
            >
              {{ 'retirement.form.chips.' + chip | translate }}
            </button>
          }
        </div>
        @if (activeChip() === 'OCCUPATIONAL') {
          <label class="field field--inline">
            <span>{{ 'retirement.form.occupationalType' | translate }}</span>
            <p-select
              [options]="occupationalOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="type()"
              (ngModelChange)="setType($event)"
              data-testid="retirement-form-occupational-type"
            />
          </label>
        }
      } @else {
        <p class="muted" data-testid="retirement-form-type-label">
          {{ 'retirement.types.' + type() | translate }}
        </p>
      }

      @if (mode() === 'supplement') {
        <p-message severity="info" data-testid="retirement-form-imported-note">{{
          'retirement.form.importedNote' | translate
        }}</p-message>
      }

      <form (ngSubmit)="submit()" novalidate class="form">
        @if (mode() !== 'supplement') {
          <section class="section" data-testid="retirement-form-section-contract">
            <h2>{{ 'retirement.form.sections.contract' | translate }}</h2>
            <div class="grid">
              @if (providerRequired()) {
                <label class="field">
                  <span>{{ 'retirement.fields.providerLabel' | translate }}</span>
                  <input
                    pInputText
                    maxlength="80"
                    name="providerLabel"
                    [ngModel]="providerLabel()"
                    (ngModelChange)="providerLabel.set($event)"
                    data-testid="retirement-form-provider"
                  />
                  <ng-container *ngTemplateOutlet="err; context: { f: 'providerLabel' }" />
                </label>
              }
              <label class="field">
                <span>{{ 'retirement.fields.identifier' | translate }}</span>
                <input
                  pInputText
                  maxlength="40"
                  name="identifier"
                  [ngModel]="identifier()"
                  (ngModelChange)="identifier.set($event)"
                  data-testid="retirement-form-identifier"
                />
                <ng-container *ngTemplateOutlet="err; context: { f: 'identifier' }" />
              </label>
              <label class="field">
                <span>{{ 'retirement.fields.statementDate' | translate }}</span>
                <input
                  pInputText
                  type="date"
                  name="statementDate"
                  [ngModel]="statementDate()"
                  (ngModelChange)="statementDate.set($event)"
                  data-testid="retirement-form-statement-date"
                />
                <ng-container *ngTemplateOutlet="err; context: { f: 'statementDate' }" />
              </label>
              <label class="field">
                <span>{{ 'retirement.fields.payoutStart' | translate }}</span>
                <input
                  pInputText
                  type="date"
                  name="payoutStart"
                  [ngModel]="payoutStart()"
                  (ngModelChange)="payoutStart.set($event)"
                  data-testid="retirement-form-payout-start"
                />
                <ng-container *ngTemplateOutlet="err; context: { f: 'payoutStart' }" />
              </label>
              @if (type() !== 'STATUTORY_PENSION') {
                <label class="field">
                  <span>{{ 'retirement.fields.status' | translate }}</span>
                  <p-select
                    [options]="statusOptions()"
                    optionLabel="label"
                    optionValue="value"
                    [ngModel]="status()"
                    name="status"
                    (ngModelChange)="status.set($event)"
                    data-testid="retirement-form-status"
                  />
                </label>
              }
              @for (key of keysOf('contract'); track key) {
                <ng-container *ngTemplateOutlet="figure; context: { key: key }" />
              }
            </div>
          </section>
          @for (section of otherSections; track section) {
            @if (keysOf(section).length > 0) {
              <section class="section" [attr.data-testid]="'retirement-form-section-' + section">
                <h2>{{ 'retirement.form.sections.' + section | translate }}</h2>
                <div class="grid">
                  @for (key of keysOf(section); track key) {
                    <ng-container *ngTemplateOutlet="figure; context: { key: key }" />
                  }
                </div>
              </section>
            }
          }
        } @else {
          <section class="section" data-testid="retirement-form-section-supplement">
            <h2>{{ 'retirement.form.sections.supplement' | translate }}</h2>
            <div class="grid">
              @for (key of supplementKeys(); track key) {
                @if (key === 'expectedScenario') {
                  <label class="field">
                    <span>{{ 'retirement.fields.expectedScenario' | translate }}</span>
                    <p-select
                      [options]="scenarioOptions()"
                      optionLabel="label"
                      optionValue="value"
                      [ngModel]="expectedScenario()"
                      name="expectedScenario"
                      (ngModelChange)="expectedScenario.set($event)"
                      data-testid="retirement-form-expected-scenario"
                    />
                  </label>
                } @else {
                  <ng-container
                    *ngTemplateOutlet="figure; context: { key: key, supplement: true }"
                  />
                }
              }
              <label class="field">
                <span>{{ 'retirement.fields.status' | translate }}</span>
                <p-select
                  [options]="statusOptions()"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="status()"
                  name="status"
                  (ngModelChange)="status.set($event)"
                  data-testid="retirement-form-status"
                />
              </label>
            </div>
          </section>
        }

        @if (serverError(); as code) {
          <p-message severity="error" data-testid="retirement-form-error">{{
            errorText(code)
          }}</p-message>
        }

        <div class="actions">
          <button pButton type="submit" [disabled]="saving()" data-testid="retirement-form-submit">
            {{ 'retirement.form.save' | translate }}
          </button>
          <a
            pButton
            severity="secondary"
            [outlined]="true"
            [routerLink]="backLink"
            data-testid="retirement-form-cancel"
          >
            {{ 'retirement.form.cancel' | translate }}
          </a>
        </div>
      </form>
    }

    <ng-template #figure let-key="key" let-supplement="supplement">
      <div class="field" [class.field--wide]="specOf(key).kind === 'scenarios'">
        @if (specOf(key).kind === 'scenarios') {
          <span class="label">
            {{ 'retirement.fields.scenarioMonthly' | translate }}
            <span class="tag tag--projection">{{
              'retirement.labels.projection' | translate
            }}</span>
          </span>
          <div class="scenarios">
            @for (s of scenarios; track s) {
              <label class="scenario">
                <span>{{ s }} %</span>
                <input
                  pInputText
                  inputmode="decimal"
                  [name]="'scenario-' + s"
                  [ngModel]="scenarioValues()[s]"
                  (ngModelChange)="setScenario(s, $event)"
                  [attr.data-testid]="'retirement-form-scenario-' + s"
                />
              </label>
            }
          </div>
          <ng-container *ngTemplateOutlet="err; context: { f: 'figures.scenarioMonthly' }" />
        } @else {
          <label [for]="'retirement-field-' + key" class="label">
            {{ 'retirement.fields.' + key | translate }}
            @switch (kindOf(key)) {
              @case ('guaranteed') {
                <span class="tag tag--guaranteed">{{
                  'retirement.labels.guaranteed' | translate
                }}</span>
              }
              @case ('projection') {
                <span class="tag tag--projection">{{
                  'retirement.labels.projection' | translate
                }}</span>
              }
            }
          </label>
          <input
            pInputText
            [id]="'retirement-field-' + key"
            [name]="key"
            [type]="specOf(key).kind === 'date' ? 'date' : 'text'"
            [attr.inputmode]="specOf(key).kind === 'date' ? null : 'decimal'"
            [ngModel]="values()[key] ?? ''"
            (ngModelChange)="setValue(key, $event)"
            [attr.aria-invalid]="hasIssue((supplement ? '' : 'figures.') + key)"
            [attr.data-testid]="'retirement-form-field-' + key"
          />
          <ng-container
            *ngTemplateOutlet="err; context: { f: (supplement ? '' : 'figures.') + key }"
          />
        }
      </div>
    </ng-template>

    <ng-template #err let-f="f">
      @for (code of codesOf(f); track code) {
        <small class="error" role="alert" [attr.data-testid]="'retirement-form-error-' + f">{{
          'retirement.validation.' + code | translate
        }}</small>
      }
    </ng-template>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 56rem;
      margin: 0 auto;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      text-decoration: none;
      font-size: 0.875rem;
    }
    .title {
      margin: 0;
      font-size: 1.4rem;
    }
    .muted {
      margin: 0;
      color: var(--p-text-muted-color);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
    .chip {
      padding: 0.4rem 0.9rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: 999px;
      background: var(--p-content-background);
      color: var(--p-text-color);
      font: inherit;
      font-size: 0.875rem;
      cursor: pointer;
    }
    .chip--active {
      border-color: var(--p-primary-color);
      background: color-mix(in srgb, var(--p-primary-color) 14%, transparent);
      color: var(--p-primary-color);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .section {
      padding: 1rem;
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      background: var(--p-content-background);
    }
    .section h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(16rem, 100%), 1fr));
      gap: 0.75rem 1rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .field--inline {
      max-width: 20rem;
    }
    .field--wide {
      grid-column: 1 / -1;
    }
    .label {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--p-text-muted-color);
    }
    .tag {
      padding: 0 0.4rem;
      border-radius: 4px;
      font-size: 0.7rem;
    }
    .tag--guaranteed {
      color: var(--p-green-700);
      background: color-mix(in srgb, var(--p-green-500) 16%, transparent);
    }
    .tag--projection {
      font-style: italic;
      color: var(--p-text-muted-color);
      background: color-mix(in srgb, var(--p-text-muted-color) 14%, transparent);
    }
    .scenarios {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
      gap: 0.5rem;
    }
    .scenario {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }
    .error {
      color: var(--p-red-600);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class RecordFormComponent {
  private readonly service = inject(RetirementService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);
  protected readonly backLink = returnLink(this.route.snapshot.queryParamMap.get('from'));
  protected readonly backLabelKey = returnLabelKey(this.route.snapshot.queryParamMap.get('from'));

  protected readonly chips = CHIPS;
  protected readonly otherSections: readonly FormSection[] = SECTIONS.filter(
    (s) => s !== 'contract',
  );
  protected readonly scenarios = SCENARIOS;

  protected readonly mode = signal<'create' | 'edit' | 'supplement'>('create');
  protected readonly type = signal<ContractType>('DIRECT_INSURANCE');
  protected readonly status = signal<RetirementStatus>('ACTIVE');
  protected readonly providerLabel = signal('');
  protected readonly identifier = signal('');
  protected readonly statementDate = signal('');
  protected readonly payoutStart = signal('');
  protected readonly expectedScenario = signal<RetirementScenario>('3');
  protected readonly values = signal<Record<string, string>>({});
  protected readonly scenarioValues = signal<Record<string, string>>({});
  protected readonly issues = signal<ValidationIssue[]>([]);
  protected readonly saving = signal(false);
  protected readonly serverError = signal<string | null>(null);
  protected readonly loadFailed = signal(false);

  private recordId: string | null = null;

  protected readonly activeChip = computed(() => chipOf(this.type()));
  protected readonly providerRequired = computed(() => needsProviderLabel(this.type()));
  private readonly loaded = signal<RetirementRecord | null>(null);
  /** Whether the imported statement printed the 0/3/6/9 % scenarios (then the expected one is chosen). */
  protected readonly hasScenarios = computed(() => {
    const figures = this.loaded()?.figures;
    return figures !== undefined && 'scenarioMonthly' in figures;
  });
  protected readonly supplementKeys = computed(() =>
    supplementKeysOf(this.type()).filter((k) => k !== 'expectedScenario' || this.hasScenarios()),
  );

  /** Figure fields of the current type with their specs. */
  private readonly fields = computed(() => figureFieldsOf(this.type(), 'MANUAL'));

  protected readonly statusOptions = computed(() => {
    this.i18n.language();
    return STATUSES.map((value) => ({
      value,
      label: this.i18n.translate(`retirement.status.${value}`),
    }));
  });
  protected readonly scenarioOptions = computed(() => {
    this.i18n.language();
    return SCENARIOS.map((value) => ({ value, label: `${value} %` }));
  });
  protected readonly occupationalOptions = computed(() => {
    this.i18n.language();
    return OCCUPATIONAL_TYPES.map((value) => ({
      value,
      label: this.i18n.translate(`retirement.types.${value}`),
    }));
  });

  constructor() {
    const params = this.route.snapshot.paramMap;
    const id = params.get('id');
    const typeParam = params.get('type');
    if (id) {
      this.load(id);
    } else if (typeParam === 'OCCUPATIONAL') {
      this.type.set('DIRECT_INSURANCE');
    } else if (isContractType(typeParam)) {
      this.type.set(typeParam);
    }
  }

  protected selectChip(chip: Chip): void {
    this.setType(chip === 'OCCUPATIONAL' ? 'DIRECT_INSURANCE' : (chip as ContractType));
  }

  protected setType(type: ContractType): void {
    this.type.set(type);
    this.issues.set([]);
    // keep only what the new type still knows, so a stale value can never be submitted
    const allowed = figureFieldsOf(type, 'MANUAL');
    this.values.update((v) => Object.fromEntries(Object.entries(v).filter(([k]) => k in allowed)));
    if (!('scenarioMonthly' in allowed)) this.scenarioValues.set({});
  }

  protected keysOf(section: FormSection): string[] {
    return sortFigureKeys(Object.keys(this.fields()).filter((k) => sectionOf(k) === section));
  }

  protected specOf(key: string): FieldSpec {
    return (this.fields()[key] ?? ({ kind: 'money' } as FieldSpec)) as FieldSpec;
  }

  protected kindOf(key: string): FigureKind {
    return figureKind(key);
  }

  protected setValue(key: string, value: string): void {
    this.values.update((v) => ({ ...v, [key]: value }));
  }

  protected setScenario(scenario: string, value: string): void {
    this.scenarioValues.update((v) => ({ ...v, [scenario]: value }));
  }

  protected codesOf(field: string): string[] {
    return this.issues()
      .filter((i) => i.field === field)
      .map((i) => i.code);
  }

  protected hasIssue(field: string): boolean {
    return this.issues().some((i) => i.field === field);
  }

  protected errorText(code: string): string {
    const key = `retirement.errors.${code}`;
    const text = this.i18n.translate(key);
    return text === key ? this.i18n.translate('retirement.errors.saveFailed') : text;
  }

  protected submit(): void {
    if (this.saving()) return;
    this.serverError.set(null);
    if (this.mode() === 'supplement') {
      this.submitSupplement();
      return;
    }

    const local: ValidationIssue[] = [];
    const figures = this.collectFigures(local);
    const body: Record<string, unknown> = {
      contractType: this.type(),
      origin: 'MANUAL',
      status: this.type() === 'STATUTORY_PENSION' ? 'ACTIVE' : this.status(),
      statementDate: this.statementDate(),
      figures,
    };
    if (this.providerRequired() || this.providerLabel().trim() !== '') {
      body['providerLabel'] = this.providerLabel().trim();
    }
    if (this.payoutStart() !== '') body['payoutStart'] = this.payoutStart();
    if (this.identifier().trim() !== '') body['identifier'] = this.identifier().trim();

    const result = validateRecordInput(body, { now: new Date() });
    const issues = [...local, ...(result.ok ? [] : result.issues)];
    this.issues.set(this.dedupe(issues));
    if (issues.length > 0 || !result.ok) return;

    const input: Record<string, unknown> = { ...result.value };
    delete input['origin'];
    this.saving.set(true);
    const request =
      this.mode() === 'create'
        ? this.service.create(result.value)
        : this.service.update(
            this.recordId as string,
            input as unknown as RetirementManualRecordInput,
          );
    request.subscribe({
      next: (record) => this.done(record.pillar),
      error: (error: unknown) => this.failed(error),
    });
  }

  private collectFigures(local: ValidationIssue[]): Record<string, unknown> {
    const figures: Record<string, unknown> = {};
    for (const [key, spec] of Object.entries(this.fields())) {
      if (spec.kind === 'scenarios') {
        const scenarios = this.parseScenarios(local);
        if (scenarios) figures[key] = scenarios;
        continue;
      }
      const text = (this.values()[key] ?? '').trim();
      if (text === '') continue;
      const parsed = this.parseFigure(spec, text);
      if (parsed === null) local.push({ field: `figures.${key}`, code: 'INVALID_AMOUNT' });
      else figures[key] = parsed;
    }
    return figures;
  }

  private submitSupplement(): void {
    const body: Record<string, unknown> = { status: this.status() };
    const local: ValidationIssue[] = [];
    for (const key of this.supplementKeys()) {
      if (key === 'expectedScenario') {
        if (this.hasScenarios()) body[key] = this.expectedScenario();
        continue;
      }
      const text = (this.values()[key] ?? '').trim();
      if (text === '') continue;
      const parsed = parseMoneyInput(text);
      if (parsed === null) local.push({ field: key, code: 'INVALID_AMOUNT' });
      else body[key] = parsed;
    }
    const result = validateSupplementPatch(this.type(), body);
    const issues = [...local, ...(result.ok ? [] : result.issues)];
    this.issues.set(this.dedupe(issues));
    if (issues.length > 0 || !result.ok) return;

    this.saving.set(true);
    this.service
      .updateSupplement(this.recordId as string, result.value as RetirementSupplementPatch)
      .subscribe({
        next: (record) => this.done(record.pillar),
        error: (error: unknown) => this.failed(error),
      });
  }

  private parseFigure(spec: FieldSpec, text: string): string | number | null {
    switch (spec.kind) {
      case 'date':
        return text;
      case 'int':
        return /^\d{1,3}$/.test(text) ? Number(text) : null;
      case 'decimal':
        return parseDecimalInput(text);
      default:
        return parseMoneyInput(text);
    }
  }

  private parseScenarios(issues: ValidationIssue[]): Record<string, string> | null {
    const out: Record<string, string> = {};
    for (const s of SCENARIOS) {
      const text = (this.scenarioValues()[s] ?? '').trim();
      if (text === '') continue;
      const parsed = parseMoneyInput(text);
      if (parsed === null)
        issues.push({ field: 'figures.scenarioMonthly', code: 'INVALID_AMOUNT' });
      else out[s] = parsed;
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  private dedupe(issues: ValidationIssue[]): ValidationIssue[] {
    const seen = new Set<string>();
    return issues.filter((i) => {
      const key = `${i.field}|${i.code}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private load(id: string): void {
    this.recordId = id;
    this.service.record(id).subscribe({
      next: (record) => this.fill(record),
      error: () => this.loadFailed.set(true),
    });
  }

  private fill(record: RetirementRecord): void {
    this.loaded.set(record);
    this.type.set(record.contractType);
    this.status.set(record.status);
    this.providerLabel.set(record.providerLabel ?? '');
    this.identifier.set(record.identifier ?? '');
    this.statementDate.set(record.statementDate);
    this.payoutStart.set(record.payoutStart ?? '');
    const lang = this.i18n.language();
    if (record.origin === 'IMPORTED') {
      this.mode.set('supplement');
      const supplement = record.supplement ?? {};
      this.expectedScenario.set(supplement.expectedScenario ?? '3');
      this.values.set(
        Object.fromEntries(
          Object.entries(supplement)
            .filter(([k, v]) => k !== 'expectedScenario' && typeof v === 'string')
            .map(([k, v]) => [k, toMoneyInput(v as string, lang)]),
        ),
      );
      return;
    }
    this.mode.set('edit');
    const specs = figureFieldsOf(record.contractType, 'MANUAL');
    const values: Record<string, string> = {};
    for (const [key, value] of Object.entries(
      record.figures as unknown as Record<string, unknown>,
    )) {
      const kind = specs[key]?.kind;
      if (kind === 'scenarios') {
        this.scenarioValues.set(
          Object.fromEntries(
            Object.entries(value as Record<string, string>).map(([s, v]) => [
              s,
              toMoneyInput(v, lang),
            ]),
          ),
        );
      } else if (kind === 'money') values[key] = toMoneyInput(value as string, lang);
      else if (kind !== undefined) values[key] = String(value);
    }
    this.values.set(values);
  }

  private done(pillar: string): void {
    this.saving.set(false);
    void this.router.navigate(['/app/retirement', pillar.toLowerCase()]);
  }

  private failed(error: unknown): void {
    this.saving.set(false);
    if (error instanceof HttpErrorResponse) {
      const body = error.error as {
        error?: string;
        details?: { field: string; message: string }[];
      } | null;
      if (body?.details?.length && body.error !== 'RETIREMENT_CHECK_FAILED') {
        this.issues.set(
          body.details.map((d) => ({ field: d.field, code: d.message as ValidationIssue['code'] })),
        );
      }
      this.serverError.set(body?.error ?? 'saveFailed');
      return;
    }
    this.serverError.set('saveFailed');
  }
}
