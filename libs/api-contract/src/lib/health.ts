/**
 * Shared contract for GET /health — see specs/001-tech-stack-setup/contracts/health-api.md.
 * Imported by both apps/backend (to shape its response) and apps/frontend (to type the HTTP
 * call) so the two tiers can never silently drift on this shape (Principle II).
 */
export interface HealthStatus {
  status: 'ok' | 'degraded';
  database: 'connected' | 'unreachable';
  /** ISO 8601 timestamp of when the health check was evaluated. */
  timestamp: string;
}
