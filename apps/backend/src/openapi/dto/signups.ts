import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const SIGNUP_STATUSES = ['PENDING', 'VERIFIED', 'APPROVED', 'REJECTED'] as const;

/** Mirrors `libs/api-contract/src/lib/signups.ts`'s `SignupSummary`. */
export class SignupSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: SIGNUP_STATUSES })
  status!: (typeof SIGNUP_STATUSES)[number];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  verifiedAt!: string | null;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  resolvedAt!: string | null;

  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Set once the account this (APPROVED) request produced is later deleted.',
  })
  accountDeletedAt!: string | null;
}

/**
 * Mirrors `libs/api-contract/src/lib/signups.ts`'s `CreateSignupRequest`.
 * `turnstileToken` is required by the `TurnstileGuard` protecting this route
 * (`@TurnstileAction('signup')`) — see the `submit` operation's description.
 */
export class CreateSignupRequestDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ format: 'password' })
  password!: string;

  @ApiProperty({ description: 'Cloudflare Turnstile challenge token.' })
  turnstileToken!: string;
}

/** Mirrors `libs/api-contract/src/lib/signups.ts`'s `SignupSubmitted`. */
export class SignupSubmittedDto {
  @ApiProperty()
  email!: string;
}

/** Mirrors `libs/api-contract/src/lib/signups.ts`'s `RejectSignupRequest`. */
export class RejectSignupRequestDto {
  @ApiPropertyOptional()
  reason?: string;
}

/** Mirrors `libs/api-contract/src/lib/signups.ts`'s `SignupsErrorResponse`. */
export class SignupsErrorResponseDto {
  @ApiProperty({
    enum: [
      'invalid_password',
      'email_unavailable',
      'signup_disabled',
      'email_delivery_failed',
      'invalid_token',
      'not_found',
      'not_verified',
      'already_resolved',
      'bot_protection_failed',
    ],
  })
  error!:
    | 'invalid_password'
    | 'email_unavailable'
    | 'signup_disabled'
    | 'email_delivery_failed'
    | 'invalid_token'
    | 'not_found'
    | 'not_verified'
    | 'already_resolved'
    | 'bot_protection_failed';

  @ApiProperty()
  message!: string;
}
