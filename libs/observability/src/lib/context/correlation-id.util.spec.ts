import { resolveCorrelationId } from './correlation-id.util.js';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';
const OTHER_VALID_UUID = '22222222-2222-4222-8222-222222222222';

describe('resolveCorrelationId', () => {
  it('reuses a valid inbound X-Correlation-Id verbatim', () => {
    expect(resolveCorrelationId({ 'x-correlation-id': VALID_UUID })).toBe(VALID_UUID);
  });

  it('falls back to x-request-id only when X-Correlation-Id is absent', () => {
    expect(resolveCorrelationId({ 'x-request-id': VALID_UUID })).toBe(VALID_UUID);
    expect(
      resolveCorrelationId({
        'x-correlation-id': VALID_UUID,
        'x-request-id': OTHER_VALID_UUID,
      }),
    ).toBe(VALID_UUID);
  });

  it('generates a fresh UUID when both headers are absent', () => {
    const id = resolveCorrelationId({});
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('generates a fresh UUID when the inbound value is malformed, never echoing it back', () => {
    const id = resolveCorrelationId({ 'x-correlation-id': 'not-a-uuid' });
    expect(id).not.toBe('not-a-uuid');
    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
