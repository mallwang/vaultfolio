import { UpperCasePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, effect, inject, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CheckboxModule } from 'primeng/checkbox';
import { DialogModule } from 'primeng/dialog';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import {
  DEFAULT_LANGUAGE_CODE,
  type InsuranceContract,
  type InsuranceContractInput,
  type InsuranceSettings,
  type LanguageCode,
  type ProfileSummary,
} from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { nextCancellationDate } from '@vaultfolio/insurances';
import { fill, formatDate, formatDateShort, reminderSendDate } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService } from '../insurances.service';
import { buildReminderPreview } from './reminder-preview';

const LEAD_DAYS = [7, 14, 30, 60, 90, 120] as const;

/** Reminders modal (design.md "Erinnerungen", Story 4): global switch, lead time and one switch per contract. */
@Component({
  selector: 'app-insurances-reminders',
  imports: [
    UpperCasePipe,
    FormsModule,
    RouterLink,
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
      [style]="{ width: '48rem' }"
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

        <div class="global">
          <label class="check">
            <p-checkbox
              [binary]="true"
              [ngModel]="enabled()"
              (ngModelChange)="setEnabled($event)"
              inputId="insurances-reminders-enabled"
              data-testid="insurances-reminders-enabled"
            />
            <span>{{ 'insurances.reminders.enabled' | translate }}</span>
          </label>
          <label class="lead">
            <span>{{ 'insurances.reminders.leadDays' | translate }}</span>
            <p-select
              [options]="leadOptions()"
              optionLabel="label"
              optionValue="value"
              [ngModel]="settings().reminders.leadDays"
              (ngModelChange)="setLeadDays($event)"
              [disabled]="!enabled()"
              appendTo="body"
              data-testid="insurances-reminders-lead"
            />
          </label>
        </div>

        <h2>{{ 'insurances.reminders.perContract' | translate }}</h2>
        <p-message severity="info" data-testid="insurances-reminders-note">{{
          'insurances.reminders.note' | translate
        }}</p-message>
        @if (contracts().length === 0) {
          <p class="muted">{{ 'insurances.reminders.none' | translate }}</p>
        }
        <ul class="items" data-testid="insurances-reminders-list">
          @for (c of contracts(); track c.id) {
            <li
              [class.muted-row]="!enabled()"
              [attr.data-testid]="'insurances-reminders-row-' + c.id"
            >
              <p-checkbox
                [binary]="true"
                [ngModel]="c.reminderEnabled"
                (ngModelChange)="setContract(c, $event)"
                [disabled]="!enabled()"
                [inputId]="'insurances-reminders-contract-' + c.id"
                [attr.data-testid]="'insurances-reminders-contract-' + c.id"
              />
              <label [for]="'insurances-reminders-contract-' + c.id">
                <span class="name">{{ c.name }}</span>
                <span class="type">{{ 'insurances.types.' + c.type | translate }}</span>
                <span
                  class="send"
                  [class.send--on]="sendScheduled(c)"
                  [attr.data-testid]="'insurances-reminders-send-' + c.id"
                >
                  <app-icon
                    size="1.15em"
                    [name]="sendScheduled(c) ? 'notifications-active' : 'notifications-off'"
                  />
                  {{ sendLabel(c) }}
                </span>
              </label>
            </li>
          }
        </ul>

        @if (preview(); as mail) {
          <section
            class="mail"
            [class.mail--off]="!enabled()"
            data-testid="insurances-reminders-preview"
          >
            <h3>
              <span
                >{{ 'insurances.reminders.preview' | translate }} ·
                {{ emailLanguage() | uppercase }}</span
              >
              @if (languageMismatch()) {
                <span class="mail__warn" data-testid="insurances-reminders-language-warning">
                  {{ languageWarning() }}
                  <a routerLink="/app/settings/preferences" (click)="visible.set(false)">{{
                    'insurances.reminders.languageSettings' | translate
                  }}</a>
                </span>
              }
            </h3>
            <p class="mail__subject">{{ mail.subject }}</p>
            <p>{{ mail.greeting }}</p>
            <p>{{ mail.body }}</p>
            <p class="mail__link">{{ mail.link }}</p>
            <p>{{ mail.signature }}</p>
            <p class="mail__footer">{{ mail.footer }}</p>
          </section>
        }
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
    .global {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
    }
    .check,
    .lead,
    .items li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .lead {
      font-size: 0.875rem;
    }
    /* Three rows of two cards stay visible; more contracts scroll. */
    .items {
      --row: 4.75rem;
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-auto-rows: var(--row);
      gap: 0.5rem;
      max-height: calc(3 * var(--row) + 2 * 0.5rem);
      overflow-y: auto;
    }
    .items li {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius);
      padding: 0 0.75rem;
    }
    .items li.muted-row {
      opacity: 0.6;
    }
    .items label {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .name,
    .send,
    .type {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .send,
    .type {
      color: var(--p-text-muted-color);
      font-size: 0.8rem;
    }
    .send {
      color: var(--p-orange-600);
    }
    .send--on {
      color: var(--p-teal-600);
    }
    @media (max-width: 700px) {
      .items {
        grid-template-columns: 1fr;
      }
    }
    .mail {
      background: var(--p-surface-100);
      color: var(--p-surface-700);
      border-radius: var(--p-content-border-radius);
      padding: 0.75rem 1rem;
      font-size: 0.85rem;
    }
    .mail--off {
      opacity: 0.55;
    }
    .mail__warn {
      margin-left: 0.5rem;
      text-transform: none;
      letter-spacing: 0;
      font-weight: 600;
      color: var(--p-orange-600);
    }
    .mail__warn a {
      color: inherit;
      text-decoration: underline;
    }
    .mail h3 {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      margin: 0 0 0.5rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--p-surface-500);
    }
    .mail p {
      margin: 0 0 0.4rem;
    }
    .mail__subject {
      font-weight: 600;
      padding-bottom: 0.4rem;
      border-bottom: 1px solid var(--p-surface-300);
    }
    .mail__link {
      color: var(--p-primary-color);
      text-decoration: underline;
    }
    .mail__footer {
      font-size: 0.75rem;
      color: var(--p-surface-500);
      margin: 0;
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
  private readonly http = inject(HttpClient);
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

  protected readonly enabled = computed(() => this.settings().reminders.enabled);
  protected readonly emailLanguage = signal<LanguageCode>(DEFAULT_LANGUAGE_CODE);

  /** Preview of the e-mail for the first contract that can remind, in the account's e-mail language. */
  protected readonly preview = computed(() => {
    const contract = this.contracts()[0];
    if (!contract) return null;
    const info = nextCancellationDate(contract, this.store.today());
    return info.kind === 'DEADLINE'
      ? buildReminderPreview(
          this.emailLanguage(),
          contract,
          formatDate(info.date, this.emailLanguage()),
        )
      : null;
  });

  protected readonly languageMismatch = computed(
    () => this.emailLanguage() !== this.i18n.language(),
  );

  private profileLoaded = false;

  constructor() {
    this.store.ensureLoaded();
    effect(() => {
      if (this.visible() && !this.profileLoaded) {
        this.profileLoaded = true;
        this.loadEmailLanguage();
      }
    });
  }

  private loadEmailLanguage(): void {
    this.http.get<ProfileSummary>('/api/profile').subscribe({
      next: (profile) => this.emailLanguage.set(profile.emailLanguage ?? DEFAULT_LANGUAGE_CODE),
      error: () => (this.profileLoaded = false),
    });
  }

  protected leadOptions() {
    return LEAD_DAYS.map((days) => ({
      label: fill(this.i18n.translate('insurances.reminders.leadDaysOption'), { days }),
      value: days,
    }));
  }

  protected languageWarning(): string {
    return fill(this.i18n.translate('insurances.reminders.languageWarning'), {
      language: this.i18n.translate(`insurances.reminders.languageName.${this.emailLanguage()}`),
    });
  }

  protected sendScheduled(contract: InsuranceContract): boolean {
    return (
      this.enabled() &&
      contract.reminderEnabled &&
      nextCancellationDate(contract, this.store.today()).kind === 'DEADLINE'
    );
  }

  /** The mail goes out on the first daily run inside the lead window: deadline − lead days, or today if already inside. */
  protected sendLabel(contract: InsuranceContract): string {
    const info = nextCancellationDate(contract, this.store.today());
    if (!this.sendScheduled(contract) || info.kind !== 'DEADLINE') {
      return this.i18n.translate('insurances.reminders.sendNone');
    }
    const date = reminderSendDate(
      info.date,
      this.settings().reminders.leadDays,
      this.store.today(),
    );
    return fill(this.i18n.translate('insurances.reminders.sendOn'), {
      date: formatDateShort(date, this.i18n.language()),
    });
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
