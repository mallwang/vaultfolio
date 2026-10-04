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
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { WealthSettings, WealthSnapshot } from '@vaultfolio/api-contract';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { RequiresDomain } from '../auth/domain.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import {
  ErrorResponseDto,
  WealthClassGroupAssignmentDto,
  WealthSettingsDto,
  WealthSnapshotDto,
  WealthSnapshotInputDto,
} from '../openapi/dto';
import { WealthAvailableGuard } from './wealth-available.guard';
import { WealthService } from './wealth.service';

/**
 * REST surface for `/wealth`, per contracts/wealth-api.md. `AuthGuard`/`DomainGuard` run
 * globally; `WealthAvailableGuard` then fails every route closed with 503 without a usable key.
 * Every call reads and writes only the caller's own data. Request bodies are validated by
 * `@vaultfolio/wealth`'s strict whitelist, not by a DTO pipe. No totals are computed here.
 */
@ApiTags('wealth')
@ApiVaultfolioSessionAuth()
@Controller('wealth')
@RequiresDomain('historic-wealth-development')
@UseGuards(WealthAvailableGuard)
@ApiResponse({ status: 403, type: ErrorResponseDto, description: 'Domain not entitled.' })
@ApiResponse({
  status: 503,
  type: ErrorResponseDto,
  description: 'WEALTH_UNAVAILABLE — key missing/invalid.',
})
export class WealthController {
  constructor(private readonly wealth: WealthService) {}

  @Get('snapshots')
  @ApiOperation({ summary: "All of the caller's snapshots with entries, ascending by date." })
  @ApiResponse({ status: 200, type: [WealthSnapshotDto] })
  list(@CurrentUser() user: RequestUser): WealthSnapshot[] {
    return this.wealth.list(user.id);
  }

  @Get('snapshots/:id')
  @ApiOperation({ summary: 'One of the caller’s snapshots.' })
  @ApiResponse({ status: 200, type: WealthSnapshotDto })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'WEALTH_SNAPSHOT_NOT_FOUND.' })
  get(@CurrentUser() user: RequestUser, @Param('id') id: string): WealthSnapshot {
    return this.wealth.get(user.id, id);
  }

  @Post('snapshots')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a snapshot (one per date).' })
  @ApiBody({ type: WealthSnapshotInputDto })
  @ApiResponse({ status: 201, type: WealthSnapshotDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'WEALTH_VALIDATION / WEALTH_UNKNOWN_FIELD / WEALTH_LIMIT_EXCEEDED.',
  })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'WEALTH_SNAPSHOT_DATE_EXISTS — the body carries `existingId`.',
  })
  create(@CurrentUser() user: RequestUser, @Body() body: unknown): WealthSnapshot {
    return this.wealth.create(user.id, body);
  }

  @Put('snapshots/:id')
  @ApiOperation({ summary: 'Replace date, note and entries of a snapshot as a whole.' })
  @ApiBody({ type: WealthSnapshotInputDto })
  @ApiResponse({ status: 200, type: WealthSnapshotDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'WEALTH_VALIDATION / WEALTH_UNKNOWN_FIELD / WEALTH_LIMIT_EXCEEDED.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'WEALTH_SNAPSHOT_NOT_FOUND.' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'WEALTH_SNAPSHOT_DATE_EXISTS — a changed date collides with another snapshot.',
  })
  update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ): WealthSnapshot {
    return this.wealth.update(user.id, id, body);
  }

  @Delete('snapshots/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of the caller’s snapshots.' })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'WEALTH_SNAPSHOT_NOT_FOUND.' })
  delete(@CurrentUser() user: RequestUser, @Param('id') id: string): void {
    this.wealth.delete(user.id, id);
  }

  @Get('settings')
  @ApiOperation({
    summary: 'Explicit class-to-balance-group assignments (defaults are not stored).',
  })
  @ApiResponse({ status: 200, type: WealthSettingsDto })
  settings(@CurrentUser() user: RequestUser): WealthSettings {
    return this.wealth.getSettings(user.id);
  }

  @Put('settings/class-groups')
  @ApiOperation({ summary: 'Upsert the balance group of one class (per side).' })
  @ApiBody({ type: WealthClassGroupAssignmentDto })
  @ApiResponse({ status: 200, type: WealthSettingsDto })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'WEALTH_VALIDATION / WEALTH_UNKNOWN_FIELD (group of the wrong side).',
  })
  upsertClassGroup(@CurrentUser() user: RequestUser, @Body() body: unknown): WealthSettings {
    return this.wealth.upsertClassGroup(user.id, body);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete all of the caller's wealth data (the account stays)." })
  @ApiResponse({ status: 204, description: 'Deleted.' })
  deleteAll(@CurrentUser() user: RequestUser): void {
    this.wealth.deleteAll(user.id);
  }
}
