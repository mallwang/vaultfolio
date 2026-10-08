import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_SUBJECT_MAX,
  type FeedbackCategory,
} from '@vaultfolio/api-contract';

const DRAFT_VERSION = 1;

export interface FeedbackDraft {
  category: FeedbackCategory;
  subject: string;
  message: string;
}

export function serializeDraft(draft: FeedbackDraft): string {
  return JSON.stringify({ v: DRAFT_VERSION, ...draft });
}

/** Returns null for missing, garbage or wrong-version input. */
export function parseDraft(raw: string | null): FeedbackDraft | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (
      d?.['v'] !== DRAFT_VERSION ||
      typeof d['subject'] !== 'string' ||
      typeof d['message'] !== 'string' ||
      !FEEDBACK_CATEGORIES.includes(d['category'] as FeedbackCategory)
    ) {
      return null;
    }
    return {
      category: d['category'] as FeedbackCategory,
      subject: d['subject'].slice(0, FEEDBACK_SUBJECT_MAX),
      message: d['message'].slice(0, FEEDBACK_MESSAGE_MAX),
    };
  } catch {
    return null;
  }
}

export function isDraftEmpty(draft: Pick<FeedbackDraft, 'subject' | 'message'>): boolean {
  return draft.subject.trim() === '' && draft.message.trim() === '';
}
