import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../health/health.module';
import { HoldingsModule } from '../holdings/holdings.module';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { InvitationsModule } from '../invitations/invitations.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    HoldingsModule,
    AccountsModule,
    InvitationsModule,
  ],
})
export class AppModule {}
