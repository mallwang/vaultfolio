import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { MultiSelectModule } from 'primeng/multiselect';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import type { InsuranceContractInput } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import {
  type Contract,
  type ContractStatus,
  type DetailField,
  INSURANCE_TYPES,
  type InsuranceGroup,
  type InsuranceTypeId,
  type PaymentInterval,
  isInsuranceTypeId,
  monthlyCostText,
  nextCancellationDate,
  typeDef,
  validateContract,
  yearlyCostText,
} from '@vaultfolio/insurances';
import { fill, formatMoney, monthName, parseAmountInput } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService, insurancesErrorOf } from '../insurances.service';
import { cancellationLabel } from '../insurances-view';

interface FormState {
  type: InsuranceTypeId | null;
  name: string;
  insurer: string;
  contractNumber: string;
  status: ContractStatus;
  startDate: string;
  endDate: string;
  premium: string;
  interval: PaymentInterval;
  paymentMonth: number | null;
  periodValue: string;
  periodUnit: 'WEEKS' | 'MONTHS';
  autoRenew: boolean;
  renewalMonths: string;
  minimumTermMonths: string;
  useFixedDate: boolean;
  fixedDay: string;
  fixedMonth: string;
  reminderEnabled: boolean;
  details: Record<string, string>;
  alsoCovers: InsuranceTypeId[];
  note: string;
}

const AREA_PATH = '/app/insurances';
const MONEY_DETAILS: readonly DetailField[] = [
  'coverageSum',
  'deductible',
  'insuredMonthlyBenefit',
  'insuredSum',
];
const GROUP_ORDER: readonly InsuranceGroup[] = [
  'PERSONS',
  'LIABILITY',
  'PROPERTY',
  'MOBILITY',
  'LEGAL',
  'OTHER',
];

function emptyState(): FormState {
  return {
    type: null,
    name: '',
    insurer: '',
    contractNumber: '',
    status: 'ACTIVE',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    premium: '',
    interval: 'YEARLY',
    paymentMonth: null,
    periodValue: '',
    periodUnit: 'MONTHS',
    autoRenew: true,
    renewalMonths: '',
    minimumTermMonths: '',
    useFixedDate: false,
    fixedDay: '',
    fixedMonth: '',
    reminderEnabled: true,
    details: {},
    alsoCovers: [],
    note: '',
  };
}

const numberOf = (text: string): number | undefined => {
  const trimmed = text.trim();
  return trimmed === '' ? undefined : Number(trimmed);
};

function detailsOf(s: FormState): Record<string, string> {
  const details: Record<string, string> = {};
  const allowed = s.type ? typeDef(s.type).detailFields : [];
  for (const field of allowed) {
    const raw = (s.details[field] ?? '').trim();
    if (raw === '') continue;
    details[field] = MONEY_DETAILS.includes(field) ? (parseAmountInput(raw) ?? raw) : raw;
  }
  return details;
}

function cancellationOf(s: FormState): Record<string, unknown> {
  const cancellation: Record<string, unknown> = { autoRenew: s.autoRenew };
  const periodValue = numberOf(s.periodValue);
  if (periodValue !== undefined)
    cancellation['period'] = { value: periodValue, unit: s.periodUnit };
  const renewal = s.autoRenew ? numberOf(s.renewalMonths) : undefined;
  if (renewal !== undefined) cancellation['renewalMonths'] = renewal;
  const minimumTerm = numberOf(s.minimumTermMonths);
  if (minimumTerm !== undefined) cancellation['minimumTermMonths'] = minimumTerm;
  if (s.useFixedDate)
    cancellation['fixedDate'] = { day: numberOf(s.fixedDay), month: numberOf(s.fixedMonth) };
  return cancellation;
}

