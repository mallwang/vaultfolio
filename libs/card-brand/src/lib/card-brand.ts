/**
 * Card network derived from a card number's leading digits (BIN/IIN ranges),
 * used to render the credit-card badge on the account overview (FR-002-style
 * detail, "credit card" special fields). Pure/framework-independent
 * (Principle I), mirroring `card-brand.spec.ts`'s cases — not an exhaustive
 * BIN database, just the three networks the feature calls out.
 *
 * Lives in this `scope:shared` lib (rather than `libs/domain/accounts`)
 * so both `scope:domain` and `scope:frontend-domain` consumers can depend on
 * it per the module-boundary rules in `eslint.config.mjs`.
 */
export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX';

/**
 * Derives the card brand from a card number, or `null` when it doesn't match
 * a known range or isn't long enough to tell. Non-digit characters (spaces,
 * dashes) are ignored so a number formatted for readability still matches.
 */
export function deriveCardBrand(cardNumber: string | null | undefined): CardBrand | null {
  if (!cardNumber) {
    return null;
  }

  const digits = cardNumber.replace(/\D/g, '');
  if (digits.length < 2) {
    return null;
  }

  if (digits.startsWith('4')) {
    return 'VISA';
  }

  const firstTwo = Number(digits.slice(0, 2));
  const firstFour = Number(digits.slice(0, 4));
  if ((firstTwo >= 51 && firstTwo <= 55) || (firstFour >= 2221 && firstFour <= 2720)) {
    return 'MASTERCARD';
  }

  if (firstTwo === 34 || firstTwo === 37) {
    return 'AMEX';
  }

  return null;
}
