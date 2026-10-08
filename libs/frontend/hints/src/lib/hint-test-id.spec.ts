import { hintTestId } from './hint-test-id';

describe('hintTestId', () => {
  it('lowercases and collapses non-alphanumeric runs into one dash', () => {
    expect(hintTestId('Earnings.data-check.ABC_1.2022')).toBe('earnings-data-check-abc-1-2022');
  });
});
