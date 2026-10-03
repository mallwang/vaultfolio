import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { RetirementRecord } from '@vaultfolio/api-contract';
import { buildRecord } from '@vaultfolio/retirement/testing';
import { ContractCardComponent } from './contract-card.component';

@Component({
  imports: [ContractCardComponent],
  template: `<app-retirement-contract-card [record]="record" (remove)="removed = $event" />`,
})
class HostComponent {
  record: RetirementRecord = buildRecord();
  removed: RetirementRecord | null = null;
}

describe('ContractCardComponent', () => {
  function render(record: RetirementRecord): { el: HTMLElement; host: HostComponent } {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.record = record;
    fixture.detectChanges();
    return { el: fixture.nativeElement as HTMLElement, host: fixture.componentInstance };
  }

  const byTestId = (el: HTMLElement, id: string): HTMLElement | null =>
    el.querySelector(`[data-testid="${id}"]`);

  it('offers edit and delete for a manual entry', () => {
    const { el, host } = render(buildRecord({ id: 'm1', origin: 'MANUAL' }));
    expect(byTestId(el, 'retirement-card-edit')).not.toBeNull();
    expect(byTestId(el, 'retirement-card-replace')).toBeNull();
    byTestId(el, 'retirement-card-delete')?.click();
    expect(host.removed?.id).toBe('m1');
  });

  it('is read-only for an imported entry: replace and delete only (plus supplement)', () => {
    const { el } = render(buildRecord({ id: 'i1', origin: 'IMPORTED' }));
    expect(byTestId(el, 'retirement-card-edit')).toBeNull();
    expect(byTestId(el, 'retirement-card-readonly-note')).not.toBeNull();
    expect(byTestId(el, 'retirement-card-replace')?.getAttribute('href')).toContain('replaces=i1');
    expect(byTestId(el, 'retirement-card-delete')).not.toBeNull();
    expect(byTestId(el, 'retirement-card-supplement')).not.toBeNull();
  });

  it('shows "no guarantee" for a retirement savings account', () => {
    const { el } = render(buildRecord({ contractType: 'ALTERSVORSORGEDEPOT' }));
    expect(el.textContent).toContain('no guarantee');
  });

  it('marks an old statement as outdated', () => {
    const { el } = render(buildRecord({ statementDate: '2020-01-01' }));
    expect(el.textContent).toContain('Outdated');
  });

  it('renders the capital box for a capital account', () => {
    const { el } = render(buildRecord({ contractType: 'CAPITAL_ACCOUNT' }));
    expect(el.textContent).toContain('Capital payout');
  });
});
