import { Logger } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { FeedbackDeliveryFailedException } from './feedback.exceptions';
import type { StoredFeedback } from './feedback.repository';

const HOUR = 3_600_000;
const NOW = Date.parse('2026-06-10T12:00:00.000Z');
const user = { id: 'u1', role: 'MEMBER', domainScopes: [] } as never;
const body = (attemptId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479') => ({
  attemptId,
  category: 'feature',
  subject: '  Hello  ',
  message: ' World ',
  language: 'en',
});
const row = (hoursAgo: number, id = `r${hoursAgo}`): StoredFeedback => ({
  id,
  category: 'other',
  language: 'en',
  createdAt: new Date(NOW - hoursAgo * HOUR).toISOString(),
});

describe('FeedbackService', () => {
  let order: string[];
  let rows: StoredFeedback[];
  let existing: StoredFeedback | null;
  let deliver: jest.Mock;
  let insert: jest.Mock;
  let service: FeedbackService;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    order = [];
    rows = [];
    existing = null;
    deliver = jest.fn(() => (order.push('mail'), Promise.resolve()));
    insert = jest.fn(() => (order.push('insert'), Promise.resolve()));
    service = new FeedbackService(
      {
        findById: jest.fn(() => (order.push('lookup'), Promise.resolve(existing))),
        listSince: jest.fn(
          (_o: string, since: string) => (
            order.push('quota'),
            Promise.resolve(rows.filter((r) => r.createdAt > since))
          ),
        ),
        insert,
      } as never,
      { deliver } as never,
      {
        findById: () => Promise.resolve({ displayName: 'Eve', email: 'eve@example.com' }),
      } as never,
    );
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('runs lookup, quota, mail, insert in order and trims input', async () => {
    const result = await service.send(user, body());
    expect(order.slice(0, 4)).toEqual(['lookup', 'quota', 'mail', 'insert']);
    expect(deliver.mock.calls[0][0]).toMatchObject({ subject: 'Hello', message: 'World' });
    expect(result.created).toBe(true);
    expect(result.body.quota).toEqual({
      limit: 5,
      remaining: 4,
      resetAt: new Date(NOW + 24 * HOUR).toISOString(),
    });
  });

  it('rejects invalid input before any lookup', async () => {
    await expect(service.send(user, { ...body(), subject: 'a\nb' })).rejects.toMatchObject({
      details: [{ field: 'subject', message: 'single_line' }],
    });
    await expect(service.send(user, { ...body('nope'), message: ' ' })).rejects.toMatchObject({
      details: expect.arrayContaining([{ field: 'attemptId', message: 'invalid' }]),
    });
    expect(order).toEqual([]);
  });

  it('counts a row at 23h59m but not one at exactly 24h', async () => {
    rows = [row(24), row(23.99), row(1), row(2), row(3)];
    const quota = await service.quota('u1');
    expect(quota.remaining).toBe(1);
    expect(quota.resetAt).toBe(new Date(NOW - 23.99 * HOUR + 24 * HOUR).toISOString());
  });

  it('answers 429 with the quota at the limit and sends nothing', async () => {
    rows = [row(5), row(4), row(3), row(2), row(1)];
    await expect(service.send(user, body())).rejects.toMatchObject({
      status: 429,
      quota: { remaining: 0, resetAt: new Date(NOW - 5 * HOUR + 24 * HOUR).toISOString() },
    });
    expect(deliver).not.toHaveBeenCalled();
  });

  it('allows a send once the oldest row leaves the window', async () => {
    rows = [row(24), row(4), row(3), row(2), row(1)];
    expect((await service.send(user, body())).created).toBe(true);
  });

  it('repeats an already stored attempt as 200 without mail, even at the limit', async () => {
    rows = [row(5), row(4), row(3), row(2), row(1)];
    existing = row(1, body().attemptId);
    const result = await service.send(user, body());
    expect(result).toMatchObject({ created: false, body: { id: body().attemptId } });
    expect(deliver).not.toHaveBeenCalled();
  });

  it('stores nothing when delivery fails', async () => {
    deliver.mockRejectedValue(new FeedbackDeliveryFailedException());
    await expect(service.send(user, body())).rejects.toBeInstanceOf(
      FeedbackDeliveryFailedException,
    );
    expect(insert).not.toHaveBeenCalled();
  });

  it('still succeeds when the insert fails after delivery and logs FeedbackStoreFailed', async () => {
    insert.mockRejectedValue(new Error('disk'));
    const result = await service.send(user, body());
    expect(result.created).toBe(true);
    expect(result.body.quota.remaining).toBe(5);
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'FeedbackStoreFailed' }),
    );
  });

  it('serializes concurrent sends of one user so the quota holds', async () => {
    const stored: StoredFeedback[] = [];
    insert.mockImplementation((r: StoredFeedback) => {
      stored.push({ ...r, createdAt: new Date().toISOString() });
      rows = stored;
      return new Promise((resolve) => setImmediate(resolve));
    });
    const ids = Array.from({ length: 7 }, (_, i) =>
      `f47ac10b-58cc-4372-a567-0e02b2c3d4${i}0`.slice(0, 36),
    );
    jest.useRealTimers();
    const results = await Promise.allSettled(ids.map((id) => service.send(user, body(id))));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(5);
    expect(deliver).toHaveBeenCalledTimes(5);
  });
});
