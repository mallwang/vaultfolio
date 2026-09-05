import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestUser {
  id: string;
  role: 'ADMIN' | 'MEMBER';
  domainScopes: string[];
}

/** Reads `request.user`, attached by `AuthGuard` on every authenticated request. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
  return request.user;
});
