import type { AnalyzedLayout } from '@vaultfolio/earnings';

/** Planted personal data of the synthetic payslip (invented): none of it may be sent (SC-003). */
export const PLANTED = [
  'Erika',
  'Musterfrau',
  'Hafenweg',
  'Musterstadt',
  'DE89370400440532013000',
  '4.521,88',
  '612,03',
];

const word = (text: string, x: number, width = text.length * 5, covered = false) => ({
  text,
  x,
  width,
  height: 9,
  covered,
});

export function plantedLayout(): AnalyzedLayout {
  return {
    pages: [
      {
        width: 595.3,
        height: 841.9,
        lines: [
          { y: 60, words: [word('Erika', 56.7), word('Musterfrau', 90)] },
          { y: 72, words: [word('Hafenweg', 56.7), word('12', 110)] },
          { y: 84, words: [word('20457', 56.7), word('Musterstadt', 90)] },
          { y: 96, words: [word('IBAN:', 56.7), word('DE89370400440532013000', 90, 110)] },
          { y: 108, words: [word('Brutto', 56.7), word('4.521,88', 391.4, 40)] },
          { y: 120, words: [word('Lohnsteuer', 56.7), word('612,03', 399.2, 30)] },
        ],
      },
    ],
  };
}
