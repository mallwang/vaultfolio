import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { DOMAIN_KEY } from './domain.decorator';
import type { RequestUser } from './current-user.decorator';

/**
 * `@RequiresDomain('holdings')` check against `request.user.domainScopes`
 * (set by `AuthGuard`, which runs first) — the server-side counterpart of
 * the frontend's `domainGuard`/`isDomainEntitled`. An `ADMIN` always
 * passes, regardless of `domainScopes`, matching `isDomainEntitled`.
 */
@Injectable()
export class DomainGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredDomain = this.reflector.getAllAndOverride<string | undefined>(DOMAIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredDomain) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (user?.role === 'ADMIN' || user?.domainScopes.includes(requiredDomain)) {
      return true;
    }

    throw new ForbiddenException({
      error: 'forbidden',
      message: 'You do not have access to this resource.',
    });
  }
}
