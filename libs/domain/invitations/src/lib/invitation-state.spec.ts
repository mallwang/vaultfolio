import { isLegalTransition } from './invitation-state.js';
import type { InvitationStatus } from './invitation-state.js';

const ALL_STATUSES: InvitationStatus[] = [
  'PENDING',
  'ACCEPTED',
  'EXPIRED',
  'CANCELLED',
  'SUPERSEDED',
];

describe('isLegalTransition', () => {
  it('allows every PENDING -> terminal-status transition', () => {
    expect(isLegalTransition('PENDING', 'ACCEPTED')).toBe(true);
    expect(isLegalTransition('PENDING', 'EXPIRED')).toBe(true);
    expect(isLegalTransition('PENDING', 'CANCELLED')).toBe(true);
    expect(isLegalTransition('PENDING', 'SUPERSEDED')).toBe(true);
  });

  it('rejects every transition out of a terminal status', () => {
    const terminal: InvitationStatus[] = ['ACCEPTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'];
    for (const from of terminal) {
      for (const to of ALL_STATUSES) {
        expect(isLegalTransition(from, to)).toBe(false);
      }
    }
  });

  it('rejects PENDING -> PENDING (no self-transition)', () => {
    expect(isLegalTransition('PENDING', 'PENDING')).toBe(false);
  });
});
