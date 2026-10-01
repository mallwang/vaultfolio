import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  type RequestDetail,
  type RequestListResponse,
  type RequestStatusDto,
  type SubmitRequestResponse,
  UserRole,
} from '@vaultfolio/api-contract';
import type { Request, Response } from 'express';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import {
  ErrorResponseDto,
  RequestDetailDto,
  RequestListResponseDto,
  SubmitRequestDto,
  SubmitRequestResponseDto,
  UpdateRequestDto,
} from '../openapi/dto';
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

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'List requests, newest first (admin only).' })
  @ApiQuery({ name: 'status', required: false, isArray: true, type: String })
  @ApiResponse({ status: 200, type: RequestListResponseDto })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not an administrator.' })
  list(@Query('status') status?: string | string[]): RequestListResponse {
    return this.requests.list([status ?? []].flat() as RequestStatusDto[]);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Request detail (admin only).' })
  @ApiResponse({ status: 200, type: RequestDetailDto })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not an administrator.' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'REQUEST_NOT_FOUND.' })
  detail(@Param('id') id: string): RequestDetail {
    return this.requests.detail(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Set the status and/or the note of a request (admin only).' })
  @ApiBody({ type: UpdateRequestDto })
  @ApiResponse({ status: 200, type: RequestDetailDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'INVALID_REQUEST_UPDATE.' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not an administrator.' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'REQUEST_NOT_FOUND.' })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): RequestDetail {
    return this.requests.update(user.id, id, body);
  }

  @Get(':id/attachment')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Download the anonymized sample PDF; audited (admin only).' })
  @ApiResponse({ status: 200, description: 'application/pdf attachment.' })
  @ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Not an administrator.' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'REQUEST_NOT_FOUND.' })
  @ApiResponse({ status: 410, type: ErrorResponseDto, description: 'SAMPLE_DELETED.' })
  attachment(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): void {
    const { bytes } = this.requests.downloadAttachment(user.id, id);
    res
      .status(HttpStatus.OK)
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="request-${id.slice(0, 8)}-sample.pdf"`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      })
      .send(bytes);
  }
}
