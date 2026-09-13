import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SUPPORTED_LANGUAGES, UserRole } from '@vaultfolio/api-contract';

const LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((language) => language.code);

/** Mirrors `libs/api-contract/src/lib/profile.ts`'s `ProfileSummary`. */
export class ProfileSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ enum: UserRole })
  role!: UserRole;

  @ApiPropertyOptional({ nullable: true })
  pendingEmail!: string | null;

  @ApiPropertyOptional({
    enum: LANGUAGE_CODES,
    nullable: true,
    description: 'null = not explicitly set; falls back to the default language.',
  })
  emailLanguage!: string | null;
}

/** Mirrors `libs/api-contract/src/lib/profile.ts`'s `UpdateDisplayNameRequest`. */
export class UpdateDisplayNameRequestDto {
  @ApiProperty()
  displayName!: string;
}

/** Mirrors `libs/api-contract/src/lib/profile.ts`'s `UpdateEmailLanguageRequest`. */
export class UpdateEmailLanguageRequestDto {
  @ApiProperty({ enum: LANGUAGE_CODES, nullable: true })
  emailLanguage!: string | null;
}

/** Mirrors `libs/api-contract/src/lib/profile.ts`'s `RequestEmailChangeRequest`. */
export class RequestEmailChangeRequestDto {
  @ApiProperty()
  newEmail!: string;
}

/** Mirrors `libs/api-contract/src/lib/profile.ts`'s `ChangePasswordRequest`. */
export class ChangePasswordRequestDto {
  @ApiProperty({ format: 'password' })
  currentPassword!: string;

  @ApiProperty({ format: 'password' })
  newPassword!: string;
}

/**
 * Mirrors `libs/api-contract/src/lib/profile.ts`'s `ForgotPasswordRequest`.
 * `turnstileToken` is required by the `TurnstileGuard` protecting this route.
 */
export class ForgotPasswordRequestDto {
  @ApiProperty()
  email!: string;

  @ApiProperty({ description: 'Cloudflare Turnstile challenge token.' })
  turnstileToken!: string;
}

/** Mirrors `libs/api-contract/src/lib/profile.ts`'s `ResetPasswordRequest`. */
export class ResetPasswordRequestDto {
  @ApiProperty({ format: 'password' })
  newPassword!: string;
}

/** Mirrors `libs/api-contract/src/lib/profile.ts`'s `ProfileErrorResponse`. */
export class ProfileErrorResponseDto {
  @ApiProperty({
    enum: [
      'invalid_display_name',
      'email_unavailable',
      'email_delivery_failed',
      'invalid_token',
      'invalid_password',
      'invalid_current_password',
      'last_admin',
      'deletion_failed',
      'invalid_email_language',
      'bot_protection_failed',
    ],
  })
  error!:
    | 'invalid_display_name'
    | 'email_unavailable'
    | 'email_delivery_failed'
    | 'invalid_token'
    | 'invalid_password'
    | 'invalid_current_password'
    | 'last_admin'
    | 'deletion_failed'
    | 'invalid_email_language'
    | 'bot_protection_failed';

  @ApiProperty()
  message!: string;
}
