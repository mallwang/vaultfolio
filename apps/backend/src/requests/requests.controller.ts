import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SubmitRequestResponse } from '@vaultfolio/api-contract';
import type { Request } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ErrorResponseDto, SubmitRequestDto, SubmitRequestResponseDto } from '../openapi/dto';
import { UnsupportedMediaTypeBodyException } from './requests.exceptions';
import { RequestsService } from './requests.service';

/**
 * REST surface for `/requests`, per specs/033-parser-requests/contracts/requests-api.md. Any
 * signed-in user may submit; the entitlement to the request type's feature is checked in the
 * service (it depends on the body). The read/handle routes are admin-only.
 */
@ApiTags('requests')
@ApiVaultfolioSessionAuth()
@Controller('requests')
export class RequestsController {
  constructor(private readonly requests: RequestsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary:
      'Submit a request (e.g. earnings/new-parser: an anonymized layout; the server generates the sample PDF).',
  })
  @ApiBody({ type: SubmitRequestDto })
  @ApiResponse({ status: 201, type: SubmitRequestResponseDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description:
      'UNKNOWN_REQUEST_TYPE / INVALID_LAYOUT / LAYOUT_UNKNOWN_FIELD / LIMIT_EXCEEDED / PERSONAL_DATA_DETECTED / INVALID_RULE_DRAFT.',
  })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Domain not entitled.' })
  @ApiResponse({
    status: 413,
    type: ErrorResponseDto,
    description: 'payload_too_large (> 512 kB).',
  })
  @ApiResponse({
    status: 415,
    type: ErrorResponseDto,
    description: 'UNSUPPORTED_MEDIA_TYPE (not JSON).',
  })
  @ApiResponse({
    status: 429,
    type: ErrorResponseDto,
    description: 'REQUEST_LIMIT_OPEN / REQUEST_LIMIT_DAILY.',
  })
  submit(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Body() body: unknown,
  ): SubmitRequestResponse {
    if (!req.is('application/json')) throw new UnsupportedMediaTypeBodyException();
    return this.requests.submit(user, body);
  }
}
