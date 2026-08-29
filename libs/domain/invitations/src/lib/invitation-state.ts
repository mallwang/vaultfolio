/**
 * Invitation lifecycle state machine (data-model.md "Lifecycle"):
 *
 * ```text
 * PENDING ──accept (valid, unexpired)──> ACCEPTED  (terminal)
 * PENDING ──expires_at elapses──> EXPIRED           (terminal, lazy-evaluated)
 * PENDING ──admin cancels──> CANCELLED              (terminal)
 * PENDING ──admin sends new invite to same email──> SUPERSEDED (terminal)
 * ```
 *
 * Every other status is terminal — no transition is legal out of ACCEPTED,
 * EXPIRED, CANCELLED, or SUPERSEDED. Pure domain logic (Principle I); the
 * repository layer enforces this same rule again at the SQL level via
 * status-guarded `UPDATE ... WHERE status = $expected` (research.md #4) so a
 * race can never apply an illegal transition even if this check were
 * bypassed.
 */
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED' | 'SUPERSEDED';

const LEGAL_TRANSITIONS: Record<InvitationStatus, readonly InvitationStatus[]> = {
  PENDING: ['ACCEPTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'],
  ACCEPTED: [],
  EXPIRED: [],
  CANCELLED: [],
  SUPERSEDED: [],
};

export function isLegalTransition(from: InvitationStatus, to: InvitationStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}
