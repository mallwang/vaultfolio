import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../health/health.module';
import { HoldingsModule } from '../holdings/holdings.module';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { SignupsModule } from '../signups/signups.module';
import { ProfileModule } from '../profile/profile.module';
import { AccountOverviewModule } from '../account-overview/account-overview.module';
import { EarningsModule } from '../earnings/earnings.module';
import { RequestsModule } from '../requests/requests.module';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { ObservabilityModule } from '@vaultfolio/observability';
import { OpenApiModule } from '../openapi/openapi.module';

@Module({
  imports: [
    ObservabilityModule,
    DatabaseModule,
    AuthModule,
    HealthModule,
    HoldingsModule,
    AccountsModule,
    InvitationsModule,
    SignupsModule,
    ProfileModule,
    AccountOverviewModule,
    EarningsModule,
    RequestsModule,
    TurnstileModule,
    OpenApiModule,
  ],
})
export class AppModule {}
