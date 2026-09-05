import { SetMetadata } from '@nestjs/common';

export const DOMAIN_KEY = 'domain';

/** Restricts a route to callers entitled to the given domain — checked by `DomainGuard` against `request.user.domainScopes` (ADMIN bypasses, mirroring `isDomainEntitled` on the frontend). */
export const RequiresDomain = (domainId: string) => SetMetadata(DOMAIN_KEY, domainId);