/**
 * Contract form (design.md "Vertrag erfassen", FR-002, FR-003, FR-018): catalog type picker grouped
 * by area, contract data, premium, cancellation settings with a live derived summary, type-specific
 * details, combination coverage and notes. The same whitelist validation the server runs executes
 * first, so mistakes show inline before anything is sent.
 *
 * Inline template/styles: consumed cross-package as a lazily loaded route target.
 */
@Component({
  selector: 'app-insurances-contract-form',
  imports: [
    FormsModule,
    RouterLink,
    ButtonModule,
    CheckboxModule,
    InputTextModule,
    MessageModule,
    MultiSelectModule,
    SelectModule,
    TextareaModule,
    IconComponent,
    TranslatePipe,
  ],
  template: `
    <a class="back" [routerLink]="areaPath" data-testid="insurances-form-back">
      <app-icon name="chevron-left" /> {{ 'insurances.form.back' | translate }}
    </a>
    <h1 class="title" data-testid="insurances-form-title">
      {{ (editId() ? 'insurances.form.titleEdit' : 'insurances.form.titleNew') | translate }}
    </h1>

    @if (loadFailed()) {
      <p-message severity="error" data-testid="insurances-form-load-error">{{
        'insurances.form.loadFailed' | translate
      }}</p-message>
    } @else {
      <div class="layout">
        <div class="panels">
          <section class="panel" data-testid="insurances-form-contract-panel">
            <h2>{{ 'insurances.form.contractPanel' | translate }}</h2>
            <div class="grid">
              <label class="field span">
                <span>{{ 'insurances.form.type' | translate }}</span>
                <p-select
                  [options]="typeOptions()"
                  optionLabel="label"
                  optionValue="value"
                  optionGroupLabel="label"
                  optionGroupChildren="items"
                  [group]="true"
                  [ngModel]="f().type"
                  (ngModelChange)="setType($event)"
                  [invalid]="!!fieldError('type')"
                  fluid
                  data-testid="insurances-form-type"
                />
                @if (fieldError('type'); as message) {
                  <small class="error" data-testid="insurances-form-type-error">{{
                    message
                  }}</small>
                }
              </label>
              <label class="field">
                <span>{{ 'insurances.form.name' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="text"
                  maxlength="100"
                  name="name"
                  [ngModel]="f().name"
                  (ngModelChange)="patch({ name: $event })"
                  [attr.aria-invalid]="!!fieldError('name')"
                  data-testid="insurances-form-name"
                />
                @if (fieldError('name'); as message) {
                  <small class="error" data-testid="insurances-form-name-error">{{
                    message
                  }}</small>
                }
              </label>
              <label class="field">
                <span>{{ 'insurances.form.insurer' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="text"
                  maxlength="100"
                  name="insurer"
                  [ngModel]="f().insurer"
                  (ngModelChange)="patch({ insurer: $event })"
                  data-testid="insurances-form-insurer"
                />
              </label>
              <label class="field">
                <span>{{ 'insurances.form.contractNumber' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="text"
                  maxlength="50"
                  name="contractNumber"
                  [ngModel]="f().contractNumber"
                  (ngModelChange)="patch({ contractNumber: $event })"
                  data-testid="insurances-form-number"
                />
              </label>
              <label class="field">
                <span>{{ 'insurances.form.status' | translate }}</span>
                <p-select
                  [options]="statusOptions()"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="f().status"
                  (ngModelChange)="patch({ status: $event })"
                  fluid
                  data-testid="insurances-form-status"
                />
              </label>
              <label class="field">
                <span>{{ 'insurances.form.startDate' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="date"
                  name="startDate"
                  [ngModel]="f().startDate"
                  (ngModelChange)="patch({ startDate: $event })"
                  [attr.aria-invalid]="!!fieldError('startDate')"
                  data-testid="insurances-form-start"
                />
                @if (fieldError('startDate'); as message) {
                  <small class="error">{{ message }}</small>
                }
              </label>
              <label class="field">
                <span>{{ 'insurances.form.endDate' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="date"
                  name="endDate"
                  [ngModel]="f().endDate"
                  (ngModelChange)="patch({ endDate: $event })"
                  [attr.aria-invalid]="!!fieldError('endDate')"
                  data-testid="insurances-form-end"
                />
                @if (fieldError('endDate'); as message) {
                  <small class="error" data-testid="insurances-form-end-error">{{ message }}</small>
                }
              </label>
            </div>
          </section>

          <section class="panel" data-testid="insurances-form-premium-panel">
            <h2>{{ 'insurances.form.premiumPanel' | translate }}</h2>
            <div class="grid">
              <label class="field">
                <span>{{ 'insurances.form.premium' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="text"
                  inputmode="decimal"
                  name="premium"
                  [ngModel]="f().premium"
                  (ngModelChange)="patch({ premium: $event })"
                  [attr.aria-invalid]="!!fieldError('premium')"
                  data-testid="insurances-form-premium"
                />
                @if (fieldError('premium'); as message) {
                  <small class="error" data-testid="insurances-form-premium-error">{{
                    message
                  }}</small>
                }
              </label>
              <label class="field">
                <span>{{ 'insurances.form.interval' | translate }}</span>
                <p-select
                  [options]="intervalOptions()"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="f().interval"
                  (ngModelChange)="patch({ interval: $event })"
                  fluid
                  data-testid="insurances-form-interval"
                />
              </label>
              @if (f().interval !== 'MONTHLY') {
                <label class="field">
                  <span>{{ 'insurances.form.paymentMonth' | translate }}</span>
                  <p-select
                    [options]="monthOptions()"
                    optionLabel="label"
                    optionValue="value"
                    [ngModel]="f().paymentMonth"
                    (ngModelChange)="patch({ paymentMonth: $event })"
                    [showClear]="true"
                    [placeholder]="'insurances.form.paymentMonthDefault' | translate"
                    fluid
                    data-testid="insurances-form-payment-month"
                  />
                </label>
              }
            </div>
          </section>

          <section class="panel" data-testid="insurances-form-cancellation-panel">
            <h2>{{ 'insurances.form.cancellationPanel' | translate }}</h2>
            <div class="grid">
              <label class="field">
                <span>{{ 'insurances.form.periodValue' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="number"
                  min="0"
                  max="60"
                  name="periodValue"
                  [ngModel]="f().periodValue"
                  (ngModelChange)="patch({ periodValue: $event === null ? '' : '' + $event })"
                  [attr.aria-invalid]="!!fieldError('cancellation.period.value')"
                  data-testid="insurances-form-period-value"
                />
                @if (fieldError('cancellation.period.value'); as message) {
                  <small class="error">{{ message }}</small>
                }
              </label>
              <label class="field">
                <span>{{ 'insurances.form.periodUnit' | translate }}</span>
                <p-select
                  [options]="unitOptions()"
                  optionLabel="label"
                  optionValue="value"
                  [ngModel]="f().periodUnit"
                  (ngModelChange)="patch({ periodUnit: $event })"
                  fluid
                  data-testid="insurances-form-period-unit"
                />
              </label>
              <label class="check span">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="f().autoRenew"
                  (ngModelChange)="patch({ autoRenew: $event })"
                  name="autoRenew"
                  data-testid="insurances-form-auto-renew"
                />
                <span>{{ 'insurances.form.autoRenew' | translate }}</span>
              </label>
              @if (f().autoRenew) {
                <label class="field">
                  <span>{{ 'insurances.form.renewalMonths' | translate }}</span>
                  <input
                    pInputText
                    fluid
                    type="number"
                    min="1"
                    max="60"
                    name="renewalMonths"
                    placeholder="12"
                    [ngModel]="f().renewalMonths"
                    (ngModelChange)="patch({ renewalMonths: $event === null ? '' : '' + $event })"
                    [attr.aria-invalid]="!!fieldError('cancellation.renewalMonths')"
                    data-testid="insurances-form-renewal"
                  />
                  @if (fieldError('cancellation.renewalMonths'); as message) {
                    <small class="error">{{ message }}</small>
                  }
                </label>
              }
              <label class="field">
                <span>{{ 'insurances.form.minimumTermMonths' | translate }}</span>
                <input
                  pInputText
                  fluid
                  type="number"
                  min="1"
                  max="600"
                  name="minimumTermMonths"
                  placeholder="12"
                  [ngModel]="f().minimumTermMonths"
                  (ngModelChange)="patch({ minimumTermMonths: $event === null ? '' : '' + $event })"
                  [attr.aria-invalid]="!!fieldError('cancellation.minimumTermMonths')"
                  data-testid="insurances-form-minimum-term"
                />
                @if (fieldError('cancellation.minimumTermMonths'); as message) {
                  <small class="error">{{ message }}</small>
                }
              </label>
              <label class="check span">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="f().useFixedDate"
                  (ngModelChange)="patch({ useFixedDate: $event })"
                  name="useFixedDate"
                  data-testid="insurances-form-use-fixed"
                />
                <span>{{ 'insurances.form.useFixedDate' | translate }}</span>
              </label>
              @if (f().useFixedDate) {
                <label class="field">
                  <span>{{ 'insurances.form.fixedDay' | translate }}</span>
                  <input
                    pInputText
                    fluid
                    type="number"
                    min="1"
                    max="31"
                    name="fixedDay"
                    [ngModel]="f().fixedDay"
                    (ngModelChange)="patch({ fixedDay: $event === null ? '' : '' + $event })"
                    [attr.aria-invalid]="!!fieldError('cancellation.fixedDate.day')"
                    data-testid="insurances-form-fixed-day"
                  />
                  @if (fieldError('cancellation.fixedDate.day'); as message) {
                    <small class="error">{{ message }}</small>
                  }
                </label>
                <label class="field">
                  <span>{{ 'insurances.form.fixedMonth' | translate }}</span>
                  <input
                    pInputText
                    fluid
                    type="number"
                    min="1"
                    max="12"
                    name="fixedMonth"
                    [ngModel]="f().fixedMonth"
                    (ngModelChange)="patch({ fixedMonth: $event === null ? '' : '' + $event })"
                    [attr.aria-invalid]="!!fieldError('cancellation.fixedDate.month')"
                    data-testid="insurances-form-fixed-month"
                  />
                  @if (fieldError('cancellation.fixedDate.month'); as message) {
                    <small class="error">{{ message }}</small>
                  }
                </label>
              }
              <label class="check span">
                <p-checkbox
                  [binary]="true"
                  [ngModel]="f().reminderEnabled"
                  (ngModelChange)="patch({ reminderEnabled: $event })"
                  name="reminderEnabled"
                  data-testid="insurances-form-reminder"
                />
                <span>{{ 'insurances.form.reminder' | translate }}</span>
              </label>
            </div>
          </section>

          @if (detailFields().length > 0) {
            <section class="panel" data-testid="insurances-form-details-panel">
              <h2>{{ 'insurances.form.detailsPanel' | translate }}</h2>
              <div class="grid">
                @for (field of detailFields(); track field) {
                  <label class="field">
                    <span>{{ 'insurances.form.details.' + field | translate }}</span>
                    <input
                      pInputText
                      fluid
                      type="text"
                      [attr.inputmode]="isMoney(field) ? 'decimal' : null"
                      [name]="'detail-' + field"
                      [ngModel]="f().details[field]"
                      (ngModelChange)="patchDetail(field, $event)"
                      [attr.aria-invalid]="!!fieldError('details.' + field)"
                      [attr.data-testid]="'insurances-form-detail-' + field"
                    />
                    @if (fieldError('details.' + field); as message) {
                      <small class="error">{{ message }}</small>
                    }
                  </label>
                }
              </div>
            </section>
          }

          <section class="panel" data-testid="insurances-form-covers-panel">
            <h2>{{ 'insurances.form.coversPanel' | translate }}</h2>
            <p class="muted">{{ 'insurances.form.coversHint' | translate }}</p>
            <p-multiselect
              [options]="coverOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="f().alsoCovers"
              (ngModelChange)="patch({ alsoCovers: $event ?? [] })"
              [maxSelectedLabels]="3"
              [showToggleAll]="false"
              fluid
              data-testid="insurances-form-covers"
            />
            @if (fieldError('alsoCovers'); as message) {
              <small class="error">{{ message }}</small>
            }
          </section>

          <section class="panel">
            <label class="field">
              <span>{{ 'insurances.form.note' | translate }}</span>
              <textarea
                pTextarea
                fluid
                rows="3"
                maxlength="500"
                name="note"
                [ngModel]="f().note"
                (ngModelChange)="patch({ note: $event })"
                data-testid="insurances-form-note"
              ></textarea>
            </label>
          </section>
        </div>

        <aside class="derived" data-testid="insurances-form-derived">
          <h2>{{ 'insurances.form.derivedTitle' | translate }}</h2>
          @if (derived(); as d) {
            <dl>
              <dt>{{ 'insurances.list.monthly' | translate }}</dt>
              <dd data-testid="insurances-form-derived-monthly">{{ d.monthly }}</dd>
              <dt>{{ 'insurances.kpi.yearly' | translate }}</dt>
              <dd data-testid="insurances-form-derived-yearly">{{ d.yearly }}</dd>
              <dt>{{ 'insurances.list.next' | translate }}</dt>
              <dd data-testid="insurances-form-derived-next">{{ d.next }}</dd>
            </dl>
          } @else {
            <p class="muted">{{ 'insurances.form.derivedEmpty' | translate }}</p>
          }
        </aside>
      </div>

      @if (saveError(); as message) {
        <p-message severity="error" data-testid="insurances-form-save-error">{{
          message
        }}</p-message>
      }
      <div class="actions">
        <a
          pButton
          severity="secondary"
          [outlined]="true"
          [routerLink]="areaPath"
          data-testid="insurances-form-cancel"
        >
          {{ 'insurances.form.cancel' | translate }}
        </a>
        <button
          type="button"
          pButton
          [disabled]="saving()"
          (click)="save()"
          data-testid="insurances-form-save"
        >
          <app-icon name="save" />
          {{ (saving() ? 'insurances.form.saving' : 'insurances.form.save') | translate }}
        </button>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .back {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      color: var(--p-primary-color);
      text-decoration: none;
    }
    .title {
      margin: 0;
      font-size: 1.5rem;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 16rem;
      gap: 1rem;
      align-items: start;
    }
    .panels {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .panel,
    .derived {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
    }
    .derived {
      position: sticky;
      top: 1rem;
    }
    h2 {
      margin: 0 0 0.75rem;
      font-size: 1rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 0.75rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .span {
      grid-column: 1 / -1;
    }
    .error {
      color: var(--p-red-500);
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.85rem;
      margin: 0 0 0.5rem;
    }
    dl {
      margin: 0;
      display: grid;
      gap: 0.25rem;
    }
    dt {
      color: var(--p-text-muted-color);
      font-size: 0.8rem;
    }
    dd {
      margin: 0 0 0.5rem;
      font-weight: 600;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.75rem;
    }
    a.p-button {
      text-decoration: none;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: minmax(0, 1fr);
      }
      .grid {
        grid-template-columns: minmax(0, 1fr);
      }
      .derived {
        position: static;
      }
    }
  `,
})
export class InsurancesContractFormComponent {
  private readonly store = inject(InsurancesStore);
  private readonly service = inject(InsurancesService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(I18nService);

  protected readonly areaPath = AREA_PATH;
  protected readonly editId = signal<string | null>(this.route.snapshot.paramMap.get('id'));
  protected readonly f = signal<FormState>(emptyState());
  protected readonly submitted = signal(false);
  protected readonly saving = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly loadFailed = signal(false);
  private readonly serverIssues = signal<{ field: string; code: string }[]>([]);
  private prefilled = false;

  private readonly candidate = computed(() => this.toCandidate(this.f()));
  private readonly validation = computed(() => validateContract(this.candidate()));

  protected readonly detailFields = computed<readonly DetailField[]>(() => {
    const type = this.f().type;
    return type ? typeDef(type).detailFields : [];
  });

  protected readonly derived = computed(() => {
    const result = this.validation();
    if (!result.ok) return null;
    const lang = this.i18n.language();
    const contract = result.value;
    return {
      monthly: formatMoney(monthlyCostText(contract), lang),
      yearly: formatMoney(yearlyCostText(contract), lang),
      next: cancellationLabel(
        nextCancellationDate(contract, this.store.today()),
        (key, params) => fill(this.i18n.translate(key), params),
        lang,
      ),
    };
  });

  constructor() {
    this.store.ensureLoaded();
    const query = this.route.snapshot.queryParamMap;
    effect(() => {
      const loaded = this.store.loaded();
      const id = this.editId();
      untracked(() => {
        if (this.prefilled) return;
        if (id) {
          if (!loaded) return;
          const contract = this.store.contracts().find((c) => c.id === id);
          this.prefilled = true;
          if (contract) this.f.set(this.toState(contract));
          else this.loadFailed.set(true);
        } else {
          this.prefilled = true;
          const type = query.get('type');
          const premium = query.get('premium');
          if (type && isInsuranceTypeId(type)) {
            this.f.update((s) => ({
              ...s,
              type,
              name: this.i18n.translate(`insurances.types.${type}`),
              interval: 'MONTHLY',
              premium: premium ?? '',
              autoRenew: false,
            }));
          }
        }
      });
    });
  }

  protected typeOptions() {
    this.i18n.language();
    return GROUP_ORDER.map((group) => ({
      label: this.i18n.translate(`insurances.groups.${group}`),
      items: INSURANCE_TYPES.filter((t) => t.group === group).map((t) => {
        const type = this.i18n.translate(`insurances.types.${t.id}`);
        const classification = this.i18n.translate(`insurances.classes.${t.classification}`);
        return { label: type + ' · ' + classification, value: t.id };
      }),
    }));
  }

  protected coverOptions() {
    return INSURANCE_TYPES.filter((t) => t.id !== this.f().type && !t.social).map((t) => ({
      label: this.i18n.translate(`insurances.types.${t.id}`),
      value: t.id,
    }));
  }

  protected statusOptions() {
    return (['ACTIVE', 'CANCELLED', 'ENDED'] as const).map((value) => ({
      label: this.i18n.translate(`insurances.status.${value}`),
      value,
    }));
  }

  protected intervalOptions() {
    return (['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const).map((value) => ({
      label: this.i18n.translate(`insurances.intervals.${value}`),
      value,
    }));
  }

