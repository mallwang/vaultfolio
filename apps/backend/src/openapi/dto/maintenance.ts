import { ApiProperty } from '@nestjs/swagger';
import { MAINTENANCE_DOMAIN_IDS } from '@vaultfolio/api-contract';

/** Mirrors `libs/api-contract/src/lib/maintenance.ts` (specs/041-domain-maintenance-mode/contracts). */

export class DomainMaintenanceStatusDto {
  @ApiProperty({ enum: MAINTENANCE_DOMAIN_IDS }) domainId!: (typeof MAINTENANCE_DOMAIN_IDS)[number];
  @ApiProperty() inMaintenance!: boolean;
  @ApiProperty({ format: 'date-time', nullable: true, type: String }) updatedAt!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Display name of the admin who last changed the state.',
  })
  updatedBy!: string | null;
}

export class DomainMaintenanceAdminResponseDto {
  @ApiProperty({ type: [DomainMaintenanceStatusDto] }) domains!: DomainMaintenanceStatusDto[];
}

export class DomainMaintenanceListResponseDto {
  @ApiProperty({ type: [String], description: 'Ids of the domains currently in maintenance.' })
  domains!: string[];
}

export class SetDomainMaintenanceRequestDto {
  @ApiProperty() inMaintenance!: boolean;
}
