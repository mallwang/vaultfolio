import type { LayoutSubmissionV1 } from './layout-submission.js';
import { toSheet } from './sheet.js';

describe('toSheet', () => {
  it('maps every word to a positioned item with its line’s baseline and size', () => {
    const submission: LayoutSubmissionV1 = {
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
                { text: '123,45', x: 391.4 },
              ],
            },
            { y: 108, size: 10, words: [{ text: 'Netto', x: 56.7 }] },
          ],
        },
        { width: 100, height: 200, lines: [{ y: 5, size: 8, words: [{ text: 'x', x: 1 }] }] },
      ],
    };
    expect(toSheet(submission)).toEqual({
      pages: [
        {
          width: 595.3,
          height: 841.9,
          items: [
            { text: 'Brutto', x: 56.7, y: 96, size: 9 },
            { text: '123,45', x: 391.4, y: 96, size: 9 },
            { text: 'Netto', x: 56.7, y: 108, size: 10 },
          ],
        },
        { width: 100, height: 200, items: [{ text: 'x', x: 1, y: 5, size: 8 }] },
      ],
    });
  });

  it('ignores the rule draft', () => {
    const submission: LayoutSubmissionV1 = {
      schemaVersion: 1,
      pages: [
        { width: 100, height: 100, lines: [{ y: 5, size: 8, words: [{ text: 'x', x: 1 }] }] },
      ],
      ruleDraft: { lines: [{ page: 0, line: 0, figure: 'NET', deduction: false }] },
    };
    expect(JSON.stringify(toSheet(submission))).not.toContain('NET');
  });
});
