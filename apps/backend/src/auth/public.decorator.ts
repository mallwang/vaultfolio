import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of the global `AuthGuard` (FR-001's default-deny, research.md #5). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
