import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  MAINTENANCE_DOMAIN_IDS,
  UserRole,
  type DomainMaintenanceAdminResponse,
  type DomainMaintenanceStatus,
} from '@vaultfolio/api-contract';
import { ValidationException } from '@vaultfolio/observability';
import { CurrentUser, type RequestUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ErrorResponseDto } from '../openapi/dto/error-response';
import {
  DomainMaintenanceAdminResponseDto,
  DomainMaintenanceStatusDto,
  SetDomainMaintenanceRequestDto,
} from '../openapi/dto/maintenance';
import { MaintenanceService } from './maintenance.service';

/** ADMIN-only listing and toggling of the per-domain maintenance state. */
@ApiTags('admin-domains')
@Roles(UserRole.ADMIN)
@ApiVaultfolioSessionAuth()
@Controller('admin/domains')
export class MaintenanceAdminController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'Maintenance status of every maintainable domain.' })
  @ApiResponse({ status: 200, type: DomainMaintenanceAdminResponseDto })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Caller is not an administrator.',
  })
  list(): DomainMaintenanceAdminResponse {
    return { domains: this.maintenance.listForAdmin() };
  }

  @Put(':domainId')
  @ApiOperation({
    summary: 'Put a domain into or out of maintenance (idempotent; audited on a real change).',
  })
  @ApiParam({ name: 'domainId', enum: MAINTENANCE_DOMAIN_IDS })
  @ApiBody({ type: SetDomainMaintenanceRequestDto })
  @ApiResponse({ status: 200, type: DomainMaintenanceStatusDto })
  @ApiResponse({ status: 400, type: ErrorResponseDto, description: 'Malformed body.' })
  @ApiResponse({
    status: 403,
    type: ErrorResponseDto,
    description: 'Caller is not an administrator.',
  })
  @ApiResponse({ status: 404, type: ErrorResponseDto, description: 'DOMAIN_NOT_FOUND.' })
  set(
    @CurrentUser() user: RequestUser,
    @Param('domainId') domainId: string,
    @Body() body: { inMaintenance?: unknown } | undefined,
  ): DomainMaintenanceStatus {
    if (typeof body?.inMaintenance !== 'boolean') {
      throw new ValidationException({
        error: 'MAINTENANCE_VALIDATION',
        message: 'inMaintenance must be a boolean.',
        details: [{ field: 'inMaintenance', message: 'BOOLEAN_REQUIRED' }],
      });
    }
    return this.maintenance.set(user.id, domainId, body.inMaintenance);
  }
}
