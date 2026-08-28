import Decimal from 'decimal.js';

/**
 * Throwaway placeholder entity (data-model.md ExampleDecimalValue) proving the
 * exact-decimal handling rule (FR-008, constitution's Money/decimal handling
 * clause) before any real monetary entity exists. Not persisted or exposed
 * via the API by this feature — exercised only by this library's own tests.
 */
export class ExampleDecimalValue {
  readonly amount: Decimal;

  /** Constructible only from a decimal string — never a native float literal. */
  constructor(amount: string) {
    this.amount = new Decimal(amount);
  }
}
