/**
 * Auto-formatting applied while typing into the credit-card fields
 * (`accountOverviewForm.cardNumber`/`validUntil`): grouping the card number
 * into blocks of 4 digits (with the separating blank landing right after
 * the 4th digit of each block, before any digit of the next block exists),
 * and inserting the `MM/YY` slash right after the 2nd (month) digit is
 * typed — before any year digit exists — so the user sees each separator
 * land on its own instead of having to type it (which the field otherwise
 * rejects, digits only). Pure formatting only — validity is still enforced
 * by the form's own `Validators.pattern` rules.
 */

/** Strips non-digits and re-groups into blocks of 4 (`4111 1111 1111 1111`), capped at 19 digits (longest PAN). */
export function formatCardNumberInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 19);
  const grouped = (digits.match(/.{1,4}/g) ?? []).join(' ');
  const atBlockBoundary = digits.length > 0 && digits.length % 4 === 0 && digits.length < 19;
  return atBlockBoundary ? `${grouped} ` : grouped;
}

/** Strips non-digits and inserts `/` right after the month (`MM/YY`), capped at 4 digits. */
export function formatExpirationInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  return digits.length < 2 ? digits : `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
