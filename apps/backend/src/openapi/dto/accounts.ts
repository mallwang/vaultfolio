import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, UserStatus } from '@vaultfolio/api-contract';

/** Mirrors `libs/api-contract/src/lib/accounts.ts`'s `AccountSummary`. */
export class AccountSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'member@example.com' })
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  archivedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  retentionExpiresAt!: string | null;

  @ApiProperty()
  isLastActiveAdmin!: boolean;

  @ApiProperty({
    type: [String],
    description: 'Domain ids this account is entitled to, independent of `role`.',
  })
  domainScopes!: string[];
}

/** Mirrors `libs/api-contract/src/lib/accounts.ts`'s `ChangeRoleRequest`. */
export class ChangeRoleRequestDto {
  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}

/** Mirrors `libs/api-contract/src/lib/accounts.ts`'s `ChangeDomainScopesRequest`. */
export class ChangeDomainScopesRequestDto {
  @ApiProperty({ type: [String] })
  domainScopes!: string[];
}

/** Mirrors `libs/api-contract/src/lib/accounts.ts`'s `AccountsErrorResponse`. */
export class AccountsErrorResponseDto {
  @ApiProperty({
    enum: [
      'not_found',
      'last_admin',
      'already_archived',
      'retention_expired',
      'forbidden',
      'invalid_domain',
    ],
  })
  error!:
    | 'not_found'
    | 'last_admin'
    | 'already_archived'
    | 'retention_expired'
    | 'forbidden'
    | 'invalid_domain';

  @ApiProperty()
  message!: string;
}
