import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { ROLES_KEY } from './roles.decorator';
import type { RequestUser } from './current-user.decorator';
import type { UserRole } from '@vaultfolio/api-contract';
import { AccessDeniedException } from '@vaultfolio/observability';

/** `@Roles('ADMIN')` check against `request.user.role` (set by `AuthGuard`, which runs first). */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    if (!requiredRoles.includes(request.user?.role as UserRole)) {
      throw new AccessDeniedException({
        error: 'forbidden',
        message: 'You do not have access to this resource.',
      });
    }
    return true;
  }
}
