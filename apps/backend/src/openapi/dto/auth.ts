import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@vaultfolio/api-contract';

/** Mirrors `libs/api-contract/src/lib/auth.ts`'s `SignInRequest`. */
export class SignInRequestDto {
  @ApiProperty({ example: 'admin@example.com' })
  email!: string;

  @ApiProperty({ format: 'password' })
  password!: string;
}

/**
 * Mirrors `libs/api-contract/src/lib/auth.ts`'s `SessionUser` — also the
 * shape returned by `GET /auth/session`. Never includes `password_hash` or
 * any other user's data.
 */
export class SessionUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'admin@example.com' })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({
    type: [String],
    description: 'Domain ids this user is entitled to, independent of `role`.',
  })
  domainScopes!: string[];
}

/** Mirrors `libs/api-contract/src/lib/auth.ts`'s `AuthErrorResponse`. */
export class AuthErrorResponseDto {
  @ApiProperty({
    enum: ['invalid_credentials', 'account_locked', 'unauthenticated', 'forbidden'],
  })
  error!: 'invalid_credentials' | 'account_locked' | 'unauthenticated' | 'forbidden';

  @ApiProperty()
  message!: string;
}
