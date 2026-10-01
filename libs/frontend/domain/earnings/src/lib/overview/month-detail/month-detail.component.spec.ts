import { TestBed } from '@angular/core/testing';
import type {
  EarningsRecordDetail,
  EarningsStoredPayRecordAmounts,
} from '@vaultfolio/api-contract';
import { en } from '@vaultfolio/frontend-shared-ui';
import { MonthDetailComponent, buildStatement } from './month-detail.component';

const translate = (key: string) =>
  key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], en) as string;

function amounts(partial: Partial<EarningsStoredPayRecordAmounts>): EarningsStoredPayRecordAmounts {
  return {
    gross: '0.00',
    taxGross: '0.00',
    svGrossKv: '0.00',
    svGrossRv: '0.00',
    wageTax: '0.00',
    soli: '0.00',
    churchTax: '0.00',
    health: '0.00',
    care: '0.00',
    pension: '0.00',
    unemployment: '0.00',
    net: '0.00',
    other: '0.00',
    payout: null,
    oneOff: {},
    employerSubsidy: null,
    ytd: null,
    checks: [{ code: 'NET', passed: true, difference: '0.00' }],
    ...partial,
  };
}

// Synthetic figures of the SAP Dec 2025 bonus fixture.
const REGULAR: EarningsRecordDetail = {
  id: 'r1',
  employerId: 'e1',
  employerLabel: 'Brightline Software GmbH',
  period: '2025-12',
  issued: '2025-12',
  kind: 'REGULAR',
  seq: 1,
  import: { id: 'i1', fileName: '2025_12_Entgeltnachweis.pdf' },
  amounts: amounts({
    gross: '8000.00',
    wageTax: '1700.00',
    churchTax: '136.00',
    health: '441.00',
    care: '99.23',
    pension: '744.00',
    unemployment: '104.00',
    net: '4775.77',
    other: '-40.00',
    payout: '4735.77',
    oneOff: { gross: '3000.00' },
  }),
};

const CORRECTION: EarningsRecordDetail = {
  ...REGULAR,
  id: 'r2',
  period: '2025-10',
  issued: '2025-12',
  kind: 'CORRECTION',
  seq: 3,
  amounts: amounts({
    gross: '-120.00',
    wageTax: '-30.25',
    churchTax: '-2.42',
    health: '-9.60',
    care: '-2.16',
    pension: '-11.16',
    unemployment: '-1.56',
    net: '-62.85',
    other: '62.85',
  }),
};

describe('buildStatement', () => {
  it('builds Regular pay → Gross → Taxes → Social → Net → Other → Payout with deductions negative', () => {
    const statement = buildStatement(REGULAR, 'en', translate);

    expect(statement.lines.map((l) => [l.label, l.detail ?? l.amount])).toEqual([
      ['Regular pay', '€5,000.00'],
      ['Bonus & one-off payments', '€3,000.00'],
      ['Gross (total gross)', '€8,000.00'],
      ['Taxes', '-€1,836.00'],
      ['Social insurance', '-€1,388.23'],
      ['Statutory net', '€4,775.77'],
      ['Other deductions/additions', '-€40.00'],
      ['Payout', '€4,735.77'],
    ]);
    expect(statement.lines[3].children?.map((c) => c.detail)).toEqual([
      '-€1,700.00',
      '€0.00',
      '-€136.00',
    ]);
    expect(statement).toMatchObject({ kindLabel: 'Payslip', issuedNote: null, checksPassed: true });
  });

  it('shows a correction as back pay issued with a later payslip and without payout', () => {
    const statement = buildStatement(CORRECTION, 'en', translate);

    expect(statement.lines[0]).toMatchObject({ label: 'Back pay', detail: '-€120.00' });
    expect(statement.issuedNote).toBe('issued Dec 2025');
    expect(statement.lines.some((l) => l.label === 'Paid out with the Dec 2025 payslip')).toBe(
      true,
    );
    expect(statement.lines.some((l) => l.label === 'Payout')).toBe(false);
  });

  it('adds a line for any non-itemized difference', () => {
    const statement = buildStatement(
      { ...REGULAR, amounts: { ...REGULAR.amounts, net: '4775.76' } },
      'en',
      translate,
    );
    expect(statement.lines.find((l) => l.label === 'Not itemized')?.amount).toBe('-€0.01');
  });
});

describe('MonthDetailComponent', () => {
  it('asks to pick a month until one is selected', () => {
    const fixture = TestBed.createComponent(MonthDetailComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Click a month');
  });

  it('renders the month heading and one statement per section, taxes expandable', () => {
    const fixture = TestBed.createComponent(MonthDetailComponent);
    fixture.componentRef.setInput('period', '2025-12');
    fixture.componentRef.setInput('records', [REGULAR, CORRECTION]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('December 2025');
    expect(root.textContent).toContain('2 payslip sections · Gross €7,880.00 · Net €4,712.92');
    expect(root.querySelectorAll('article')).toHaveLength(2);
    expect(root.textContent).not.toContain('Wage tax');
    (
      root.querySelector('[data-testid="earnings-statement-r1-taxes"]') as HTMLButtonElement
    ).click();
    fixture.detectChanges();
    expect(root.textContent).toContain('Wage tax');
  });
});
