import { ApiProperty } from '@nestjs/swagger';
import { InvitationStatus, UserRole } from '@vaultfolio/api-contract';

/** Mirrors `libs/api-contract/src/lib/invitations.ts`'s `InvitationSummary`. */
export class InvitationSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiProperty({ enum: InvitationStatus })
  status!: InvitationStatus;

  @ApiProperty({ format: 'uuid', description: 'Id of the admin who sent this invitation.' })
  invitedBy!: string;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}

/** Mirrors `libs/api-contract/src/lib/invitations.ts`'s `CreateInvitationRequest`. */
export class CreateInvitationRequestDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}

/** Mirrors `libs/api-contract/src/lib/invitations.ts`'s `InvitationTokenLookup`. */
export class InvitationTokenLookupDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;
}

/** Mirrors `libs/api-contract/src/lib/invitations.ts`'s `AcceptInvitationRequest`. */
export class AcceptInvitationRequestDto {
  @ApiProperty({ format: 'password' })
  password!: string;

  @ApiProperty()
  displayName!: string;
}

/** Mirrors `libs/api-contract/src/lib/invitations.ts`'s `InvitationsErrorResponse`. */
export class InvitationsErrorResponseDto {
  @ApiProperty({
    enum: [
      'account_exists',
      'not_found',
      'already_resolved',
      'email_delivery_failed',
      'invalid_invitation',
      'invalid_password',
    ],
  })
  error!:
    | 'account_exists'
    | 'not_found'
    | 'already_resolved'
    | 'email_delivery_failed'
    | 'invalid_invitation'
    | 'invalid_password';

  @ApiProperty()
  message!: string;
}
