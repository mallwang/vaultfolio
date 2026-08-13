import type { HealthStatus } from './health.js';

describe('HealthStatus', () => {
  it('accepts the documented "connected" shape', () => {
    const ok: HealthStatus = {
      status: 'ok',
      database: 'connected',
      timestamp: '2026-08-13T12:00:00.000Z',
    };

    expect(ok.status).toBe('ok');
  });

  it('accepts the documented "unreachable" shape', () => {
    const degraded: HealthStatus = {
      status: 'degraded',
      database: 'unreachable',
      timestamp: '2026-08-13T12:00:00.000Z',
    };

    expect(degraded.status).toBe('degraded');
  });
});
