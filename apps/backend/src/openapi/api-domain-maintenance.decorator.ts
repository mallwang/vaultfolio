import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { ErrorResponseDto } from './dto/error-response';

/** Documents the 503 every `@RequiresDomain` route returns to non-admins while its domain is in maintenance. */
export const ApiDomainMaintenanceResponse = () =>
  applyDecorators(
    ApiResponse({
      status: 503,
      type: ErrorResponseDto,
      description: 'DOMAIN_MAINTENANCE: the domain is temporarily unavailable (non-admin callers).',
    }),
  );
