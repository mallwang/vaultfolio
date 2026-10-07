import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RetirementRecord, RetirementSummary } from '@vaultfolio/api-contract';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ApiDomainMaintenanceResponse } from '../openapi/api-domain-maintenance.decorator';
import {
  ErrorResponseDto,
  RetirementManualRecordInputDto,
  RetirementRecordDto,
  RetirementRecordInputDto,
  RetirementSummaryDto,
  RetirementSupplementPatchDto,
} from '../openapi/dto';
import { RetirementAvailableGuard } from './retirement-available.guard';
import { RetirementService, pillarParam } from './retirement.service';

/**
 * REST surface for `/retirement`, per contracts/retirement-api.md. `AuthGuard`/`DomainGuard` run
 * globally; `RetirementAvailableGuard` then fails every route closed with 503 without a usable
 * key. Every call reads and writes only the caller's own data. Request bodies are validated by
 * `@vaultfolio/retirement`'s strict whitelist, not by a DTO pipe.
 */
@ApiTags('retirement')
@ApiVaultfolioSessionAuth()
@ApiDomainMaintenanceResponse()
@Controller('retirement')
@RequiresDomain('retirement')
@UseGuards(RetirementAvailableGuard)
@ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Domain not entitled.' })
@ApiResponse({
  status: 503,
  type: ErrorResponseDto,
  description: 'RETIREMENT_UNAVAILABLE — key missing/invalid.',
})
export class RetirementController {
  constructor(private readonly retirement: RetirementService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Derived overview: totals, pillars, pension start, flags.' })
  @ApiResponse({ status: 200, type: RetirementSummaryDto })
  summary(@CurrentUser() user: RequestUser): RetirementSummary {
    return this.retirement.summary(user.id);
  }

  @Get('records')
  @ApiOperation({ summary: "The caller's retirement records, newest statement first." })
  @ApiQuery({ name: 'pillar', required: false, enum: ['STATUTORY', 'OCCUPATIONAL', 'PRIVATE'] })
  @ApiResponse({ status: 200, type: [RetirementRecordDto] })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'RETIREMENT_VALIDATION.' })
  list(@CurrentUser() user: RequestUser, @Query('pillar') pillar?: string): RetirementRecord[] {
    return this.retirement.list(user.id, pillarParam(pillar));
  }

  @Get('records/:id')
  @ApiOperation({ summary: 'One of the caller’s retirement records.' })
  @ApiResponse({ status: 200, type: RetirementRecordDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'RETIREMENT_RECORD_NOT_FOUND.' })
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): RetirementRecord {
    return this.retirement.get(user.id, id);
  }

  @Post('records')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a record (manual entry or confirmed import); `replaces` swaps one atomically.',
  })
  @ApiBody({ type: RetirementRecordInputDto })
  @ApiResponse({ status: 201, type: RetirementRecordDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description:
      'RETIREMENT_VALIDATION / RETIREMENT_UNKNOWN_FIELD / RETIREMENT_CHECK_FAILED (check ids only).',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'RETIREMENT_RECORD_NOT_FOUND.' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'RETIREMENT_STATUTORY_EXISTS.' })
  create(@CurrentUser() user: RequestUser, @Body() body: unknown): RetirementRecord {
    return this.retirement.create(user.id, body);
  }

  @Put('records/:id')
  @ApiOperation({ summary: 'Replace a manual record; imported records are read-only.' })
  @ApiBody({ type: RetirementManualRecordInputDto })
  @ApiResponse({ status: 200, type: RetirementRecordDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'RETIREMENT_VALIDATION / RETIREMENT_UNKNOWN_FIELD.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'RETIREMENT_RECORD_NOT_FOUND.' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'RETIREMENT_IMPORTED_READONLY.',
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): RetirementRecord {
    return this.retirement.update(user.id, id, body);
  }

  @Patch('records/:id/supplement')
  @ApiOperation({ summary: 'Edit the supplement (and status) of an imported record.' })
  @ApiBody({ type: RetirementSupplementPatchDto })
  @ApiResponse({ status: 200, type: RetirementRecordDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'RETIREMENT_VALIDATION / RETIREMENT_UNKNOWN_FIELD.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'RETIREMENT_RECORD_NOT_FOUND.' })
  @ApiResponse({ status: 409, type: ErrorResponseDto, description: 'RETIREMENT_NOT_IMPORTED.' })
  updateSupplement(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): RetirementRecord {
    return this.retirement.updateSupplement(user.id, id, body);
  }

  @Delete('records/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of the caller’s records.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'RETIREMENT_RECORD_NOT_FOUND.' })
  delete(@CurrentUser() user: RequestUser, @Param('id') id: string): void {
    this.retirement.delete(user.id, id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete all of the caller's retirement data (the account stays)." })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  deleteAll(@CurrentUser() user: RequestUser): void {
    this.retirement.deleteAll(user.id);
  }
}
