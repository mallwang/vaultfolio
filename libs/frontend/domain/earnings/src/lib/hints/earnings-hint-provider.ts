import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import type { DataCheckRow } from '@vaultfolio/api-contract';
import type { Hint, HintProvider } from '@vaultfolio/frontend-hints';
import { EarningsService } from '../earnings.service';

/** Yields one hint per data-check row that has differences or a MISSING completeness status. */
@Injectable({ providedIn: 'root' })
export class EarningsHintProvider implements HintProvider {
  private readonly service = inject(EarningsService);
  private readonly rows = signal<readonly DataCheckRow[]>([]);
  private readonly _ready = signal(false);

  readonly hints: Signal<readonly Hint[]> = computed(() =>
    this.rows()
      .filter(
        (row) =>
          row.ytd.differences.length > 0 ||
          row.certificate.differences.length > 0 ||
          row.completeness.status === 'MISSING',
      )
      .map((row) => ({
        id: `earnings.data-check.${row.employerId}.${row.year}`,
        severity: 'warning' as const,
        titleKey: 'hints.earnings.dataCheck.title',
        descriptionKey:
          row.completeness.status === 'MISSING'
            ? 'hints.earnings.dataCheck.descriptionMissing'
            : 'hints.earnings.dataCheck.description',
        params: { employerLabel: row.employerLabel, year: row.year },
        target: { commands: ['/app', 'earnings', 'data-check'] },
        linkLabelKey: 'hints.earnings.dataCheck.linkLabel',
      })),
  );

  readonly ready: Signal<boolean> = computed(() => this._ready());

  load(): void {
    this.fetchRows();
  }

  refresh(): void {
    this.fetchRows();
  }

  private fetchRows(): void {
    this.service.dataCheck().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this._ready.set(true);
      },
      error: () => {
        this.rows.set([]);
        this._ready.set(true);
      },
    });
  }
}
