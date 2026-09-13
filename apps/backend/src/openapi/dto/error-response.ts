import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Mirrors `libs/api-contract/src/lib/error-response.ts`'s `ErrorResponseDetail` —
 * used as the shape of `ErrorResponseDto.details` entries.
 */
export class ErrorResponseDetailDto {
  @ApiProperty({ example: 'quantity' })
  field!: string;

  @ApiProperty({ example: 'Must be a positive number.' })
  message!: string;
}

/**
 * Mirrors `libs/api-contract/src/lib/error-response.ts`'s `ErrorResponse` —
 * the structured error body every documented error status in this API
 * returns (T016).
 */
export class ErrorResponseDto {
  @ApiProperty({ description: 'Stable machine-readable error code.', example: 'not_found' })
  error!: string;

  @ApiProperty({ example: 'Account not found.' })
  message!: string;

  @ApiProperty({
    description: 'UUID for end-to-end tracing; matches the X-Correlation-Id response header.',
    format: 'uuid',
  })
  correlationId!: string;

  @ApiPropertyOptional({
    description: 'Only present for field-level validation errors; non-empty when present.',
    type: [ErrorResponseDetailDto],
  })
  details?: ErrorResponseDetailDto[];
}
