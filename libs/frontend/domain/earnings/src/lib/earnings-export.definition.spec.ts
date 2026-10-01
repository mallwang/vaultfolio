import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EarningsRecordDetail } from '@vaultfolio/api-contract';
import { en } from '@vaultfolio/frontend-shared-ui';
import { createEarningsExportDefinition } from './earnings-export.definition';

function record(
  period: string,
  issued: string,
  kind: EarningsRecordDetail['kind'],
  seq: number,
): EarningsRecordDetail {
  return {
    id: `${period}-${seq}`,
    employerId: 'e1',
    employerLabel: 'Brightline Software GmbH',
    period,
    issued,
    kind,
    seq,
    import: { id: 'i1', fileName: `${issued}.pdf` },
    amounts: {
      gross: '5000.00',
      taxGross: '5000.00',
      svGrossKv: '5000.00',
      svGrossRv: '5000.00',
      wageTax: '800.00',
      soli: '0.00',
      churchTax: '64.00',
      health: '400.00',
      care: '90.00',
      pension: '465.00',
      unemployment: '65.00',
      net: '3116.00',
      other: '-40.00',
      payout: kind === 'CORRECTION' ? null : '3076.00',
      oneOff: {},
      employerSubsidy: null,
      ytd: null,
      checks: [],
    },
  };
}

function lookup(key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en);
}

describe('createEarningsExportDefinition', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('exports every record oldest first with employer, period, issued, kind and exact amounts', async () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    const rows = definition.fetchData();
    http
      .expectOne('/api/earnings/records')
      .flush([
        record('2026-09', '2026-09', 'REGULAR', 1),
        record('2026-07', '2026-09', 'CORRECTION', 3),
      ]);

    const result = await rows;
    expect(result.map((r) => [r['period'], r['kind']])).toEqual([
      ['2026-07', 'Correction'],
      ['2026-09', 'Payslip'],
    ]);
    expect(result[1]).toMatchObject({
      employer: 'Brightline Software GmbH',
      issued: '2026-09',
      net: '3116.00',
      payout: '3076.00',
      bonus: '0.00',
    });
    expect(result[0]['payout']).toBeNull();
  });

  it('returns no rows for a member without the Earnings domain', async () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    const rows = definition.fetchData();
    http
      .expectOne('/api/earnings/records')
      .flush({ error: 'DOMAIN_NOT_ENTITLED' }, { status: 403, statusText: 'Forbidden' });
    expect(await rows).toEqual([]);
  });

  it('has a translated label for every column', () => {
    const definition = TestBed.runInInjectionContext(createEarningsExportDefinition);
    expect(definition.columns.filter((c) => typeof lookup(c.labelKey) !== 'string')).toEqual([]);
    expect(typeof lookup(definition.titleKey)).toBe('string');
    expect(typeof lookup(definition.infoboxKey)).toBe('string');
  });
});
