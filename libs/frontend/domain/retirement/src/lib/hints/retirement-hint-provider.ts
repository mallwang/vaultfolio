import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import type { RetirementRecord } from '@vaultfolio/api-contract';
import type { Hint, HintProvider } from '@vaultfolio/frontend-hints';
import { I18nService } from '@vaultfolio/frontend-shared-ui';
import { isOutdated } from '@vaultfolio/retirement';
import { RetirementService } from '../retirement.service';

/** Yields a warning per statement older than 12 months and an info per OCR-read record to double-check. */
@Injectable({ providedIn: 'root' })
export class RetirementHintProvider implements HintProvider {
  private readonly service = inject(RetirementService);
  private readonly i18n = inject(I18nService);
  private readonly records = signal<readonly RetirementRecord[]>([]);
  private readonly _ready = signal(false);

  readonly hints: Signal<readonly Hint[]> = computed(() => {
    this.i18n.language();
    const now = new Date();
    const result: Hint[] = [];
    for (const record of this.records()) {
      const params = {
        contractName:
          record.providerLabel ?? this.i18n.translate(`retirement.types.${record.contractType}`),
      };
      const target = {
        commands: ['/app', 'retirement', record.id, 'edit'],
        queryParams: { from: record.pillar.toLowerCase() },
      };
      if (isOutdated(record.statementDate, now)) {
        result.push({
          id: `retirement.outdated.${record.id}`,
          severity: 'warning',
          titleKey: 'hints.retirement.outdated.title',
          descriptionKey: 'hints.retirement.outdated.description',
          params,
          target,
          linkLabelKey: 'hints.retirement.linkLabel',
        });
      }
      if (record.import?.ocrRead) {
        result.push({
          id: `retirement.ocr.${record.id}`,
          severity: 'info',
          titleKey: 'hints.retirement.ocr.title',
          descriptionKey: 'hints.retirement.ocr.description',
          params,
          target,
          linkLabelKey: 'hints.retirement.linkLabel',
        });
      }
    }
    return result;
  });

  readonly ready: Signal<boolean> = computed(() => this._ready());

  load(): void {
    this.fetchRecords();
  }

  refresh(): void {
    this.fetchRecords();
  }

  private fetchRecords(): void {
    this.service.records().subscribe({
      next: (records) => {
        this.records.set(records);
        this._ready.set(true);
      },
      error: () => {
        this.records.set([]);
        this._ready.set(true);
      },
    });
  }
}
