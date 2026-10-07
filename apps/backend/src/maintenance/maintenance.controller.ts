import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { DomainMaintenanceListResponse } from '@vaultfolio/api-contract';
import { ApiVaultfolioSessionAuth } from '../openapi/api-vaultfolio-auth.decorator';
import { ErrorResponseDto } from '../openapi/dto/error-response';
import { DomainMaintenanceListResponseDto } from '../openapi/dto/maintenance';
import { MaintenanceService } from './maintenance.service';

/** Any signed-in user may read which domains are in maintenance (needed to render notices and tiles). */
@ApiTags('maintenance')
@ApiVaultfolioSessionAuth()
@Controller('domains/maintenance')
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  @ApiOperation({ summary: 'Ids of the domains currently in maintenance.' })
  @ApiResponse({ status: 200, type: DomainMaintenanceListResponseDto })
  @ApiResponse({ status: 401, type: ErrorResponseDto, description: 'Not signed in.' })
  list(): DomainMaintenanceListResponse {
    return { domains: this.maintenance.listInMaintenance() };
  }
}
