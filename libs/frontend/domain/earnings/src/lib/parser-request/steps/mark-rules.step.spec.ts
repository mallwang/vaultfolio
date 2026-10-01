import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { AnalyzedLayout } from '@vaultfolio/earnings';
import { ParserRequestComponent } from '../parser-request.component';
import { ParserRequestStore } from '../parser-request.store';

const word = (text: string, x: number, width = text.length * 5) => ({
  text,
  x,
  width,
  height: 9,
  covered: false,
});

/** Invented payslip: gross 3 000,00 − wage tax 500,00 = net 2 500,00 (no social insurance). */
const payslip = (net = '2.500,00'): AnalyzedLayout => ({
  pages: [
    {
      width: 595,
      height: 842,
      lines: [
        { y: 60, words: [word('Brutto', 50), word('3.000,00', 400, 40)] },
        { y: 72, words: [word('Lohnsteuer', 50), word('500,00', 400, 30)] },
        { y: 84, words: [word('Netto', 50), word(net, 400, 40)] },
        { y: 96, words: [word('Abrechnung', 50), word('09.2026', 400, 35)] },
      ],
    },
  ],
});

describe('MarkRulesStepComponent', () => {
  let store: ParserRequestStore;

  function open(layout = payslip()) {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ParserRequestStore);
    store.file.set(new File(['x'], 'unknown.pdf'));
    store.analysis.set(layout);
    store.consent.set(true);
    store.step.set('rules');
    const fixture = TestBed.createComponent(ParserRequestComponent);
    fixture.detectChanges();
    return fixture;
  }
  const el = (f: { nativeElement: HTMLElement }, id: string) =>
    f.nativeElement.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
  const click = (f: { detectChanges(): void; nativeElement: HTMLElement }, id: string) => {
    el(f, id)?.click();
    f.detectChanges();
  };

  /** Marks a line through the DOM: select the row, choose the figure, click the number. */
  function mark(
    f: { detectChanges(): void; nativeElement: HTMLElement },
    line: number,
    figure: Parameters<ParserRequestStore['setFigure']>[0],
    deduction = false,
  ) {
    click(f, `request-rule-row-0-${line}`);
    store.setFigure(figure);
    if (deduction) store.patchSelectedRule({ deduction: true });
    f.detectChanges();
    click(f, `request-word-0-${line}-1`);
  }

  it('selects a line on click and shows its card; rows are keyboard-operable buttons', () => {
    const fixture = open();
    expect(el(fixture, 'request-rule-row-0-0')?.tagName).toBe('BUTTON');
    expect(el(fixture, 'request-rule-figure')).toBeNull();
    click(fixture, 'request-rule-row-0-0');
    expect(store.selectedLine()).toEqual({ page: 0, line: 0 });
    expect(el(fixture, 'request-rule-figure')).not.toBeNull();
    expect(el(fixture, 'request-rule-row-0-0')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('records figure, sign, column and a guessed format, and shows a chip', () => {
    const fixture = open();
    mark(fixture, 1, 'WAGE_TAX', true);
    expect(store.ruleDraft()?.lines).toEqual([
      {
        page: 0,
        line: 1,
        figure: 'WAGE_TAX',
        deduction: true,
        column: { x0: 400, x1: 430 },
        format: 'DE_DECIMAL',
      },
    ]);
    expect(el(fixture, 'request-rule-chip-0-1')?.textContent).toContain('Wage tax');
    expect(el(fixture, 'request-word-0-1-1')?.className).toContain('word--picked');
  });

  it('ignores a number click before a figure is chosen and removes a rule with "not marked"', () => {
    const fixture = open();
    click(fixture, 'request-rule-row-0-0');
    click(fixture, 'request-word-0-0-1');
    expect(store.ruleDraft()).toBeUndefined();
    store.setFigure('GROSS');
    store.setFigure(null);
    expect(store.ruleDraft()).toBeUndefined();
  });

  it('marks the period on the sheet and can clear it', () => {
    const fixture = open();
    click(fixture, 'request-rule-period');
    expect(el(fixture, 'request-rule-period-hint')).not.toBeNull();
    click(fixture, 'request-word-0-3-1');
    expect(store.ruleDraft()).toEqual({
      lines: [],
      period: { page: 0, line: 3, x0: 400, x1: 435 },
    });
    expect(el(fixture, 'request-rule-period-set')).not.toBeNull();
    click(fixture, 'request-rule-period-clear');
    expect(store.ruleDraft()).toBeUndefined();
  });

  it('shows the live check green (colour and icon) when the markings add up', () => {
    const fixture = open();
    mark(fixture, 0, 'GROSS');
    mark(fixture, 1, 'WAGE_TAX', true);
    mark(fixture, 2, 'NET');
    const net = el(fixture, 'request-check-net');
    expect(net?.dataset['state']).toBe('ok');
    expect(net?.className).toContain('check--ok');
    expect(net?.textContent).toContain('adds up');
    expect(net?.querySelector('app-icon')?.textContent).toContain('check_circle');
    expect(el(fixture, 'request-live-check')?.textContent).toContain('never sent');
  });

  it('shows the live check red with the involved figures when a marking is wrong', () => {
    const fixture = open(payslip('2.400,00'));
    mark(fixture, 0, 'GROSS');
    mark(fixture, 1, 'WAGE_TAX', true);
    mark(fixture, 2, 'NET');
    const net = el(fixture, 'request-check-net');
    expect(net?.dataset['state']).toBe('fail');
    expect(net?.className).toContain('check--fail');
    expect(net?.querySelector('app-icon')?.textContent).toContain('warning');
    expect(net?.textContent).toContain('Gross, Wage tax, Net');
  });

  it('shows "not enough markings" while gross or net is missing', () => {
    const fixture = open();
    mark(fixture, 1, 'WAGE_TAX', true);
    expect(el(fixture, 'request-check-net')?.dataset['state']).toBe('unknown');
  });

  it('keeps no figure value in the submission and never sends the live check', () => {
    const fixture = open();
    mark(fixture, 0, 'GROSS');
    mark(fixture, 2, 'NET');
    const json = JSON.stringify(store.preview());
    expect(json).toContain('"ruleDraft"');
    expect(json).not.toMatch(/3\.000|2\.500|derived|checks/);
  });

  it('Skip markings drops the draft and goes to the preview; Continue keeps it', () => {
    const fixture = open();
    mark(fixture, 0, 'GROSS');
    click(fixture, 'request-continue');
    expect(store.step()).toBe('preview');
    expect(store.ruleDraft()?.lines).toHaveLength(1);
    expect(el(fixture, 'request-summary-rules')?.textContent).toContain('1');

    store.step.set('rules');
    fixture.detectChanges();
    click(fixture, 'request-skip-rules');
    expect(store.step()).toBe('preview');
    expect(store.ruleDraft()).toBeUndefined();
  });

  it('clears selection, draft and period when the store is reset', () => {
    const fixture = open();
    mark(fixture, 0, 'GROSS');
    store.reset();
    expect(store.ruleDraft()).toBeUndefined();
    expect(store.selectedLine()).toBeNull();
    expect(store.liveCheck()).toBeNull();
  });
});
