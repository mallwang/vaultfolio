import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../health/health.module';
import { HoldingsModule } from '../holdings/holdings.module';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { SignupsModule } from '../signups/signups.module';
import { ProfileModule } from '../profile/profile.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    HealthModule,
    HoldingsModule,
    AccountsModule,
    InvitationsModule,
    SignupsModule,
    ProfileModule,
  ],
})
export class AppModule {}
