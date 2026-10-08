import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FEEDBACK_CATEGORIES, FEEDBACK_LANGUAGES } from '@vaultfolio/api-contract';

/** Mirrors `libs/api-contract/src/lib/feedback.ts` (044-user-feedback). */
export class FeedbackQuotaDto {
  @ApiProperty({ example: 5 })
  limit!: number;

  @ApiProperty({ example: 4 })
  remaining!: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'When the oldest counted feedback leaves the window; null when none counted.',
  })
  resetAt!: string | null;
}

export class SendFeedbackRequestDto {
  @ApiProperty({ format: 'uuid', description: 'Client-generated UUID v4; idempotency key.' })
  attemptId!: string;

  @ApiProperty({ enum: FEEDBACK_CATEGORIES })
  category!: string;

  @ApiProperty({ minLength: 1, maxLength: 100, description: 'Single line, trimmed.' })
  subject!: string;

  @ApiProperty({ minLength: 1, maxLength: 2000, description: 'Trimmed.' })
  message!: string;

  @ApiProperty({ enum: FEEDBACK_LANGUAGES })
  language!: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token.' })
  turnstileToken?: string;
}

export class SendFeedbackResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: FeedbackQuotaDto })
  quota!: FeedbackQuotaDto;
}
