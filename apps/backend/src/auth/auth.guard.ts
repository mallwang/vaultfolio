import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import { SessionsRepository } from './sessions.repository';
import { UsersRepository } from './users.repository';
import { SESSION_COOKIE_NAME } from './session-cookie';
import type { RequestUser } from './current-user.decorator';

const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30;

function unauthenticated(): UnauthorizedException {
  return new UnauthorizedException({ error: 'unauthenticated', message: 'Sign in required.' });
}

function inactivityTimeoutMs(): number {
  const minutes = Number(process.env.SESSION_INACTIVITY_TIMEOUT_MINUTES);
  return (
    (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_INACTIVITY_TIMEOUT_MINUTES) *
    60_000
  );
}

/**
 * Global `AuthGuard` (research.md #5, FR-001): every route requires a valid
 * session by default; `@Public()` is the explicit opt-out. Reads the session
 * cookie, looks it up (`SessionsRepository` already treats an
 * absolute-expiry miss as a lookup-miss), enforces the sliding
 * inactivity-timeout window here, attaches `request.user`, and bumps
 * `last_active_at` on every valid request.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionsRepository,
    private readonly users: UsersRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const sessionId = (request.cookies as Record<string, string> | undefined)?.[
      SESSION_COOKIE_NAME
    ];
    if (!sessionId) {
      throw unauthenticated();
    }

    const session = await this.sessions.findById(sessionId);
    if (!session) {
      throw unauthenticated();
    }

    const inactiveMs = Date.now() - new Date(session.lastActiveAt).getTime();
    if (inactiveMs > inactivityTimeoutMs()) {
      await this.sessions.deleteById(session.id);
      throw unauthenticated();
    }

    const user = await this.users.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      await this.sessions.deleteById(session.id);
      throw unauthenticated();
    }

    await this.sessions.touch(session.id);
    request.user = { id: user.id, role: user.role };
    return true;
  }
}
