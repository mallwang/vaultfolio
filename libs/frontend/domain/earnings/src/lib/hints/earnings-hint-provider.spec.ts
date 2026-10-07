import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { DataCheckRow } from '@vaultfolio/api-contract';
import { EarningsService } from '../earnings.service';
import { EarningsHintProvider } from './earnings-hint-provider';

const row = (over: Partial<DataCheckRow> = {}): DataCheckRow =>
  ({
    employerId: 'e1',
    employerLabel: 'ACME',
    year: 2022,
    ytd: { status: 'MATCH', differences: [] },
    certificate: { status: 'MATCH', differences: [] },
    completeness: { status: 'COMPLETE', missingPeriods: [] },
    lateCorrections: [],
    ...over,
  }) as unknown as DataCheckRow;

const differs = [{ field: 'health' }] as never;

describe('EarningsHintProvider', () => {
  const dataCheck = vi.fn();
  let provider: EarningsHintProvider;

  beforeEach(() => {
    dataCheck.mockReset();
    TestBed.configureTestingModule({
      providers: [{ provide: EarningsService, useValue: { dataCheck } }],
    });
    provider = TestBed.inject(EarningsHintProvider);
  });

  it('is not ready until the first response arrives', () => {
    const pending = new Subject<DataCheckRow[]>();
    dataCheck.mockReturnValue(pending);
    provider.load();

    expect(provider.ready()).toBe(false);
    pending.next([]);
    expect(provider.ready()).toBe(true);
  });

  it('flags differences against payslips and against the certificate', () => {
    dataCheck.mockReturnValue(
      of([
        row({ employerId: 'a', ytd: { status: 'DIFFERS', differences: differs } as never }),
        row({ employerId: 'b', certificate: { status: 'DIFFERS', differences: differs } as never }),
        row({ employerId: 'c' }),
      ]),
    );
    provider.load();

    expect(provider.hints().map((h) => h.id)).toEqual([
      'earnings.data-check.a.2022',
      'earnings.data-check.b.2022',
    ]);
    expect(provider.hints()[0].descriptionKey).toBe('hints.earnings.dataCheck.description');
    expect(provider.hints()[0].params).toEqual({ employerLabel: 'ACME', year: 2022 });
  });

  it('uses the missing-data text when payslips are missing', () => {
    dataCheck.mockReturnValue(
      of([row({ completeness: { status: 'MISSING', missingPeriods: ['2022-01'] } as never })]),
    );
    provider.load();

    expect(provider.hints()[0].descriptionKey).toBe('hints.earnings.dataCheck.descriptionMissing');
  });

  it('clears the hints and becomes ready when loading fails; refresh reloads', () => {
    dataCheck.mockReturnValueOnce(of([row({ ytd: { differences: differs } as never })]));
    provider.load();
    expect(provider.hints()).toHaveLength(1);

    dataCheck.mockReturnValueOnce(throwError(() => new Error('boom')));
    provider.refresh();

    expect(provider.hints()).toEqual([]);
    expect(provider.ready()).toBe(true);
  });
});
