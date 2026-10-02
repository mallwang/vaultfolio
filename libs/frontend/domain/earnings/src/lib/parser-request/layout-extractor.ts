import {
  type PdfDocumentText,
  type AnalyzedLayout,
  type AnalyzedLine,
  type AnalyzedWord,
  layoutLimitProblem,
} from '@vaultfolio/earnings';
import { loadPdfJs, type PdfJsModule } from '../pdf/pdf-text-extractor';
import { readBytes } from '../pdf/read-blob';

/** Why a file cannot be offered as a parser request (FR-004, edge cases). */
export type LayoutRefusal =
  'IMAGE_ONLY' | 'PASSWORD_PROTECTED' | 'UNREADABLE' | 'TOO_MANY_PAGES' | 'TOO_LARGE';

export type LayoutExtractResult = { layout: AnalyzedLayout } | { error: LayoutRefusal };

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface PdfPage {
  getViewport(options: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[] }>;
}

interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}

/** Baseline tolerance for grouping text runs into one line (points). */
const LINE_TOLERANCE = 2;
/** Runs closer than this continue the previous word (split glyph runs), in points. */
const WORD_GAP = 1;
/** A word counts as covered when a dark shape contains at least this share of its box. */
const COVERED_SHARE = 0.8;
const DARK_LUMINANCE = 0.2;

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