  protected unitOptions() {
    return (['MONTHS', 'WEEKS'] as const).map((value) => ({
      label: this.i18n.translate(`insurances.units.${value}`),
      value,
    }));
  }

  protected monthOptions() {
    const lang = this.i18n.language();
    return Array.from({ length: 12 }, (_, i) => ({ label: monthName(i + 1, lang), value: i + 1 }));
  }

  protected isMoney(field: DetailField): boolean {
    return MONEY_DETAILS.includes(field);
  }

  protected patch(partial: Partial<FormState>): void {
    this.f.update((s) => ({ ...s, ...partial }));
  }

  protected patchDetail(field: DetailField, value: string): void {
    this.f.update((s) => ({ ...s, details: { ...s.details, [field]: value } }));
  }

  protected setType(type: InsuranceTypeId): void {
    const social = typeDef(type).social;
    this.f.update((s) => ({
      ...s,
      type,
      name: s.name.trim() === '' ? this.i18n.translate(`insurances.types.${type}`) : s.name,
      interval: social ? 'MONTHLY' : s.interval,
      alsoCovers: s.alsoCovers.filter((t) => t !== type),
    }));
  }

  protected fieldError(field: string): string | null {
    if (!this.submitted() && this.serverIssues().length === 0) return null;
    const local = this.validation();
    const issue =
      (!local.ok ? local.issues.find((i) => i.field === field) : undefined) ??
      this.serverIssues().find((i) => i.field === field);
    return issue ? this.i18n.translate(`insurances.fieldErrors.${issue.code}`) : null;
  }

