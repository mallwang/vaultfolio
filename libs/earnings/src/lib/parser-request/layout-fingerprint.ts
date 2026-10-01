import { COURIER_ADVANCE, isNumericWord } from './anonymize.js';
import type { LayoutSubmissionV1 } from './layout-submission.js';

/** Coordinates are rounded to this grid so small layout differences do not matter. */
const GRID = 5;

const snap = (value: number): number => Math.round(value / GRID) * GRID;

/**
 * Canonical string of a submission with its values taken out (R12): digits become `0`, amounts are
 * placed by their right edge, masked (`xxx`) and removed (`XXX`) words collapse to one token, and
 * coordinates snap to a 5 pt grid. Two users with the same employer layout produce the same string
 * although every value in the sample is random. The caller hashes it (SHA-256).
 */
export function layoutFingerprintInput(submission: LayoutSubmissionV1): string {
  return submission.pages
    .map((page) => {
      const lines = page.lines
        .map((line) => {
          const words = line.words
            .map((word) => {
              if (/^x+$/.test(word.text)) return `${snap(word.x)}:x`;
              if (/^X+$/.test(word.text)) return `${snap(word.x)}:X`;
              if (isNumericWord(word.text)) {
                const right = word.x + word.text.length * COURIER_ADVANCE * line.size;
                return `${snap(right)}:#`;
              }
              return `${snap(word.x)}:${word.text.replaceAll(/\d/g, '0')}`;
            })
            .join(',');
          return `${snap(line.y)}[${words}]`;
        })
        .join(';');
      return `${snap(page.width)}x${snap(page.height)}{${lines}}`;
    })
    .join('|');
}
