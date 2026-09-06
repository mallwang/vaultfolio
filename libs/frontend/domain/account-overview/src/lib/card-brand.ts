/**
 * Card network derived from a card number's leading digits, used to render
 * the credit-card badge on the account overview. Duplicated — rather than
 * imported — from `libs/domain/accounts`'s `card-brand.ts` because
 * `apps/frontend` (tag `scope:frontend-domain`) is only permitted to depend
 * on `scope:shared` libraries per the module-boundary rules in
 * `eslint.config.mjs`, mirroring `account-category-options.ts`'s identical
 * reasoning. Keep in sync with `libs/domain/accounts/src/lib/card-brand.ts`.
 */
export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX';

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
