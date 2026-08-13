import Decimal from 'decimal.js';
import { ExampleDecimalValue } from './example-decimal-value.js';

/**
 * Demonstrates — and enforces — the exact-decimal rule (FR-008, constitution's
 * Money/decimal handling clause) before any real monetary entity is introduced.
 * This is a throwaway placeholder (data-model.md ExampleDecimalValue); its only
 * purpose is proving `0.1 + 0.2` behaves exactly under a decimal type, unlike
 * native floating-point arithmetic.
 */
describe('ExampleDecimalValue', () => {
  it('adds decimal-string amounts exactly, unlike native floating point', () => {
    const a = new ExampleDecimalValue('0.1');
    const b = new ExampleDecimalValue('0.2');

    expect(a.amount.plus(b.amount).equals(new Decimal('0.3'))).toBe(true);
    // The native-float version of this same computation is NOT exact —
    // demonstrating why FR-008 forbids using it for money/quantity values.
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('is constructible only from a decimal-string input, never a float literal', () => {
    // @ts-expect-error — a native number literal must not type-check as a
    // valid constructor argument; the exact-decimal rule must be visible at
    // the type boundary, not just enforced at runtime.
    new ExampleDecimalValue(0.1);

    expect(() => new ExampleDecimalValue('0.1')).not.toThrow();
  });
});
