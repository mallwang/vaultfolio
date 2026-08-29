/**
 * Shared contract for the Signups API — see
 * specs/007-self-service-signup/contracts/signups-api.md. Plain TypeScript
 * interfaces, no runtime dependency (Principle II).
 */

export interface SignupSummary {
  id: string;
  email: string;
  status: 'PENDING' | 'VERIFIED' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  verifiedAt: string | null;
  resolvedAt: string | null;
}

export interface CreateSignupRequest {
  email: string;
  password: string;
}

export interface SignupSubmitted {
  email: string;
}

export interface RejectSignupRequest {
  reason?: string;
}

export interface SignupsErrorResponse {
  error:
    | 'invalid_password'
    | 'email_unavailable'
    | 'signup_disabled'
    | 'email_delivery_failed'
    | 'invalid_token'
    | 'not_found'
    | 'not_verified'
    | 'already_resolved';
  message: string;
}
