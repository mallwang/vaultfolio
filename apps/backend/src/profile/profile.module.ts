import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsModule } from '../accounts/accounts.module';
import { EmailAvailabilityService } from '../shared/email-availability.service';
import { InvitationsRepository } from '../invitations/invitations.repository';
import { SignupsRepository } from '../signups/signups.repository';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { AccountActionTokensRepository } from './account-action-tokens.repository';
import { EmailService } from './email.service';

/**
 * `AuthModule` exports `UsersRepository`/`SessionsRepository`; `AccountsModule`
 * exports `AccountsService` (for `deleteSelf`, research.md #1) — both reused
 * here rather than re-provided. `InvitationsRepository`/`SignupsRepository`
 * are provided directly (not imported as modules, avoiding a cycle) purely
 * so `EmailAvailabilityService` can see 006/007's invitation/sign-up tables,
 * mirroring `InvitationsModule`'s own provider list.
 */
@Module({
  imports: [AuthModule, AccountsModule],
  controllers: [ProfileController],
  providers: [
    ProfileService,
    AccountActionTokensRepository,
    EmailService,
    EmailAvailabilityService,
    InvitationsRepository,
    SignupsRepository,
  ],
})
export class ProfileModule {}
