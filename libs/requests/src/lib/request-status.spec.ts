import { CLOSED_STATUSES, REQUEST_LIMITS, REQUEST_STATUSES } from './request-status.js';

describe('request status', () => {
  it('lists the four statuses in workflow order', () => {
    expect(REQUEST_STATUSES).toEqual(['OPEN', 'IN_PROGRESS', 'DONE', 'REJECTED']);
  });

  it('treats DONE and REJECTED as closed', () => {
    expect(CLOSED_STATUSES).toEqual(['DONE', 'REJECTED']);
  });

  it('exposes the limits of FR-039/FR-040', () => {
    expect(REQUEST_LIMITS).toEqual({ open: 3, perDay: 5, retentionDays: 30 });
  });
});
