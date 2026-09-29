import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  DataCheckRow,
  EarningsEmployer,
  EarningsImportPreview,
  EarningsImportResult,
  EarningsImportSummary,
  EarningsOverview,
  EarningsRecordDetail,
  EarningsTables,
} from '@vaultfolio/api-contract';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import {
  DataCheckRowDto,
  EarningsEmployerDto,
  EarningsImportBatchDto,
  EarningsImportPreviewDto,
  EarningsImportResultDto,
  EarningsImportSummaryDto,
  EarningsOverviewDto,
  EarningsRecordDetailDto,
  EarningsTablesDto,
  ErrorResponseDto,
  RenameEarningsEmployerDto,
} from '../openapi/dto';
import { EarningsAvailableGuard } from './earnings-available.guard';
import { EarningsService, employerParam, periodParam } from './earnings.service';

/**
 * REST surface for `/earnings`, per contracts/earnings-api.md. `AuthGuard`/`DomainGuard` run
 * globally; `EarningsAvailableGuard` then fails every route closed with 503 without a usable key
 * (FR-044). Every call reads and writes only the caller's own data (FR-003). Request bodies are
 * validated by the service's strict whitelist, not by a DTO pipe (FR-009, FR-013).
 */
@ApiTags('earnings')
@ApiVaultfolioSessionAuth()
@Controller('earnings')
@RequiresDomain('earnings')
@UseGuards(EarningsAvailableGuard)
@ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Domain not entitled.' })
@ApiResponse({
  status: 503,
  type: ErrorResponseDto,
  description: 'EARNINGS_UNAVAILABLE — key missing/invalid (FR-044).',
})
export class EarningsController {
  constructor(private readonly earnings: EarningsService) {}

  @Post('imports/preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate and classify an import batch without saving (dry run).' })
  @ApiBody({ type: EarningsImportBatchDto })
  @ApiResponse({ status: 200, type: EarningsImportPreviewDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'INVALID_BATCH / EARNINGS_UNKNOWN_FIELD / LIMIT_EXCEEDED.',
  })
  preview(@CurrentUser() user: RequestUser, @Body() body: unknown): EarningsImportPreview {
    return this.earnings.preview(user.id, body);
  }

  @Post('imports')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Re-validate and save each NEW/REPLACES file of the batch (one transaction per file).',
  })
  @ApiBody({ type: EarningsImportBatchDto })
  @ApiResponse({ status: 201, type: EarningsImportResultDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'INVALID_BATCH / EARNINGS_UNKNOWN_FIELD / LIMIT_EXCEEDED.',
  })
  commit(@CurrentUser() user: RequestUser, @Body() body: unknown): EarningsImportResult {
    return this.earnings.commit(user.id, body);
  }

  @Get('imports')
  @ApiOperation({ summary: "The caller's import history, newest first." })
  @ApiResponse({ status: 200, type: [EarningsImportSummaryDto] })
  listImports(@CurrentUser() user: RequestUser): EarningsImportSummary[] {
    return this.earnings.listImports(user.id);
  }

  @Delete('imports/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an import and exactly its remaining records/certificates.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'EARNINGS_IMPORT_NOT_FOUND.' })
  deleteImport(@CurrentUser() user: RequestUser, @Param('id') id: string): void {
    this.earnings.deleteImport(user.id, id);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete all of the caller's earnings data." })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  deleteAll(@CurrentUser() user: RequestUser): void {
    this.earnings.deleteAll(user.id);
  }

  @Get('employers')
  @ApiOperation({ summary: "The caller's detected employers." })
  @ApiResponse({ status: 200, type: [EarningsEmployerDto] })
  listEmployers(@CurrentUser() user: RequestUser): EarningsEmployer[] {
    return this.earnings.listEmployers(user.id);
  }

  @Put('employers/:id')
  @ApiOperation({ summary: "Set an employer's display name (no figure is editable)." })
  @ApiBody({ type: RenameEarningsEmployerDto })
  @ApiResponse({ status: 200, type: EarningsEmployerDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'EARNINGS_UNKNOWN_FIELD / INVALID_VALUE.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'EARNINGS_EMPLOYER_NOT_FOUND.' })
  renameEmployer(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): EarningsEmployer {
    return this.earnings.renameEmployer(user.id, id, body);
  }

  @Get('overview')
  @ApiOperation({ summary: 'Career, latest-year KPIs, yearly and monthly series.' })
  @ApiQuery({
    name: 'employer',
    required: false,
    description: 'Employer id; omitted = all employers.',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'INVALID_VALUE (employer).' })
  @ApiResponse({ status: 200, type: EarningsOverviewDto })
  overview(
    @CurrentUser() user: RequestUser,
    @Query('employer') employer?: string,
  ): EarningsOverview {
    return this.earnings.overview(user.id, employerParam(employer));
  }

  @Get('records')
  @ApiOperation({ summary: 'Records of one month (month detail) or, without period, all records.' })
  @ApiQuery({ name: 'period', required: false, example: '2026-09' })
  @ApiResponse({ status: 200, type: [EarningsRecordDetailDto] })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'INVALID_VALUE (period).' })
  records(
    @CurrentUser() user: RequestUser,
    @Query('period') period?: string,
  ): EarningsRecordDetail[] {
    return this.earnings.records(user.id, periodParam(period));
  }

  @Get('tables')
  @ApiOperation({ summary: 'Year × month grid, taxes per year and wage-tax certificates.' })
  @ApiQuery({
    name: 'employer',
    required: false,
    description: 'Employer id; omitted = all employers.',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'INVALID_VALUE (employer).' })
  @ApiResponse({ status: 200, type: EarningsTablesDto })
  tables(@CurrentUser() user: RequestUser, @Query('employer') employer?: string): EarningsTables {
    return this.earnings.tables(user.id, employerParam(employer));
  }

  @Get('data-check')
  @ApiOperation({
    summary: 'Per employer and year: year-to-date, certificate and completeness checks.',
  })
  @ApiQuery({
    name: 'employer',
    required: false,
    description: 'Employer id; omitted = all employers.',
  })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'INVALID_VALUE (employer).' })
  @ApiResponse({ status: 200, type: [DataCheckRowDto] })
  dataCheck(
    @CurrentUser() user: RequestUser,
    @Query('employer') employer?: string,
  ): DataCheckRow[] {
    return this.earnings.dataCheck(user.id, employerParam(employer));
  }
}
