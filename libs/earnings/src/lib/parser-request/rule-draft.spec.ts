import * as fs from 'node:fs';
import * as path from 'node:path';
import type { LayoutSubmissionV1 } from './layout-submission.js';
import { validateLayoutSubmission } from './layout-submission.js';
import { deriveRuleLabels, FIGURE_TYPES, type SubmittedRuleDraft } from './rule-draft.js';

const base = (ruleDraft?: unknown): unknown => ({
  schemaVersion: 1,
  pages: [
    {
      width: 595,
      height: 842,
      lines: [
        {
          y: 60,
          size: 9,
          words: [
            { text: 'Lohnsteuer', x: 50 },
            { text: 'lfd.', x: 100 },
            { text: '123,45', x: 400 },
          ],
        },
        {
          y: 72,
          size: 9,
          words: [
            { text: 'Netto', x: 50 },
            { text: '999,99', x: 400 },
          ],
        },
      ],
    },
  ],
  ...(ruleDraft === undefined ? {} : { ruleDraft }),
});

const rule = { page: 0, line: 0, figure: 'WAGE_TAX', deduction: true } as const;

const code = (draft: unknown) => {
  const result = validateLayoutSubmission(base(draft));
  return result.ok ? 'OK' : `${result.code}:${result.path}`;
};

describe('rule draft', () => {
  it('lists the figure types of the contract', () => {
    expect(FIGURE_TYPES).toEqual([
      'GROSS',
      'TAX_GROSS',
      'WAGE_TAX',
      'SOLIDARITY',
      'CHURCH_TAX',
      'HEALTH',
      'CARE',
      'PENSION',
      'UNEMPLOYMENT',
      'NET',
      'PAYOUT',
      'IGNORE',
    ]);
  });

  describe('validation (INVALID_RULE_DRAFT)', () => {
    it('accepts a draft with column, format and period', () => {
      expect(
        code({
          lines: [{ ...rule, column: { x0: 390, x1: 450 }, format: 'DE_DECIMAL' }],
          period: { page: 0, line: 1, x0: 390, x1: 450 },
        }),
      ).toBe('OK');
    });

    it('rejects references to missing pages and lines', () => {
      expect(code({ lines: [{ ...rule, page: 1 }] })).toBe(
        'INVALID_RULE_DRAFT:ruleDraft.lines[0].page',
      );
      expect(code({ lines: [{ ...rule, line: 2 }] })).toBe(
        'INVALID_RULE_DRAFT:ruleDraft.lines[0].line',
      );
      expect(code({ lines: [], period: { page: 0, line: 5, x0: 1, x1: 2 } })).toBe(
        'INVALID_RULE_DRAFT:ruleDraft.period.line',
      );
    });

    it('rejects more than 60 rule lines with LIMIT_EXCEEDED', () => {
      expect(code({ lines: Array.from({ length: 61 }, () => rule) })).toBe(
        'LIMIT_EXCEEDED:ruleDraft.lines',
      );
      expect(code({ lines: Array.from({ length: 60 }, () => rule) })).toBe('OK');
    });

    it('requires x0 < x1 inside the page width', () => {
      const bad = (column: unknown) => code({ lines: [{ ...rule, column }] });
      expect(bad({ x0: 450, x1: 390 })).toBe('INVALID_RULE_DRAFT:ruleDraft.lines[0].column');
      expect(bad({ x0: 390, x1: 390 })).toBe('INVALID_RULE_DRAFT:ruleDraft.lines[0].column');
      expect(bad({ x0: 390, x1: 700 })).toBe('INVALID_RULE_DRAFT:ruleDraft.lines[0].column.x1');
      expect(bad({ x0: -1, x1: 400 })).toBe('INVALID_RULE_DRAFT:ruleDraft.lines[0].column.x0');
    });

    it('rejects an unknown figure, format and a non-boolean sign', () => {
      expect(code({ lines: [{ ...rule, figure: 'BONUS' }] })).toBe(
        'INVALID_RULE_DRAFT:ruleDraft.lines[0].figure',
      );
      expect(code({ lines: [{ ...rule, format: 'US_DECIMAL' }] })).toBe(
        'INVALID_RULE_DRAFT:ruleDraft.lines[0].format',
      );
      expect(code({ lines: [{ ...rule, deduction: 'yes' }] })).toBe(
        'INVALID_RULE_DRAFT:ruleDraft.lines[0].deduction',
      );
    });

    it('rejects any key outside the schema, so no text or figure can ride along', () => {
      expect(code({ lines: [{ ...rule, label: 'Lohnsteuer' }] })).toBe(
        'LAYOUT_UNKNOWN_FIELD:ruleDraft.lines[0]',
      );
      expect(code({ lines: [], note: 'x' })).toBe('LAYOUT_UNKNOWN_FIELD:ruleDraft');
    });
  });

  describe('deriveRuleLabels', () => {
    const submission = (draft?: SubmittedRuleDraft): LayoutSubmissionV1 => {
      const result = validateLayoutSubmission(base(draft));
      if (!result.ok) throw new Error('fixture invalid');
      return result.value;
    };

    it('derives the label from the non-digit words of the referenced line and nothing else', () => {
      const stored = deriveRuleLabels(
        submission({
          lines: [
            { ...rule, column: { x0: 390, x1: 450 }, format: 'DE_DECIMAL' },
            { page: 0, line: 1, figure: 'NET', deduction: false },
          ],
          period: { page: 0, line: 1, x0: 390, x1: 450 },
        }),
      );
      expect(stored).toEqual({
        schemaVersion: 1,
        pages: 1,
        lines: [
          {
            page: 0,
            line: 0,
            label: 'Lohnsteuer lfd.',
            figure: 'WAGE_TAX',
            deduction: true,
            column: { x0: 390, x1: 450 },
            format: 'DE_DECIMAL',
          },
          {
            page: 0,
            line: 1,
            label: 'Netto',
            figure: 'NET',
            deduction: false,
            column: null,
            format: null,
          },
        ],
        period: { page: 0, line: 1, x0: 390, x1: 450 },
      });
      expect(JSON.stringify(stored)).not.toMatch(/123,45|999,99/);
    });

    it('stores an empty draft when none was submitted', () => {
      expect(deriveRuleLabels(submission())).toEqual({
        schemaVersion: 1,
        pages: 1,
        lines: [],
        period: null,
      });
    });
  });

  it('is never imported by the parsers or the registry (FR-014)', () => {
    const root = path.resolve(__dirname, '..');
    const files = [
      ...fs
        .readdirSync(path.join(root, 'parsers'))
        .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'))
        .map((f) => path.join(root, 'parsers', f)),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(/rule-draft|parser-request/);
    }
  });
});
