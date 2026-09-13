import { RequestContextService } from './request-context.service.js';

describe('RequestContextService', () => {
  it('is unset outside run()', () => {
    const service = new RequestContextService();
    expect(service.getCorrelationId()).toBeUndefined();
    expect(service.getUserId()).toBeUndefined();
  });

  it('exposes the values set for run()', () => {
    const service = new RequestContextService();
    service.run({ correlationId: 'abc', userId: 'user-1' }, () => {
      expect(service.getCorrelationId()).toBe('abc');
      expect(service.getUserId()).toBe('user-1');
    });
  });

  it('isolates context per concurrent async execution', async () => {
    const service = new RequestContextService();

    const runWith = (correlationId: string, delayMs: number) =>
      service.run({ correlationId }, async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return service.getCorrelationId();
      });

    const [first, second] = await Promise.all([runWith('req-1', 20), runWith('req-2', 5)]);

    expect(first).toBe('req-1');
    expect(second).toBe('req-2');
    expect(service.getCorrelationId()).toBeUndefined();
  });
});
