import { EventEmitter } from 'node:events';
import { RequestLoggingMiddleware } from './request-logging.middleware.js';
import { RequestContextService } from './request-context.service.js';

function buildResponse(statusCode: number) {
  const res = new EventEmitter() as EventEmitter & { statusCode: number };
  res.statusCode = statusCode;
  return res;
}

describe('RequestLoggingMiddleware', () => {
  let requestContext: RequestContextService;
  let middleware: RequestLoggingMiddleware;

  beforeEach(() => {
    requestContext = new RequestContextService();
    middleware = new RequestLoggingMiddleware(requestContext);
  });

  it('logs one Incoming Request and exactly one Request Completed line for a successful response', () => {
    const logSpy = jest.spyOn(middleware['logger'], 'log');
    const req = { method: 'GET', url: '/accounts', headers: {} } as unknown as Parameters<
      RequestLoggingMiddleware['use']
    >[0];
    const res = buildResponse(200);
    const next = jest.fn();

    requestContext.run({ correlationId: 'corr-1' }, () => {
      middleware.use(req, res as never, next);
    });
    res.emit('finish');

    const events = logSpy.mock.calls.map(([entry]) => (entry as { event: string }).event);
    expect(events).toEqual(['Incoming Request', 'Request Completed']);
    expect(next).toHaveBeenCalled();
  });

  it('logs Request Failed for a 4xx/5xx response — including one produced by a Guard rejection with no handler ever reached', () => {
    const logSpy = jest.spyOn(middleware['logger'], 'log');
    const req = { method: 'GET', url: '/accounts', headers: {} } as unknown as Parameters<
      RequestLoggingMiddleware['use']
    >[0];
    const res = buildResponse(401);
    const next = jest.fn();

    requestContext.run({ correlationId: 'corr-1' }, () => {
      middleware.use(req, res as never, next);
    });
    res.emit('finish');

    const events = logSpy.mock.calls.map(([entry]) => (entry as { event: string }).event);
    expect(events).toEqual(['Incoming Request', 'Request Failed']);
  });

  it('includes userId only when the request is authenticated by the time the response finishes', () => {
    const logSpy = jest.spyOn(middleware['logger'], 'log');
    const req = { method: 'GET', url: '/accounts', headers: {} } as unknown as Parameters<
      RequestLoggingMiddleware['use']
    >[0] & { user?: { id: string } };
    const res = buildResponse(200);

    requestContext.run({ correlationId: 'corr-1' }, () => {
      middleware.use(req, res as never, jest.fn());
    });
    // AuthGuard would set this after middleware runs but before the response finishes.
    req.user = { id: 'user-1' };
    res.emit('finish');

    const completed = logSpy.mock.calls.find(
      ([entry]) => (entry as { event: string }).event === 'Request Completed',
    )?.[0] as { userId?: string };
    expect(completed.userId).toBe('user-1');
  });

  it('a forced logging failure does not propagate (does not throw)', () => {
    jest.spyOn(middleware['logger'], 'log').mockImplementation(() => {
      throw new Error('logger exploded');
    });
    const req = { method: 'GET', url: '/accounts', headers: {} } as unknown as Parameters<
      RequestLoggingMiddleware['use']
    >[0];
    const res = buildResponse(200);
    const next = jest.fn();

    expect(() => {
      requestContext.run({ correlationId: 'corr-1' }, () => {
        middleware.use(req, res as never, next);
      });
      res.emit('finish');
    }).not.toThrow();
    expect(next).toHaveBeenCalled();
  });
});
