import { type LayoutSubmissionV1 } from '@vaultfolio/earnings';
import { ValidationException } from '@vaultfolio/observability';
import { EarningsNewParserHandler } from './earnings-new-parser.handler';

const handler = new EarningsNewParserHandler();

function submission(): LayoutSubmissionV1 {
  return {
    schemaVersion: 1,
    pages: [
      {
        width: 595.3,
        height: 841.9,
        lines: [
          {
            y: 96,
            size: 9,
            words: [
              { text: 'Brutto', x: 56.7 },
              { text: '4.521,88', x: 391.4 },
            ],
          },
          {
            y: 108,
            size: 9,
            words: [
              { text: 'Lohnsteuer', x: 56.7 },
              { text: '612,03', x: 399.2 },
            ],
          },
        ],
      },
    ],
  };
}

function rejection(payload: unknown): { code: string; details?: unknown } {
  try {
    handler.validate(payload);
  } catch (error) {
    if (error instanceof ValidationException) {
      return {
        code: (error.getResponse() as { error: string }).error,
        details: error.details,
      };
    }
    throw error;
  }
  throw new Error('expected a rejection');
}

describe('EarningsNewParserHandler', () => {
  it('identifies the registry row it serves', () => {
    expect([handler.feature, handler.type]).toEqual(['earnings', 'new-parser']);
  });

  describe('validate', () => {
    it('returns the validated submission', () => {
      expect(handler.validate(submission())).toEqual(submission());
    });

    it('maps layout errors to their codes with the JSON path only', () => {
      const extra = { ...submission(), extra: 1 };
      expect(rejection(extra)).toEqual({
        code: 'LAYOUT_UNKNOWN_FIELD',
        details: [{ field: '$', message: 'LAYOUT_UNKNOWN_FIELD' }],
      });

      const fourPages = submission();
      fourPages.pages = [1, 2, 3, 4].map(() => structuredClone(submission().pages[0]));
      expect(rejection(fourPages).code).toBe('LIMIT_EXCEEDED');

      expect(rejection('not an object').code).toBe('INVALID_LAYOUT');

      const badDraft = {
        ...submission(),
        ruleDraft: { lines: [{ page: 5, line: 0, figure: 'NET', deduction: false }] },
      };
      expect(rejection(badDraft).code).toBe('INVALID_RULE_DRAFT');
    });

    it('rejects personal data with kinds and page/line, never the text', () => {
      const withIban = submission();
      withIban.pages[0].lines[1].words.push({ text: 'DE89370400440532013000', x: 300 });
      const result = rejection(withIban);
      expect(result).toEqual({
        code: 'PERSONAL_DATA_DETECTED',
        details: [{ field: 'pages[0].lines[1]', message: 'BANK_ACCOUNT' }],
      });
      expect(JSON.stringify(result)).not.toContain('DE89');
    });

    it('rejects an e-mail address', () => {
      const withMail = submission();
      withMail.pages[0].lines[0].words.push({ text: 'erika@example.org', x: 200 });
      expect(rejection(withMail).code).toBe('PERSONAL_DATA_DETECTED');
    });
  });

  describe('buildAttachment', () => {
    it('renders the sample PDF with the page count', () => {
      const built = handler.buildAttachment(submission());
      expect(built.contentType).toBe('application/pdf');
      expect(built.pageCount).toBe(1);
      const text = Buffer.from(built.bytes).toString('latin1');
      expect(text.startsWith('%PDF-1.4')).toBe(true);
      expect(text).toContain('(Brutto) Tj');
      expect(text).toContain('(4.521,88) Tj');
    });

    it('rejects a sample over the registry attachment size', () => {
      const big = submission();
      big.pages = [1, 2, 3].map(() => ({
        width: 595.3,
        height: 841.9,
        lines: Array.from({ length: 100 }, (_l, i) => ({
          y: 6 + i * 8,
          size: 9,
          words: Array.from({ length: 30 }, (_w, j) => ({ text: 'x'.repeat(60), x: 5 + j })),
        })),
      }));
      // 3 × 100 × 30 = 9 000 words is over the word limit, which validate() would catch;
      // the size check is the second line of defence for anything that passes it
      expect(() => handler.buildAttachment(big)).toThrow(ValidationException);
    });
  });

  describe('toStoredPayload', () => {
    it('stores an empty rule draft as the data-model shape', () => {
      expect(handler.toStoredPayload(submission())).toEqual({
        schemaVersion: 1,
        pages: 1,
        lines: [],
        period: null,
      });
    });
  });

  describe('fingerprint', () => {
    it('is a stable SHA-256 hex that ignores values', () => {
      const first = handler.fingerprint(submission());
      expect(first).toMatch(/^[0-9a-f]{64}$/);
      const other = submission();
      other.pages[0].lines[0].words[1] = { text: '9.999,99', x: 391.4 };
      expect(handler.fingerprint(other)).toBe(first);
      const different = submission();
      different.pages[0].lines[0].words[0].text = 'Netto';
      expect(handler.fingerprint(different)).not.toBe(first);
    });
  });
});
