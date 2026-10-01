import type { LayoutSubmissionV1 } from './layout-submission.js';

/**
 * One description of the sample for both the browser preview and the server's PDF writer (R7): a
 * list of positioned text items per page, so "what the administrators receive" is testable.
 */
export interface Sheet {
  pages: {
    width: number;
    height: number;
    items: { text: string; x: number; y: number; size: number }[];
  }[];
}

export function toSheet(submission: LayoutSubmissionV1): Sheet {
  return {
    pages: submission.pages.map((page) => ({
      width: page.width,
      height: page.height,
      items: page.lines.flatMap((line) =>
        line.words.map((word) => ({ text: word.text, x: word.x, y: line.y, size: line.size })),
      ),
    })),
  };
}
