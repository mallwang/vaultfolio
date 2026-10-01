import { TestBed } from '@angular/core/testing';
import type { CareerEntry } from '@vaultfolio/api-contract';
import { CareerSummaryComponent } from './career-summary.component';

function entry(key: string, label: string, partial: Partial<CareerEntry> = {}): CareerEntry {
  const totals = {
    gross: '600000.00',
    net: '370000.00',
    taxes: '110000.00',
    social: '120000.00',
    bonus: '30000.00',
  };
  return {
    key,
    label,
    firstPeriod: '2012-01',
    lastPeriod: '2026-09',
    monthsEmployed: 177,
    employerCount: 1,
    totals,
    perMonth: {
      gross: '3389.83',
      net: '2090.40',
      taxes: '621.47',
      social: '677.97',
      bonus: '169.49',
    },
    netRatio: '0.6167',
    ...partial,
  };
}

describe('CareerSummaryComponent', () => {
  it('opens "Whole career" by default and lists each employer', () => {
    const fixture = TestBed.createComponent(CareerSummaryComponent);
    fixture.componentRef.setInput('entries', [
      entry('ALL', '', { employerCount: 2 }),
      entry('e1', 'Brightline Software GmbH'),
      entry('e2', 'Harbor Analytics AG', { monthsEmployed: 1 }),
    ]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const all = root.querySelector('[data-testid="earnings-career-all"]');
    expect(all?.textContent).toContain('Whole career');
    expect(all?.textContent).toContain('177 months · 2 employers');
    expect(all?.textContent).toContain('€600,000');
    expect(all?.textContent).toContain('Ø per month €3,390');
    expect(all?.textContent).toContain('61.7%');
    expect(all?.textContent).toContain('61.7% of gross');
    expect(all?.textContent).toContain('5.0% of gross');
    expect(root.querySelector('[data-testid="earnings-career-e2"]')?.textContent).toContain(
      'Harbor Analytics AG',
    );
    expect(root.querySelector('[data-testid="earnings-career-e2"]')?.textContent).toContain(
      '1 month',
    );
    expect(root.querySelector('[data-testid="earnings-career-e2"]')?.textContent).not.toContain(
      '1 months',
    );
  });

  it('has no "Whole career" row with a single employer', () => {
    const fixture = TestBed.createComponent(CareerSummaryComponent);
    fixture.componentRef.setInput('entries', [entry('e1', 'Brightline Software GmbH')]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Whole career');
  });
});
