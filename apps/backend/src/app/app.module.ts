import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { HealthModule } from '../health/health.module';
import { HoldingsModule } from '../holdings/holdings.module';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { InvitationsModule } from '../invitations/invitations.module';
import { SignupsModule } from '../signups/signups.module';
import { ProfileModule } from '../profile/profile.module';
import { AccountOverviewModule } from '../account-overview/account-overview.module';
import { EarningsModule } from '../earnings/earnings.module';
import { RetirementModule } from '../retirement/retirement.module';
import { WealthModule } from '../wealth/wealth.module';
import { InsurancesModule } from '../insurances/insurances.module';
import { RequestsModule } from '../requests/requests.module';
import { TurnstileModule } from '../turnstile/turnstile.module';
import { ObservabilityModule } from '@vaultfolio/observability';
import { OpenApiModule } from '../openapi/openapi.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';

@Module({
  imports: [
    ObservabilityModule,
    DatabaseModule,
    EncryptionModule,
    MaintenanceModule,
    AuthModule,
    HealthModule,
    HoldingsModule,
    AccountsModule,
    InvitationsModule,
    SignupsModule,
    ProfileModule,
    AccountOverviewModule,
    EarningsModule,
    RetirementModule,
    WealthModule,
    InsurancesModule,
    RequestsModule,
    TurnstileModule,
    OpenApiModule,
  ],
})
export class AppModule {}