  protected save(): void {
    this.submitted.set(true);
    this.saveError.set(null);
    this.serverIssues.set([]);
    const result = this.validation();
    if (!result.ok) return;
    const input = result.value as InsuranceContractInput;
    this.saving.set(true);
    const id = this.editId();
    (id ? this.service.update(id, input) : this.service.create(input)).subscribe({
      next: () => {
        this.saving.set(false);
        this.store.refresh();
        void this.router.navigate([AREA_PATH, 'contracts']);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const { code, details } = insurancesErrorOf(error);
        this.serverIssues.set(details.map((d) => ({ field: d.field, code: d.message })));
        const key = `insurances.errors.${code}`;
        const text = this.i18n.translate(key);
        this.saveError.set(text === key ? this.i18n.translate('insurances.form.saveFailed') : text);
      },
    });
  }

  private toCandidate(s: FormState): unknown {
    const body: Record<string, unknown> = {
      type: s.type ?? undefined,
      name: s.name,
      status: s.status,
      startDate: s.startDate,
      premium: parseAmountInput(s.premium) ?? s.premium,
      interval: s.interval,
      cancellation: cancellationOf(s),
      reminderEnabled: s.reminderEnabled,
    };
    const details = detailsOf(s);
    const optional: [string, unknown][] = [
      ['insurer', s.insurer.trim() ? s.insurer : undefined],
      ['contractNumber', s.contractNumber.trim() ? s.contractNumber : undefined],
      ['endDate', s.endDate || undefined],
      ['paymentMonth', s.interval !== 'MONTHLY' ? (s.paymentMonth ?? undefined) : undefined],
      ['details', Object.keys(details).length > 0 ? details : undefined],
      ['alsoCovers', s.alsoCovers.length > 0 ? s.alsoCovers : undefined],
      ['note', s.note.trim() ? s.note : undefined],
    ];
    for (const [key, value] of optional) if (value !== undefined) body[key] = value;
    return body;
  }

  private toState(c: Contract): FormState {
    return {
      type: c.type,
      name: c.name,
      insurer: c.insurer ?? '',
      contractNumber: c.contractNumber ?? '',
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate ?? '',
      premium: c.premium,
      interval: c.interval,
      paymentMonth: c.paymentMonth ?? null,
      periodValue: c.cancellation.period ? String(c.cancellation.period.value) : '',
      periodUnit: c.cancellation.period?.unit ?? 'MONTHS',
      autoRenew: c.cancellation.autoRenew,
      renewalMonths: c.cancellation.renewalMonths ? String(c.cancellation.renewalMonths) : '',
      minimumTermMonths: c.cancellation.minimumTermMonths
        ? String(c.cancellation.minimumTermMonths)
        : '',
      useFixedDate: !!c.cancellation.fixedDate,
      fixedDay: c.cancellation.fixedDate ? String(c.cancellation.fixedDate.day) : '',
      fixedMonth: c.cancellation.fixedDate ? String(c.cancellation.fixedDate.month) : '',
      reminderEnabled: c.reminderEnabled,
      details: { ...(c.details ?? {}) } as Record<string, string>,
      alsoCovers: [...(c.alsoCovers ?? [])],
      note: c.note ?? '',
    };
  }
}
