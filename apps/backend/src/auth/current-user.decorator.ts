import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole } from '@vaultfolio/api-contract';

export interface RequestUser {
  id: string;
  role: UserRole;
  domainScopes: string[];
}

/** Reads `request.user`, attached by `AuthGuard` on every authenticated request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
  return request.user;
});
