import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EarningsNewParserViewComponent } from './earnings-new-parser.view';

describe('EarningsNewParserViewComponent', () => {
  let fixture: ComponentFixture<EarningsNewParserViewComponent>;
  const el = (id: string) => fixture.nativeElement.querySelector(`[data-testid="${id}"]`);

  const show = (payload: unknown) => {
    fixture = TestBed.createComponent(EarningsNewParserViewComponent);
    fixture.componentRef.setInput('payload', payload);
    fixture.detectChanges();
  };

  it('lists the rule hints with label, figure type, sign, column and format and says they are not executed', () => {
    show({
      schemaVersion: 1,
      pages: 1,
      lines: [
        {
          page: 0,
          line: 4,
          label: 'Lohnsteuer',
          figure: 'WAGE_TAX',
          deduction: true,
          column: { x0: 399.2, x1: 430 },
          format: 'DE_DECIMAL',
        },
        {
          page: 0,
          line: 5,
          label: 'Netto',
          figure: 'NET',
          deduction: false,
          column: null,
          format: null,
        },
      ],
      period: { page: 0, line: 1, x0: 390, x1: 450 },
    });
    expect(el('request-hints-note')?.textContent).toContain('Not executed');
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('1/5');
    expect(rows[0].textContent).toContain('Lohnsteuer');
    expect(rows[0].textContent).toContain('Wage tax');
    expect(rows[0].textContent).toContain('Deduction');
    expect(rows[0].textContent).toContain('399–430');
    expect(rows[0].textContent).toContain('1.234,56');
    expect(rows[1].textContent).toContain('Net');
    expect(el('request-hints-period')?.textContent).toContain('390–450');
  });

  it('says so when no markings were sent, and renders nothing for an unusable payload', () => {
    show({ schemaVersion: 1, pages: 1, lines: [], period: null });
    expect(el('request-hints-empty')).not.toBeNull();
    expect(el('request-hints-table')).toBeNull();
    show(null);
    expect(el('request-hints-table')).toBeNull();
    expect(el('request-hints-empty')).toBeNull();
  });
});
