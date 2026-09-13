import { sanitiseLogValue } from './log-value-sanitiser.js';

describe('sanitiseLogValue', () => {
  it('strips newlines and control characters', () => {
    expect(sanitiseLogValue('line1\nline2\r\nline3')).toBe('line1line2line3');
  });

  it('caps length, appending an ellipsis marker', () => {
    const long = 'a'.repeat(600);
    const result = sanitiseLogValue(long);
    expect(result).toHaveLength(513);
    expect(result.endsWith('…')).toBe(true);
  });

  it('leaves an already-clean, short value unchanged', () => {
    expect(sanitiseLogValue('/api/signups')).toBe('/api/signups');
  });
});
