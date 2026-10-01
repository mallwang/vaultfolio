import {
  type LayoutSubmissionV1,
  SUBMISSION_LIMITS,
  sanitizeWordText,
  validateLayoutSubmission,
} from './layout-submission.js';

function valid(): LayoutSubmissionV1 {
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
              { text: '3.842,17', x: 391.4 },
            ],
          },
          { y: 108, size: 9, words: [{ text: 'Lohnsteuer', x: 56.7 }] },
        ],
      },
    ],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tests mutate arbitrary untrusted shapes
type Mutable = Record<string, any>;
const clone = (): Mutable => structuredClone(valid()) as unknown as Mutable;

function fail(input: unknown) {
  const result = validateLayoutSubmission(input);
  if (result.ok) throw new Error('expected a rejection');
  return { code: result.code, path: result.path };
}

describe('validateLayoutSubmission', () => {
  it('accepts a valid submission unchanged', () => {
    expect(validateLayoutSubmission(valid())).toEqual({ ok: true, value: valid() });
  });

  describe('structure', () => {
    it.each([null, 'x', 5, [], undefined])('rejects %p', (input) => {
      expect(fail(input)).toEqual({ code: 'INVALID_LAYOUT', path: '$' });
    });

    it('rejects a wrong or missing schemaVersion', () => {
      const wrong = clone();
      wrong['schemaVersion'] = 2;
      expect(fail(wrong)).toEqual({ code: 'INVALID_LAYOUT', path: 'schemaVersion' });
      const missing = clone();
      delete missing['schemaVersion'];
      expect(fail(missing)).toEqual({ code: 'INVALID_LAYOUT', path: '$.schemaVersion' });
    });

    it.each([
      ['root', (s: Mutable) => (s['extra'] = 1), '$'],
      ['page', (s: Mutable) => (s['pages'][0].extra = 1), 'pages[0]'],
      ['line', (s: Mutable) => (s['pages'][0].lines[1].extra = 1), 'pages[0].lines[1]'],
      [
        'word',
        (s: Mutable) => (s['pages'][0].lines[0].words[1].extra = 1),
        'pages[0].lines[0].words[1]',
      ],
    ])('rejects an unknown key on the %s without echoing it', (_level, mutate, path) => {
      const input = clone();
      mutate(input);
      expect(fail(input)).toEqual({ code: 'LAYOUT_UNKNOWN_FIELD', path });
    });

    it('rejects missing required keys and wrong types', () => {
      const noWidth = clone();
      delete noWidth['pages'][0].width;
      expect(fail(noWidth)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages[0].width' });
      const stringX = clone();
      stringX['pages'][0].lines[0].words[0].x = '5';
      expect(fail(stringX)).toEqual({
        code: 'INVALID_LAYOUT',
        path: 'pages[0].lines[0].words[0].x',
      });
      const mapPages = clone();
      mapPages['pages'] = { 0: mapPages['pages'][0] };
      expect(fail(mapPages)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages' });
    });

    it('rejects empty pages, lines and words', () => {
      const noPages = clone();
      noPages['pages'] = [];
      expect(fail(noPages)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages' });
      const noLines = clone();
      noLines['pages'][0].lines = [];
      expect(fail(noLines)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages[0].lines' });
      const noWords = clone();
      noWords['pages'][0].lines[0].words = [];
      expect(fail(noWords)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages[0].lines[0].words' });
    });
  });

  describe('limits', () => {
    it('exposes the contract limits', () => {
      expect(SUBMISSION_LIMITS).toEqual({
        pages: 3,
        linesPerPage: 120,
        wordsPerLine: 40,
        wordsTotal: 3000,
        wordLength: 60,
        ruleLines: 60,
      });
    });

    it('accepts the maxima and rejects one more', () => {
      const three = clone();
      three['pages'] = [three['pages'][0], three['pages'][0], three['pages'][0]];
      expect(validateLayoutSubmission(three).ok).toBe(true);
      three['pages'].push(three['pages'][0]);
      expect(fail(three)).toEqual({ code: 'LIMIT_EXCEEDED', path: 'pages' });

      const lines = clone();
      lines['pages'][0].lines = Array.from({ length: 120 }, () => lines['pages'][0].lines[1]);
      expect(validateLayoutSubmission(lines).ok).toBe(true);
      lines['pages'][0].lines.push(lines['pages'][0].lines[0]);
      expect(fail(lines)).toEqual({ code: 'LIMIT_EXCEEDED', path: 'pages[0].lines' });

      const words = clone();
      words['pages'][0].lines[0].words = Array.from({ length: 40 }, () => ({ text: 'a', x: 1 }));
      expect(validateLayoutSubmission(words).ok).toBe(true);
      words['pages'][0].lines[0].words.push({ text: 'a', x: 1 });
      expect(fail(words)).toEqual({ code: 'LIMIT_EXCEEDED', path: 'pages[0].lines[0].words' });

      const text = clone();
      text['pages'][0].lines[0].words[0].text = 'a'.repeat(60);
      expect(validateLayoutSubmission(text).ok).toBe(true);
      text['pages'][0].lines[0].words[0].text = 'a'.repeat(61);
      expect(fail(text)).toEqual({
        code: 'LIMIT_EXCEEDED',
        path: 'pages[0].lines[0].words[0].text',
      });
    });

    it('rejects more than 3 000 words in total', () => {
      const input = clone();
      const line = {
        y: 10,
        size: 9,
        words: Array.from({ length: 40 }, () => ({ text: 'a', x: 1 })),
      };
      // 3 pages × 25 lines × 40 words = 3 000 (valid); one more word tips it over
      input['pages'] = Array.from({ length: 3 }, () => ({
        width: 595,
        height: 842,
        lines: Array.from({ length: 25 }, () => structuredClone(line)),
      }));
      expect(validateLayoutSubmission(input).ok).toBe(true);
      input['pages'][2].lines[24].words.pop();
      input['pages'][2].lines.push({
        y: 10,
        size: 9,
        words: [
          { text: 'a', x: 1 },
          { text: 'b', x: 2 },
        ],
      });
      expect(fail(input)).toEqual({ code: 'LIMIT_EXCEEDED', path: 'pages' });
    });
  });

  describe('word characters', () => {
    it.each([
      ['a control character', 'ab\u0007c'],
      ['a C1 control character', 'ab\u0085c'],
      ['a bidi override', 'ab‮c'],
      ['a zero-width space', 'ab​c'],
      ['an isolate', 'ab⁧c'],
      ['whitespace inside a word', 'ab c'],
      ['a tab', 'ab\tc'],
      ['a newline', 'ab\nc'],
      ['angle brackets', '<b>'],
      ['a backslash', 'a\\b'],
      ['an emoji', 'a😀'],
      ['an empty word', ''],
    ])('rejects %s', (_name, text) => {
      const input = clone();
      input['pages'][0].lines[0].words[0].text = text;
      expect(fail(input)).toEqual({
        code: 'INVALID_LAYOUT',
        path: 'pages[0].lines[0].words[0].text',
      });
    });

    it.each([
      'Größe',
      'Lohnsteuer:',
      '12,5%',
      "O'Neil",
      '(Netto)',
      '€5',
      '§37b',
      'a@b',
      '#1',
      '50°',
      'a/b',
      'x_y',
      'a=b',
      '"q"',
      '!?',
    ])('accepts %s', (text) => {
      const input = clone();
      input['pages'][0].lines[0].words[0].text = text;
      expect(validateLayoutSubmission(input).ok).toBe(true);
    });
  });

  describe('numbers', () => {
    it.each([
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['-Infinity', -Infinity],
    ])('rejects %s coordinates', (_name, value) => {
      const input = clone();
      input['pages'][0].lines[0].words[0].x = value;
      expect(fail(input)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages[0].lines[0].words[0].x' });
    });

    it('rejects coordinates outside the page box and sizes outside 5..20', () => {
      const wide = clone();
      wide['pages'][0].lines[0].words[1].x = 595.4;
      expect(fail(wide)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages[0].lines[0].words[1].x' });
      const negative = clone();
      negative['pages'][0].lines[0].words[0].x = -0.1;
      expect(fail(negative).path).toBe('pages[0].lines[0].words[0].x');
      const low = clone();
      low['pages'][0].lines[0].y = 842;
      expect(fail(low)).toEqual({ code: 'INVALID_LAYOUT', path: 'pages[0].lines[0].y' });
      const small = clone();
      small['pages'][0].lines[0].size = 4.9;
      expect(fail(small).path).toBe('pages[0].lines[0].size');
      const big = clone();
      big['pages'][0].lines[0].size = 20.1;
      expect(fail(big).path).toBe('pages[0].lines[0].size');
      const tiny = clone();
      tiny['pages'][0].width = 99;
      expect(fail(tiny).path).toBe('pages[0].width');
    });
  });

  describe('error paths', () => {
    it('never contain submitted values', () => {
      const input = clone();
      input['pages'][0].lines[0].words[0].text = 'Secret Name';
      input['pages'][0].lines[0].secretKey = 'Secret Value';
      const result = fail(input);
      expect(JSON.stringify(result)).not.toMatch(/Secret/);
    });
  });

  describe('rule draft', () => {
    const withDraft = (draft: unknown): Mutable => {
      const input = clone();
      input['ruleDraft'] = draft;
      return input;
    };

    it('accepts a valid draft', () => {
      const draft = {
        lines: [
          {
            page: 0,
            line: 1,
            figure: 'WAGE_TAX',
            deduction: true,
            column: { x0: 390, x1: 450 },
            format: 'DE_DECIMAL',
          },
          { page: 0, line: 0, figure: 'IGNORE', deduction: false },
        ],
        period: { page: 0, line: 0, x0: 10, x1: 20 },
      };
      expect(validateLayoutSubmission(withDraft(draft))).toEqual({
        ok: true,
        value: { ...valid(), ruleDraft: draft },
      });
    });

    it.each([
      [
        'a missing line',
        { lines: [{ page: 0, line: 2, figure: 'NET', deduction: false }] },
        'ruleDraft.lines[0].line',
      ],
      [
        'a missing page',
        { lines: [{ page: 1, line: 0, figure: 'NET', deduction: false }] },
        'ruleDraft.lines[0].page',
      ],
      [
        'a negative index',
        { lines: [{ page: 0, line: -1, figure: 'NET', deduction: false }] },
        'ruleDraft.lines[0].line',
      ],
      [
        'an unknown figure',
        { lines: [{ page: 0, line: 0, figure: 'BONUS', deduction: false }] },
        'ruleDraft.lines[0].figure',
      ],
      [
        'an unknown format',
        { lines: [{ page: 0, line: 0, figure: 'NET', deduction: false, format: 'X' }] },
        'ruleDraft.lines[0].format',
      ],
      [
        'a non-boolean deduction',
        { lines: [{ page: 0, line: 0, figure: 'NET', deduction: 1 }] },
        'ruleDraft.lines[0].deduction',
      ],
      [
        'x0 >= x1',
        {
          lines: [{ page: 0, line: 0, figure: 'NET', deduction: false, column: { x0: 5, x1: 5 } }],
        },
        'ruleDraft.lines[0].column',
      ],
      [
        'a column beyond the page',
        {
          lines: [
            { page: 0, line: 0, figure: 'NET', deduction: false, column: { x0: 5, x1: 600 } },
          ],
        },
        'ruleDraft.lines[0].column.x1',
      ],
      [
        'a period on a missing line',
        { lines: [], period: { page: 0, line: 9, x0: 1, x1: 2 } },
        'ruleDraft.period.line',
      ],
      ['a non-array lines', { lines: {} }, 'ruleDraft.lines'],
    ])('rejects %s', (_name, draft, path) => {
      expect(fail(withDraft(draft))).toEqual({ code: 'INVALID_RULE_DRAFT', path });
    });

    it('rejects unknown keys anywhere in the draft', () => {
      expect(fail(withDraft({ lines: [], extra: 1 }))).toEqual({
        code: 'LAYOUT_UNKNOWN_FIELD',
        path: 'ruleDraft',
      });
      expect(
        fail(
          withDraft({ lines: [{ page: 0, line: 0, figure: 'NET', deduction: false, label: 'x' }] }),
        ),
      ).toEqual({ code: 'LAYOUT_UNKNOWN_FIELD', path: 'ruleDraft.lines[0]' });
    });

    it('rejects more than 60 rule lines', () => {
      const line = { page: 0, line: 0, figure: 'NET', deduction: false };
      expect(
        validateLayoutSubmission(withDraft({ lines: Array.from({ length: 60 }, () => line) })).ok,
      ).toBe(true);
      expect(fail(withDraft({ lines: Array.from({ length: 61 }, () => line) }))).toEqual({
        code: 'LIMIT_EXCEEDED',
        path: 'ruleDraft.lines',
      });
    });
  });
});

describe('sanitizeWordText', () => {
  it('keeps allowed text', () => {
    expect(sanitizeWordText('Lohnsteuer:')).toBe('Lohnsteuer:');
  });

  it('maps typographic punctuation and replaces other characters', () => {
    expect(sanitizeWordText('’quoted’')).toBe("'quoted'");
    expect(sanitizeWordText('a–b')).toBe('a-b');
    expect(sanitizeWordText('a·b')).toBe('a?b');
    expect(sanitizeWordText('a‮b')).toBe('a?b');
  });

  it('clamps the length and never returns an empty word', () => {
    expect(sanitizeWordText('a'.repeat(80))).toHaveLength(60);
    expect(sanitizeWordText('')).toBe('?');
  });
});
