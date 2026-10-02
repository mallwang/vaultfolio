import type { PdfDocumentText } from '@vaultfolio/earnings';

/** Pages above this limit are refused before any rendering (payslips and certificates have 1–2). */
export const MAX_RECOGNITION_PAGES = 5;

export interface RecognitionProgress {
  /** Engine load, page rendering, or recognition of the current page. */
  phase: 'LOADING' | 'RENDERING' | 'RECOGNISING';
  /** 1-based current page. */
  page: number;
  pageCount: number;
  /** 0..1 within the current page. */
  fraction: number;
}

export type RecognitionError = 'NO_TEXT' | 'TOO_MANY_PAGES' | 'ENGINE_UNAVAILABLE' | 'CANCELLED';

export type RecognitionResult = { text: PdfDocumentText } | { error: RecognitionError };

/**
 * Reads the text of a PDF without a text layer, entirely on the device (034 FR-004). The only
 * implementation in the app is the tesseract.js adapter; specs use a scriptable fake.
 */
export interface TextRecogniser {
  /** Renders and recognises the PDF; resolves with text or an error. Never rejects. */
  recognise(
    file: Blob,
    options: { signal: AbortSignal; onProgress: (progress: RecognitionProgress) => void },
  ): Promise<RecognitionResult>;
}
