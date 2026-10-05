import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import type { InsuranceSettings } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import type { Classification, Employment, Profile } from '@vaultfolio/insurances';
import { fill } from '../insurances-format';
import { InsurancesStore } from '../insurances-store';
import { InsurancesService } from '../insurances.service';

type FlagKey = 'ownsProperty' | 'ownsCar' | 'hasChildren' | 'hasPets' | 'travelsAbroad';
const FLAGS: readonly FlagKey[] = [
  'ownsProperty',
  'ownsCar',
  'hasChildren',
  'hasPets',
  'travelsAbroad',
];
const EMPLOYMENTS: readonly Employment[] = ['EMPLOYED', 'SELF_EMPLOYED', 'CIVIL_SERVANT', 'OTHER'];

/**
 * Gap check tab (design.md "Lückencheck", Story 6): the profile, missing and covered insurances,
 * possible duplicates and hidden suggestions. Always labelled as general guidance (FR-016).
 */
@Component({
  selector: 'app-insurances-gap-check',
  imports: [
    FormsModule,
    ButtonModule,
    CheckboxModule,
    MessageModule,
    SelectModule,
    IconComponent,
    TranslatePipe,
  ],
  template: `
    <p-message severity="info" data-testid="insurances-gap-note">{{
      'insurances.gap.note' | translate
    }}</p-message>
    @if (failed()) {
      <p-message severity="error" data-testid="insurances-gap-error">{{
        'insurances.gap.saveFailed' | translate
      }}</p-message>
    }

    <div class="layout">
      <section class="panel" data-testid="insurances-gap-profile">
        <h2>{{ 'insurances.gap.profileTitle' | translate }}</h2>
        @for (flag of flags; track flag) {
          <label class="check">
            <p-checkbox
              [binary]="true"
              [ngModel]="profile()[flag]"
              (ngModelChange)="setFlag(flag, $event)"
              [inputId]="'insurances-profile-' + flag"
              [attr.data-testid]="'insurances-profile-' + flag"
            />
            <span>{{ 'insurances.gap.' + flag | translate }}</span>
          </label>
        }
        <label class="field">
          <span>{{ 'insurances.gap.employment' | translate }}</span>
          <p-select
            [options]="employmentOptions()"
            optionLabel="label"
            optionValue="value"
            [ngModel]="profile().employment"
            (ngModelChange)="setEmployment($event)"
            fluid
            data-testid="insurances-profile-employment"
          />
        </label>
      </section>

      <section class="panel" data-testid="insurances-gap-missing">
        <h2>{{ 'insurances.gap.missingTitle' | translate }}</h2>
        @if (gaps().missing.length === 0) {
          <p class="muted">{{ 'insurances.gap.missingEmpty' | translate }}</p>
        }
        <ul class="items">
          @for (m of gaps().missing; track m.requirement) {
            <li [attr.data-testid]="'insurances-gap-missing-' + m.requirement">
              <div class="item__main">
                <strong>{{ name(m.requirement) }}</strong>
                <span class="tag" [class.tag--essential]="m.classification === 'ESSENTIAL'">{{
                  classLabel(m.classification)
                }}</span>
                <div class="muted">{{ why(m.requirement) }}</div>
              </div>
              <button
                type="button"
                pButton
                [text]="true"
                severity="secondary"
                size="small"
                [attr.data-testid]="'insurances-gap-dismiss-' + m.requirement"
                (click)="dismiss(m.requirement)"
              >
                {{ 'insurances.gap.dismiss' | translate }}
              </button>
            </li>
          }
        </ul>
      </section>
    </div>

    <div class="layout layout--three">
      <section class="panel" data-testid="insurances-gap-covered">
        <h2>{{ 'insurances.gap.coveredTitle' | translate }}</h2>
        @if (gaps().covered.length === 0) {
          <p class="muted">{{ 'insurances.gap.coveredEmpty' | translate }}</p>
        }
        <ul class="items">
          @for (c of gaps().covered; track c.requirement) {
            <li [attr.data-testid]="'insurances-gap-covered-' + c.requirement">
              <div class="item__main">
                <app-icon name="check-circle" /> {{ name(c.requirement) }}
                @if (c.linked) {
                  <span class="tag tag--source">{{
                    'insurances.gap.fromEarnings' | translate
                  }}</span>
                }
              </div>
            </li>
          }
        </ul>
      </section>

      <section class="panel" data-testid="insurances-gap-redundant">
        <h2>{{ 'insurances.gap.redundantTitle' | translate }}</h2>
        @if (gaps().redundant.length === 0) {
          <p class="muted">{{ 'insurances.gap.redundantEmpty' | translate }}</p>
        }
        <ul class="items">
          @for (r of gaps().redundant; track r.contractId + r.otherContractId) {
            <li>
              <div class="item__main"><app-icon name="warning" /> {{ redundantText(r) }}</div>
            </li>
          }
        </ul>
      </section>

      <section class="panel" data-testid="insurances-gap-dismissed">
        <h2>{{ 'insurances.gap.dismissedTitle' | translate }}</h2>
        @if (gaps().dismissed.length === 0) {
          <p class="muted">{{ 'insurances.gap.dismissedEmpty' | translate }}</p>
        }
        <ul class="items">
          @for (d of gaps().dismissed; track d.requirement) {
            <li [attr.data-testid]="'insurances-gap-dismissed-' + d.requirement">
              <div class="item__main">{{ name(d.requirement) }}</div>
              <button
                type="button"
                pButton
                [text]="true"
                severity="secondary"
                size="small"
                [attr.data-testid]="'insurances-gap-restore-' + d.requirement"
                (click)="restore(d.requirement)"
              >
                {{ 'insurances.gap.restore' | translate }}
              </button>
            </li>
          }
        </ul>
      </section>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem;
    }
    .layout {
      display: grid;
      grid-template-columns: 18rem minmax(0, 1fr);
      gap: 1rem;
      align-items: start;
    }
    .layout--three {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .panel {
      border: 1px solid var(--p-content-border-color);
      border-radius: var(--p-content-border-radius, 0.5rem);
      background: var(--p-content-background);
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    h2 {
      margin: 0 0 0.25rem;
      font-size: 1rem;
    }
    .check {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      font-size: 0.875rem;
    }
    .items {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .items li {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.5rem;
    }
    .item__main {
      flex: 1;
      min-width: 0;
    }
    .muted {
      color: var(--p-text-muted-color);
      font-size: 0.85rem;
      margin: 0;
    }
    .tag {
      display: inline-block;
      margin-left: 0.5rem;
      padding: 0.05rem 0.5rem;
      border-radius: 1rem;
      background: color-mix(in srgb, var(--p-text-color) 10%, transparent);
      font-size: 0.75rem;
    }
    .tag--essential {
      background: color-mix(in srgb, var(--p-red-500) 18%, transparent);
    }
    .tag--source {
      background: color-mix(in srgb, var(--p-green-500) 20%, transparent);
    }
    @media (max-width: 900px) {
      .layout,
      .layout--three {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
})
export class InsurancesGapCheckComponent {
  protected readonly store = inject(InsurancesStore);
  private readonly service = inject(InsurancesService);
  private readonly i18n = inject(I18nService);

  protected readonly flags = FLAGS;
  protected readonly gaps = this.store.gaps;
  protected readonly profile = computed<Profile>(() => this.store.settings().profile);
  protected readonly failed = signal(false);

  protected employmentOptions() {
    return EMPLOYMENTS.map((value) => ({
      label: this.i18n.translate(`insurances.employment.${value}`),
      value,
    }));
  }

  protected name(id: string): string {
    return this.i18n.translate(`insurances.requirements.${id}.name`);
  }

  protected why(id: string): string {
    return this.i18n.translate(`insurances.requirements.${id}.why`);
  }

  protected classLabel(c: Classification): string {
    return this.i18n.translate(`insurances.classes.${c}`);
  }

  protected redundantText(r: {
    contractId: string;
    otherContractId: string;
    reason: 'COMBINATION' | 'INCLUDED_IN';
  }): string {
    const nameOf = (id: string) => this.store.contracts().find((c) => c.id === id)?.name ?? '';
    return fill(
      this.i18n.translate(
        r.reason === 'COMBINATION'
          ? 'insurances.gap.redundantCombination'
          : 'insurances.gap.redundantIncluded',
      ),
      { name: nameOf(r.contractId), other: nameOf(r.otherContractId) },
    );
  }

  protected setFlag(flag: FlagKey, value: boolean): void {
    this.save({ ...this.store.settings(), profile: { ...this.profile(), [flag]: value } });
  }

  protected setEmployment(employment: Employment): void {
    this.save({ ...this.store.settings(), profile: { ...this.profile(), employment } });
  }

  protected dismiss(id: string): void {
    const settings = this.store.settings();
    this.save({
      ...settings,
      dismissedRequirements: [...settings.dismissedRequirements, id as never],
    });
  }

  protected restore(id: string): void {
    const settings = this.store.settings();
    this.save({
      ...settings,
      dismissedRequirements: settings.dismissedRequirements.filter((r) => r !== id),
    });
  }

  private save(next: InsuranceSettings): void {
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
