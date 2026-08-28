import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../health/health.module';
import { HoldingsModule } from '../holdings/holdings.module';

@Module({
  imports: [DatabaseModule, HealthModule, HoldingsModule],
})
export class AppModule {}
