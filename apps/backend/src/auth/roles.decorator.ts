import { SetMetadata } from '@nestjs/common';
import type { UserRole } from './users.repository';

export const ROLES_KEY = 'roles';

/** Restricts a route to the given role(s) — checked by `RolesGuard` against `request.user.role`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
