import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import type {
  AcceptInvitationRequest,
  CreateInvitationRequest,
  InvitationsErrorResponse,
  InvitationSummary,
  InvitationTokenLookup,
  SessionUser,
} from '@vaultfolio/api-contract';
import { Roles } from '../auth/roles.decorator';
import { Public } from '../auth/public.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { RequestUser } from '../auth/current-user.decorator';
import { setSessionCookie } from '../auth/session-cookie';
import { InvitationsService } from './invitations.service';

const ACCOUNT_EXISTS: InvitationsErrorResponse = {
  error: 'account_exists',
  message: 'This email already has an account.',
};
const NOT_FOUND: InvitationsErrorResponse = {
  error: 'not_found',
  message: 'Invitation not found.',
};
const ALREADY_RESOLVED: InvitationsErrorResponse = {
  error: 'already_resolved',
  message: 'This invitation was already accepted, cancelled, or superseded.',
};
const EMAIL_DELIVERY_FAILED: InvitationsErrorResponse = {
  error: 'email_delivery_failed',
  message: 'Invitation saved, but the email could not be sent. Try resending.',
};
const INVALID_INVITATION: InvitationsErrorResponse = {
  error: 'invalid_invitation',
  message: 'This invitation link is no longer valid.',
};
const INVALID_PASSWORD: InvitationsErrorResponse = {
  error: 'invalid_password',
  message: 'Password must be between 8 and 200 characters.',
};

/**
 * REST surface for `/invitations`, per contracts/invitations-api.md. Two
 * audiences share this controller: admin-facing routes (`@Roles('ADMIN')`)
 * and invitee-facing public routes (`@Public()`, no session) — the token
 * lookup/accept endpoints must never leak which failure case applied
 * (FR-012), so both collapse to the identical `410 invalid_invitation` body.
 */
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Roles('ADMIN')
  @Post()
  async create(
    @CurrentUser() currentUser: RequestUser,
    @Body() body: CreateInvitationRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationSummary | InvitationsErrorResponse> {
    const result = await this.invitationsService.create(
      body?.email ?? '',
      body?.role ?? 'MEMBER',
      currentUser.id,
    );

    if (result.kind === 'account_exists') {
      res.status(HttpStatus.CONFLICT);
      return ACCOUNT_EXISTS;
    }
    if (result.kind === 'email_delivery_failed') {
      res.status(HttpStatus.BAD_GATEWAY);
      return EMAIL_DELIVERY_FAILED;
    }
    res.status(HttpStatus.CREATED);
    return toSummary(result.invitation);
  }

  @Roles('ADMIN')
  @Get()
  async list(): Promise<InvitationSummary[]> {
    return this.invitationsService.list();
  }

  @Roles('ADMIN')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationSummary | InvitationsErrorResponse> {
    const result = await this.invitationsService.cancel(id, currentUser.id);

    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    if (result.kind === 'already_resolved') {
      res.status(HttpStatus.CONFLICT);
      return ALREADY_RESOLVED;
    }
    return toSummary(result.invitation);
  }

  @Roles('ADMIN')
  @Post(':id/resend')
  async resend(
    @CurrentUser() currentUser: RequestUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationSummary | InvitationsErrorResponse> {
    const result = await this.invitationsService.resend(id, currentUser.id);

    if (result.kind === 'not_found') {
      res.status(HttpStatus.NOT_FOUND);
      return NOT_FOUND;
    }
    if (result.kind === 'already_resolved') {
      res.status(HttpStatus.CONFLICT);
      return ALREADY_RESOLVED;
    }
    if (result.kind === 'email_delivery_failed') {
      res.status(HttpStatus.BAD_GATEWAY);
      return EMAIL_DELIVERY_FAILED;
    }
    res.status(HttpStatus.CREATED);
    return toSummary(result.invitation);
  }

  @Public()
  @Get('token/:token')
  async lookupToken(
    @Param('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<InvitationTokenLookup | InvitationsErrorResponse> {
    const result = await this.invitationsService.lookupByToken(token);
    if (result.kind === 'invalid') {
      res.status(HttpStatus.GONE);
      return INVALID_INVITATION;
    }
    return { email: result.email, role: result.role };
  }

  @Public()
  @Post('token/:token/accept')
  async accept(
    @Param('token') token: string,
    @Body() body: AcceptInvitationRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionUser | InvitationsErrorResponse> {
    const result = await this.invitationsService.accept(
      token,
      body?.password ?? '',
      body?.displayName ?? '',
    );

    if (result.kind === 'invalid_password') {
      res.status(HttpStatus.BAD_REQUEST);
      return INVALID_PASSWORD;
    }
    if (result.kind === 'invalid') {
      res.status(HttpStatus.GONE);
      return INVALID_INVITATION;
    }

    setSessionCookie(res, result.session.id, new Date(result.session.expiresAt));
    res.status(HttpStatus.CREATED);
    return result.user;
  }
}

function toSummary(invitation: {
  id: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'CANCELLED' | 'SUPERSEDED';
  invitedBy: string;
  createdAt: string;
  expiresAt: string;
}): InvitationSummary {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedBy: invitation.invitedBy,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
  };
}
