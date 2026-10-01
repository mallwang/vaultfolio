import { layoutFingerprintInput } from './layout-fingerprint.js';
import type { LayoutSubmissionV1 } from './layout-submission.js';

function submission(overrides: {
  amount?: string;
  amountX?: number;
  jitter?: number;
  label?: string;
  masked?: string;
}): LayoutSubmissionV1 {
  const jitter = overrides.jitter ?? 0;
  return {
    schemaVersion: 1,
    pages: [
      {
        width: 595.3,
        height: 841.9,
        lines: [
          {
            y: 96 + jitter,
            size: 10,
            words: [
              { text: overrides.label ?? 'Brutto', x: 56.7 + jitter },
              { text: overrides.amount ?? '3.842,17', x: overrides.amountX ?? 391.4 + jitter },
            ],
          },
          {
            y: 108,
            size: 10,
            words: [
              { text: overrides.masked ?? 'xxxxx', x: 56.7 },
              { text: 'XXXXXX', x: 100 },
              { text: '31.12.2025', x: 200 },
            ],
          },
        ],
      },
    ],
  };
}

describe('layoutFingerprintInput', () => {
  const base = layoutFingerprintInput(submission({}));

  it('is stable under value changes', () => {
    // 6-char amount right-aligned to the same edge: x moves right by two glyphs (10 × 0.6 × 2 = 12 pt)
    expect(layoutFingerprintInput(submission({ amount: '842,17', amountX: 403.4 }))).toBe(base);
    expect(layoutFingerprintInput(submission({ amount: '9.999,99' }))).toBe(base);
    expect(layoutFingerprintInput(submission({ masked: 'xxxxxxxx' }))).toBe(base);
  });

  it('is stable under sub-grid jitter', () => {
    expect(layoutFingerprintInput(submission({ jitter: 0.5 }))).toBe(base);
    expect(layoutFingerprintInput(submission({ jitter: -0.5 }))).toBe(base);
  });

  it('differs for a different layout', () => {
    expect(layoutFingerprintInput(submission({ label: 'Netto' }))).not.toBe(base);
    expect(layoutFingerprintInput(submission({ jitter: 5 }))).not.toBe(base);
    const moved = submission({});
    moved.pages[0].lines.pop();
    expect(layoutFingerprintInput(moved)).not.toBe(base);
    const otherSize = submission({});
    otherSize.pages[0].width = 400;
    expect(layoutFingerprintInput(otherSize)).not.toBe(base);
  });

  it('contains no digit of any value', () => {
    expect(base).not.toMatch(/3\.842|17/);
    expect(layoutFingerprintInput(submission({ label: 'Y$52' }))).toContain(':Y$00');
  });

  it('ignores the rule draft', () => {
    const withDraft = { ...submission({}), ruleDraft: { lines: [] } };
    expect(layoutFingerprintInput(withDraft)).toBe(base);
  });
});
