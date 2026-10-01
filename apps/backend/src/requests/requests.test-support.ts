import {
  type AnalyzedLayout,
  anonymizeLayout,
  type LayoutSubmissionV1,
  toSubmission,
  type WordDecision,
} from '@vaultfolio/earnings';

/** Planted personal data of the synthetic payslip: none of it may ever reach a stored sample. */
export const PLANTED = [
  'Erika',
  'Musterfrau',
  'Hafenweg',
  'Musterstadt',
  'DE89370400440532013000',
  '4.521,88',
];

/** Deterministic random source (mulberry32). */
export function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const word = (text: string, x: number, width = text.length * 5) => ({
  text,
  x,
  width,
  height: 9,
  covered: false,
});

/** A synthetic payslip layout with planted personal data (invented values only). */
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
          { y: 132, words: [word('Netto', 56.7), word('3.100,12', 391.4, 40)] },
        ],
      },
    ],
  };
}

/** A valid, anonymized submission as the browser would send it (every unknown word masked). */
export function validSubmission(
  seed = 1,
  layout: AnalyzedLayout = plantedLayout(),
  decisions: ReadonlyMap<string, WordDecision> = new Map(),
): LayoutSubmissionV1 {
  return toSubmission(anonymizeLayout(layout, decisions, seeded(seed)));
}
