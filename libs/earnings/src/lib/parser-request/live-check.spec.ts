import type { AnalyzedLayout } from './anonymize.js';
import { liveCheck } from './live-check.js';
import type { SubmittedRuleDraft, SubmittedRuleLine } from './rule-draft.js';

const word = (text: string, x: number, width = text.length * 5) => ({
  text,
  x,
  width,
  height: 9,
  covered: false,
});

/** An invented payslip: gross 3 000,00 − wage tax 500,00 − soli 27,50 − health 250,00 − pension 280,00 = net 1 942,50. */
const original = (overrides: Partial<Record<string, string>> = {}): AnalyzedLayout => ({
  pages: [
    {
      width: 595,
      height: 842,
      lines: [
        { y: 60, words: [word('Brutto', 50), word(overrides['gross'] ?? '3.000,00', 400, 50)] },
        { y: 72, words: [word('Lohnsteuer', 50), word(overrides['tax'] ?? '500,00', 400, 40)] },
        { y: 84, words: [word('Soli', 50), word('2750', 400, 20), word('27,50-', 470, 30)] },
        { y: 96, words: [word('Krankenv.', 50), word('250,00', 400, 40)] },
        { y: 108, words: [word('Rentenv.', 50), word('280,00', 400, 40)] },
        { y: 120, words: [word('Netto', 50), word(overrides['net'] ?? '1.942,50', 400, 50)] },
        {
          y: 132,
          words: [word('Auszahlung', 50), word(overrides['payout'] ?? '1.942,50', 400, 50)],
        },
      ],
    },
  ],
});

const column = { x0: 395, x1: 455 };
const rule = (line: number, figure: SubmittedRuleLine['figure'], deduction = false) =>
  ({ page: 0, line, figure, deduction, column, format: 'DE_DECIMAL' }) satisfies SubmittedRuleLine;

const fullDraft = (): SubmittedRuleDraft => ({
  lines: [
    rule(0, 'GROSS'),
    rule(1, 'WAGE_TAX', true),
    { ...rule(2, 'SOLIDARITY', true), column: { x0: 465, x1: 505 }, format: 'TRAILING_MINUS' },
    rule(3, 'HEALTH', true),
    rule(4, 'PENSION', true),
    rule(5, 'NET'),
    rule(6, 'PAYOUT'),
  ],
});

describe('liveCheck', () => {
  it('derives the marked figures from the original layout and passes both checks', () => {
    const result = liveCheck(original(), fullDraft());
    expect(result.derived).toEqual({
      GROSS: '3000.00',
      WAGE_TAX: '500.00',
      SOLIDARITY: '27.50',
      HEALTH: '250.00',
      PENSION: '280.00',
      NET: '1942.50',
      PAYOUT: '1942.50',
    });
    expect(result.checks).toEqual([
      {
        id: 'NET',
        passed: true,
        involved: ['GROSS', 'WAGE_TAX', 'SOLIDARITY', 'HEALTH', 'PENSION', 'NET'],
      },
      { id: 'PAYOUT', passed: true, involved: ['NET', 'PAYOUT'] },
    ]);
  });

  it('fails NET and names the involved figures when a marking is wrong', () => {
    const draft = fullDraft();
    draft.lines = draft.lines.filter((l) => l.figure !== 'PENSION');
    const result = liveCheck(original(), draft);
    const net = result.checks.find((c) => c.id === 'NET');
    expect(net?.passed).toBe(false);
    expect(net?.involved).toEqual(['GROSS', 'WAGE_TAX', 'SOLIDARITY', 'HEALTH', 'NET']);
    expect(result.checks.find((c) => c.id === 'PAYOUT')?.passed).toBe(true);
  });

  it('fails PAYOUT when payout differs from net', () => {
    const result = liveCheck(original({ payout: '1.900,00' }), fullDraft());
    expect(result.checks.find((c) => c.id === 'PAYOUT')?.passed).toBe(false);
    expect(result.checks.find((c) => c.id === 'NET')?.passed).toBe(true);
  });

  it('yields null (not enough markings) without gross or net, and for an empty draft', () => {
    const noGross = liveCheck(original(), {
      lines: [rule(1, 'WAGE_TAX', true), rule(5, 'NET')],
    });
    expect(noGross.checks.find((c) => c.id === 'NET')?.passed).toBeNull();
    expect(noGross.checks.find((c) => c.id === 'PAYOUT')?.passed).toBeNull();

    const empty = liveCheck(original(), { lines: [] });
    expect(empty.derived).toEqual({});
    expect(empty.checks.map((c) => c.passed)).toEqual([null, null]);
  });

  it('reads the CENTS format and ignores IGNORE lines and lines without a column or number', () => {
    const draft: SubmittedRuleDraft = {
      lines: [
        { ...rule(2, 'HEALTH', true), column: { x0: 395, x1: 430 }, format: 'CENTS' },
        rule(0, 'IGNORE'),
        { page: 0, line: 1, figure: 'WAGE_TAX', deduction: true },
        rule(5, 'CARE', true),
      ],
    };
    const text = original();
    text.pages[0].lines[5].words[1].text = 'n/a';
    expect(liveCheck(text, draft).derived).toEqual({ HEALTH: '27.50' });
  });

  it('sums several lines marked with the same figure and treats a deduction as positive', () => {
    const draft: SubmittedRuleDraft = {
      lines: [rule(3, 'HEALTH', true), rule(4, 'HEALTH', true)],
    };
    expect(liveCheck(original(), draft).derived).toEqual({ HEALTH: '530.00' });
    const negative = original({ tax: '-500,00' });
    expect(liveCheck(negative, { lines: [rule(1, 'WAGE_TAX', true)] }).derived).toEqual({
      WAGE_TAX: '500.00',
    });
  });

  it('ignores references to missing pages or lines and never echoes document text', () => {
    const result = liveCheck(original(), {
      lines: [{ ...rule(0, 'GROSS'), page: 3 }, { ...rule(99, 'NET') }],
    });
    expect(result.derived).toEqual({});
    expect(JSON.stringify(result)).not.toContain('Brutto');
  });
});
