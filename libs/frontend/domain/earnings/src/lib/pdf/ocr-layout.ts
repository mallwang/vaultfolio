import {
  normaliseRecognisedWord,
  type PdfLine,
  type PdfPageText,
  type PdfWord,
} from '@vaultfolio/earnings';

/** A recognised word as the engine reports it: render-pixel box, top-left origin, and confidence 0..100. */
export interface RecognisedWord {
  text: string;
  confidence: number;
  bbox: { x0: number; y0: number; x1: number; y1: number };
}

/** Words below this confidence are dropped as noise (034 research R4). */
export const CONFIDENCE_FLOOR = 30;
/** Words below this confidence are kept but marked, so the request preview can underline them. */
export const LOW_CONFIDENCE = 70;

/**
 * Converts the recognised words of one rendered page into the parsers' line model, in PDF points
 * with y growing upwards. The engine's own lines are not used — its block analysis splits table
 * rows into per-cell lines — so all words are regrouped into rows by vertical centre (tolerance
 * about half the median word height), rows top to bottom, words left to right (034 research R4).
 *
 * @param scale     render scale (pixels per PDF point)
 * @param heightPx  rendered page height in pixels
 * @param widthPx   rendered page width in pixels (page size in points is kept for the layout)
 */
export function recognisedWordsToPage(
  words: readonly RecognisedWord[],
  scale: number,
  heightPx: number,
  widthPx = 0,
): PdfPageText {
  const size = widthPx > 0 ? { width: widthPx / scale, height: heightPx / scale } : {};
  const kept = words
    .map((w) => ({ ...w, text: w.text.trim() }))
    .filter((w) => w.text.length > 0 && w.confidence >= CONFIDENCE_FLOOR);
  if (kept.length === 0) return { lines: [], ...size };

  const tolerance = median(kept.map((w) => w.bbox.y1 - w.bbox.y0)) / 2;
  const centre = (w: (typeof kept)[number]) => (w.bbox.y0 + w.bbox.y1) / 2;

  const rows: { centre: number; words: typeof kept }[] = [];
  for (const word of [...kept].sort((a, b) => centre(a) - centre(b) || a.bbox.x0 - b.bbox.x0)) {
    const row = rows.find((r) => Math.abs(r.centre - centre(word)) <= tolerance);
    if (row) {
      row.words.push(word);
      row.centre = row.words.reduce((sum, w) => sum + centre(w), 0) / row.words.length;
    } else {
      rows.push({ centre: centre(word), words: [word] });
    }
  }

  const lines: PdfLine[] = rows
    .sort((a, b) => a.centre - b.centre)
    .map((row) => {
      const ordered = [...row.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
      const pdfWords: PdfWord[] = ordered.map((w) => ({
        text: normaliseRecognisedWord(w.text),
        x: w.bbox.x0 / scale,
        width: (w.bbox.x1 - w.bbox.x0) / scale,
        height: (w.bbox.y1 - w.bbox.y0) / scale,
        ...(w.confidence < LOW_CONFIDENCE ? { lowConfidence: true } : {}),
      }));
      const baseline = row.words.reduce((sum, w) => sum + w.bbox.y1, 0) / row.words.length;
      return {
        text: pdfWords.map((w) => w.text).join(' '),
        words: pdfWords,
        y: (heightPx - baseline) / scale,
      };
    });
  return { lines, ...size };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
