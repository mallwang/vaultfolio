import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import type { EarningsEmployer, EarningsOverview } from '@vaultfolio/api-contract';
import { catchError, of, switchMap } from 'rxjs';
import { EarningsService } from '../earnings.service';

/** Sentinel value of the employer filter for "All employers". */
export const ALL_EMPLOYERS = 'ALL';

/**
 * State shared by the Earnings area and its tabs (FR-023): the employer filter, the detected
 * employers and the overview of the current selection (which also drives the empty state and the
 * Data check badge). Provided by `EarningsAreaComponent`, so every tab of one visit shares it.
 * `reload()` refetches after an import was deleted or an employer renamed.
 */
@Injectable()
export class EarningsFilterStore {
  private readonly api = inject(EarningsService);

  readonly employers = signal<EarningsEmployer[]>([]);
  readonly selection = signal<string>(ALL_EMPLOYERS);
  readonly overview = signal<EarningsOverview | null>(null);
  readonly loadError = signal(false);
  private readonly version = signal(0);

  /** `null` = all employers; passed as `?employer=` to every read call. */
  readonly employerId = computed(() =>
    this.selection() === ALL_EMPLOYERS ? null : this.selection(),
  );
  /** `null` while the first overview is loading. */
  readonly hasData = computed(() => this.overview()?.hasData ?? null);
  readonly dataCheckIssues = computed(() => this.overview()?.dataCheckIssues ?? 0);
  readonly unavailable = this.api.unavailable;
  /** Changes whenever the tabs should refetch: another employer, or `reload()`. */
  readonly query = computed(() => ({ employerId: this.employerId(), version: this.version() }));

  constructor() {
    toObservable(this.query)
      .pipe(
        switchMap(({ employerId }) =>
          this.api.overview(employerId).pipe(
            catchError(() => {
              this.loadError.set(true);
              return of(null);
            }),
          ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((overview) => {
        if (overview) this.loadError.set(false);
        this.overview.set(overview);
      });
    this.loadEmployers();
  }

  select(value: string | null | undefined): void {
    this.selection.set(value || ALL_EMPLOYERS);
  }

  reload(): void {
    this.version.update((v) => v + 1);
    this.loadEmployers();
  }

  labelOf(employer: EarningsEmployer): string {
    return employer.displayName ?? employer.detectedName;
  }

  private loadEmployers(): void {
    this.api
      .employers()
      .pipe(catchError(() => of([] as EarningsEmployer[])))
      .subscribe((employers) => {
        this.employers.set(employers);
        const selected = this.employerId();
        if (selected && !employers.some((e) => e.id === selected))
          this.selection.set(ALL_EMPLOYERS);
      });
  }
}
