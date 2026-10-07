import { Global, Module } from '@nestjs/common';
import { MaintenanceAdminController } from './maintenance-admin.controller';
import { MaintenanceController } from './maintenance.controller';
import { MaintenanceRepository } from './maintenance.repository';
import { MaintenanceService } from './maintenance.service';

/** Global so the app-wide `DomainGuard` and the insurances reminder sweep can inject the service. */
@Global()
@Module({
  controllers: [MaintenanceController, MaintenanceAdminController],
  providers: [MaintenanceRepository, MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
