import { Injectable, Logger } from '@nestjs/common';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_DAILY_LIMIT,
  FEEDBACK_LANGUAGES,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_SUBJECT_MAX,
  FEEDBACK_WINDOW_HOURS,
  type ErrorResponseDetail,
  type FeedbackCategory,
  type FeedbackLanguage,
  type FeedbackQuota,
  type SendFeedbackResponse,
} from '@vaultfolio/api-contract';
import { UsersRepository } from '../auth/users.repository';
import type { RequestUser } from '../auth/current-user.decorator';
import { FeedbackEmailService } from './feedback-email.service';
import { FeedbackLimitReachedException, feedbackInvalid } from './feedback.exceptions';
import { FeedbackRepository } from './feedback.repository';

const WINDOW_MS = FEEDBACK_WINDOW_HOURS * 60 * 60 * 1000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ParsedFeedback {
  attemptId: string;
  category: FeedbackCategory;
  subject: string;
  message: string;
  language: FeedbackLanguage;
}

function parse(body: unknown): ParsedFeedback {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
  const details: ErrorResponseDetail[] = [];
  const text = (field: string, max: number, singleLine: boolean): string => {
    const value = typeof b[field] === 'string' ? (b[field] as string).trim() : '';
    if (value.length === 0) details.push({ field, message: 'required' });
    else if (value.length > max) details.push({ field, message: 'too_long' });
    else if (singleLine && /[\r\n]/.test(value)) details.push({ field, message: 'single_line' });
    return value;
  };
  const attemptId = typeof b['attemptId'] === 'string' ? b['attemptId'] : '';
  if (!UUID_V4.test(attemptId)) details.push({ field: 'attemptId', message: 'invalid' });
  const subject = text('subject', FEEDBACK_SUBJECT_MAX, true);
  const message = text('message', FEEDBACK_MESSAGE_MAX, false);
  const category = b['category'] as FeedbackCategory;
  if (!FEEDBACK_CATEGORIES.includes(category))
    details.push({ field: 'category', message: 'invalid' });
  const language = b['language'] as FeedbackLanguage;
  if (!FEEDBACK_LANGUAGES.includes(language))
    details.push({ field: 'language', message: 'invalid' });
  if (details.length > 0) throw feedbackInvalid(details);
  return { attemptId, category, subject, message, language };
}

/** Rolling window: a row exactly 24 h old no longer counts. */
function quotaOf(createdAts: string[]): FeedbackQuota {
  return {
    limit: FEEDBACK_DAILY_LIMIT,
    remaining: Math.max(0, FEEDBACK_DAILY_LIMIT - createdAts.length),
    resetAt: createdAts.length
      ? new Date(Date.parse(createdAts[0]) + WINDOW_MS).toISOString()
      : null,
  };
}

/**
 * Flow (after Turnstile + availability guards): validate, idempotency lookup, quota, deliver mail,
 * store. Mail failure stores nothing (502); a store failure after delivery still succeeds. A
 * per-user in-process lock serializes quota and idempotency.
 * ponytail: in-process lock, assumes a single backend instance; use a DB constraint if scaled out.
 */
@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly repository: FeedbackRepository,
    private readonly email: FeedbackEmailService,
    private readonly users: UsersRepository,
  ) {}

  async quota(userId: string): Promise<FeedbackQuota> {
    return quotaOf(await this.windowOf(userId));
  }

  /** `created` is false for an idempotent repeat of an already stored attempt. */
  async send(
    user: RequestUser,
    body: unknown,
  ): Promise<{ created: boolean; body: SendFeedbackResponse }> {
    const input = parse(body);
    return this.locked(user.id, () => this.doSend(user.id, input));
  }

  private async doSend(userId: string, input: ParsedFeedback) {
    if (await this.repository.findById(input.attemptId, userId)) {
      return { created: false, body: { id: input.attemptId, quota: await this.quota(userId) } };
    }
    const window = await this.windowOf(userId);
    if (window.length >= FEEDBACK_DAILY_LIMIT) {
      const quota = quotaOf(window);
      this.logger.warn({ event: 'FeedbackLimitReached', userId });
      throw new FeedbackLimitReachedException(quota);
    }
    const sender = await this.users.findById(userId);
    await this.email.deliver({
      id: input.attemptId,
      category: input.category,
      subject: input.subject,
      message: input.message,
      senderName: sender?.displayName ?? '',
      senderEmail: sender?.email ?? '',
      senderLanguage: input.language,
    });
    const createdAt = new Date().toISOString();
    try {
      await this.repository.insert(
        { id: input.attemptId, category: input.category, language: input.language, createdAt },
        userId,
        { subject: input.subject, message: input.message },
      );
      window.push(createdAt);
    } catch (error) {
      this.logger.error({
        event: 'FeedbackStoreFailed',
        feedbackId: input.attemptId,
        category: input.category,
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
    this.logger.log({
      event: 'FeedbackDelivered',
      feedbackId: input.attemptId,
      category: input.category,
    });
    return { created: true, body: { id: input.attemptId, quota: quotaOf(window) } };
  }

  private async windowOf(userId: string): Promise<string[]> {
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    return (await this.repository.listSince(userId, since)).map((row) => row.createdAt);
  }

  private locked<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const run = (this.locks.get(key) ?? Promise.resolve()).then(fn, fn);
    const tail = run.catch(() => undefined);
    this.locks.set(key, tail);
    void tail.then(() => {
      if (this.locks.get(key) === tail) this.locks.delete(key);
    });
    return run;
  }
}
