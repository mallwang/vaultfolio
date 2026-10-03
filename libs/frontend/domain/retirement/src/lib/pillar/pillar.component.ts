import { Component, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { ConfirmationService } from 'primeng/api';
import type { RetirementPillar, RetirementRecord } from '@vaultfolio/api-contract';
import { I18nService, IconComponent, TranslatePipe } from '@vaultfolio/frontend-shared-ui';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { ContractCardComponent } from '../contract-card/contract-card.component';
import { fill } from '../retirement-format';
import { RetirementService } from '../retirement.service';

/** Where the "add" button of each pillar starts the manual form. */
const ADD_TYPE: Record<RetirementPillar, string> = {
  STATUTORY: 'STATUTORY_PENSION',
  OCCUPATIONAL: 'OCCUPATIONAL',
  PRIVATE: 'RIESTER',
};

/**
 * One pillar tab (Gesetzlich / Betrieblich / Privat): the contract cards of the pillar, an empty
 * state with both ways to add the first entry, and an add button below the list. The pillar comes
 * from the route's `data.pillar`. Deleting asks for confirmation first (FR-015); the list reloads
 * whenever any retirement write succeeded.
 */
@Component({
  selector: 'app-retirement-pillar',
  imports: [
    RouterLink,
    ButtonModule,
    ConfirmDialogModule,
    MessageModule,
    IconComponent,
    TranslatePipe,
    ContractCardComponent,
    EmptyStateComponent,
  ],
  providers: [ConfirmationService],
  template: `
    <p-confirmdialog
      [pt]="{
        pcAcceptButton: { root: { 'data-testid': 'retirement-confirm-accept' } },
        pcRejectButton: { root: { 'data-testid': 'retirement-confirm-reject' } },
      }"
    >
      <ng-template #icon><app-icon name="warning" /></ng-template>
    </p-confirmdialog>

    @if (loadFailed()) {
      <p-message severity="error" data-testid="retirement-pillar-error">{{
        'retirement.errors.loadFailed' | translate
      }}</p-message>
    }
    @if (deleteFailed()) {
      <p-message severity="error" data-testid="retirement-pillar-delete-error">{{
        'retirement.errors.deleteFailed' | translate
      }}</p-message>
    }

    @if (records(); as list) {
      @if (list.length === 0 && !loadFailed()) {
        <app-retirement-empty-state
          testId="retirement-pillar-empty"
          [titleKey]="'retirement.pillarView.empty.' + pillarKey + '.title'"
          [bodyKey]="'retirement.pillarView.empty.' + pillarKey + '.body'"
          [manualLink]="['/app/retirement/new', addType()]"
          [from]="pillarKey"
        />
      }
      <div class="cards">
        @for (record of list; track record.id) {
          <app-retirement-contract-card [record]="record" (remove)="confirmDelete($event)" />
        }
      </div>
    }

    @if (records()?.length) {
      <div class="add">
        @if (canAdd()) {
          <a
            pButton
            severity="secondary"
            [outlined]="true"
            [routerLink]="['/app/retirement/new', addType()]"
            [queryParams]="{ from: pillarKey }"
            data-testid="retirement-pillar-add"
          >
            <app-icon name="plus" /> {{ 'retirement.pillarView.add.' + pillarKey | translate }}
          </a>
        }
        <a
          pButton
          [outlined]="true"
          routerLink="/app/retirement/import"
          [queryParams]="{ from: pillarKey }"
          data-testid="retirement-pillar-upload"
        >
          <app-icon name="upload" /> {{ 'retirement.toolbar.upload' | translate }}
        </a>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(28rem, 100%), 1fr));
      gap: 0.75rem;
    }
    .add {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    a.p-button {
      text-decoration: none;
    }
  `,
})
export class PillarComponent {
  private readonly service = inject(RetirementService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);

  protected readonly pillar = this.route.snapshot.data['pillar'] as RetirementPillar;
  protected readonly pillarKey = this.pillar.toLowerCase();
  protected readonly loadFailed = signal(false);
  protected readonly deleteFailed = signal(false);
  protected readonly records = signal<RetirementRecord[] | null>(null);

  constructor() {
    toObservable(this.service.changes)
      .pipe(
        switchMap(() =>
          this.service.records(this.pillar).pipe(
            catchError(() => {
              this.loadFailed.set(true);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((list) => {
        if (list) {
          this.loadFailed.set(false);
          this.records.set(list);
        }
      });
  }

  protected addType(): string {
    return ADD_TYPE[this.pillar];
  }

  /** The statutory pension is a single record: adding is only offered while there is none. */
  protected canAdd(): boolean {
    return this.pillar !== 'STATUTORY' || (this.records()?.length ?? 1) === 0;
  }

  protected confirmDelete(record: RetirementRecord): void {
    const name =
      record.providerLabel ?? this.i18n.translate(`retirement.types.${record.contractType}`);
    this.confirmation.confirm({
      header: this.i18n.translate('retirement.pillarView.deleteHeader'),
      message: fill(this.i18n.translate('retirement.pillarView.deleteMessage'), { name }),
      acceptLabel: this.i18n.translate('retirement.card.delete'),
      rejectLabel: this.i18n.translate('retirement.form.cancel'),
      acceptButtonProps: { severity: 'danger' },
      rejectButtonProps: { severity: 'secondary', outlined: true },
      accept: () => {
        this.deleteFailed.set(false);
        this.service.delete(record.id).subscribe({ error: () => this.deleteFailed.set(true) });
      },
    });
  }
}
