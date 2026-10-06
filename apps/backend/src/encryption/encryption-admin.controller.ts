import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ENCRYPTION_DOMAIN_IDS,
  UserRole,
  type EncryptionDomainId,
  type EncryptionHistoryResponse,
  type EncryptionStatusResponse,
  type RotationRun,
} from '@vaultfolio/api-contract';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import {
  EncryptionHistoryResponseDto,
  EncryptionStatusResponseDto,
  RotationRunDto,
  StartReencryptionRequestDto,
} from '../openapi/dto/encryption';
import { ErrorResponseDto } from '../openapi/dto/error-response';
import { isDomainId } from './domain-encryption.registry';
import { EncryptionDomainNotFoundException } from './encryption.exceptions';
import { RotationService } from './rotation.service';

const DEFAULT_HISTORY_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;

function domainOf(value: string): EncryptionDomainId {
  if (!isDomainId(value)) throw new EncryptionDomainNotFoundException();
  return value;
}

function versionOf(value: string): number {
  const version = Number(value);
  if (!Number.isInteger(version) || version < 2) throw new EncryptionDomainNotFoundException();
  return version;
}

/** ADMIN-only key status and rotation operations. No endpoint accepts or returns key material. */
@ApiTags('admin-encryption')
@Roles(UserRole.ADMIN)
@ApiVaultfolioSessionAuth()
@Controller('admin/encryption')
export class EncryptionAdminController {
  constructor(private readonly rotation: RotationService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Key status of every encrypted domain (works while domains are locked).',
  })
  @ApiResponse({ status: 200, type: EncryptionStatusResponseDto })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Caller is not an administrator.',
  })
  status(): EncryptionStatusResponse {
    return { domains: this.rotation.status() };
  }

  @Get('history')
  @ApiOperation({
    summary:
      'History of rotations, re-encryptions, destroys and upgrade migrations (newest first).',
  })
  @ApiQuery({ name: 'domain', required: false, enum: ENCRYPTION_DOMAIN_IDS })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: DEFAULT_HISTORY_LIMIT })
  @ApiResponse({ status: 200, type: EncryptionHistoryResponseDto })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Caller is not an administrator.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'ENCRYPTION_DOMAIN_NOT_FOUND.' })
  history(
    @Query('domain') domain?: string,
    @Query('limit') limit?: string,
  ): EncryptionHistoryResponse {
    const parsed = Number(limit ?? DEFAULT_HISTORY_LIMIT);
    const bounded = Number.isInteger(parsed)
      ? Math.min(Math.max(parsed, 1), MAX_HISTORY_LIMIT)
      : DEFAULT_HISTORY_LIMIT;
    return { runs: this.rotation.history(domain ? domainOf(domain) : undefined, bounded) };
  }

  @Post('domains/:domain/master-key-rotation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Re-wrap all data keys of the domain under the current master key.' })
  @ApiParam({ name: 'domain', enum: ENCRYPTION_DOMAIN_IDS })
  @ApiResponse({ status: 200, type: RotationRunDto })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Caller is not an administrator.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'ENCRYPTION_DOMAIN_NOT_FOUND.' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'ENCRYPTION_DOMAIN_NOT_READY / ENCRYPTION_OPERATION_RUNNING.',
  })
  rotateMasterKey(@CurrentUser() user: RequestUser, @Param('domain') domain: string): RotationRun {
    return this.rotation.rotateMasterKey(domainOf(domain), this.rotation.actorFor(user.id));
  }

  @Post('domains/:domain/reencryption')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Generate a new data key and re-encrypt all domain data (domain locked meanwhile).',
  })
  @ApiParam({ name: 'domain', enum: ENCRYPTION_DOMAIN_IDS })
  @ApiBody({ type: StartReencryptionRequestDto })
  @ApiResponse({
    status: 202,
    type: RotationRunDto,
    description: 'Started; poll the status endpoint.',
  })
  @ApiResponse({
    status: 400,
    type: ErrorResponseDto,
    description: 'ENCRYPTION_CONFIRMATION_MISMATCH.',
  })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Caller is not an administrator.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'ENCRYPTION_DOMAIN_NOT_FOUND.' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description: 'ENCRYPTION_DOMAIN_NOT_READY / ENCRYPTION_OPERATION_RUNNING.',
  })
  startReencryption(
    @CurrentUser() user: RequestUser,
    @Param('domain') domain: string,
    @Body() body: { confirm?: unknown } | undefined,
  ): RotationRun {
    const confirm = typeof body?.confirm === 'string' ? body.confirm : '';
    return this.rotation.startReencryption(
      domainOf(domain),
      confirm,
      this.rotation.actorFor(user.id),
    );
  }

  @Post('domains/:domain/data-keys/:version/destroy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Irreversibly destroy a retired data key (refused while rows still use it).',
  })
  @ApiParam({ name: 'domain', enum: ENCRYPTION_DOMAIN_IDS })
  @ApiParam({ name: 'version', type: Number })
  @ApiResponse({ status: 200, type: RotationRunDto })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Caller is not an administrator.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'ENCRYPTION_DOMAIN_NOT_FOUND.' })
  @ApiResponse({
    status: 409,
    type: ErrorResponseDto,
    description:
      'ENCRYPTION_KEY_NOT_RETIRED / ENCRYPTION_KEY_IN_USE / ENCRYPTION_OPERATION_RUNNING.',
  })
  destroyDataKey(
    @CurrentUser() user: RequestUser,
    @Param('domain') domain: string,
    @Param('version') version: string,
  ): RotationRun {
    return this.rotation.destroyDataKey(
      domainOf(domain),
      versionOf(version),
      this.rotation.actorFor(user.id),
    );
  }
}
