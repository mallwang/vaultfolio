import { Component, computed, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import type {
  InsuranceContract,
  InsuranceContractInput,
  InsuranceSettings,
} from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { nextCancellationDate } from '@vaultfolio/insurances';
import { fill } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService } from '../insurances.service';

const LEAD_DAYS = [7, 14, 30, 60, 90, 120] as const;

/** Reminders modal (design.md "Erinnerungen", Story 4): global switch, lead time and one switch per contract. */
@Component({
  selector: 'app-insurances-reminders',
  imports: [
    FormsModule,
    CheckboxModule,
    DialogModule,
    MessageModule,
    SelectModule,
    IconComponent,
    TranslatePipe,
  ],
  template: `
    <p-dialog
      [header]="'insurances.reminders.title' | translate"
      [modal]="true"
      [dismissableMask]="true"
      [draggable]="false"
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      [style]="{ width: '40rem' }"
      [breakpoints]="{ '700px': '94vw' }"
      [pt]="{
        root: { 'data-testid': 'insurances-reminders-dialog' },
        pcCloseButton: { root: { 'data-testid': 'insurances-reminders-close' } },
      }"
    >
      <ng-template #closeicon><app-icon name="close" /></ng-template>
      <div class="body">
        @if (failed()) {
          <p-message severity="error" data-testid="insurances-reminders-error">{{
            'insurances.reminders.saveFailed' | translate
          }}</p-message>
        }

        <label class="check">
          <p-checkbox
            [binary]="true"
            [ngModel]="settings().reminders.enabled"
            (ngModelChange)="setEnabled($event)"
            inputId="insurances-reminders-enabled"
            data-testid="insurances-reminders-enabled"
          />
          <span>{{ 'insurances.reminders.enabled' | translate }}</span>
        </label>
        <label class="field">
          <span>{{ 'insurances.reminders.leadDays' | translate }}</span>
          <p-select
            [options]="leadOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="settings().reminders.leadDays"
            (ngModelChange)="setLeadDays($event)"
            appendTo="body"
            data-testid="insurances-reminders-lead"
          />
        </label>

        <h2>{{ 'insurances.reminders.perContract' | translate }}</h2>
        @if (contracts().length === 0) {
          <p class="muted">{{ 'insurances.reminders.none' | translate }}</p>
        }
        <ul class="items">
          @for (c of contracts(); track c.id) {
            <li [attr.data-testid]="'insurances-reminders-row-' + c.id">
              <p-checkbox
                [binary]="true"
                [ngModel]="c.reminderEnabled"
                (ngModelChange)="setContract(c, $event)"
                [inputId]="'insurances-reminders-contract-' + c.id"
                [attr.data-testid]="'insurances-reminders-contract-' + c.id"
              />
              <label [for]="'insurances-reminders-contract-' + c.id">{{ c.name }}</label>
            </li>
          }
        </ul>
        <p class="muted">{{ 'insurances.reminders.note' | translate }}</p>
      </div>
    </p-dialog>
  `,
  styles: `
    .body {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    h2 {
      margin: 0.5rem 0 0;
      font-size: 1rem;
    }
    .check,
    .items li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
      max-width: 14rem;
    }
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.85rem;
      margin: 0;
    }
  `,
})
export class InsurancesRemindersComponent {
  private readonly store = inject(InsurancesStore);
  private readonly service = inject(InsurancesService);
  private readonly i18n = inject(I18nService);

  readonly visible = model(false);

  protected readonly settings = this.store.settings;
  protected readonly failed = signal(false);

  /** Active contracts that have a cancellation deadline (the only ones that can remind). */
  protected readonly contracts = computed<InsuranceContract[]>(() =>
    this.store
      .contracts()
      .filter((c) => nextCancellationDate(c, this.store.today()).kind === 'DEADLINE'),
  );

  constructor() {
    this.store.ensureLoaded();
  }

  protected leadOptions() {
    return LEAD_DAYS.map((days) => ({
      label: fill(this.i18n.translate('insurances.reminders.leadDaysOption'), { days }),
      value: days,
    }));
  }

  protected setEnabled(enabled: boolean): void {
    this.saveSettings({
      ...this.settings(),
      reminders: { ...this.settings().reminders, enabled },
    });
  }

  protected setLeadDays(leadDays: number): void {
    this.saveSettings({
      ...this.settings(),
      reminders: { ...this.settings().reminders, leadDays },
    });
  }

  protected setContract(contract: InsuranceContract, reminderEnabled: boolean): void {
    const input: Record<string, unknown> = { ...contract, reminderEnabled };
    delete input['id'];
    delete input['createdAt'];
    delete input['updatedAt'];
    this.failed.set(false);
    this.service.update(contract.id, input as unknown as InsuranceContractInput).subscribe({
      next: () => this.store.refresh(),
      error: () => {
        this.failed.set(true);
        this.store.refresh();
      },
    });
  }

  private saveSettings(next: InsuranceSettings): void {
    this.failed.set(false);
    this.store.setSettings(next);
    this.service.saveSettings(next).subscribe({
      next: (saved) => this.store.setSettings(saved),
      error: () => {
        this.failed.set(true);
        this.store.refresh();
      },
    });
  }
}
