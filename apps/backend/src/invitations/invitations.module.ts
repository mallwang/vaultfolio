import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InvitationsController } from './invitations.controller';
import { InvitationsService } from './invitations.service';
import { InvitationsRepository } from './invitations.repository';
import { EmailService } from './email.service';

/** `AuthModule` exports `UsersRepository`/`SessionsRepository` — reused here rather than re-provided. */
@Module({
  imports: [AuthModule],
  controllers: [InvitationsController],
  providers: [InvitationsService, InvitationsRepository, EmailService],
})
export class InvitationsModule {}