type Matrix = [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function transformBox(box: Box, m: Matrix): Box {
  const corners = [
    [box.x0, box.y0],
    [box.x1, box.y0],
    [box.x0, box.y1],
    [box.x1, box.y1],
  ].map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

function luminance(color: unknown): number | null {
  if (typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) {
    const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(color.slice(i, i + 2), 16) / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return null;
}

/**
 * Filled, axis-aligned dark rectangles of a page in PDF user space (y up), found in the operator
 * list. Best effort (R4): if nothing is found the result is empty and no word is preselected as
 * masked — every unknown word still needs a decision, so this never causes a leak.
 */
async function darkRectangles(
  page: PdfPage,
  ops: Record<string, number> | undefined,
): Promise<Box[]> {
  if (!ops) return [];
  const { fnArray, argsArray } = await page.getOperatorList();
  const fills = new Set([ops['fill'], ops['eoFill'], ops['fillStroke'], ops['eoFillStroke']]);
  const stack: Matrix[] = [];
  let ctm: Matrix = IDENTITY;
  let fill: number | null = null;
  const boxes: Box[] = [];
  fnArray.forEach((fn, i) => {
    const args = argsArray[i] as unknown;
    if (fn === ops['save']) stack.push(ctm);
    else if (fn === ops['restore']) ctm = stack.pop() ?? IDENTITY;
    else if (fn === ops['transform']) ctm = multiply(ctm, Array.from(args as number[]) as Matrix);
    else if (fn === ops['setFillRGBColor']) fill = luminance((args as unknown[])[0]);
    else if (fn === ops['setFillGray']) fill = Number((args as unknown[])[0]);
    else if (fn === ops['constructPath']) {
      const [paintOp, , minMax] = args as [number, unknown, ArrayLike<number> | null];
      if (fills.has(paintOp) && minMax && fill !== null && fill < DARK_LUMINANCE) {
        const [x0, y0, x1, y1] = Array.from(minMax);
        boxes.push(transformBox({ x0, y0, x1, y1 }, ctm));
      }
    }
  });
  return boxes;
}

function share(word: Box, rect: Box): number {
  const w = Math.min(word.x1, rect.x1) - Math.max(word.x0, rect.x0);
  const h = Math.min(word.y1, rect.y1) - Math.max(word.y0, rect.y0);
  const area = (word.x1 - word.x0) * (word.y1 - word.y0);
  return w > 0 && h > 0 && area > 0 ? (w * h) / area : 0;
}

interface Run {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function toLines(items: TextItem[], pageHeight: number, rects: Box[]): AnalyzedLine[] {
  const runs: Run[] = items
    .filter((i) => i.str.trim().length > 0)
    .map((i) => ({
      str: i.str,
      x: i.transform[4],
      y: i.transform[5],
      width: i.width,
      height: i.height,
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const groups: { y: number; runs: Run[] }[] = [];
  for (const run of runs) {
    const group = groups.find((g) => Math.abs(g.y - run.y) <= LINE_TOLERANCE);
    if (group) group.runs.push(run);
    else groups.push({ y: run.y, runs: [run] });
  }

  return groups.map((group) => {
    const words: AnalyzedWord[] = [];
    group.runs.sort((a, b) => a.x - b.x);
    for (const run of group.runs) {
      const charWidth = run.str.length > 0 ? run.width / run.str.length : 0;
      for (const m of run.str.matchAll(/\S+/g)) {
        const x = run.x + (m.index ?? 0) * charWidth;
        const width = m[0].length * charWidth;
        const previous = words.at(-1);
        if (previous && m.index === 0 && x - (previous.x + previous.width) < WORD_GAP) {
          previous.text += m[0];
          previous.width = x + width - previous.x;
          previous.height = Math.max(previous.height, run.height);
        } else {
          words.push({ text: m[0], x, width, height: run.height, covered: false });
        }
      }
    }
    for (const word of words) {
      const box = { x0: word.x, y0: group.y, x1: word.x + word.width, y1: group.y + word.height };
      word.covered = rects.some((rect) => share(box, rect) >= COVERED_SHARE);
    }
    return { y: pageHeight - group.y, words };
  });
}

const isTextItem = (item: unknown): item is TextItem => {
  const candidate = item as Partial<TextItem>;
  return typeof candidate?.str === 'string' && Array.isArray(candidate.transform);
};

/**
 * Reads positions, sizes and "covered by a dark shape" hints of a PDF in the browser (R4). The
 * file and everything read here stay in memory on the device (FR-003); the result feeds the
 * anonymizer. Pages without text are dropped; documents the server would refuse are refused here.
 */
export async function extractLayout(file: Blob): Promise<LayoutExtractResult> {
  const data = await readBytes(file);
  let pdfjs: PdfJsModule;
  try {
    pdfjs = await loadPdfJs();
  } catch {
    return { error: 'UNREADABLE' };
  }
  const task = pdfjs.getDocument({ data, isEvalSupported: false, disableFontFace: true });
  try {
    const doc = (await task.promise) as unknown as PdfDocument;
    const pages: AnalyzedLayout['pages'] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const items = (await page.getTextContent()).items.filter(isTextItem);
      if (items.every((item) => item.str.trim() === '')) continue;
      const rects = await darkRectangles(page, pdfjs.OPS);
      pages.push({
        width: viewport.width,
        height: viewport.height,
        lines: toLines(items, viewport.height, rects),
      });
    }
    const layout: AnalyzedLayout = { pages };
    const problem = layoutLimitProblem(layout);
    if (problem === 'NO_TEXT') return { error: 'IMAGE_ONLY' };
    return problem ? { error: problem } : { layout };
  } catch (error: unknown) {
    const name = (error as { name?: string } | null)?.name;
    return { error: name === 'PasswordException' ? 'PASSWORD_PROTECTED' : 'UNREADABLE' };
  } finally {
    await task.destroy().catch(() => undefined);
  }
}

/** A4 in points, for recognised pages whose size was not reported. */
const A4 = { width: 595.3, height: 841.9 };
const DEFAULT_WORD_HEIGHT = 9;

/** Share of a recognised word's box another word may cover before it counts as a duplicate. */
const DUPLICATE_SHARE = 0.6;

interface PlacedWord {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

function coveredShare(word: PlacedWord, other: PlacedWord): number {
  const w = Math.min(word.x1, other.x1) - Math.max(word.x0, other.x0);
  const h = Math.min(word.y1, other.y1) - Math.max(word.y0, other.y0);
  const area = (word.x1 - word.x0) * (word.y1 - word.y0);
  return w > 0 && h > 0 && area > 0 ? (w * h) / area : 0;
}

/**
 * Text recognition sometimes reads the same print twice (a line and a re-read of its small-print
 * neighbour); the second word, mostly covered by an earlier one, is dropped so the preview shows
 * one word per place.
 */
function dropDuplicateWords(lines: AnalyzedLine[]): AnalyzedLine[] {
  const kept: PlacedWord[] = [];
  return lines
    .map((line) => ({
      ...line,
      words: line.words.filter((word) => {
        const box = {
          x0: word.x,
          x1: word.x + word.width,
          y0: line.y - word.height,
          y1: line.y,
        };
        if (kept.some((other) => coveredShare(box, other) >= DUPLICATE_SHARE)) return false;
        kept.push(box);
        return true;
      }),
    }))
    .filter((line) => line.words.length > 0);
}

/**
 * Builds the analysis of a document read by text recognition (034): the same structure the PDF text
 * layer yields — positions, sizes — without "covered" hints (a scan has no shapes drawn over text);
 * low-confidence words are carried so the preview can underline them. Everything stays in memory.
 */
export function layoutFromRecognised(text: PdfDocumentText): LayoutExtractResult {
  const pages: AnalyzedLayout['pages'] = text.pages
    .filter((page) => page.lines.length > 0)
    .map((page) => {
      const height = page.height ?? A4.height;
      return {
        width: page.width ?? A4.width,
        height,
        lines: dropDuplicateWords(
          page.lines.map((line) => ({
            y: height - line.y,
            words: line.words.map((word) => ({
              text: word.text,
              x: word.x,
              width: word.width,
              height: word.height ?? DEFAULT_WORD_HEIGHT,
              covered: false,
              ...(word.lowConfidence ? { lowConfidence: true } : {}),
            })),
          })),
        ),
      };
    });
  const layout: AnalyzedLayout = { pages };
  const problem = layoutLimitProblem(layout);
  if (problem === 'NO_TEXT') return { error: 'IMAGE_ONLY' };
  return problem ? { error: problem } : { layout };
}
